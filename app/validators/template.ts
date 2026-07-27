import vine from '@vinejs/vine'

export const templateSaveValidator = vine.compile(
  vine.object({
    id: vine.any().optional(),
    template_name: vine.string().trim().minLength(1).maxLength(100),
    // โหมด flex ไม่บังคับให้กรอกเอง — controller สร้างข้อความสำรองจาก buildPlainText
    template_content: vine.string().optional(),
    message_type: vine.enum(['text', 'flex']).optional(),
    flex_design: vine.string().optional(),
    alt_text: vine.string().trim().maxLength(400).optional(),
    is_active: vine.accepted().optional(),
  })
)
