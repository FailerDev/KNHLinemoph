import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

const jsonArrayCol = {
  prepare: (v: unknown[] | null | undefined) => (v == null ? null : JSON.stringify(v)),
  consume: (v: unknown) => {
    if (v == null) return []
    if (Array.isArray(v)) return v
    try { return JSON.parse(String(v)) } catch { return [] }
  },
}

export default class CdcuWatchGroup extends BaseModel {
  public static table = 'cdcu_watch_groups'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'group_name' })
  declare groupName: string

  @column({ columnName: 'icd10_codes', ...jsonArrayCol })
  declare icd10Codes: string[]

  @column({ columnName: 'template_id' })
  declare templateId: number | null

  @column({ columnName: 'line_group_ids', ...jsonArrayCol })
  declare lineGroupIds: number[]

  @column({ columnName: 'his_database' })
  declare hisDatabase: string

  @column({ columnName: 'time_start' })
  declare timeStart: string | null

  @column({ columnName: 'time_end' })
  declare timeEnd: string | null

  @column({ columnName: 'days_of_week' })
  declare daysOfWeek: string

  @column()
  declare description: string | null

  @column({
    columnName: 'is_active',
    consume: (v) => v === 1 || v === true,
    prepare: (v: boolean) => (v ? 1 : 0),
  })
  declare isActive: boolean

  @column({
    columnName: 'mask_name',
    consume: (v) => v === 1 || v === true,
    prepare: (v: boolean) => (v ? 1 : 0),
  })
  declare maskName: boolean

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime
}
