import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { FlexDesign } from '#types/flex_design'

export default class NotificationTemplate extends BaseModel {
  public static table = 'notification_templates'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'template_name' })
  declare templateName: string

  @column({ columnName: 'template_content' })
  declare templateContent: string

  @column({ columnName: 'message_type' })
  declare messageType: 'text' | 'flex'

  /**
   * นิยามบล็อก — MariaDB เก็บ JSON เป็น longtext จึงคืนมาเป็น string
   * ส่วน MySQL 8 คืนเป็น object ที่ parse แล้ว consume จึงต้องรับได้ทั้งสองแบบ
   */
  @column({
    columnName: 'flex_design',
    prepare: (v: FlexDesign | null) => (v == null ? null : JSON.stringify(v)),
    consume: (v) => {
      if (v == null) return null
      if (typeof v === 'object') return v as FlexDesign
      try {
        return JSON.parse(String(v)) as FlexDesign
      } catch {
        return null
      }
    },
  })
  declare flexDesign: FlexDesign | null

  @column({ columnName: 'alt_text' })
  declare altText: string | null

  @column({
    prepare: (v: string[] | null) => (v == null ? null : JSON.stringify(v)),
    consume: (v) => {
      if (v == null) return []
      if (Array.isArray(v)) return v
      try {
        return JSON.parse(String(v))
      } catch {
        return []
      }
    },
  })
  declare variables: string[]

  @column({
    columnName: 'is_active',
    consume: (v) => v === 1 || v === true,
    prepare: (v: boolean) => (v ? 1 : 0),
  })
  declare isActive: boolean

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime
}
