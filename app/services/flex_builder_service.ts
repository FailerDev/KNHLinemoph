import type {
  BackgroundValue,
  BuildContext,
  BuildResult,
  FlexBlock,
  FlexDesign,
  FlexTheme,
  FlexTone,
  ImageBlock,
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
 * แปลงพื้นหลัง (สีทึบหรือ gradient) เป็น property ที่ LINE Flex ต้องการ
 * สีทึบใช้ backgroundColor, gradient ใช้ background (คนละ key กัน)
 */
function backgroundStyle(v: BackgroundValue): Record<string, unknown> {
  if (typeof v === 'string') return { backgroundColor: v }
  return { background: v }
}

/**
 * FlexBuilderService — คอมไพล์นิยามบล็อกเป็น LINE Flex bubble
 *
 * เป็น pure function โดยตั้งใจ: ไม่แตะ DB ไม่ยิง HTTP ไม่อ่านเวลาปัจจุบัน
 * ทุกอย่างที่ต้องใช้ส่งเข้ามาทาง BuildContext
 *
 * ใช้ body อย่างเดียว ไม่มี header/footer แยก ตาม MOPH_FLEX_GUIDE.md ข้อ 3
 * ที่ระบุว่ารูปแบบนี้ใช้จริงในโปรดักชันมาแล้ว (hero เป็นข้อยกเว้นเดียว — LINE
 * เก็บมันไว้เป็น property คนละอันจาก body โดยธรรมชาติของสเปก ไม่ใช่ทางเลือกของเรา)
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

    let heroNode: Record<string, unknown> | null = null
    const compiled: Array<{ id: string; node: Record<string, unknown> }> = []

    for (const block of design.blocks ?? []) {
      if (block.type === 'image' && block.hero) {
        if (heroNode) {
          warnings.push(
            `บล็อก '${block.id}': การ์ดมีรูป hero ได้ใบเดียว บล็อกนี้จึงแสดงเป็นรูปปกติแทน`
          )
        } else {
          const node = this.compileImage(block, ctx.placeholders, warnings)
          if (node) {
            heroNode = node
            continue
          }
        }
      }

      const node = this.compileBlock(block, theme, ctx, warnings, rowBudget)
      if (node) compiled.push({ id: block.id, node })
    }

    const contents: Record<string, unknown> = {
      type: 'bubble',
      size: design.size || 'mega',
      ...(heroNode ? { hero: heroNode } : {}),
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '0px',
        paddingBottom: '14px',
        ...backgroundStyle(theme.background),
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
          if (block.metricValue && block.metricLabel) {
            lines.push(`${value(block.metricValue, ph)} ${substitute(block.metricLabel, ph)}`)
          }
          lines.push('')
          break

        case 'kpi':
          for (const cell of block.cells ?? []) {
            const unit = cell.unit ? ` ${substitute(cell.unit, ph)}` : ''
            lines.push(`${substitute(cell.label, ph)}: ${value(cell.value, ph)}${unit}`)
          }
          break

        case 'list':
          if (block.heading) lines.push(substitute(block.heading, ph))
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

        case 'progress':
          for (const row of block.rows ?? []) {
            lines.push(`${substitute(row.label, ph)}: ${value(row.value, ph)} (${row.percent}%)`)
          }
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
          scan(block.metricValue)
          scan(block.metricLabel)
          break
        case 'kpi':
          for (const cell of block.cells ?? []) {
            scan(cell.label)
            scan(cell.value)
            scan(cell.unit)
          }
          break
        case 'list':
          scan(block.heading)
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
        case 'progress':
          for (const row of block.rows ?? []) {
            scan(row.label)
            scan(row.value)
          }
          break
        case 'separator':
          break
      }
    }

    return [...found]
  }

  /** ใช้ทั้งรูปในเนื้อ body และรูป hero — ต่างกันแค่ตำแหน่งที่ compileBubble เอาไปวาง */
  private static compileImage(
    block: ImageBlock,
    ph: Record<string, string>,
    warnings: string[]
  ): Record<string, unknown> | null {
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

  /** แบ่ง cells เป็นแถว ๆ ตามจำนวนคอลัมน์ เติมช่องว่างให้แถวสุดท้ายเต็มความกว้าง */
  private static chunkCells<T>(cells: T[], columns: number, makeCell: (cell: T) => Record<string, unknown>) {
    const rows: Record<string, unknown>[] = []
    for (let i = 0; i < cells.length; i += columns) {
      const chunk = cells.slice(i, i + columns).map(makeCell)
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
    return rows
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
            color: block.titleColor || '#FFFFFF',
            wrap: true,
          },
        ]
        if (block.metricValue && block.metricLabel) {
          lines.push(
            {
              type: 'text',
              text: value(block.metricValue, ph),
              size: '3xl',
              weight: 'bold',
              color: block.titleColor || '#FFFFFF',
              align: 'center',
              margin: 'sm',
            },
            {
              type: 'text',
              text: substitute(block.metricLabel, ph),
              size: 'xxs',
              color: block.subtitleColor || '#E2E8F0',
              align: 'center',
            }
          )
        }
        if (block.subtitle) {
          lines.push({
            type: 'text',
            text: substitute(block.subtitle, ph),
            size: 'xxs',
            // เทาอ่อนกลาง ๆ อ่านได้บนสีหลักทุกเฉด ไม่ผูกกับโทนน้ำเงิน
            color: block.subtitleColor || '#E2E8F0',
            margin: 'xs',
            wrap: true,
          })
        }
        return {
          type: 'box',
          layout: 'vertical',
          ...backgroundStyle(block.background ?? theme.primary),
          paddingAll: '14px',
          contents: lines,
        }
      }

      case 'kpi': {
        const columns = Math.min(4, Math.max(1, block.columns ?? 2))
        const cells = block.cells ?? []
        const variant = block.variant ?? 'card'

        const makeCard = (cell: (typeof cells)[number]) => {
          const t = tone(cell.tone)
          const bg = cell.bg ?? t.bg
          const fg = cell.color ?? t.fg
          // ถ้าไม่ระบุ labelColor เอง และมี bg กำหนดเอง ให้เดาว่าเป็นธีมเข้มแล้ว
          // ใช้เทาอ่อนคงที่ — แต่ถ้า bg ที่กำหนดเป็นโทนอ่อน (เช่นพาสเทล) ต้องระบุ
          // labelColor เองเสมอ ไม่งั้นได้เทาอ่อนบนพื้นอ่อนซึ่งอ่านไม่ออก
          const labelColor = cell.labelColor ?? (cell.bg ? '#94A3B8' : t.label)
          const lines: Record<string, unknown>[] = [
            {
              type: 'text',
              text: substitute(cell.label, ph),
              size: 'xxs',
              weight: 'bold',
              color: labelColor,
              align: 'center',
              wrap: true,
            },
            {
              type: 'text',
              text: value(cell.value, ph),
              size: 'xl',
              weight: 'bold',
              color: fg,
              align: 'center',
              margin: 'xs',
              wrap: true,
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
            backgroundColor: bg,
            cornerRadius: 'lg',
            paddingAll: '10px',
            flex: 1,
            ...(cell.border ? { borderColor: cell.border, borderWidth: 'light' } : {}),
            contents: lines,
          }
        }

        const makeChip = (cell: (typeof cells)[number]) => ({
          type: 'box',
          layout: 'vertical',
          backgroundColor: cell.bg ?? '#FFFFFF29',
          cornerRadius: 'xxl',
          paddingAll: '6px',
          flex: 1,
          contents: [
            {
              type: 'text',
              text: `${substitute(cell.label, ph)} ${value(cell.value, ph)}`,
              size: 'xxs',
              color: cell.color ?? '#F0FDFA',
              align: 'center',
              wrap: true,
            },
          ],
        })

        const makeStat = (cell: (typeof cells)[number]) => ({
          type: 'box',
          layout: 'vertical',
          flex: 1,
          contents: [
            {
              type: 'text',
              text: value(cell.value, ph),
              size: 'lg',
              weight: 'bold',
              color: cell.color ?? tone(cell.tone).fg,
              align: 'center',
              wrap: true,
            },
            {
              type: 'text',
              text: substitute(cell.label, ph),
              size: 'xxs',
              color: '#6B7280',
              align: 'center',
              wrap: true,
            },
          ],
        })

        const makeCell = variant === 'chip' ? makeChip : variant === 'stat' ? makeStat : makeCard
        const rows = this.chunkCells(cells, columns, makeCell)

        if (rows.length === 0) return null
        return { type: 'box', layout: 'vertical', ...BLOCK_PAD, contents: rows }
      }

      case 'list': {
        const rowNodes = (block.rows ?? []).map((row) => ({
          type: 'box',
          layout: 'horizontal',
          paddingAll: '5px',
          contents: [
            {
              type: 'text',
              text: substitute(row.label, ph),
              size: 'xs',
              color: block.labelColor || '#334155',
              flex: 3,
              wrap: true,
            },
            {
              type: 'text',
              text: value(row.value, ph),
              size: 'xs',
              weight: 'bold',
              color: row.color ?? tone(row.tone).fg,
              flex: 2,
              align: 'end',
              wrap: true,
            },
          ],
        }))

        if (rowNodes.length === 0) return null

        // สไตล์แถบข้าง (design แถบข้าง) — ต้องมี heading หรือ stripeColor อย่างใดอย่างหนึ่ง
        if (block.heading || block.stripeColor) {
          const content: Record<string, unknown>[] = []
          if (block.heading) {
            content.push({
              type: 'text',
              text: substitute(block.heading, ph),
              size: 'xxs',
              weight: 'bold',
              color: '#6B7280',
            })
          }
          content.push(...rowNodes)

          return {
            type: 'box',
            layout: 'horizontal',
            ...BLOCK_PAD,
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                width: '4px',
                backgroundColor: block.stripeColor || theme.primary,
                cornerRadius: '2px',
                contents: [],
              },
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                margin: 'md',
                spacing: 'xs',
                contents: content,
              },
            ],
          }
        }

        return { type: 'box', layout: 'vertical', ...BLOCK_PAD, contents: rowNodes }
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
        const bg = block.bg ?? t.bg
        const fg = block.color ?? t.fg
        return {
          type: 'box',
          layout: 'vertical',
          ...BLOCK_PAD,
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: bg,
              cornerRadius: 'md',
              paddingAll: '10px',
              contents: [
                {
                  type: 'text',
                  text: substitute(block.text, ph),
                  size: 'xs',
                  weight: 'bold',
                  color: fg,
                  wrap: true,
                },
              ],
            },
          ],
        }
      }

      case 'image':
        return this.compileImage(block, ph, warnings)

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

      case 'progress': {
        const rows = (block.rows ?? []).map((row) => {
          const pct = Math.max(0, Math.min(100, row.percent))
          const color = row.color || '#14B8A6'
          return {
            type: 'box',
            layout: 'horizontal',
            alignItems: 'center',
            contents: [
              { type: 'text', text: substitute(row.label, ph), size: 'xs', color: '#374151', flex: 0 },
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#F0FDFA',
                cornerRadius: '3px',
                flex: 1,
                margin: 'sm',
                justifyContent: 'center',
                contents: [
                  {
                    type: 'box',
                    layout: 'vertical',
                    height: '6px',
                    backgroundColor: color,
                    cornerRadius: '3px',
                    width: `${pct}%`,
                    contents: [],
                  },
                ],
              },
              {
                type: 'text',
                text: value(row.value, ph),
                size: 'xs',
                weight: 'bold',
                color,
                flex: 0,
                margin: 'sm',
                align: 'end',
              },
            ],
          }
        })

        if (rows.length === 0) return null
        return { type: 'box', layout: 'vertical', ...BLOCK_PAD, spacing: 'sm', contents: rows }
      }

      case 'separator': {
        // มีสี/พื้นหลัง/ความหนากำหนดเอง = แถบตกแต่งเต็มขอบ ไม่ใช่เส้นคั่นบาง ๆ แบบเดิม
        if (block.background || block.thickness) {
          return {
            type: 'box',
            layout: 'vertical',
            height: block.thickness || '4px',
            ...backgroundStyle(block.background ?? block.color ?? '#E2E8F0'),
            contents: [],
          }
        }
        return {
          type: 'box',
          layout: 'vertical',
          ...BLOCK_PAD,
          contents: [{ type: 'separator', color: block.color || '#E2E8F0' }],
        }
      }

      default:
        warnings.push(`ไม่รู้จักบล็อกชนิด '${(block as FlexBlock).type}' — ข้ามไป`)
        return null
    }
  }
}
