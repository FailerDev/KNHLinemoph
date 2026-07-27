import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import CdcuWatchGroup from '#models/cdcu_watch_group'
import NotificationTemplate from '#models/notification_template'
import LineGroup from '#models/line_group'
import HisManager from '#services/his_manager'
import LineApiService, { type LineMessage } from '#services/line_api_service'
import FlexBuilderService from '#services/flex_builder_service'
import SettingsService from '#services/settings_service'
import type { BuildContext } from '#types/flex_design'

interface CdcuPayload {
  messageType: 'text' | 'flex'
  messages: LineMessage[]
  /** ข้อความที่ลง cdcu_sent_logs.message_content — flex ใช้ altText */
  logText: string
}

const TZ = 'Asia/Bangkok'
const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const THAI_WEEKDAY = ['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์']

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const THAI_PREFIXES = ['นางสาว', 'เด็กชาย', 'เด็กหญิง', 'นาง', 'นาย', 'ด.ช.', 'ด.ญ.']

// Mask the middle portion of a word, keeping the last ~half as grapheme clusters.
// e.g. "สุขสันต์" → "xxxสันต์", "ตะภา" → "xxxภา"
function maskWord(word: string): string {
  if (!word) return word
  const seg = new Intl.Segmenter('th', { granularity: 'grapheme' })
  const graphemes = [...seg.segment(word)].map((s) => s.segment)
  if (graphemes.length <= 2) return word
  const keepCount = Math.ceil(graphemes.length / 2)
  return 'xxx' + graphemes.slice(graphemes.length - keepCount).join('')
}

// Mask patient full name while keeping title prefix.
// "นายสุขสันต์ ตะภา" → "นายxxxสันต์ xxxภา"
function maskPatientName(fullName: string): string {
  if (!fullName?.trim()) return fullName
  let prefix = ''
  let rest = fullName.trim()
  for (const p of THAI_PREFIXES) {
    if (rest.startsWith(p)) { prefix = p; rest = rest.slice(p.length); break }
  }
  const spaceIdx = rest.indexOf(' ')
  const fname = spaceIdx >= 0 ? rest.slice(0, spaceIdx) : rest
  const lname = spaceIdx >= 0 ? rest.slice(spaceIdx + 1) : ''
  return prefix + maskWord(fname) + (lname ? ' ' + maskWord(lname) : '')
}

function toThaiDate(date: string): string {
  const parts = date.split('-')
  if (parts.length !== 3) return date
  const [year, month, day] = parts
  return `${day}/${month}/${parseInt(year, 10) + 543}`
}

function formatVitals(val: unknown): string {
  const n = Number(val)
  return Number.isFinite(n) && n > 0 ? n.toFixed(1).replace(/\.0$/, '') : ''
}

// Build the HIS query for a given set of ICD-10 codes.
// Uses `?` placeholders — never interpolates codes directly into SQL.
function buildHisQuery(icd10Count: number): string {
  const inClause = Array.from({ length: icd10Count }, () => '?').join(',')
  return `
    SELECT
      d.vn, d.hn, d.vstdate, d.vsttime, d.icd10,
      COALESCE(i.name, d.icd10) AS icd10_name,
      COALESCE(d.dx_code_note, '') AS dx_code_note,
      COALESCE(d.diagtype, '') AS diagtype,
      CONCAT(COALESCE(p.pname,''), COALESCE(p.fname,''), ' ', COALESCE(p.lname,'')) AS pt_name,
      (YEAR(CURDATE()) - YEAR(p.birthday)) AS age,
      COALESCE(pe.temperature, 0) AS temperature,
      COALESCE(pe.pulse, 0) AS pulse,
      COALESCE(pe.rr, 0) AS rr,
      COALESCE(pe.bps, 0) AS bps,
      COALESCE(pe.bpd, 0) AS bpd,
      COALESCE(GROUP_CONCAT(DISTINCT cc.entry_cc_data ORDER BY cc.entry_cc_data SEPARATOR ', '), '') AS cc,
      COALESCE(p.hometel, '') AS hometel,
      COALESCE(p.informtel, '') AS informtel,
      COALESCE(p.informaddr, '') AS informaddr
    FROM ovstdiag d
    LEFT JOIN patient p ON p.hn = d.hn
    LEFT JOIN icd101 i ON i.code = d.icd10
    LEFT JOIN opdscreen_cc_history cc ON cc.vn = d.vn
    LEFT JOIN opdscreen pe ON pe.vn = d.vn
    WHERE d.vstdate = ?
      AND d.icd10 IN (${inClause})
    GROUP BY d.vn, d.icd10
    ORDER BY d.vn ASC
  `
}

class CdcuServiceImpl {
  /**
   * Run CDCU surveillance for all active watch groups.
   * Called by CronService on every tick.
   * Returns the number of LINE messages sent.
   */
  async runOnce(
    log: (m: string, lv?: 'info' | 'warning' | 'error') => Promise<void>,
    today: string,
    currentDay: number
  ): Promise<number> {
    const watchGroups = await CdcuWatchGroup.query().where('is_active', 1)
    if (watchGroups.length === 0) return 0

    let totalSent = 0

    for (const wg of watchGroups) {
      try {
        // Day-of-week gate (same 1=Sun…7=Sat convention as ScheduleCalculator)
        const days = String(wg.daysOfWeek ?? '1,2,3,4,5,6,7')
          .split(',')
          .map((n) => parseInt(n.trim(), 10))
          .filter((n) => n >= 1 && n <= 7)
        if (!days.includes(currentDay)) continue

        const icd10Codes = (wg.icd10Codes ?? []).map((c) => String(c).trim()).filter(Boolean)
        if (icd10Codes.length === 0) {
          await log(`  [CDCU] "${wg.groupName}" — ไม่มี ICD-10 codes`, 'warning')
          continue
        }

        // Query HIS
        const sql = buildHisQuery(icd10Codes.length)
        const rows = await HisManager.query(wg.hisDatabase || 'hos', sql, [today, ...icd10Codes])

        if (rows.length === 0) continue

        // Load already-sent VN+ICD10 combos for this watch group today
        const sentRows = await db
          .from('cdcu_sent_logs')
          .where('watch_group_id', wg.id)
          .whereRaw('DATE(sent_at) = ?', [today])
          .select('vn', 'icd10')

        const sentKeys = new Set(sentRows.map((r: any) => `${r.vn}|${r.icd10}`))
        const newPatients = rows.filter((r) => !sentKeys.has(`${r.vn}|${r.icd10}`))

        if (newPatients.length === 0) continue

        // Load LINE groups
        const lineGroupIds = (wg.lineGroupIds ?? []).map(Number).filter(Boolean)
        if (lineGroupIds.length === 0) {
          await log(`  [CDCU] "${wg.groupName}" — ไม่มี LINE groups`, 'warning')
          continue
        }
        const lineGroups = await LineGroup.query()
          .whereIn('id', lineGroupIds)
          .where('is_active', 1)

        if (lineGroups.length === 0) continue

        await log(`[CDCU] "${wg.groupName}": พบผู้ป่วยใหม่ ${newPatients.length} ราย`)

        const orgName = await SettingsService.get('org_name', '')

        for (const raw of newPatients) {
          const patient: Record<string, unknown> = {
            ...raw,
            vstdate_th: toThaiDate(String(raw.vstdate ?? '')),
            temperature: formatVitals(raw.temperature),
            pulse: formatVitals(raw.pulse),
            rr: formatVitals(raw.rr),
            bps: formatVitals(raw.bps),
            bpd: formatVitals(raw.bpd),
          }
          if (wg.maskName && patient.pt_name) {
            patient.pt_name = maskPatientName(String(patient.pt_name))
          }

          let payload: CdcuPayload
          try {
            payload = await this.buildPayload(wg.templateId, patient, orgName)
          } catch (err: any) {
            const text = this.buildDefaultMessage(patient, orgName)
            payload = { messageType: 'text', messages: [{ type: 'text', text }], logText: text }
            await log(`  ⚠ buildPayload error (wg ${wg.id}): ${err?.message ?? err}`, 'warning')
          }

          for (const lineGroup of lineGroups) {
            const result = await LineApiService.sendPayload(
              { apiUrl: lineGroup.apiUrl, clientKey: lineGroup.clientKey, secretKey: lineGroup.secretKey },
              payload.messages
            )

            try {
              await db.table('cdcu_sent_logs').insert({
                watch_group_id: wg.id,
                vn: String(raw.vn),
                icd10: String(raw.icd10),
                hn: raw.hn ? String(raw.hn) : null,
                pt_name: raw.pt_name ? String(raw.pt_name) : null,
                line_group_id: lineGroup.id,
                status_code: result.code,
                message_content: payload.logText.slice(0, 65_535),
              })
            } catch (err: any) {
              // ON DUPLICATE KEY — already sent this combo, ignore
              if (!String(err?.message ?? '').includes('Duplicate')) {
                logger.warn({ err }, 'cdcu_sent_logs insert failed')
              }
            }

            const icon = result.success ? '✓' : '✗'
            await log(
              `  ${icon} ${raw.pt_name} (HN:${raw.hn}, ICD:${raw.icd10}) → ${lineGroup.groupName} [${result.code}]`,
              result.success ? 'info' : 'warning'
            )
            totalSent++
          }
        }
      } catch (err: any) {
        await log(`[CDCU] Error in watch group "${wg.groupName}" (ID:${wg.id}): ${err?.message ?? err}`, 'error')
        logger.error({ err, watchGroupId: wg.id }, 'cdcu watch group error')
      }
    }

    return totalSent
  }

  /**
   * Force-run a single watch group regardless of time/day gates.
   * Used by the UI "ทดสอบรัน" button.
   */
  async runGroup(watchGroupId: number, today: string): Promise<{
    sent: number
    patients: number
    message: string
  }> {
    const wg = await CdcuWatchGroup.find(watchGroupId)
    if (!wg) throw new Error('Watch group not found')

    const icd10Codes = (wg.icd10Codes ?? []).map((c) => String(c).trim()).filter(Boolean)
    if (icd10Codes.length === 0) throw new Error('ไม่มี ICD-10 codes ที่กำหนด')

    const sql = buildHisQuery(icd10Codes.length)
    const rows = await HisManager.query(wg.hisDatabase || 'hos', sql, [today, ...icd10Codes])

    const sentRows = await db
      .from('cdcu_sent_logs')
      .where('watch_group_id', wg.id)
      .whereRaw('DATE(sent_at) = ?', [today])
      .select('vn', 'icd10')
    const sentKeys = new Set(sentRows.map((r: any) => `${r.vn}|${r.icd10}`))
    const newPatients = rows.filter((r) => !sentKeys.has(`${r.vn}|${r.icd10}`))

    const lineGroupIds = (wg.lineGroupIds ?? []).map(Number).filter(Boolean)
    const lineGroups = lineGroupIds.length
      ? await LineGroup.query().whereIn('id', lineGroupIds).where('is_active', 1)
      : []

    const orgName = await SettingsService.get('org_name', '')

    let sent = 0
    for (const raw of newPatients) {
      const patient: Record<string, unknown> = {
        ...raw,
        vstdate_th: toThaiDate(String(raw.vstdate ?? '')),
        temperature: formatVitals(raw.temperature),
        pulse: formatVitals(raw.pulse),
        rr: formatVitals(raw.rr),
        bps: formatVitals(raw.bps),
        bpd: formatVitals(raw.bpd),
      }
      if (wg.maskName && patient.pt_name) {
        patient.pt_name = maskPatientName(String(patient.pt_name))
      }
      const payload = await this.buildPayload(wg.templateId, patient, orgName)

      for (const lineGroup of lineGroups) {
        const result = await LineApiService.sendPayload(
          { apiUrl: lineGroup.apiUrl, clientKey: lineGroup.clientKey, secretKey: lineGroup.secretKey },
          payload.messages
        )
        try {
          await db.table('cdcu_sent_logs').insert({
            watch_group_id: wg.id,
            vn: String(raw.vn),
            icd10: String(raw.icd10),
            hn: raw.hn ? String(raw.hn) : null,
            pt_name: raw.pt_name ? String(raw.pt_name) : null,
            line_group_id: lineGroup.id,
            status_code: result.code,
            message_content: payload.logText.slice(0, 65_535),
          })
        } catch { /* duplicate — skip */ }
        sent++
      }
    }

    return {
      sent,
      patients: newPatients.length,
      message: `พบผู้ป่วยวันนี้ ${rows.length} ราย, ใหม่ ${newPatients.length} ราย, ส่งแล้ว ${sent} ครั้ง`,
    }
  }

  /**
   * ประกอบ payload ที่พร้อมส่งให้ผู้ป่วยรายหนึ่ง — เลือกเส้นทาง text/flex ตามเทมเพลต
   *
   * patient ต้องถูก mask ชื่อ (ถ้าเปิด mask_name) มาก่อนเรียกฟังก์ชันนี้แล้ว เพราะ
   * ค่าที่ส่งเข้ามาจะกลายเป็น placeholder โดยตรงไม่ว่าจะไปโผล่ในบล็อกไหนของ Flex
   *
   * ถ้าคอมไพล์ Flex ล้มเหลว จะถอยไปส่งข้อความธรรมดาแทนเสมอ เพราะการแจ้งเตือน
   * ผู้ป่วยเฝ้าระวังต้องถึงมือคนรับ ดีกว่าเงียบหายเพราะดีไซน์พัง
   */
  private async buildPayload(
    templateId: number | null,
    patient: Record<string, unknown>,
    orgName: string
  ): Promise<CdcuPayload> {
    if (!templateId) {
      const text = this.buildDefaultMessage(patient, orgName)
      return { messageType: 'text', messages: [{ type: 'text', text }], logText: text }
    }

    const template = await NotificationTemplate.find(templateId)
    if (!template) {
      const text = this.buildDefaultMessage(patient, orgName)
      return { messageType: 'text', messages: [{ type: 'text', text }], logText: text }
    }

    const now = DateTime.now().setZone(TZ)
    const [siteTitle, siteFooter] = await Promise.all([
      SettingsService.get('site_title', ''),
      SettingsService.get('site_footer', ''),
    ])

    const m = now.month - 1
    const w = now.weekday - 1
    const placeholders: Record<string, string> = {
      date:        now.toFormat('yyyy-MM-dd'),
      time:        now.toFormat('HH:mm:ss'),
      date_th:     `${now.day} ${THAI_MONTHS[m]} ${now.year + 543}`,
      weekday:     `วัน${THAI_WEEKDAY[w]}`,
      org_name:    orgName,
      site_title:  siteTitle,
      site_footer: siteFooter,
    }
    for (const [k, v] of Object.entries(patient)) {
      placeholders[k] = v == null ? '' : String(v)
    }

    const asText = (): CdcuPayload => {
      let text = template.templateContent
      for (const [k, v] of Object.entries(placeholders)) {
        text = text.replace(new RegExp(`\\{${escapeRe(k)}\\}`, 'g'), v)
      }
      return { messageType: 'text', messages: [{ type: 'text', text }], logText: text }
    }

    if (template.messageType !== 'flex' || !template.flexDesign) {
      return asText()
    }

    // CDCU ไม่มี notification_items ให้ query จึงไม่มีข้อมูลตารางป้อนบล็อก table
    const ctx: BuildContext = { placeholders, tables: {} }

    try {
      const built = FlexBuilderService.build(
        template.flexDesign,
        template.altText || template.templateName,
        ctx
      )
      return {
        messageType: 'flex',
        messages: [{ type: 'flex', altText: built.altText, contents: built.contents }],
        logText: built.altText,
      }
    } catch (err: any) {
      logger.warn({ err, templateId }, 'cdcu flex build failed, falling back to plain text')

      let text = ''
      try {
        text = FlexBuilderService.buildPlainText(template.flexDesign, ctx).trim()
      } catch {
        text = ''
      }
      if (!text) text = asText().logText

      return { messageType: 'text', messages: [{ type: 'text', text }], logText: text }
    }
  }

  private buildDefaultMessage(p: Record<string, unknown>, orgName = ''): string {
    const lines: string[] = [
      `แจ้งเตือน CDCU ${orgName}`,
      `DX: ${p.icd10} ${p.icd10_name ?? ''}`.trim(),
      `วันที่: ${p.vstdate_th}  เวลา: ${p.vsttime}`,
      `HN: ${p.hn}  ชื่อ: ${p.pt_name}  อายุ: ${p.age} ปี`,
    ]
    if (p.dx_code_note) lines.push(`DX Note: ${p.dx_code_note}`)
    if (p.cc) lines.push(`CC: ${p.cc}`)

    const vitals = [
      p.temperature ? `อุณหภูมิ: ${p.temperature}` : '',
      p.pulse       ? `ชีพจร: ${p.pulse}`          : '',
      p.rr          ? `หายใจ: ${p.rr}`             : '',
      p.bps && p.bpd ? `ความดัน: ${p.bps}/${p.bpd}` : '',
    ].filter(Boolean).join('  ')
    if (vitals) lines.push(vitals)

    if (p.hometel)    lines.push(`Tel: ${p.hometel}`)
    if (p.informaddr) lines.push(`ที่อยู่: ${p.informaddr}`)
    lines.push(`VN: ${p.vn}`)

    return lines.join('\n')
  }
}

const CdcuService = new CdcuServiceImpl()
export default CdcuService
