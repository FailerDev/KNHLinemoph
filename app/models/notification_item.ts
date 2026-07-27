import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class NotificationItem extends BaseModel {
  public static table = 'notification_items'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'item_name' })
  declare itemName: string

  @column({ columnName: 'item_key' })
  declare itemKey: string

  @column({ columnName: 'sql_query' })
  declare sqlQuery: string

  @column({ columnName: 'his_database' })
  declare hisDatabase: string

  @column()
  declare description: string | null

  @column({
    columnName: 'is_active',
    consume: (v) => v === 1 || v === true,
    prepare: (v: boolean) => (v ? 1 : 0),
  })
  declare isActive: boolean

  @column({ columnName: 'row_template' })
  declare rowTemplate: string | null

  @column({ columnName: 'row_separator' })
  declare rowSeparator: string | null

  /**
   * single = แถวแรกกลายเป็นคอลัมน์ {col}
   * joined = ทุกแถวผ่าน row_template แล้วต่อกันเป็นข้อความเดียว
   * rows   = คืน array แถวดิบ ใช้กับบล็อกตารางของ Flex เท่านั้น
   */
  @column({ columnName: 'result_mode' })
  declare resultMode: 'single' | 'joined' | 'rows'

  /**
   * โหมดผลลัพธ์ที่ควรบันทึก
   *
   * ถ้าผู้เรียกไม่ได้ระบุมา ให้เดาจาก row_template แบบเดียวกับที่ระบบทำก่อนมี
   * คอลัมน์นี้ — กัน item ที่สร้างใหม่พร้อม row_template ตกไปอยู่โหมด single
   * ตาม DB default แล้วการรวมหลายแถวพังเงียบ ๆ
   */
  static resolveResultMode(
    requested: string | null | undefined,
    rowTemplate: string | null | undefined
  ): 'single' | 'joined' | 'rows' {
    if (requested === 'single' || requested === 'joined' || requested === 'rows') {
      return requested
    }
    return rowTemplate && rowTemplate.trim() !== '' ? 'joined' : 'single'
  }

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime
}
