import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/**
 * NotificationLog — the only table without created_at/updated_at;
 * it has a single `sent_at` timestamp filled by MySQL DEFAULT
 * CURRENT_TIMESTAMP. We never UPDATE log rows, so no autoUpdate.
 */
export default class NotificationLog extends BaseModel {
  public static table = 'notification_logs'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'schedule_id' })
  declare scheduleId: number | null

  @column({ columnName: 'group_id' })
  declare groupId: number | null

  @column({ columnName: 'template_id' })
  declare templateId: number | null

  @column({ columnName: 'message_type' })
  declare messageType: string

  @column({ columnName: 'status_code' })
  declare statusCode: number | null

  /** ค่า `status` จาก JSON body ของ MOPH — MOPH ตอบ HTTP 200 แม้ key ผิด */
  @column({ columnName: 'api_status' })
  declare apiStatus: number | null

  @column({ columnName: 'response_text' })
  declare responseText: string | null

  @column({ columnName: 'message_content' })
  declare messageContent: string | null

  /** messages array ที่ส่งจริง ใช้ตอนส่งซ้ำให้ได้การ์ดหน้าตาเดิม */
  @column({ columnName: 'payload_json' })
  declare payloadJson: string | null

  @column.dateTime({ autoCreate: true, columnName: 'sent_at' })
  declare sentAt: DateTime
}
