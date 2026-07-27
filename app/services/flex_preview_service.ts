import { DateTime } from 'luxon'
import NotificationItem from '#models/notification_item'
import NotificationService from '#services/notification_service'
import FlexBuilderService from '#services/flex_builder_service'
import SettingsService from '#services/settings_service'
import type { BuildContext, FlexDesign, TableBlock } from '#types/flex_design'

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]
const THAI_WEEKDAY = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์']

const SAMPLE_VALUE = '123'
const SAMPLE_ROWS = 3

/**
 * FlexPreviewService — ประกอบ BuildContext สำหรับหน้าตัวอย่าง
 *
 * ค่าเริ่มต้นใช้ข้อมูลจำลอง เพราะตัวอย่างอัปเดตทุกครั้งที่ผู้ใช้พิมพ์
 * การยิง query ใส่ฐาน HOSxP โปรดักชันทุกครั้งที่กดคีย์ไม่คุ้มเลย
 * โหมด live ดึงของจริงหนึ่งครั้งเมื่อผู้ใช้กดปุ่มเอง เพื่อดูว่าข้อมูลจริง
 * ยาวเกินหรือทำให้ payload ล้นหรือไม่
 */
export default class FlexPreviewService {
  static async buildContext(design: FlexDesign, live: boolean): Promise<BuildContext> {
    const now = DateTime.now().setZone(NotificationService.TZ)
    const [orgName, siteTitle, siteFooter] = await Promise.all([
      SettingsService.get('org_name', 'โรงพยาบาลตัวอย่าง'),
      SettingsService.get('site_title', 'ระบบแจ้งเตือน LINE'),
      SettingsService.get('site_footer', ''),
    ])

    const placeholders: Record<string, string> = {
      date: now.toFormat('yyyy-MM-dd'),
      time: now.toFormat('HH:mm:ss'),
      date_th: `${now.day} ${THAI_MONTHS[now.month - 1]} ${now.year + 543}`,
      weekday: `วัน${THAI_WEEKDAY[now.weekday - 1]}`,
      org_name: orgName || 'โรงพยาบาลตัวอย่าง',
      site_title: siteTitle || 'ระบบแจ้งเตือน LINE',
      site_footer: siteFooter,
    }
    const tables: BuildContext['tables'] = {}

    const wanted = FlexBuilderService.extractVariables(design)
    const tableBlocks = (design.blocks ?? []).filter(
      (b): b is TableBlock => b.type === 'table'
    )
    const tableKeys = new Set(tableBlocks.map((b) => b.itemKey))

    if (live && wanted.length > 0) {
      const today = now.toFormat('yyyy-MM-dd')
      const items = await NotificationItem.query()
        .whereIn('item_key', wanted)
        .where('is_active', 1)

      for (const item of items) {
        const data = await NotificationService.fetchItemData(item.id, today)
        if (!data) continue
        if (data.rows) tables[data.itemKey] = data.rows
        for (const [key, val] of Object.entries(data.data)) {
          placeholders[key] = val == null ? '0' : String(val)
        }
      }
    }

    // เติมค่าจำลองให้ทุกตัวแปรที่ยังไม่มีค่า ผู้ใช้จะได้ไม่เห็น {placeholder} ดิบ
    for (const key of wanted) {
      if (tableKeys.has(key)) {
        if (!tables[key]) tables[key] = this.sampleRows(tableBlocks, key)
        continue
      }
      if (placeholders[key] === undefined) placeholders[key] = SAMPLE_VALUE
    }

    return { placeholders, tables }
  }

  /** แถวจำลองที่มีคอลัมน์ตรงกับที่บล็อกตารางประกาศไว้ */
  private static sampleRows(
    tableBlocks: TableBlock[],
    itemKey: string
  ): Record<string, unknown>[] {
    const block = tableBlocks.find((b) => b.itemKey === itemKey)
    const columns = block?.columns ?? []

    return Array.from({ length: SAMPLE_ROWS }, (_, rowIndex) => {
      const row: Record<string, unknown> = {}
      columns.forEach((col, colIndex) => {
        row[col.source] =
          colIndex === 0 ? `ตัวอย่าง ${rowIndex + 1}` : (rowIndex + 1) * 10 + colIndex
      })
      return row
    })
  }
}
