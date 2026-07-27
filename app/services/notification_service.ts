import { DateTime } from 'luxon'
import NotificationSchedule from '#models/notification_schedule'
import NotificationTemplate from '#models/notification_template'
import NotificationItem from '#models/notification_item'
import NotificationLog from '#models/notification_log'
import LineGroup from '#models/line_group'
import LineApiService, { type LineApiResult, type LineMessage } from '#services/line_api_service'
import FlexBuilderService from '#services/flex_builder_service'
import type { BuildContext } from '#types/flex_design'
import HisManager from '#services/his_manager'
import ScheduleCalculator from '#services/schedule_calculator'
import SettingsService from '#services/settings_service'
import logger from '@adonisjs/core/services/logger'

const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
// Luxon isoWeekday: 1=Mon … 7=Sun
const THAI_WEEKDAY = ['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์']

function buildSystemPlaceholders(now: DateTime): Record<string, string> {
  const m = now.month - 1
  const w = now.weekday - 1
  return {
    date:     now.toFormat('yyyy-MM-dd'),
    time:     now.toFormat('HH:mm:ss'),
    date_th:  `${now.day} ${THAI_MONTHS[m]} ${now.year + 543}`,
    weekday:  `วัน${THAI_WEEKDAY[w]}`,
  }
}

export interface ItemData {
  itemName: string
  itemKey: string
  data: Record<string, unknown>
  /** มีเฉพาะ item ที่ result_mode = 'rows' — แถวดิบสำหรับบล็อกตาราง Flex */
  rows?: Record<string, unknown>[]
  error?: string
}

export interface PayloadResult {
  messageType: 'text' | 'flex'
  messages: LineMessage[]
  /** ข้อความที่ลง notification_logs.message_content — flex ใช้ altText */
  logText: string
  warnings: string[]
}

export interface SendResult {
  success: boolean
  message: string
  warnings: string[]
  itemsData: ItemData[]
  results: Array<{
    groupId: number
    groupName: string
    line: LineApiResult
  }>
}

/**
 * NotificationService — port of app/controllers/NotificationController.php.
 *
 * Loads a schedule, fetches each item's data from HIS, substitutes
 * placeholders into the template, then pushes the message to every
 * configured LINE group and writes one notification_logs row per send.
 */
export default class NotificationService {
  static TZ = ScheduleCalculator.TZ

  /**
   * Fetch a single item's row by running its SQL on the configured
   * HIS connection with `{date}` substituted.
   */
  static async fetchItemData(itemId: number, date?: string): Promise<ItemData | null> {
    const item = await NotificationItem.find(itemId)
    if (!item || !item.isActive) return null

    const targetDate = date ?? DateTime.now().setZone(this.TZ).toFormat('yyyy-MM-dd')

    try {
      const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? targetDate : ''
      if (!safeDate) throw new Error(`Invalid date: ${targetDate}`)

      const sql = item.sqlQuery.replace(/\{date\}/g, safeDate)
      const db = item.hisDatabase || 'hos'

      const mode = item.resultMode ?? 'single'

      if (mode === 'rows') {
        const rows = (await HisManager.query(db, sql, [])) as Record<string, unknown>[]
        return {
          itemName: item.itemName,
          itemKey: item.itemKey,
          // เทมเพลต text ที่อ้าง item โหมดนี้ได้ข้อความบอกจำนวนแถวแทน [object Object]
          data: { [item.itemKey]: `${rows.length} รายการ` },
          rows,
        }
      }

      if (mode === 'joined') {
        const rows = await HisManager.query(db, sql, [])
        const sep = (item.rowSeparator ?? '\\n').replace(/\\n/g, '\n').replace(/\\t/g, '\t')
        const lines = rows.map((row) => {
          let line = item.rowTemplate ?? ''
          for (const [k, v] of Object.entries(row)) {
            line = line.replace(new RegExp(`\\{${k}\\}`, 'g'), v == null ? '' : String(v))
          }
          return line
        })
        return {
          itemName: item.itemName,
          itemKey: item.itemKey,
          data: { [item.itemKey]: lines.join(sep) || '—' },
        }
      }

      const row = await HisManager.queryFirst(db, sql, [])
      return {
        itemName: item.itemName,
        itemKey: item.itemKey,
        data: row ?? {},
      }
    } catch (err: any) {
      logger.warn({ err, itemId }, 'fetchItemData failed')
      return {
        itemName: item.itemName,
        itemKey: item.itemKey,
        data: {},
        error: err?.message ?? String(err),
      }
    }
  }

  /** แผนที่ค่าตัวแปรทั้งหมด — ระบบ + ข้อมูลจาก item */
  private static async buildPlaceholders(
    itemsData: ItemData[]
  ): Promise<Record<string, string>> {
    const now = DateTime.now().setZone(this.TZ)
    const [orgName, siteTitle, siteFooter] = await Promise.all([
      SettingsService.get('org_name', ''),
      SettingsService.get('site_title', ''),
      SettingsService.get('site_footer', ''),
    ])

    const map: Record<string, string> = buildSystemPlaceholders(now)
    map['org_name'] = orgName
    map['site_title'] = siteTitle
    map['site_footer'] = siteFooter

    for (const item of itemsData) {
      if (item.error) {
        map[item.itemKey] = 'ERROR'
        continue
      }
      for (const [k, v] of Object.entries(item.data)) {
        map[k] = v == null ? '0' : String(v)
      }
      // Fallback: {item_key} → ค่าคอลัมน์เดียว
      const vals = Object.values(item.data)
      if (vals.length === 1 && map[item.itemKey] === undefined) {
        map[item.itemKey] = vals[0] == null ? '0' : String(vals[0])
      }
    }

    return map
  }

  private static buildTables(itemsData: ItemData[]): BuildContext['tables'] {
    const tables: BuildContext['tables'] = {}
    for (const item of itemsData) {
      if (item.rows) tables[item.itemKey] = item.rows
    }
    return tables
  }

  private static substituteAll(
    template: string,
    placeholders: Record<string, string>
  ): string {
    let out = template
    for (const [k, v] of Object.entries(placeholders)) {
      out = out.replace(new RegExp(`\\{${escapeRe(k)}\\}`, 'g'), v)
    }
    return out
  }

  /**
   * ประกอบ payload ที่พร้อมส่ง — เลือกเส้นทาง text หรือ flex ตามเทมเพลต
   *
   * ถ้าคอมไพล์ Flex ล้มเหลว จะถอยไปส่งข้อความธรรมดาแทนเสมอ
   * เพราะการแจ้งเตือนต้องถึงมือคนรับ ดีกว่าเงียบหายเพราะดีไซน์พัง
   */
  static async buildPayload(templateId: number, itemsData: ItemData[]): Promise<PayloadResult> {
    const template = await NotificationTemplate.find(templateId)
    if (!template) throw new Error('Template not found')

    const placeholders = await this.buildPlaceholders(itemsData)

    const asText = (): PayloadResult => {
      const text = this.substituteAll(template.templateContent, placeholders)
      return { messageType: 'text', messages: [{ type: 'text', text }], logText: text, warnings: [] }
    }

    if (template.messageType !== 'flex' || !template.flexDesign) {
      return asText()
    }

    const ctx: BuildContext = { placeholders, tables: this.buildTables(itemsData) }

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
        warnings: built.warnings,
      }
    } catch (err: any) {
      logger.warn({ err, templateId }, 'flex build failed, falling back to plain text')

      let text = ''
      try {
        text = FlexBuilderService.buildPlainText(template.flexDesign, ctx).trim()
      } catch {
        text = ''
      }
      if (!text) text = this.substituteAll(template.templateContent, placeholders)

      return {
        messageType: 'text',
        messages: [{ type: 'text', text }],
        logText: text,
        warnings: [`คอมไพล์ Flex ล้มเหลว ส่งเป็นข้อความธรรมดาแทน: ${err?.message ?? err}`],
      }
    }
  }

  /**
   * Send a single schedule. Mirrors PHP NotificationController::sendNotification.
   * When `force=true`, all day/time gates are bypassed (used by test send).
   */
  static async sendNotification(scheduleId: number, force = false): Promise<SendResult> {
    const schedule = await NotificationSchedule.find(scheduleId)
    if (!schedule || !schedule.isActive) {
      throw new Error('Schedule not found or inactive')
    }

    const now = DateTime.now().setZone(this.TZ)
    const today = now.toFormat('yyyy-MM-dd')
    const currentTime = now.toFormat('HH:mm:ss')
    const isRepeat = schedule.repeatEnabled

    if (!force && !isRepeat && schedule.lastSentDate?.toFormat('yyyy-MM-dd') === today) {
      throw new Error('Already sent today')
    }

    if (!force) {
      const mode = schedule.scheduleMode || 'weekly'
      if (mode === 'specific') {
        if (!schedule.specificDates?.includes(today)) {
          throw new Error('Today not in specific_dates list')
        }
      } else {
        const dow = ScheduleCalculator.todayDow()
        const allowed = String(schedule.daysOfWeek ?? '')
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
        if (!allowed.includes(dow)) {
          throw new Error('Not scheduled for today')
        }
      }

      if (!isRepeat && currentTime < schedule.sendTime) {
        throw new Error('Not yet time to send')
      }
      if (isRepeat && schedule.repeatEndTime && currentTime > schedule.repeatEndTime) {
        throw new Error('Past repeat_end_time for today')
      }
    }

    // ---- Load template & auto-detect items from its variables ----
    if (!schedule.templateId) throw new Error('Schedule has no template')
    const tpl = await NotificationTemplate.find(schedule.templateId)
    if (!tpl) throw new Error('Template not found')

    const itemsData: ItemData[] = []
    // เทมเพลต flex ดึงตัวแปรสด ๆ จากนิยามบล็อก เพราะคอลัมน์ variables จะถูกเติม
    // ให้ถูกต้องตอนบันทึกผ่าน UI ซึ่งยังไม่มีในเฟสนี้
    const tplVars: string[] =
      tpl.messageType === 'flex' && tpl.flexDesign
        ? FlexBuilderService.extractVariables(tpl.flexDesign, tpl.altText ?? undefined)
        : (tpl.variables ?? [])
    if (tplVars.length > 0) {
      const matchingItems = await NotificationItem.query()
        .whereIn('item_key', tplVars)
        .where('is_active', 1)
      for (const item of matchingItems) {
        const data = await this.fetchItemData(item.id, today)
        if (data) itemsData.push(data)
      }
    }
    const payload = await this.buildPayload(schedule.templateId, itemsData)
    const message = payload.logText

    // ---- Send to each active group ----
    const groupIds = (schedule.groupIds ?? []).map(Number)
    const groups = groupIds.length === 0
      ? []
      : await LineGroup.query().whereIn('id', groupIds).where('is_active', 1)

    const results: SendResult['results'] = []
    for (const group of groups) {
      const line = await LineApiService.sendPayload(
        { apiUrl: group.apiUrl, clientKey: group.clientKey, secretKey: group.secretKey },
        payload.messages
      )

      try {
        const log = new NotificationLog()
        log.scheduleId = scheduleId
        log.groupId = group.id
        log.templateId = schedule.templateId
        log.messageType = payload.messageType
        log.statusCode = line.code
        log.apiStatus = line.apiStatus
        log.responseText = line.response?.slice(0, 65_535) ?? null
        log.messageContent = message
        log.payloadJson = JSON.stringify(payload.messages)
        await log.save()
      } catch (err) {
        logger.warn({ err }, 'failed to write notification_log row')
      }

      results.push({ groupId: group.id, groupName: group.groupName, line })
    }

    if (results.length > 0 && !force) {
      schedule.lastSentDate = now.startOf('day')
      try { await schedule.save() } catch (err) { logger.warn({ err }, 'failed to update last_sent_date') }
    }

    return {
      success: results.length > 0 && results.some((r) => r.line.success),
      message,
      warnings: payload.warnings,
      itemsData,
      results,
    }
  }

  /**
   * Manual test-send to a specific group with a custom message.
   * Always force=true (skips schedule gating).
   */
  static async sendTest(groupId: number, message?: string): Promise<{ success: boolean; message: string; line: LineApiResult }> {
    const group = await LineGroup.find(groupId)
    if (!group || !group.isActive) throw new Error('Group not found or inactive')

    const now = DateTime.now().setZone(this.TZ)
    const finalMsg = message?.trim() || [
      'ทดสอบการส่งข้อความ',
      `วันที่: ${now.toFormat('yyyy-MM-dd')}`,
      `เวลา: ${now.toFormat('HH:mm:ss')}`,
      'จากระบบ Line Notification',
    ].join('\n')

    const line = await LineApiService.sendMessage(
      { apiUrl: group.apiUrl, clientKey: group.clientKey, secretKey: group.secretKey },
      finalMsg
    )

    try {
      const log = new NotificationLog()
      log.groupId = group.id
      log.messageType = 'text'
      log.statusCode = line.code
      log.apiStatus = line.apiStatus
      log.responseText = line.response?.slice(0, 65_535) ?? null
      log.messageContent = finalMsg
      await log.save()
    } catch (err) {
      logger.warn({ err }, 'failed to write test-send notification_log row')
    }

    return { success: line.success, message: finalMsg, line }
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
