export type FlexTone = 'info' | 'ok' | 'warn' | 'danger' | 'muted'
export type FlexAlign = 'start' | 'center' | 'end'
export type FlexSize = 'nano' | 'micro' | 'kilo' | 'mega' | 'giga'

export interface FlexTheme {
  primary: string
  background: string
}

export interface HeaderBlock {
  id: string
  type: 'header'
  title: string
  subtitle?: string
}

export interface KpiCell {
  label: string
  value: string
  unit?: string
  tone?: FlexTone
}

export interface KpiBlock {
  id: string
  type: 'kpi'
  columns: 2 | 3 | 4
  cells: KpiCell[]
}

export interface ListRow {
  label: string
  value: string
  tone?: FlexTone
}

export interface ListBlock {
  id: string
  type: 'list'
  rows: ListRow[]
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
}

export interface ImageBlock {
  id: string
  type: 'image'
  url: string
  aspectRatio?: string
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
