import vine from '@vinejs/vine'

export const itemSaveValidator = vine.compile(
  vine.object({
    id: vine.any().optional(),
    item_name: vine.string().trim().minLength(1).maxLength(100),
    item_key: vine.string().trim().regex(/^[a-zA-Z0-9_]+$/).maxLength(50),
    sql_query: vine.string().minLength(1),
    his_database: vine.string().trim().maxLength(50).optional(),
    description: vine.string().maxLength(2000).optional(),
    is_active: vine.accepted().optional(),
    row_template: vine.string().maxLength(5000).optional(),
    row_separator: vine.string().maxLength(50).optional(),
    result_mode: vine.enum(['single', 'joined', 'rows']).optional(),
  })
)
