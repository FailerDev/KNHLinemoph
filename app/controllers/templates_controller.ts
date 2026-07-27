import type { HttpContext } from '@adonisjs/core/http'
import NotificationTemplate from '#models/notification_template'
import NotificationItem from '#models/notification_item'
import LineGroup from '#models/line_group'
import AuditService from '#services/audit_service'
import LineApiService from '#services/line_api_service'
import FlexBuilderService from '#services/flex_builder_service'
import FlexPreviewService from '#services/flex_preview_service'
import { templateSaveValidator } from '#validators/template'
import { parseFlexDesign } from '#validators/flex_design'
import type { FlexDesign } from '#types/flex_design'

const SYSTEM_VARS = [
  'date', 'time', 'date_th', 'weekday', 'org_name', 'site_title', 'site_footer',
]

/** ป้ายภาษาไทยของตัวแปรระบบ — ใช้เติมตัวเลือกในหน้า builder */
const SYSTEM_VAR_LABELS: Record<string, string> = {
  date: 'วันที่ (YYYY-MM-DD)',
  time: 'เวลา (HH:mm:ss)',
  date_th: 'วันที่ภาษาไทย',
  weekday: 'วันในสัปดาห์',
  org_name: 'ชื่อโรงพยาบาล',
  site_title: 'ชื่อระบบ',
  site_footer: 'ท้ายข้อความ',
}

export default class TemplatesController {
  async index({ view }: HttpContext) {
    const [templates, items, groups] = await Promise.all([
      NotificationTemplate.query().orderBy('id', 'desc'),
      NotificationItem.query().where('is_active', 1),
      LineGroup.query().where('is_active', 1).orderBy('group_name', 'asc'),
    ])
    return view.render('pages/templates', {
      title: 'เทมเพลตข้อความ',
      templates: templates.map((t) => ({
        id: t.id,
        name: t.templateName,
        content: t.templateContent,
        message_type: t.messageType,
        flex_design: t.flexDesign,
        alt_text: t.altText ?? '',
        variables: t.variables ?? [],
        is_active: !!t.isActive,
      })),
      knownVars: [...SYSTEM_VARS, ...items.map((i) => i.itemKey)],
      itemVars: items.map((i) => ({
        key: i.itemKey,
        name: i.itemName,
        result_mode: i.resultMode,
      })),
      systemVars: SYSTEM_VARS.map((key) => ({ key, label: SYSTEM_VAR_LABELS[key] })),
      lineGroups: groups.map((g) => ({ id: g.id, name: g.groupName })),
    })
  }

  async save(ctx: HttpContext) {
    const { request, response } = ctx
    let payload
    try {
      payload = await request.validateUsing(templateSaveValidator)
    } catch (err: any) {
      return response.json({
        success: false,
        message: err?.messages?.[0]?.message ?? 'ข้อมูลไม่ถูกต้อง',
      })
    }

    const messageType = payload.message_type === 'flex' ? 'flex' : 'text'

    let content = payload.template_content ?? ''
    let vars: string[] = []
    let design: FlexDesign | null = null
    let altText: string | null = null

    if (messageType === 'flex') {
      try {
        design = await parseFlexDesign(request.input('flex_design', null))
      } catch (err: any) {
        return response.json({ success: false, message: describeDesignError(err) })
      }
      altText = (payload.alt_text ?? '').trim() || payload.template_name.trim()
      vars = FlexBuilderService.extractVariables(design, altText)
      // ข้อความสำรองสร้างอัตโนมัติจากนิยามบล็อก ผู้ใช้ไม่ต้องกรอกซ้ำ
      content = FlexBuilderService.buildPlainText(design).trim() || altText
    } else {
      if (!content.trim()) {
        return response.json({ success: false, message: 'กรุณากรอกเนื้อหาข้อความ' })
      }
      const matches = [...content.matchAll(/\{([a-zA-Z0-9_]+)\}/g)]
      vars = [...new Set(matches.map((m) => m[1]))]
    }

    const items = await NotificationItem.query().select('item_key').where('is_active', 1)
    const known = new Set([...SYSTEM_VARS, ...items.map((i) => i.itemKey)])
    const unknown = vars.filter((v) => !known.has(v))

    const idRaw = request.input('id', null)
    const id = idRaw && Number(idRaw) > 0 ? Number(idRaw) : null
    const isUpdate = id !== null

    const tpl = isUpdate
      ? ((await NotificationTemplate.find(id!)) ?? new NotificationTemplate())
      : new NotificationTemplate()
    const before = isUpdate && tpl.$isPersisted ? tpl.toJSON() : null

    tpl.templateName = payload.template_name.trim()
    tpl.templateContent = content
    tpl.messageType = messageType
    tpl.flexDesign = design
    tpl.altText = altText
    tpl.variables = vars
    tpl.isActive = !!payload.is_active

    try {
      await tpl.save()
    } catch (err: any) {
      return response.json({ success: false, message: 'บันทึกไม่สำเร็จ: ' + (err?.message ?? '') })
    }

    const desc = `Template '${tpl.templateName}' ${isUpdate ? 'updated' : 'created'}`
    if (isUpdate) await AuditService.recordUpdate(ctx, 'template', tpl.id, before, tpl.toJSON(), desc)
    else await AuditService.recordCreate(ctx, 'template', tpl.id, tpl.toJSON(), desc)

    let message = 'บันทึกเทมเพลตสำเร็จ'
    if (unknown.length > 0) {
      message += ` — ⚠ มีตัวแปรที่ไม่ตรงกับรายการข้อมูล: {${unknown.join('}, {')}}`
    }
    return response.json({ success: true, message, data: { id: tpl.id, unknown_vars: unknown } })
  }

  async delete(ctx: HttpContext) {
    const { request, response } = ctx
    const id = Number(request.input('id', 0))
    if (!id) return response.json({ success: false, message: 'Invalid ID' })

    const tpl = await NotificationTemplate.find(id)
    if (!tpl) return response.json({ success: false, message: 'ไม่พบเทมเพลต' })

    const snapshot = tpl.toJSON()
    const name = tpl.templateName
    try {
      await tpl.delete()
    } catch (err: any) {
      return response.json({ success: false, message: 'ลบไม่สำเร็จ: ' + (err?.message ?? '') })
    }
    await AuditService.recordDelete(ctx, 'template', id, snapshot, `Deleted '${name}'`)
    return response.json({ success: true, message: 'ลบสำเร็จ' })
  }

  /**
   * คอมไพล์นิยามบล็อกเป็น Flex bubble สำหรับหน้าตัวอย่าง
   *
   * server เป็นคนคอมไพล์เสมอ เบราว์เซอร์แค่วาดผลลัพธ์ จึงไม่มีทางที่
   * ตัวอย่างกับการ์ดที่ส่งจริงจะเพี้ยนกัน
   */
  async flexPreview({ request, response }: HttpContext) {
    let design: FlexDesign
    try {
      design = await parseFlexDesign(request.input('flex_design', null))
    } catch (err: any) {
      return response.json({ success: false, message: describeDesignError(err) })
    }

    const live = String(request.input('live', '')) === '1'
    const altText = String(request.input('alt_text', '') || 'ตัวอย่างการแจ้งเตือน')

    try {
      const ctx = await FlexPreviewService.buildContext(design, live)
      const built = FlexBuilderService.build(design, altText, ctx)
      return response.json({
        success: true,
        data: {
          altText: built.altText,
          contents: built.contents,
          bytes: built.bytes,
          warnings: built.warnings,
          plainText: FlexBuilderService.buildPlainText(design, ctx),
          live,
        },
      })
    } catch (err: any) {
      return response.json({
        success: false,
        message: err?.message ?? 'สร้างตัวอย่างไม่สำเร็จ',
      })
    }
  }

  /** ส่งการ์ดที่กำลังแก้ไขเข้าห้อง LINE จริง */
  async flexTestSend({ request, response }: HttpContext) {
    const groupId = Number(request.input('group_id', 0))
    if (!groupId) return response.json({ success: false, message: 'กรุณาเลือกกลุ่ม LINE' })

    const group = await LineGroup.find(groupId)
    if (!group || !group.isActive) {
      return response.json({ success: false, message: 'ไม่พบกลุ่ม LINE หรือกลุ่มถูกปิดใช้งาน' })
    }

    let design: FlexDesign
    try {
      design = await parseFlexDesign(request.input('flex_design', null))
    } catch (err: any) {
      return response.json({ success: false, message: describeDesignError(err) })
    }

    const altText = String(request.input('alt_text', '') || 'ทดสอบการแจ้งเตือน')

    try {
      const ctx = await FlexPreviewService.buildContext(design, true)
      const built = FlexBuilderService.build(design, altText, ctx)

      const line = await LineApiService.sendPayload(
        { apiUrl: group.apiUrl, clientKey: group.clientKey, secretKey: group.secretKey },
        [{ type: 'flex', altText: built.altText, contents: built.contents }]
      )

      if (!line.success) {
        const status = line.apiStatus !== null ? `, status ${line.apiStatus}` : ''
        return response.json({
          success: false,
          message: `ส่งไม่สำเร็จ (HTTP ${line.code}${status}) — ${line.response.slice(0, 200)}`,
        })
      }

      return response.json({
        success: true,
        message: `ส่งเข้ากลุ่ม '${group.groupName}' แล้ว — กรุณาเปิดแอป LINE ตรวจว่าการ์ดเข้าห้องจริง`,
        data: { warnings: built.warnings, bytes: built.bytes },
      })
    } catch (err: any) {
      return response.json({ success: false, message: err?.message ?? 'ส่งทดสอบไม่สำเร็จ' })
    }
  }
}

/** VineJS error → ข้อความที่ชี้จุดผิดให้ผู้ใช้ */
function describeDesignError(err: any): string {
  const first = err?.messages?.[0]
  if (first?.field) return `นิยามการ์ดไม่ถูกต้องที่ ${first.field}: ${first.message}`
  return err?.message ?? 'นิยามการ์ดไม่ถูกต้อง'
}
