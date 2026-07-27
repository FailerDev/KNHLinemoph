import vine from '@vinejs/vine'
import type { FlexDesign } from '#types/flex_design'

const TONES = ['info', 'ok', 'warn', 'danger', 'muted'] as const
const ALIGNS = ['start', 'center', 'end'] as const
const SIZES = ['nano', 'micro', 'kilo', 'mega', 'giga'] as const
// ค่าที่ LINE Flex Message รองรับจริงสำหรับ aspectRatio ของ image component
// อ้างอิงเอกสาร LINE — ผิดไปจากนี้ LINE จะปฏิเสธข้อความทั้งใบตอนส่งจริง
const ASPECT_RATIOS = [
  '1:1', '1.51:1', '1.91:1', '4:3', '16:9', '20:13', '2:1', '3:1', '3:4', '9:16', '1:2', '1:3',
] as const
// LINE Flex รองรับทั้ง #RRGGBB และ #RRGGBBAA (มีความโปร่งใส)
const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/
const ANGLE = /^\d{1,3}deg$/
const PX = /^\d{1,3}px$/

const blockId = vine.string().trim().minLength(1).maxLength(40)
const toneField = vine.enum(TONES).optional()

function assertHex(value: unknown, label: string): string {
  if (typeof value !== 'string' || !HEX.test(value)) {
    throw new Error(`${label} ต้องเป็นสี hex เช่น #1E3A8A หรือ #1E3A8A80 (ได้รับ '${String(value)}')`)
  }
  return value
}

function assertBackground(
  value: unknown,
  label: string
): string | { type: 'linearGradient'; angle: string; startColor: string; endColor: string } {
  if (typeof value === 'string') return assertHex(value, label)
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>
    if (v.type !== 'linearGradient') {
      throw new Error(`${label}.type ต้องเป็น 'linearGradient'`)
    }
    if (typeof v.angle !== 'string' || !ANGLE.test(v.angle)) {
      throw new Error(`${label}.angle ต้องเป็นรูปแบบเช่น '135deg'`)
    }
    return {
      type: 'linearGradient',
      angle: v.angle,
      startColor: assertHex(v.startColor, `${label}.startColor`),
      endColor: assertHex(v.endColor, `${label}.endColor`),
    }
  }
  throw new Error(`${label} ต้องเป็นสี hex หรือวัตถุ gradient ({type:'linearGradient', angle, startColor, endColor})`)
}

/**
 * ฟิลด์สี/พื้นหลังที่รับได้ทั้ง string (hex) หรือ object (gradient) — VineUnion
 * ไม่รองรับ `.optional()` โดยตรง จึงใช้ vine.any() + transform ตรวจรูปแบบเองแทน
 * โยน Error ธรรมดาเมื่อไม่ผ่าน ซึ่ง templates_controller ดัก .message ไปแสดงอยู่แล้ว
 */
const hexOptional = (label: string) =>
  vine.any().optional().transform((value) => (value === undefined ? undefined : assertHex(value, label)))

const backgroundOptional = (label: string) =>
  vine
    .any()
    .optional()
    .transform((value) => (value === undefined ? undefined : assertBackground(value, label)))

const headerBlock = vine.object({
  id: blockId,
  type: vine.literal('header'),
  title: vine.string().trim().maxLength(200),
  subtitle: vine.string().trim().maxLength(200).optional(),
  background: backgroundOptional('พื้นหลังหัวข้อ'),
  titleColor: hexOptional('สีตัวอักษรหัวข้อ'),
  subtitleColor: hexOptional('สีตัวอักษรบรรทัดรอง'),
  metricValue: vine.string().trim().maxLength(20).optional(),
  metricLabel: vine.string().trim().maxLength(40).optional(),
})

const kpiBlock = vine.object({
  id: blockId,
  type: vine.literal('kpi'),
  columns: vine.number().min(1).max(4),
  variant: vine.enum(['card', 'chip', 'stat']).optional(),
  cells: vine
    .array(
      vine.object({
        label: vine.string().trim().maxLength(60),
        value: vine.string().trim().maxLength(60),
        unit: vine.string().trim().maxLength(20).optional(),
        tone: toneField,
        color: hexOptional('สีตัวเลขของช่อง KPI'),
        labelColor: hexOptional('สีป้ายของช่อง KPI'),
        bg: hexOptional('สีพื้นของช่อง KPI'),
        border: hexOptional('สีขอบของช่อง KPI'),
      })
    )
    .minLength(1)
    .maxLength(12),
})

const listBlock = vine.object({
  id: blockId,
  type: vine.literal('list'),
  heading: vine.string().trim().maxLength(60).optional(),
  stripeColor: hexOptional('สีแถบข้างของ list'),
  labelColor: hexOptional('สีป้ายของ list'),
  rows: vine
    .array(
      vine.object({
        label: vine.string().trim().maxLength(80),
        value: vine.string().trim().maxLength(80),
        tone: toneField,
        color: hexOptional('สีค่าของแถว list'),
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
  bg: hexOptional('สีพื้นของข้อความเตือน'),
  color: hexOptional('สีตัวอักษรของข้อความเตือน'),
})

const imageBlock = vine.object({
  id: blockId,
  type: vine.literal('image'),
  url: vine.string().trim().url().maxLength(500),
  aspectRatio: vine.enum(ASPECT_RATIOS).optional(),
  hero: vine.boolean().optional(),
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
  color: hexOptional('สีเส้นคั่น'),
  background: backgroundOptional('พื้นหลังเส้นคั่น'),
  thickness: vine.string().trim().regex(PX).optional(),
})

const progressBlock = vine.object({
  id: blockId,
  type: vine.literal('progress'),
  rows: vine
    .array(
      vine.object({
        label: vine.string().trim().maxLength(60),
        value: vine.string().trim().maxLength(30),
        percent: vine.number().min(0).max(100),
        color: hexOptional('สีแถบ progress'),
      })
    )
    .minLength(1)
    .maxLength(10),
})

const isType = (type: string) => (value: unknown) =>
  vine.helpers.isObject(value) && (value as Record<string, unknown>).type === type

export const flexDesignValidator = vine.compile(
  vine.object({
    version: vine.literal(1),
    size: vine.enum(SIZES).optional(),
    theme: vine
      .object({
        primary: hexOptional('สีหลักของธีม'),
        background: backgroundOptional('พื้นหลังของการ์ด'),
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
          vine.union.if(isType('progress'), progressBlock),
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
