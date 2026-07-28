import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class CdcuSentLog extends BaseModel {
  public static table = 'cdcu_sent_logs'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'watch_group_id' })
  declare watchGroupId: number

  @column()
  declare vn: string

  @column()
  declare icd10: string

  @column()
  declare hn: string | null

  @column({ columnName: 'pt_name' })
  declare ptName: string | null

  @column({ columnName: 'line_group_id' })
  declare lineGroupId: number | null

  @column({ columnName: 'status_code' })
  declare statusCode: number | null

  @column({ columnName: 'message_content' })
  declare messageContent: string | null

  @column.dateTime({ autoCreate: true, columnName: 'sent_at' })
  declare sentAt: DateTime
}
