import vine from '@vinejs/vine'
import type { FlexDesign } from '#types/flex_design'

const TONES = ['info', 'ok', 'warn', 'danger', 'muted'] as const
const ALIGNS = ['start', 'center', 'end'] as const
const SIZES = ['nano', 'micro', 'kilo', 'mega', 'giga'] as const
const HEX = /^#[0-9a-fA-F]{6}$/

const blockId = vine.string().trim().minLength(1).maxLength(40)
const toneField = vine.enum(TONES).optional()

const headerBlock = vine.object({
  id: blockId,
  type: vine.literal('header'),
  title: vine.string().trim().maxLength(200),
  subtitle: vine.string().trim().maxLength(200).optional(),
})

const kpiBlock = vine.object({
  id: blockId,
  type: vine.literal('kpi'),
  columns: vine.number().min(2).max(4),
  cells: vine
    .array(
      vine.object({
        label: vine.string().trim().maxLength(60),
        value: vine.string().trim().maxLength(60),
        unit: vine.string().trim().maxLength(20).optional(),
        tone: toneField,
      })
    )
    .minLength(1)
    .maxLength(12),
})

const listBlock = vine.object({
  id: blockId,
  type: vine.literal('list'),
  rows: vine
    .array(
      vine.object({
        label: vine.string().trim().maxLength(80),
        value: vine.string().trim().maxLength(80),
        tone: toneField,
      })
    )
    .minLength(1)
    .maxLength(20),
})

const tableBlock = vine.object({
  id: blockId,
  type: vine.literal('table'),
  itemKey: vine.string().trim().minLength(1).maxLength(100),
  maxRows: vine.number().min(1).max(30).optional(),
  showHeader: vine.boolean().optional(),
  emptyText: vine.string().trim().maxLength(120).optional(),
  columns: vine
    .array(
      vine.object({
        source: vine.string().trim().minLength(1).maxLength(100),
        label: vine.string().trim().maxLength(40),
        flex: vine.number().min(0).max(12),
        align: vine.enum(ALIGNS).optional(),
        tone: toneField,
      })
    )
    .minLength(1)
    .maxLength(6),
})

const noteBlock = vine.object({
  id: blockId,
  type: vine.literal('note'),
  text: vine.string().trim().maxLength(400),
  tone: toneField,
})

const imageBlock = vine.object({
  id: blockId,
  type: vine.literal('image'),
  url: vine.string().trim().url().maxLength(500),
  aspectRatio: vine.string().trim().maxLength(10).optional(),
})

const buttonBlock = vine.object({
  id: blockId,
  type: vine.literal('button'),
  label: vine.string().trim().maxLength(40),
  uri: vine.string().trim().url({ require_protocol: true }).maxLength(500),
})

const separatorBlock = vine.object({
  id: blockId,
  type: vine.literal('separator'),
})

const isType = (type: string) => (value: unknown) =>
  vine.helpers.isObject(value) && (value as Record<string, unknown>).type === type

export const flexDesignValidator = vine.compile(
  vine.object({
    version: vine.literal(1),
    size: vine.enum(SIZES).optional(),
    theme: vine
      .object({
        primary: vine.string().trim().regex(HEX).optional(),
        background: vine.string().trim().regex(HEX).optional(),
      })
      .optional(),
    blocks: vine
      .array(
        vine.union([
          vine.union.if(isType('header'), headerBlock),
          vine.union.if(isType('kpi'), kpiBlock),
          vine.union.if(isType('list'), listBlock),
          vine.union.if(isType('table'), tableBlock),
          vine.union.if(isType('note'), noteBlock),
          vine.union.if(isType('image'), imageBlock),
          vine.union.if(isType('button'), buttonBlock),
          vine.union.if(isType('separator'), separatorBlock),
        ])
      )
      .maxLength(30),
  })
)

/**
 * แปลงและตรวจนิยามบล็อกที่มาจากฟอร์ม
 *
 * รับได้ทั้ง JSON string (จากฟอร์ม) และ object (จากเทสต์หรือ preset)
 * throw เมื่อไม่ผ่าน เพื่อให้ controller จับแล้วตอบข้อความที่ชี้จุดผิดได้
 */
export async function parseFlexDesign(raw: string | object | null): Promise<FlexDesign> {
  if (raw == null || raw === '') {
    throw new Error('ไม่พบนิยามบล็อกของการ์ด Flex')
  }

  let candidate: unknown = raw
  if (typeof raw === 'string') {
    try {
      candidate = JSON.parse(raw)
    } catch {
      throw new Error('นิยามบล็อกไม่ใช่ JSON ที่ถูกต้อง')
    }
  }

  return (await flexDesignValidator.validate(candidate)) as unknown as FlexDesign
}
