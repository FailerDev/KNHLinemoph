export type FlexTone = 'info' | 'ok' | 'warn' | 'danger' | 'muted'
export type FlexAlign = 'start' | 'center' | 'end'
export type FlexSize = 'nano' | 'micro' | 'kilo' | 'mega' | 'giga'

/** hex สี — 6 หลัก (#RRGGBB) หรือ 8 หลักมีความโปร่งใส (#RRGGBBAA) ตามที่ LINE Flex รองรับ */
export type FlexColor = string

export interface GradientBackground {
  type: 'linearGradient'
  /** เช่น '135deg' — ใช้ค่าเดียวกับ CSS ได้ตรง ๆ */
  angle: string
  startColor: FlexColor
  endColor: FlexColor
}

/** พื้นหลัง — สีทึบเดียว หรือไล่เฉดสี */
export type BackgroundValue = FlexColor | GradientBackground

export interface FlexTheme {
  primary: string
  background: BackgroundValue
}

export interface HeaderBlock {
  id: string
  type: 'header'
  title: string
  subtitle?: string
  /** ทับสีพื้นของ header เฉพาะบล็อกนี้ ไม่ระบุ = ใช้ theme.primary */
  background?: BackgroundValue
  titleColor?: FlexColor
  subtitleColor?: FlexColor
}

export interface KpiCell {
  label: string
  value: string
  unit?: string
  tone?: FlexTone
  /** สีตัวเลข/ป้าย กำหนดเองแทนโทนสำเร็จรูป — ใช้คู่กับ bg */
  color?: FlexColor
  /** สีพื้นการ์ด กำหนดเองแทนโทนสำเร็จรูป */
  bg?: FlexColor
  /** สีขอบการ์ด (ใช้กับธีมพื้นเข้มที่ต้องการเส้นขอบบาง ๆ) */
  border?: FlexColor
}

export interface KpiBlock {
  id: string
  type: 'kpi'
  columns: 2 | 3 | 4
  cells: KpiCell[]
  /** 'chip' = ป้ายมนบรรทัดเดียว พื้นโปร่งแสง (เหมาะกับวางบนพื้นสีเข้ม/ไล่เฉด) */
  variant?: 'card' | 'chip'
}

export interface ListRow {
  label: string
  value: string
  tone?: FlexTone
  /** สีค่า กำหนดเองแทนโทนสำเร็จรูป */
  color?: FlexColor
}

export interface ListBlock {
  id: string
  type: 'list'
  rows: ListRow[]
  /** หัวข้อกลุ่มด้านบนแถบสี — ใส่คู่กับ stripeColor เพื่อเป็นสไตล์ editorial */
  heading?: string
  stripeColor?: FlexColor
}

export interface TableColumn {
  /** ชื่อคอลัมน์ที่ SQL ของ item คืนมา */
  source: string
  label: string
  flex: number
  align?: FlexAlign
  tone?: FlexTone
}

export interface TableBlock {
  id: string
  type: 'table'
  /** item_key ของ notification_items ที่ result_mode = 'rows' */
  itemKey: string
  maxRows?: number
  showHeader?: boolean
  emptyText?: string
  columns: TableColumn[]
}

export interface NoteBlock {
  id: string
  type: 'note'
  text: string
  tone?: FlexTone
  /** ทับสีพื้น/ตัวอักษรของโทนสำเร็จรูป */
  bg?: FlexColor
  color?: FlexColor
}

export interface ImageBlock {
  id: string
  type: 'image'
  url: string
  aspectRatio?: string
  /** true = วางเป็นรูปเต็มขอบด้านบนสุดของบับเบิล (hero) แทนที่จะอยู่ใน body */
  hero?: boolean
}

export interface ButtonBlock {
  id: string
  type: 'button'
  label: string
  uri: string
}

export interface SeparatorBlock {
  id: string
  type: 'separator'
  /** ค่าเริ่มต้นบางและเทา — ใส่เพื่อทำเป็นแถบหนา/มีสี/ไล่เฉด (เช่น แถบหัวการ์ด) */
  color?: FlexColor
  background?: BackgroundValue
  thickness?: string
}

export interface ProgressRow {
  label: string
  value: string
  /** 0–100 ความยาวแถบ */
  percent: number
  color?: FlexColor
}

export interface ProgressBlock {
  id: string
  type: 'progress'
  rows: ProgressRow[]
}

export type FlexBlock =
  | HeaderBlock
  | KpiBlock
  | ListBlock
  | TableBlock
  | NoteBlock
  | ImageBlock
  | ButtonBlock
  | SeparatorBlock
  | ProgressBlock

export interface FlexDesign {
  version: 1
  size?: FlexSize
  theme?: Partial<FlexTheme>
  blocks: FlexBlock[]
}

export interface BuildContext {
  /** {date}, {org_name}, {vn} … ค่าที่แทนแล้ว */
  placeholders: Record<string, string>
  /** itemKey → แถวดิบจาก HIS สำหรับบล็อกตาราง */
  tables: Record<string, Record<string, unknown>[]>
}

export interface BuildResult {
  altText: string
  contents: Record<string, unknown>
  bytes: number
  warnings: string[]
}
