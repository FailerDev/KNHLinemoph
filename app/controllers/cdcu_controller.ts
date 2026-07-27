import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import CdcuWatchGroup from '#models/cdcu_watch_group'
import NotificationTemplate from '#models/notification_template'
import LineGroup from '#models/line_group'
import HisDatabase from '#models/his_database'
import CdcuService from '#services/cdcu_service'

const TZ = 'Asia/Bangkok'

export default class CdcuController {
  async index({ view }: HttpContext) {
    const [watchGroups, templates, lineGroups, hisDbs] = await Promise.all([
      CdcuWatchGroup.query().orderBy('id', 'asc'),
      NotificationTemplate.query().where('is_active', 1).orderBy('template_name', 'asc'),
      LineGroup.query().where('is_active', 1).orderBy('group_name', 'asc'),
      HisDatabase.query().where('is_active', 1).orderBy('name', 'asc'),
    ])

    const today = DateTime.now().setZone(TZ).toFormat('yyyy-MM-dd')

    const sentToday = await db
      .from('cdcu_sent_logs')
      .whereRaw('DATE(sent_at) = ?', [today])
      .count('* as total')
      .first()

    const lineGroupMap = new Map(lineGroups.map((g) => [g.id, g.groupName]))
    const templateMap  = new Map(templates.map((t) => [t.id, { name: t.templateName, messageType: t.messageType }]))

    const rows = watchGroups.map((wg) => ({
      id:            wg.id,
      group_name:    wg.groupName,
      icd10_codes:   wg.icd10Codes,
      template_id:   wg.templateId,
      template_name: wg.templateId ? (templateMap.get(wg.templateId)?.name ?? null) : null,
      template_message_type: wg.templateId ? (templateMap.get(wg.templateId)?.messageType ?? 'text') : null,
      line_group_ids: wg.lineGroupIds,
      line_group_names: (wg.lineGroupIds ?? []).map((id) => lineGroupMap.get(Number(id)) ?? `#${id}`),
      his_database:  wg.hisDatabase,
      days_of_week:  wg.daysOfWeek,
      description:   wg.description,
      is_active:     wg.isActive,
      mask_name:     wg.maskName,
    }))

    return view.render('pages/cdcu', {
      title: 'CDCU เฝ้าระวังโรค',
      watchGroups: rows,
      templates: templates.map((t) => ({ id: t.id, name: t.templateName, message_type: t.messageType })),
      lineGroups: lineGroups.map((g) => ({ id: g.id, name: g.groupName })),
      hisDbs: hisDbs.map((h) => ({ name: h.name })),
      sentToday: Number((sentToday as any)?.total ?? 0),
      today,
    })
  }

  async save({ request, response }: HttpContext) {
    const id          = Number(request.input('id', 0))
    const groupName   = String(request.input('group_name', '')).trim()
    const icd10Raw    = String(request.input('icd10_codes', ''))
    const templateId  = request.input('template_id') ? Number(request.input('template_id')) : null
    const lineIds     = (request.input('line_group_ids') as string[] | string | undefined)
    const hisDb       = String(request.input('his_database', 'hos')).trim() || 'hos'
    const daysOfWeek  = String(request.input('days_of_week', '1,2,3,4,5,6,7')).trim()
    const description = String(request.input('description', '')).trim() || null
    const isActive    = request.input('is_active') !== '0'
    const maskName    = request.input('mask_name') === '1' || request.input('mask_name') === true

    if (!groupName) {
      return response.json({ success: false, message: 'กรุณาระบุชื่อกลุ่ม' })
    }

    // Parse ICD-10 codes — one per line or comma-separated
    const icd10Codes = icd10Raw
      .split(/[\n,]+/)
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length > 0)

    if (icd10Codes.length === 0) {
      return response.json({ success: false, message: 'กรุณาระบุ ICD-10 codes อย่างน้อย 1 รายการ' })
    }

    // Normalize line_group_ids to number[]
    const lineGroupIds: number[] = Array.isArray(lineIds)
      ? lineIds.map(Number).filter(Boolean)
      : lineIds
      ? String(lineIds).split(',').map(Number).filter(Boolean)
      : []

    const wg = id ? (await CdcuWatchGroup.find(id)) ?? new CdcuWatchGroup() : new CdcuWatchGroup()
    wg.groupName    = groupName
    wg.icd10Codes   = icd10Codes
    wg.templateId   = templateId
    wg.lineGroupIds = lineGroupIds
    wg.hisDatabase  = hisDb
    wg.daysOfWeek   = daysOfWeek
    wg.description  = description
    wg.isActive     = isActive
    wg.maskName     = maskName

    await wg.save()
    return response.json({ success: true, message: id ? 'แก้ไขสำเร็จ' : 'เพิ่มสำเร็จ', id: wg.id })
  }

  async delete({ request, response }: HttpContext) {
    const id = Number(request.input('id', 0))
    const wg = id ? await CdcuWatchGroup.find(id) : null
    if (!wg) return response.json({ success: false, message: 'ไม่พบข้อมูล' })
    await wg.delete()
    return response.json({ success: true, message: 'ลบสำเร็จ' })
  }

  async toggle({ request, response }: HttpContext) {
    const id = Number(request.input('id', 0))
    const wg = id ? await CdcuWatchGroup.find(id) : null
    if (!wg) return response.json({ success: false, message: 'ไม่พบข้อมูล' })
    wg.isActive = !wg.isActive
    await wg.save()
    return response.json({ success: true, is_active: wg.isActive })
  }

  async get({ request, response }: HttpContext) {
    const id = Number(request.input('id', 0))
    const wg = id ? await CdcuWatchGroup.find(id) : null
    if (!wg) return response.json({ success: false, message: 'ไม่พบข้อมูล' })
    return response.json({
      success: true,
      data: {
        id:             wg.id,
        group_name:     wg.groupName,
        icd10_codes:    wg.icd10Codes,
        template_id:    wg.templateId,
        line_group_ids: wg.lineGroupIds,
        his_database:   wg.hisDatabase,
        days_of_week:   wg.daysOfWeek,
        description:    wg.description,
        is_active:      wg.isActive,
        mask_name:      wg.maskName,
      },
    })
  }

  async logs({ request, response }: HttpContext) {
    const watchGroupId = Number(request.input('watch_group_id', 0))
    const date = String(request.input('date', DateTime.now().setZone(TZ).toFormat('yyyy-MM-dd')))

    const query = db
      .from('cdcu_sent_logs as sl')
      .leftJoin('cdcu_watch_groups as wg', 'wg.id', 'sl.watch_group_id')
      .leftJoin('line_groups as lg', 'lg.id', 'sl.line_group_id')
      .whereRaw('DATE(sl.sent_at) = ?', [date])
      .orderBy('sl.sent_at', 'desc')
      .limit(200)
      .select(
        'sl.id', 'sl.vn', 'sl.icd10', 'sl.hn', 'sl.pt_name',
        'sl.status_code', 'sl.sent_at',
        'wg.group_name as watch_group_name',
        'lg.group_name as line_group_name'
      )

    if (watchGroupId) query.where('sl.watch_group_id', watchGroupId)

    const logs = await query
    return response.json({ success: true, logs })
  }

  async run({ request, response }: HttpContext) {
    const id = Number(request.input('id', 0))
    if (!id) return response.json({ success: false, message: 'Invalid ID' })

    const today = DateTime.now().setZone(TZ).toFormat('yyyy-MM-dd')
    try {
      const result = await CdcuService.runGroup(id, today)
      return response.json({ success: true, ...result })
    } catch (err: any) {
      return response.json({ success: false, message: err?.message ?? String(err) })
    }
  }

  async clearLogs({ request, response }: HttpContext) {
    const days = Math.max(1, Number(request.input('days', 30)))
    const cutoff = DateTime.now().setZone(TZ).minus({ days }).toFormat('yyyy-MM-dd')
    const deleted = await db
      .from('cdcu_sent_logs')
      .whereRaw('DATE(sent_at) < ?', [cutoff])
      .delete() as unknown as number
    return response.json({ success: true, message: `ลบ ${deleted} รายการ (ก่อน ${cutoff})` })
  }
}
