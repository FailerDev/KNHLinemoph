import type {
  BuildContext,
  BuildResult,
  FlexBlock,
  FlexDesign,
  FlexTheme,
  FlexTone,
} from '#types/flex_design'

const WARN_BYTES = 8_000
const MAX_BYTES = 10_000

const DEFAULT_MAX_ROWS = 15
const HARD_MAX_ROWS = 30

const DEFAULT_THEME: FlexTheme = {
  primary: '#1E3A8A',
  background: '#FFFFFF',
}

/**
 * โทนสีตามตารางใน E:\line\lineflex.md
 * fg = ตัวเลข/ข้อความเน้น, bg = พื้นการ์ด, label = ป้ายบนพื้น bg
 */
const TONES: Record<FlexTone, { fg: string; bg: string; label: string }> = {
  info: { fg: '#1D4ED8', bg: '#EFF6FF', label: '#1E40AF' },
  ok: { fg: '#15803D', bg: '#ECFDF5', label: '#065F46' },
  warn: { fg: '#B45309', bg: '#FFFBEB', label: '#92400E' },
  danger: { fg: '#B91C1C', bg: '#FEF2F2', label: '#991B1B' },
  muted: { fg: '#64748B', bg: '#F8FAFC', label: '#475569' },
}

/** ระยะขอบของทุกบล็อกยกเว้น header ซึ่งกินเต็มความกว้าง */
const BLOCK_PAD = {
  paddingStart: '14px',
  paddingEnd: '14px',
  paddingTop: '10px',
} as const

const HTTPS_URL = /^https:\/\//i
const ACTION_URL = /^https?:\/\//i

export class FlexTooLargeError extends Error {
  constructor(
    public bytes: number,
    public heaviestBlockId: string | null,
    public heaviestBlockBytes: number
  ) {
    super(
      `Flex payload ${bytes.toLocaleString('en-US')} bytes เกินขีดจำกัด ${MAX_BYTES.toLocaleString('en-US')} bytes` +
        (heaviestBlockId
          ? ` — บล็อกที่ใหญ่ที่สุดคือ '${heaviestBlockId}' (${heaviestBlockBytes.toLocaleString('en-US')} bytes)`
          : '')
    )
    this.name = 'FlexTooLargeError'
  }
}

function substitute(raw: unknown, placeholders: Record<string, string>): string {
  return String(raw ?? '').replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    const found = placeholders[key]
    return found === undefined ? match : found
  })
}

function tone(name: FlexTone | undefined) {
  return TONES[name ?? 'muted']
}

/** ค่าที่แสดงในช่องข้อมูล — ว่างแล้วแสดงขีดแทนช่องเปล่า */
function value(raw: unknown, placeholders: Record<string, string>): string {
  const text = substitute(raw, placeholders).trim()
  return text === '' ? '-' : text
}

/** ตัวเลขจัดรูปแบบมีคอมมา ข้อความอื่นคงเดิม */
function formatNumber(raw: unknown): string {
  if (raw === null || raw === undefined) return '-'
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw.toLocaleString('th-TH') : '-'
  const text = String(raw).trim()
  if (text === '') return '-'
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text).toLocaleString('th-TH')
  return text
}

function clampRows(requested: number | undefined): number {
  const n = Number(requested ?? DEFAULT_MAX_ROWS)
  if (!Number.isFinite(n)) return DEFAULT_MAX_ROWS
  return Math.min(HARD_MAX_ROWS, Math.max(1, Math.trunc(n)))
}

/**
 * FlexBuilderService — คอมไพล์นิยามบล็อกเป็น LINE Flex bubble
 *
 * เป็น pure function โดยตั้งใจ: ไม่แตะ DB ไม่ยิง HTTP ไม่อ่านเวลาปัจจุบัน
 * ทุกอย่างที่ต้องใช้ส่งเข้ามาทาง BuildContext
 *
 * ใช้ body อย่างเดียว ไม่มี header/footer แยก ตาม MOPH_FLEX_GUIDE.md ข้อ 3
 * ที่ระบุว่ารูปแบบนี้ใช้จริงในโปรดักชันมาแล้ว
 */
export default class FlexBuilderService {
  /**
   * คอมไพล์นิยามบล็อกเป็น Flex bubble
   *
   * เพดานแถวตายตัวรับประกันขนาดไม่ได้ เพราะข้อความไทยกิน 3 bytes ต่อตัวอักษร
   * ตาราง 30 แถวที่มีชื่อแพทย์จริงจึงทะลุ 10KB ได้ง่าย เมื่อ payload เกินขีด
   * จะลดจำนวนแถวของบล็อกตารางลงจนพอดีก่อน แล้วค่อยยอมแพ้ — การแจ้งเตือนที่
   * แสดงแถวน้อยลงยังมีประโยชน์ ส่วนการแจ้งเตือนที่ไม่ถูกส่งไม่มีประโยชน์เลย
   */
  static build(design: FlexDesign, altTextTemplate: string, ctx: BuildContext): BuildResult {
    const altText = substitute(altTextTemplate, ctx.placeholders).trim() || 'การแจ้งเตือน'
    const hasTable = (design.blocks ?? []).some((b) => b.type === 'table')

    let attempt = this.compileBubble(design, ctx, altText, HARD_MAX_ROWS)
    let trimmedTo: number | null = null

    if (hasTable) {
      let budget = HARD_MAX_ROWS
      while (attempt.bytes > MAX_BYTES && budget > 1) {
        budget -= 1
        attempt = this.compileBubble(design, ctx, altText, budget)
        trimmedTo = budget
      }
    }

    if (attempt.bytes > MAX_BYTES) {
      let heaviestId: string | null = null
      let heaviestBytes = 0
      for (const block of attempt.compiled) {
        const size = Buffer.byteLength(JSON.stringify(block.node), 'utf8')
        if (size > heaviestBytes) {
          heaviestBytes = size
          heaviestId = block.id
        }
      }
      throw new FlexTooLargeError(attempt.bytes, heaviestId, heaviestBytes)
    }

    const warnings = [...attempt.warnings]

    if (trimmedTo !== null) {
      warnings.push(
        `ข้อความยาวเกินขีดจำกัด จึงลดจำนวนแถวตารางลงเหลือ ${trimmedTo} แถวเพื่อให้ส่งได้`
      )
    }

    if (attempt.bytes > WARN_BYTES) {
      warnings.push(
        `ข้อความมีขนาด ${attempt.bytes.toLocaleString('en-US')} bytes ใกล้ขีดจำกัด — บับเบิลที่ใหญ่เกินอาจส่งแล้วไม่เข้าห้อง LINE แม้ API จะตอบสำเร็จ`
      )
    }

    return { altText, contents: attempt.contents, bytes: attempt.bytes, warnings }
  }

  private static compileBubble(
    design: FlexDesign,
    ctx: BuildContext,
    altText: string,
    rowBudget: number
  ) {
    const warnings: string[] = []
    const theme: FlexTheme = {
      primary: design.theme?.primary || DEFAULT_THEME.primary,
      background: design.theme?.background || DEFAULT_THEME.background,
    }

    const compiled: Array<{ id: string; node: Record<string, unknown> }> = []
    for (const block of design.blocks ?? []) {
      const node = this.compileBlock(block, theme, ctx, warnings, rowBudget)
      if (node) compiled.push({ id: block.id, node })
    }

    const contents = {
      type: 'bubble',
      size: design.size || 'mega',
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '0px',
        paddingBottom: '14px',
        backgroundColor: theme.background,
        contents: compiled.map((c) => c.node),
      },
    }

    const bytes = Buffer.byteLength(JSON.stringify({ type: 'flex', altText, contents }), 'utf8')

    return { contents, bytes, warnings, compiled }
  }

  /**
   * ข้อความสำรองที่อ่านได้จากนิยามบล็อกเดียวกัน
   *
   * ใช้สองที่: สร้าง template_content อัตโนมัติตอนบันทึกเทมเพลต (ไม่ส่ง ctx
   * จึงคง {placeholder} ไว้) และตอน fallback ขณะส่งจริงเมื่อคอมไพล์ Flex
   * ล้มเหลว (ส่ง ctx จึงได้ข้อความที่แทนค่าแล้ว)
   */
  static buildPlainText(design: FlexDesign, ctx?: BuildContext): string {
    const ph = ctx?.placeholders ?? {}
    const tables = ctx?.tables ?? {}
    const lines: string[] = []

    for (const block of design.blocks ?? []) {
      switch (block.type) {
        case 'header':
          lines.push(substitute(block.title, ph))
          if (block.subtitle) lines.push(substitute(block.subtitle, ph))
          lines.push('')
          break

        case 'kpi':
          for (const cell of block.cells ?? []) {
            const unit = cell.unit ? ` ${substitute(cell.unit, ph)}` : ''
            lines.push(`${substitute(cell.label, ph)}: ${value(cell.value, ph)}${unit}`)
          }
          break

        case 'list':
          for (const row of block.rows ?? []) {
            lines.push(`${substitute(row.label, ph)}: ${value(row.value, ph)}`)
          }
          break

        case 'table': {
          const columns = block.columns ?? []
          if (columns.length === 0) break

          const allRows = tables[block.itemKey] ?? []
          const max = clampRows(block.maxRows)
          const shown = allRows.slice(0, max)

          if (shown.length === 0) {
            lines.push(block.emptyText || 'ไม่พบข้อมูล')
            break
          }

          const [first, ...rest] = columns
          for (const row of shown) {
            const head = formatNumber(row[first.source])
            const tail = rest.map((col) => formatNumber(row[col.source])).join(' / ')
            lines.push(tail ? `${head}: ${tail}` : head)
          }
          if (allRows.length > shown.length) {
            lines.push(
              `…และอีก ${(allRows.length - shown.length).toLocaleString('th-TH')} รายการ`
            )
          }
          break
        }

        case 'note':
          lines.push(substitute(block.text, ph))
          break

        case 'button':
          lines.push(`${substitute(block.label, ph)}: ${substitute(block.uri, ph)}`)
          break

        case 'separator':
          lines.push('')
          break

        case 'image':
          break
      }
    }

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  }

  /**
   * ชื่อตัวแปรทั้งหมดที่นิยามบล็อกนี้ต้องใช้
   *
   * รวม {placeholder} จากทุกข้อความ และ itemKey ของบล็อกตาราง
   * ชื่อคอลัมน์ (column.source) ไม่นับเป็นตัวแปร เพราะมาจากผลลัพธ์ SQL
   * ของ item ไม่ใช่จากตารางตัวแปรของระบบ
   */
  static extractVariables(design: FlexDesign, altText?: string): string[] {
    const found = new Set<string>()

    const scan = (raw: unknown) => {
      for (const match of String(raw ?? '').matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
        found.add(match[1])
      }
    }

    scan(altText)

    for (const block of design.blocks ?? []) {
      switch (block.type) {
        case 'header':
          scan(block.title)
          scan(block.subtitle)
          break
        case 'kpi':
          for (const cell of block.cells ?? []) {
            scan(cell.label)
            scan(cell.value)
            scan(cell.unit)
          }
          break
        case 'list':
          for (const row of block.rows ?? []) {
            scan(row.label)
            scan(row.value)
          }
          break
        case 'table':
          if (block.itemKey) found.add(block.itemKey)
          for (const col of block.columns ?? []) scan(col.label)
          break
        case 'note':
          scan(block.text)
          break
        case 'image':
          scan(block.url)
          break
        case 'button':
          scan(block.label)
          scan(block.uri)
          break
        case 'separator':
          break
      }
    }

    return [...found]
  }

  private static compileBlock(
    block: FlexBlock,
    theme: FlexTheme,
    ctx: BuildContext,
    warnings: string[],
    rowBudget: number
  ): Record<string, unknown> | null {
    const ph = ctx.placeholders

    switch (block.type) {
      case 'header': {
        const lines: Record<string, unknown>[] = [
          {
            type: 'text',
            text: substitute(block.title, ph),
            weight: 'bold',
            size: 'md',
            color: '#FFFFFF',
            wrap: true,
          },
        ]
        if (block.subtitle) {
          lines.push({
            type: 'text',
            text: substitute(block.subtitle, ph),
            size: 'xxs',
            // เทาอ่อนกลาง ๆ อ่านได้บนสีหลักทุกเฉด ไม่ผูกกับโทนน้ำเงิน
            color: '#E2E8F0',
            margin: 'xs',
            wrap: true,
          })
        }
        return {
          type: 'box',
          layout: 'vertical',
          backgroundColor: theme.primary,
          paddingAll: '14px',
          contents: lines,
        }
      }

      case 'kpi': {
        const columns = Math.min(4, Math.max(2, block.columns ?? 2))
        const cells = block.cells ?? []
        const rows: Record<string, unknown>[] = []

        for (let i = 0; i < cells.length; i += columns) {
          const chunk: Record<string, unknown>[] = cells.slice(i, i + columns).map((cell) => {
            const t = tone(cell.tone)
            const lines: Record<string, unknown>[] = [
              {
                type: 'text',
                text: substitute(cell.label, ph),
                size: 'xxs',
                weight: 'bold',
                color: t.label,
                align: 'center',
                wrap: true,
              },
              {
                type: 'text',
                text: value(cell.value, ph),
                size: 'xl',
                weight: 'bold',
                color: t.fg,
                align: 'center',
                margin: 'xs',
              },
            ]
            if (cell.unit) {
              lines.push({
                type: 'text',
                text: substitute(cell.unit, ph),
                size: 'xxs',
                color: '#64748B',
                align: 'center',
              })
            }
            return {
              type: 'box',
              layout: 'vertical',
              backgroundColor: t.bg,
              cornerRadius: 'lg',
              paddingAll: '10px',
              flex: 1,
              contents: lines,
            }
          })

          // เติมช่องว่างให้แถวสุดท้ายกว้างเท่าแถวอื่น
          // กล่องต้องมี contents อย่างน้อย 1 ชิ้น Flex จึงยอมรับ
          while (chunk.length < columns) {
            chunk.push({
              type: 'box',
              layout: 'vertical',
              flex: 1,
              contents: [{ type: 'text', text: ' ', size: 'xxs' }],
            })
          }

          rows.push({
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            ...(rows.length > 0 ? { margin: 'sm' } : {}),
            contents: chunk,
          })
        }

        if (rows.length === 0) return null
        return { type: 'box', layout: 'vertical', ...BLOCK_PAD, contents: rows }
      }

      case 'list': {
        const rows = (block.rows ?? []).map((row) => ({
          type: 'box',
          layout: 'horizontal',
          paddingAll: '5px',
          contents: [
            {
              type: 'text',
              text: substitute(row.label, ph),
              size: 'xs',
              color: '#334155',
              flex: 3,
              wrap: true,
            },
            {
              type: 'text',
              text: value(row.value, ph),
              size: 'xs',
              weight: 'bold',
              color: tone(row.tone).fg,
              flex: 2,
              align: 'end',
            },
          ],
        }))

        if (rows.length === 0) return null
        return { type: 'box', layout: 'vertical', ...BLOCK_PAD, contents: rows }
      }

      case 'table': {
        const columns = block.columns ?? []
        if (columns.length === 0) {
          warnings.push(`บล็อก '${block.id}': ตารางไม่มีคอลัมน์ จึงข้ามไป`)
          return null
        }

        const source = ctx.tables[block.itemKey]
        if (source === undefined) {
          warnings.push(
            `บล็อก '${block.id}': ไม่พบรายการข้อมูล '${block.itemKey}' (ต้องเป็น item ที่ result_mode = rows และเปิดใช้งาน)`
          )
        }

        const allRows = source ?? []
        const max = Math.min(clampRows(block.maxRows), Math.max(1, rowBudget))
        const shown = allRows.slice(0, max)
        const contents: Record<string, unknown>[] = []

        if (block.showHeader !== false) {
          contents.push({
            type: 'box',
            layout: 'horizontal',
            paddingAll: '5px',
            spacing: 'xs',
            backgroundColor: '#EEF2FF',
            cornerRadius: 'sm',
            contents: columns.map((col) => ({
              type: 'text',
              text: substitute(col.label, ph),
              size: 'xxs',
              weight: 'bold',
              color: '#1E3A8A',
              flex: col.flex,
              // 'start' เป็นค่า default ของ Flex อยู่แล้ว ละไว้เพื่อลดขนาด payload
              ...(col.align && col.align !== 'start' ? { align: col.align } : {}),
            })),
          })
        }

        for (const row of shown) {
          contents.push({
            type: 'box',
            layout: 'horizontal',
            paddingAll: '5px',
            spacing: 'xs',
            alignItems: 'center',
            contents: columns.map((col) => ({
              type: 'text',
              text: formatNumber(row[col.source]),
              size: 'xxs',
              color: col.tone ? tone(col.tone).fg : '#334155',
              ...(col.tone ? { weight: 'bold' } : {}),
              flex: col.flex,
              ...(col.align && col.align !== 'start' ? { align: col.align } : {}),
            })),
          })
        }

        if (shown.length === 0) {
          contents.push({
            type: 'text',
            text: block.emptyText || 'ไม่พบข้อมูล',
            size: 'xs',
            color: '#64748B',
            align: 'center',
            margin: 'md',
          })
        } else if (allRows.length > shown.length) {
          contents.push({
            type: 'text',
            text: `…และอีก ${(allRows.length - shown.length).toLocaleString('th-TH')} รายการ`,
            size: 'xxs',
            color: '#64748B',
            align: 'end',
            margin: 'sm',
          })
        }

        return { type: 'box', layout: 'vertical', ...BLOCK_PAD, contents }
      }

      case 'note': {
        const t = tone(block.tone)
        return {
          type: 'box',
          layout: 'vertical',
          ...BLOCK_PAD,
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: t.bg,
              cornerRadius: 'md',
              paddingAll: '10px',
              contents: [
                {
                  type: 'text',
                  text: substitute(block.text, ph),
                  size: 'xs',
                  weight: 'bold',
                  color: t.fg,
                  wrap: true,
                },
              ],
            },
          ],
        }
      }

      case 'image': {
        const url = substitute(block.url, ph).trim()
        if (!HTTPS_URL.test(url)) {
          warnings.push(`บล็อก '${block.id}': รูปต้องเป็น https จึงข้ามไป (ได้รับ '${url}')`)
          return null
        }
        return {
          type: 'image',
          url,
          size: 'full',
          aspectRatio: block.aspectRatio || '20:13',
          aspectMode: 'cover',
        }
      }

      case 'button': {
        const uri = substitute(block.uri, ph).trim()
        if (!ACTION_URL.test(uri)) {
          warnings.push(
            `บล็อก '${block.id}': ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https:// จึงข้ามไป`
          )
          return null
        }
        return {
          type: 'box',
          layout: 'vertical',
          ...BLOCK_PAD,
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: theme.primary,
              height: 'sm',
              action: {
                type: 'uri',
                label: substitute(block.label, ph).slice(0, 40) || 'เปิดลิงก์',
                uri,
              },
            },
          ],
        }
      }

      case 'separator':
        return {
          type: 'box',
          layout: 'vertical',
          ...BLOCK_PAD,
          contents: [{ type: 'separator', color: '#E2E8F0' }],
        }

      default:
        warnings.push(`ไม่รู้จักบล็อกชนิด '${(block as FlexBlock).type}' — ข้ามไป`)
        return null
    }
  }
}
