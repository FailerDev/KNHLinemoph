import { test } from '@japa/runner'
import FlexBuilderService from '#services/flex_builder_service'
import type { BuildContext, FlexDesign, TableBlock } from '#types/flex_design'

const emptyCtx: BuildContext = { placeholders: {}, tables: {} }

function design(blocks: FlexDesign['blocks']): FlexDesign {
  return { version: 1, blocks }
}

test.group('FlexBuilderService.build — โครงและบล็อกพื้นฐาน', () => {
  test('คืน bubble ที่มี body เป็น box แนวตั้ง', ({ assert }) => {
    const result = FlexBuilderService.build(design([]), 'ทดสอบ', emptyCtx)
    const bubble = result.contents as any

    assert.equal(bubble.type, 'bubble')
    assert.equal(bubble.size, 'mega')
    assert.equal(bubble.body.type, 'box')
    assert.equal(bubble.body.layout, 'vertical')
    assert.isArray(bubble.body.contents)
  })

  test('ไม่มี header/footer แยก ใช้ body อย่างเดียว', ({ assert }) => {
    const d = design([{ id: 'h', type: 'header', title: 'หัวข้อ' }])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.isUndefined(bubble.header)
    assert.isUndefined(bubble.footer)
  })

  test('บล็อก header คอมไพล์เป็นกล่องพื้นสีหลักพร้อมหัวข้อ', ({ assert }) => {
    const d = design([{ id: 'h', type: 'header', title: 'สรุปรายวัน', subtitle: 'รพ.ทดสอบ' }])
    d.theme = { primary: '#1E3A8A' }
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const header = bubble.body.contents[0]

    assert.equal(header.backgroundColor, '#1E3A8A')
    assert.equal(header.contents[0].text, 'สรุปรายวัน')
    assert.equal(header.contents[1].text, 'รพ.ทดสอบ')
  })

  test('header ที่ไม่มี subtitle มีข้อความบรรทัดเดียว', ({ assert }) => {
    const d = design([{ id: 'h', type: 'header', title: 'หัวข้อ' }])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.lengthOf(bubble.body.contents[0].contents, 1)
  })

  test('แทนค่า placeholder ใน title, subtitle และ altText', ({ assert }) => {
    const ctx: BuildContext = {
      placeholders: { org_name: 'รพ.แก้งสนามนาง', date_th: '27 กรกฎาคม 2569' },
      tables: {},
    }
    const d = design([{ id: 'h', type: 'header', title: '{org_name}', subtitle: '{date_th}' }])
    const result = FlexBuilderService.build(d, 'สรุป {org_name} {date_th}', ctx)
    const header = (result.contents as any).body.contents[0]

    assert.equal(header.contents[0].text, 'รพ.แก้งสนามนาง')
    assert.equal(header.contents[1].text, '27 กรกฎาคม 2569')
    assert.equal(result.altText, 'สรุป รพ.แก้งสนามนาง 27 กรกฎาคม 2569')
  })

  test('placeholder ที่ไม่รู้จักคงข้อความเดิมไว้', ({ assert }) => {
    const d = design([{ id: 'h', type: 'header', title: 'ยอด {unknown_key}' }])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.equal(bubble.body.contents[0].contents[0].text, 'ยอด {unknown_key}')
  })

  test('altText ว่างใช้ข้อความสำรอง', ({ assert }) => {
    const result = FlexBuilderService.build(design([]), '   ', emptyCtx)
    assert.equal(result.altText, 'การแจ้งเตือน')
  })

  test('บล็อก note ใช้สีตามโทน', ({ assert }) => {
    const d = design([{ id: 'n', type: 'note', text: 'ค้างบันทึก 18 ราย', tone: 'danger' }])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const note = bubble.body.contents[0].contents[0].contents[0]

    assert.equal(note.text, 'ค้างบันทึก 18 ราย')
    assert.equal(note.color, '#B91C1C')
  })

  test('note ที่ไม่ระบุโทนใช้ muted', ({ assert }) => {
    const d = design([{ id: 'n', type: 'note', text: 'หมายเหตุ' }])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.equal(bubble.body.contents[0].contents[0].contents[0].color, '#64748B')
  })

  test('บล็อก separator คอมไพล์เป็น separator', ({ assert }) => {
    const d = design([{ id: 's', type: 'separator' }])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.equal(bubble.body.contents[0].contents[0].type, 'separator')
  })

  test('รายงานจำนวน bytes ของ payload', ({ assert }) => {
    const result = FlexBuilderService.build(design([]), 'alt', emptyCtx)
    assert.isAbove(result.bytes, 0)
  })
})

test.group('FlexBuilderService.build — kpi, list, image, button', () => {
  test('kpi columns:1 ให้ช่องเดียวเต็มความกว้าง ไม่เติมช่องว่างข้าง ๆ', ({ assert }) => {
    // เจอจริงตอนทดสอบส่ง: HN ที่มีหลายหลักพับบรรทัดเมื่อถูกบีบให้แชร์แถวกับช่องอื่น
    // columns:1 คือทางแก้ — ต้องไม่ถูกดันขึ้น min 2 เหมือนเดิม
    const d = design([
      { id: 'k', type: 'kpi', columns: 1, cells: [{ label: 'HN', value: '00025631' }] },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const row = bubble.body.contents[0].contents[0]

    assert.lengthOf(row.contents, 1)
    assert.equal(row.contents[0].contents[1].text, '00025631')
  })

  test('kpi จัดเป็นแถวละ columns ช่อง', ({ assert }) => {
    const d = design([
      {
        id: 'k',
        type: 'kpi',
        columns: 2,
        cells: [
          { label: 'OPD', value: '250', unit: 'ราย', tone: 'info' },
          { label: 'IPD', value: '45', unit: 'ราย', tone: 'ok' },
          { label: 'ER', value: '32', unit: 'ราย', tone: 'danger' },
        ],
      },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const rows = bubble.body.contents[0].contents

    assert.lengthOf(rows, 2)
    assert.lengthOf(rows[0].contents, 2)
    assert.lengthOf(rows[1].contents, 2)
  })

  test('แถวสุดท้ายที่ไม่เต็มเติมช่องว่างให้ความกว้างเท่ากัน', ({ assert }) => {
    const d = design([
      { id: 'k', type: 'kpi', columns: 2, cells: [{ label: 'OPD', value: '250' }] },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const row = bubble.body.contents[0].contents[0]

    assert.lengthOf(row.contents, 2)
    assert.equal(row.contents[1].flex, 1)
  })

  test('ช่อง kpi ใช้สีพื้นและสีตัวเลขตามโทน', ({ assert }) => {
    const d = design([
      { id: 'k', type: 'kpi', columns: 2, cells: [{ label: 'ER', value: '32', tone: 'danger' }] },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const cell = bubble.body.contents[0].contents[0].contents[0]

    assert.equal(cell.backgroundColor, '#FEF2F2')
    assert.equal(cell.contents[0].text, 'ER')
    assert.equal(cell.contents[1].text, '32')
    assert.equal(cell.contents[1].color, '#B91C1C')
  })

  test('ช่อง kpi ที่ไม่มี unit มีสองบรรทัด', ({ assert }) => {
    const d = design([
      { id: 'k', type: 'kpi', columns: 2, cells: [{ label: 'OPD', value: '250' }] },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.lengthOf(bubble.body.contents[0].contents[0].contents[0].contents, 2)
  })

  test('ค่า kpi ที่แทน placeholder แล้วว่างแสดงเป็นขีด', ({ assert }) => {
    const ctx: BuildContext = { placeholders: { vn: '' }, tables: {} }
    const d = design([
      { id: 'k', type: 'kpi', columns: 2, cells: [{ label: 'OPD', value: '{vn}' }] },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', ctx).contents as any

    assert.equal(bubble.body.contents[0].contents[0].contents[0].contents[1].text, '-')
  })

  test('list สร้างแถวป้ายกับค่าโดยใช้ flex คงที่', ({ assert }) => {
    const d = design([
      {
        id: 'l',
        type: 'list',
        rows: [
          { label: 'X-ray', value: '28' },
          { label: 'ทันตกรรม', value: '15', tone: 'ok' },
        ],
      },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const rows = bubble.body.contents[0].contents

    assert.lengthOf(rows, 2)
    assert.equal(rows[0].contents[0].text, 'X-ray')
    assert.equal(rows[0].contents[1].text, '28')
    assert.equal(rows[0].contents[1].align, 'end')
    assert.equal(rows[1].contents[1].color, '#15803D')
  })

  test('image ที่เป็น https คอมไพล์เป็น image เต็มความกว้าง', ({ assert }) => {
    const d = design([{ id: 'i', type: 'image', url: 'https://example.com/a.png' }])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.equal(bubble.body.contents[0].type, 'image')
    assert.equal(bubble.body.contents[0].size, 'full')
  })

  test('image ที่ไม่ใช่ https ถูกตัดทิ้งพร้อมคำเตือน', ({ assert }) => {
    const d = design([{ id: 'i', type: 'image', url: 'http://example.com/a.png' }])
    const result = FlexBuilderService.build(d, 'alt', emptyCtx)

    assert.lengthOf((result.contents as any).body.contents, 0)
    assert.lengthOf(result.warnings, 1)
    assert.include(result.warnings[0], 'i')
  })

  test('button คอมไพล์เป็นปุ่ม uri สีตามธีม', ({ assert }) => {
    const d = design([
      { id: 'b', type: 'button', label: 'ดู Dashboard', uri: 'https://example.com' },
    ])
    d.theme = { primary: '#1E3A8A' }
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const button = bubble.body.contents[0].contents[0]

    assert.equal(button.type, 'button')
    assert.equal(button.color, '#1E3A8A')
    assert.equal(button.action.type, 'uri')
    assert.equal(button.action.label, 'ดู Dashboard')
    assert.equal(button.action.uri, 'https://example.com')
  })

  test('button ที่ uri ไม่ถูกต้องถูกตัดทิ้งพร้อมคำเตือน', ({ assert }) => {
    const d = design([{ id: 'b', type: 'button', label: 'ปุ่ม', uri: 'javascript:alert(1)' }])
    const result = FlexBuilderService.build(d, 'alt', emptyCtx)

    assert.lengthOf((result.contents as any).body.contents, 0)
    assert.lengthOf(result.warnings, 1)
  })

  test('label ของปุ่มถูกตัดที่ 40 ตัวอักษรตามข้อจำกัดของ LINE', ({ assert }) => {
    const d = design([
      { id: 'b', type: 'button', label: 'ก'.repeat(60), uri: 'https://example.com' },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.lengthOf(bubble.body.contents[0].contents[0].action.label, 40)
  })
})

const tableDesign = (over: Partial<TableBlock> = {}) =>
  design([
    {
      id: 't',
      type: 'table',
      itemKey: 'doctor_summary',
      columns: [
        { source: 'doctor_name', label: 'แพทย์', flex: 5, align: 'start' },
        { source: 'opd', label: 'OPD', flex: 2, align: 'end', tone: 'info' },
      ],
      ...over,
    },
  ])

test.group('FlexBuilderService.build — บล็อกตาราง', () => {
  test('สร้างหัวตารางและแถวข้อมูลจาก ctx.tables', ({ assert }) => {
    const ctx: BuildContext = {
      placeholders: {},
      tables: {
        doctor_summary: [
          { doctor_name: 'นพ.สมชาย', opd: 12 },
          { doctor_name: 'พญ.มานี', opd: 8 },
        ],
      },
    }
    const bubble = FlexBuilderService.build(tableDesign(), 'alt', ctx).contents as any
    const rows = bubble.body.contents[0].contents

    assert.lengthOf(rows, 3)
    assert.equal(rows[0].contents[0].text, 'แพทย์')
    assert.equal(rows[1].contents[0].text, 'นพ.สมชาย')
    assert.equal(rows[1].contents[1].text, '12')
    assert.equal(rows[2].contents[0].text, 'พญ.มานี')
  })

  test('หัวตารางกับแถวข้อมูลใช้ค่า flex ชุดเดียวกัน', ({ assert }) => {
    const ctx: BuildContext = {
      placeholders: {},
      tables: { doctor_summary: [{ doctor_name: 'นพ.ก', opd: 1 }] },
    }
    const bubble = FlexBuilderService.build(tableDesign(), 'alt', ctx).contents as any
    const [header, row] = bubble.body.contents[0].contents

    assert.deepEqual(
      header.contents.map((c: any) => [c.flex, c.align]),
      row.contents.map((c: any) => [c.flex, c.align])
    )
  })

  test('ซ่อนหัวตารางได้เมื่อ showHeader เป็น false', ({ assert }) => {
    const ctx: BuildContext = {
      placeholders: {},
      tables: { doctor_summary: [{ doctor_name: 'นพ.ก', opd: 1 }] },
    }
    const bubble = FlexBuilderService.build(tableDesign({ showHeader: false }), 'alt', ctx)
      .contents as any

    assert.lengthOf(bubble.body.contents[0].contents, 1)
  })

  test('ไม่มีข้อมูลแสดง emptyText', ({ assert }) => {
    const ctx: BuildContext = { placeholders: {}, tables: { doctor_summary: [] } }
    const d = tableDesign({ emptyText: 'ยังไม่มีการตรวจวันนี้' })
    const bubble = FlexBuilderService.build(d, 'alt', ctx).contents as any
    const rows = bubble.body.contents[0].contents

    assert.equal(rows[rows.length - 1].text, 'ยังไม่มีการตรวจวันนี้')
  })

  test('ไม่มีข้อมูลและไม่ระบุ emptyText ใช้ข้อความเริ่มต้น', ({ assert }) => {
    const ctx: BuildContext = { placeholders: {}, tables: { doctor_summary: [] } }
    const bubble = FlexBuilderService.build(tableDesign(), 'alt', ctx).contents as any
    const rows = bubble.body.contents[0].contents

    assert.equal(rows[rows.length - 1].text, 'ไม่พบข้อมูล')
  })

  test('item ที่หาไม่เจอแสดง emptyText พร้อมคำเตือน ไม่ทำให้การ์ดพัง', ({ assert }) => {
    const result = FlexBuilderService.build(tableDesign(), 'alt', emptyCtx)
    const rows = (result.contents as any).body.contents[0].contents

    assert.equal(rows[rows.length - 1].text, 'ไม่พบข้อมูล')
    assert.lengthOf(result.warnings, 1)
    assert.include(result.warnings[0], 'doctor_summary')
  })

  test('ตัดแถวที่เกิน maxRows แล้วบอกจำนวนที่เหลือ', ({ assert }) => {
    const ctx: BuildContext = {
      placeholders: {},
      tables: {
        doctor_summary: Array.from({ length: 20 }, (_, i) => ({
          doctor_name: `นพ.${i}`,
          opd: i,
        })),
      },
    }
    const bubble = FlexBuilderService.build(tableDesign({ maxRows: 5 }), 'alt', ctx).contents as any
    const rows = bubble.body.contents[0].contents

    // หัวตาราง 1 + ข้อมูล 5 + บรรทัดสรุป 1
    assert.lengthOf(rows, 7)
    assert.equal(rows[6].text, '…และอีก 15 รายการ')
  })

  test('maxRows เกิน 30 ถูกบีบลงเหลือ 30', ({ assert }) => {
    const ctx: BuildContext = {
      placeholders: {},
      tables: {
        doctor_summary: Array.from({ length: 50 }, (_, i) => ({ doctor_name: `น.${i}`, opd: i })),
      },
    }
    const bubble = FlexBuilderService.build(tableDesign({ maxRows: 999 }), 'alt', ctx)
      .contents as any

    assert.lengthOf(bubble.body.contents[0].contents, 32)
  })

  test('ไม่ระบุ maxRows ใช้ค่าเริ่มต้น 15', ({ assert }) => {
    const ctx: BuildContext = {
      placeholders: {},
      tables: {
        doctor_summary: Array.from({ length: 20 }, (_, i) => ({ doctor_name: `น.${i}`, opd: i })),
      },
    }
    const bubble = FlexBuilderService.build(tableDesign(), 'alt', ctx).contents as any

    assert.lengthOf(bubble.body.contents[0].contents, 17)
  })

  test('ค่า null ในเซลล์แสดงเป็นขีด และตัวเลขมีคอมมา', ({ assert }) => {
    const ctx: BuildContext = {
      placeholders: {},
      tables: { doctor_summary: [{ doctor_name: null, opd: 1234 }] },
    }
    const bubble = FlexBuilderService.build(tableDesign(), 'alt', ctx).contents as any
    const row = bubble.body.contents[0].contents[1]

    assert.equal(row.contents[0].text, '-')
    assert.equal(row.contents[1].text, '1,234')
  })

  test('ตัวเลขที่ driver คืนมาเป็นสตริงก็จัดรูปแบบเหมือนกัน', ({ assert }) => {
    const ctx: BuildContext = {
      placeholders: {},
      tables: { doctor_summary: [{ doctor_name: 'นพ.ก', opd: '9876' }] },
    }
    const bubble = FlexBuilderService.build(tableDesign(), 'alt', ctx).contents as any

    assert.equal(bubble.body.contents[0].contents[1].contents[1].text, '9,876')
  })
})

test.group('FlexBuilderService.build — ขีดจำกัดขนาด', () => {
  function bigDesign(noteCount: number) {
    return design(
      Array.from({ length: noteCount }, (_, i) => ({
        id: `n${i}`,
        type: 'note' as const,
        text: 'ก'.repeat(200),
      }))
    )
  }

  test('payload ปกติไม่มีคำเตือน', ({ assert }) => {
    const result = FlexBuilderService.build(bigDesign(1), 'alt', emptyCtx)

    assert.isBelow(result.bytes, 8_000)
    assert.lengthOf(result.warnings, 0)
  })

  test('payload เกิน 8KB ยังส่งได้แต่มีคำเตือน', ({ assert }) => {
    let count = 2
    let result = FlexBuilderService.build(bigDesign(count), 'alt', emptyCtx)
    while (result.bytes <= 8_000 && count < 40) {
      count += 1
      result = FlexBuilderService.build(bigDesign(count), 'alt', emptyCtx)
    }

    assert.isAbove(result.bytes, 8_000)
    assert.isAtLeast(result.warnings.length, 1)
    assert.include(result.warnings[0], 'ไม่เข้าห้อง LINE')
  })

  test('payload เกิน 10KB ถูกปฏิเสธพร้อมบอกบล็อกที่ใหญ่ที่สุด', ({ assert }) => {
    const d = design([
      { id: 'small', type: 'note', text: 'สั้น' },
      { id: 'huge', type: 'note', text: 'ก'.repeat(12_000) },
    ])

    assert.throws(() => FlexBuilderService.build(d, 'alt', emptyCtx), /huge/)
  })

  test('ตารางที่ข้อมูลจริงยาวเกินงบ ถูกลดแถวลงจนส่งได้ ไม่ throw', ({ assert }) => {
    // ข้อความไทยกิน 3 bytes ต่อตัวอักษร ตาราง 30 แถวที่มีชื่อแพทย์จริงจึงทะลุ
    // 10KB เพดานแถวตายตัวรับประกันขนาดไม่ได้ builder ต้องลดแถวเองแทนการโยนทิ้ง
    const ctx: BuildContext = {
      placeholders: {},
      tables: {
        doctor_summary: Array.from({ length: 50 }, (_, i) => ({
          doctor_name: `นายแพทย์ทดสอบ ${i}`,
          opd: i * 111,
        })),
      },
    }
    const result = FlexBuilderService.build(tableDesign({ maxRows: 30 }), 'alt', ctx)
    const rows = (result.contents as any).body.contents[0].contents

    assert.isBelow(result.bytes, 10_000)
    assert.isBelow(rows.length, 32, 'ต้องลดแถวลงจากเพดาน 30')
    assert.isTrue(
      result.warnings.some((w) => w.includes('ลดจำนวนแถว')),
      'ต้องบอกผู้ใช้ว่าแถวถูกลด'
    )
  })

  test('บรรทัดสรุปยังบอกจำนวนที่เหลือถูกต้องหลังถูกลดแถว', ({ assert }) => {
    const ctx: BuildContext = {
      placeholders: {},
      tables: {
        doctor_summary: Array.from({ length: 50 }, (_, i) => ({
          doctor_name: `นายแพทย์ทดสอบ ${i}`,
          opd: i * 111,
        })),
      },
    }
    const result = FlexBuilderService.build(tableDesign({ maxRows: 30 }), 'alt', ctx)
    const rows = (result.contents as any).body.contents[0].contents
    const shownDataRows = rows.length - 2 // หักหัวตารางกับบรรทัดสรุป

    assert.equal(rows[rows.length - 1].text, `…และอีก ${50 - shownDataRows} รายการ`)
  })

  test('ข้อผิดพลาดขนาดเกินเป็น FlexTooLargeError ที่บอกจำนวน bytes', ({ assert }) => {
    const d = design([{ id: 'huge', type: 'note', text: 'ก'.repeat(12_000) }])

    try {
      FlexBuilderService.build(d, 'alt', emptyCtx)
      assert.fail('ควร throw')
    } catch (err: any) {
      assert.equal(err.name, 'FlexTooLargeError')
      assert.isAbove(err.bytes, 10_000)
      assert.equal(err.heaviestBlockId, 'huge')
    }
  })
})

test.group('FlexBuilderService.buildPlainText', () => {
  test('ไม่ส่ง ctx คง {placeholder} ไว้', ({ assert }) => {
    const d = design([{ id: 'h', type: 'header', title: 'สรุป {org_name}' }])

    assert.include(FlexBuilderService.buildPlainText(d), '{org_name}')
  })

  test('ส่ง ctx แล้วแทนค่า', ({ assert }) => {
    const d = design([{ id: 'h', type: 'header', title: 'สรุป {org_name}' }])
    const ctx: BuildContext = { placeholders: { org_name: 'รพ.ทดสอบ' }, tables: {} }

    assert.include(FlexBuilderService.buildPlainText(d, ctx), 'รพ.ทดสอบ')
  })

  test('kpi และ list กลายเป็นบรรทัด ป้าย: ค่า', ({ assert }) => {
    const d = design([
      { id: 'k', type: 'kpi', columns: 2, cells: [{ label: 'OPD', value: '250', unit: 'ราย' }] },
      { id: 'l', type: 'list', rows: [{ label: 'X-ray', value: '28' }] },
    ])
    const text = FlexBuilderService.buildPlainText(d)

    assert.include(text, 'OPD: 250 ราย')
    assert.include(text, 'X-ray: 28')
  })

  test('ตารางแสดงคอลัมน์แรกเป็นหัวบรรทัด ที่เหลือคั่นด้วยทับ', ({ assert }) => {
    const d = design([
      {
        id: 't',
        type: 'table',
        itemKey: 'doc',
        columns: [
          { source: 'name', label: 'แพทย์', flex: 5 },
          { source: 'opd', label: 'OPD', flex: 2 },
          { source: 'ipd', label: 'IPD', flex: 2 },
        ],
      },
    ])
    const ctx: BuildContext = {
      placeholders: {},
      tables: { doc: [{ name: 'นพ.สมชาย', opd: 12, ipd: 3 }] },
    }

    assert.include(FlexBuilderService.buildPlainText(d, ctx), 'นพ.สมชาย: 12 / 3')
  })

  test('ตารางที่ไม่มีข้อมูลแสดง emptyText', ({ assert }) => {
    const d = design([
      {
        id: 't',
        type: 'table',
        itemKey: 'doc',
        emptyText: 'ไม่มีข้อมูล',
        columns: [{ source: 'name', label: 'แพทย์', flex: 5 }],
      },
    ])

    assert.include(FlexBuilderService.buildPlainText(d), 'ไม่มีข้อมูล')
  })

  test('ตารางที่เกิน maxRows บอกจำนวนที่เหลือ', ({ assert }) => {
    const d = design([
      {
        id: 't',
        type: 'table',
        itemKey: 'doc',
        maxRows: 2,
        columns: [{ source: 'name', label: 'แพทย์', flex: 5 }],
      },
    ])
    const ctx: BuildContext = {
      placeholders: {},
      tables: { doc: Array.from({ length: 6 }, (_, i) => ({ name: `น.${i}` })) },
    }

    assert.include(FlexBuilderService.buildPlainText(d, ctx), '…และอีก 4 รายการ')
  })

  test('บล็อก image ไม่ปรากฏในข้อความสำรอง', ({ assert }) => {
    const d = design([
      { id: 'i', type: 'image', url: 'https://example.com/a.png' },
      { id: 'n', type: 'note', text: 'หมายเหตุ' },
    ])

    const text = FlexBuilderService.buildPlainText(d)
    assert.notInclude(text, 'example.com')
    assert.include(text, 'หมายเหตุ')
  })

  test('button แสดงข้อความพร้อมลิงก์', ({ assert }) => {
    const d = design([
      { id: 'b', type: 'button', label: 'ดู Dashboard', uri: 'https://example.com' },
    ])

    assert.include(FlexBuilderService.buildPlainText(d), 'ดู Dashboard: https://example.com')
  })

  test('ไม่มีบรรทัดว่างติดกันเกินสองบรรทัด', ({ assert }) => {
    const d = design([
      { id: 'h', type: 'header', title: 'หัวข้อ' },
      { id: 's', type: 'separator' },
      { id: 'n', type: 'note', text: 'หมายเหตุ' },
    ])

    assert.notMatch(FlexBuilderService.buildPlainText(d), /\n{3,}/)
  })
})

test.group('FlexBuilderService.extractVariables', () => {
  test('เก็บ placeholder จาก title, subtitle, kpi, list และ note', ({ assert }) => {
    const d = design([
      { id: 'h', type: 'header', title: '{org_name}', subtitle: '{date_th}' },
      { id: 'k', type: 'kpi', columns: 2, cells: [{ label: 'OPD', value: '{vn}' }] },
      { id: 'l', type: 'list', rows: [{ label: 'X-ray', value: '{xray}' }] },
      { id: 'n', type: 'note', text: 'ค้าง {total_no_cc_pe} ราย' },
    ])

    assert.sameMembers(FlexBuilderService.extractVariables(d), [
      'org_name',
      'date_th',
      'vn',
      'xray',
      'total_no_cc_pe',
    ])
  })

  test('เก็บ itemKey ของบล็อกตารางด้วย', ({ assert }) => {
    const d = design([
      {
        id: 't',
        type: 'table',
        itemKey: 'doctor_summary',
        columns: [{ source: 'name', label: 'แพทย์', flex: 5 }],
      },
    ])

    assert.deepEqual(FlexBuilderService.extractVariables(d), ['doctor_summary'])
  })

  test('ไม่เก็บชื่อคอลัมน์ของตารางเป็นตัวแปร', ({ assert }) => {
    const d = design([
      {
        id: 't',
        type: 'table',
        itemKey: 'doc',
        columns: [{ source: 'doctor_name', label: 'แพทย์', flex: 5 }],
      },
    ])

    assert.notInclude(FlexBuilderService.extractVariables(d), 'doctor_name')
  })

  test('รวม placeholder จาก altText', ({ assert }) => {
    assert.deepEqual(FlexBuilderService.extractVariables(design([]), 'สรุป {date} ยอด {vn}'), [
      'date',
      'vn',
    ])
  })

  test('ไม่มีตัวแปรซ้ำ', ({ assert }) => {
    const d = design([
      { id: 'h', type: 'header', title: '{vn}' },
      { id: 'n', type: 'note', text: '{vn}' },
    ])

    assert.deepEqual(FlexBuilderService.extractVariables(d), ['vn'])
  })

  test('เก็บ placeholder จาก label และ uri ของปุ่ม', ({ assert }) => {
    const d = design([
      { id: 'b', type: 'button', label: 'ดู {org_name}', uri: 'https://x.test/{date}' },
    ])

    assert.sameMembers(FlexBuilderService.extractVariables(d), ['org_name', 'date'])
  })
})

test.group('FlexBuilderService.build — พื้นหลัง gradient และ hero image', () => {
  test('theme.background เป็น gradient คอมไพล์เป็น background object ไม่ใช่ backgroundColor', ({ assert }) => {
    const d = design([])
    d.theme = {
      background: { type: 'linearGradient', angle: '135deg', startColor: '#4F46E5', endColor: '#06B6D4' },
    }
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.isUndefined(bubble.body.backgroundColor)
    assert.deepEqual(bubble.body.background, {
      type: 'linearGradient',
      angle: '135deg',
      startColor: '#4F46E5',
      endColor: '#06B6D4',
    })
  })

  test('theme.background เป็น string ยังคอมไพล์เป็น backgroundColor เหมือนเดิม', ({ assert }) => {
    const d = design([])
    d.theme = { background: '#0F172A' }
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.equal(bubble.body.backgroundColor, '#0F172A')
    assert.isUndefined(bubble.body.background)
  })

  test('บล็อกรูปที่ hero:true ไปอยู่ที่ bubble.hero ไม่ใช่ body.contents', ({ assert }) => {
    const d = design([
      { id: 'i', type: 'image', url: 'https://example.com/a.png', hero: true },
      { id: 'n', type: 'note', text: 'หมายเหตุ' },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.equal(bubble.hero.type, 'image')
    assert.equal(bubble.hero.url, 'https://example.com/a.png')
    // body ต้องเหลือแค่บล็อก note ไม่มีรูปซ้ำอยู่ข้างใน
    assert.lengthOf(bubble.body.contents, 1)
  })

  test('รูป hero ตัวที่สองถูกลดเป็นรูปธรรมดาพร้อมคำเตือน', ({ assert }) => {
    const d = design([
      { id: 'i1', type: 'image', url: 'https://example.com/a.png', hero: true },
      { id: 'i2', type: 'image', url: 'https://example.com/b.png', hero: true },
    ])
    const result = FlexBuilderService.build(d, 'alt', emptyCtx)
    const bubble = result.contents as any

    assert.equal(bubble.hero.url, 'https://example.com/a.png')
    assert.lengthOf(bubble.body.contents, 1)
    assert.equal(bubble.body.contents[0].url, 'https://example.com/b.png')
    assert.isAtLeast(result.warnings.length, 1)
  })

  test('ไม่มีบล็อกรูปเลยไม่มี key hero ใน bubble', ({ assert }) => {
    const d = design([{ id: 'n', type: 'note', text: 'x' }])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.isUndefined(bubble.hero)
  })
})

test.group('FlexBuilderService.build — สีกำหนดเองบน kpi/note/header/list', () => {
  test('kpi cell ที่กำหนด bg/color/border เองทับโทนสำเร็จรูป', ({ assert }) => {
    const d = design([
      {
        id: 'k',
        type: 'kpi',
        columns: 2,
        cells: [{ label: 'OPD', value: '10', bg: '#1E293B', color: '#38BDF8', border: '#334155' }],
      },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const cell = bubble.body.contents[0].contents[0].contents[0]

    assert.equal(cell.backgroundColor, '#1E293B')
    assert.equal(cell.borderColor, '#334155')
    assert.equal(cell.contents[1].color, '#38BDF8')
    // กำหนด bg เองแปลว่าเป็นธีมเข้ม ป้ายจึงใช้เทาอ่อนคงที่แทนโทนสำเร็จรูป
    assert.equal(cell.contents[0].color, '#94A3B8')
  })

  test('kpi cell bg สีอ่อน (พาสเทล) ต้องใช้ labelColor ที่ระบุเอง ไม่ใช่เทาอ่อนที่เดาไว้', ({ assert }) => {
    // บั๊กที่เจอจริงตอนสร้าง preset พาสเทล: ถ้าเดา labelColor จาก bg เสมอ
    // จะได้ป้ายสีเทาอ่อนบนพื้นสีอ่อน (#EDE9FE) อ่านไม่ออก ต้องให้ระบุเองได้
    const d = design([
      {
        id: 'k',
        type: 'kpi',
        columns: 2,
        cells: [{ label: 'OPD', value: '10', bg: '#EDE9FE', color: '#7C3AED', labelColor: '#6D28D9' }],
      },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const cell = bubble.body.contents[0].contents[0].contents[0]

    assert.equal(cell.contents[0].color, '#6D28D9')
  })

  test('kpi cell bg โดยไม่ระบุ labelColor ยังเดาเป็นเทาอ่อนเหมือนเดิม (ธีมเข้ม)', ({ assert }) => {
    const d = design([
      { id: 'k', type: 'kpi', columns: 2, cells: [{ label: 'OPD', value: '10', bg: '#1E293B' }] },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const cell = bubble.body.contents[0].contents[0].contents[0]

    assert.equal(cell.contents[0].color, '#94A3B8')
  })

  test('kpi variant chip รวมป้าย+ค่าในบรรทัดเดียว พื้นโปร่งแสง', ({ assert }) => {
    const d = design([
      {
        id: 'k',
        type: 'kpi',
        columns: 2,
        variant: 'chip',
        cells: [{ label: 'IPD', value: '45' }],
      },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const chip = bubble.body.contents[0].contents[0].contents[0]

    assert.equal(chip.cornerRadius, 'xxl')
    assert.equal(chip.contents[0].text, 'IPD 45')
  })

  test('kpi variant stat แสดงค่าก่อนแล้วป้ายเล็กด้านล่าง ไม่มีกล่องพื้นสี', ({ assert }) => {
    const d = design([
      { id: 'k', type: 'kpi', columns: 2, variant: 'stat', cells: [{ label: 'OPD', value: '10' }] },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const cell = bubble.body.contents[0].contents[0].contents[0]

    assert.isUndefined(cell.backgroundColor)
    assert.equal(cell.contents[0].text, '10')
    assert.equal(cell.contents[1].text, 'OPD')
  })

  test('note ที่กำหนด bg/color เองทับโทนสำเร็จรูป', ({ assert }) => {
    const d = design([{ id: 'n', type: 'note', text: 'x', bg: '#0B0F19', color: '#F472B6' }])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const box = bubble.body.contents[0].contents[0]

    assert.equal(box.backgroundColor, '#0B0F19')
    assert.equal(box.contents[0].color, '#F472B6')
  })

  test('header ที่กำหนด background เป็น gradient + titleColor เอง', ({ assert }) => {
    const d = design([
      {
        id: 'h',
        type: 'header',
        title: 'x',
        background: { type: 'linearGradient', angle: '90deg', startColor: '#F472B6', endColor: '#A78BFA' },
        titleColor: '#F472B6',
      },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const header = bubble.body.contents[0]

    assert.deepEqual(header.background, {
      type: 'linearGradient', angle: '90deg', startColor: '#F472B6', endColor: '#A78BFA',
    })
    assert.equal(header.contents[0].color, '#F472B6')
  })

  test('header ที่มี metricValue+metricLabel แสดงตัวเลขใหญ่กลางบล็อก', ({ assert }) => {
    const d = design([
      { id: 'h', type: 'header', title: 'สรุป', metricValue: '{vn}', metricLabel: 'ราย (OPD)' },
    ])
    const ctx: BuildContext = { placeholders: { vn: '250' }, tables: {} }
    const bubble = FlexBuilderService.build(d, 'alt', ctx).contents as any
    const header = bubble.body.contents[0]

    assert.equal(header.contents[1].text, '250')
    assert.equal(header.contents[1].size, '3xl')
    assert.equal(header.contents[2].text, 'ราย (OPD)')
  })

  test('header ที่ไม่มี metricLabel คู่กันไม่แสดงตัวเลขใหญ่', ({ assert }) => {
    const d = design([{ id: 'h', type: 'header', title: 'สรุป', metricValue: '250' }])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.lengthOf(bubble.body.contents[0].contents, 1)
  })

  test('list ที่มี heading+stripeColor ห่อด้วยแถบสีข้าง', ({ assert }) => {
    const d = design([
      {
        id: 'l',
        type: 'list',
        heading: 'ผู้ป่วย',
        stripeColor: '#2563EB',
        rows: [{ label: 'OPD', value: '10' }],
      },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const wrap = bubble.body.contents[0]

    assert.equal(wrap.layout, 'horizontal')
    assert.equal(wrap.contents[0].backgroundColor, '#2563EB')
    assert.equal(wrap.contents[1].contents[0].text, 'ผู้ป่วย')
  })

  test('list ธรรมดาไม่มี heading/stripeColor ยังเป็นรายการแบนเหมือนเดิม', ({ assert }) => {
    const d = design([{ id: 'l', type: 'list', rows: [{ label: 'OPD', value: '10' }] }])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.equal(bubble.body.contents[0].layout, 'vertical')
  })

  test('list.labelColor ทับสีป้ายทุกแถว', ({ assert }) => {
    const d = design([
      { id: 'l', type: 'list', labelColor: '#94A3B8', rows: [{ label: 'OPD', value: '10' }] },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.equal(bubble.body.contents[0].contents[0].contents[0].color, '#94A3B8')
  })

  test('list row.color ทับโทนสำเร็จรูปของค่า', ({ assert }) => {
    const d = design([
      { id: 'l', type: 'list', rows: [{ label: 'x', value: '10', color: '#E2E8F0' }] },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.equal(bubble.body.contents[0].contents[0].contents[1].color, '#E2E8F0')
  })
})

test.group('FlexBuilderService.build — separator ตกแต่งและ progress', () => {
  test('separator ปกติยังเป็นเส้นบางเหมือนเดิม', ({ assert }) => {
    const d = design([{ id: 's', type: 'separator' }])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.equal(bubble.body.contents[0].contents[0].type, 'separator')
  })

  test('separator ที่มี thickness กลายเป็นแถบทึบเต็มขอบ ไม่ใช่เส้นบาง', ({ assert }) => {
    const d = design([{ id: 's', type: 'separator', thickness: '4px', color: '#2563EB' }])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const node = bubble.body.contents[0]

    assert.equal(node.type, 'box')
    assert.equal(node.height, '4px')
    assert.equal(node.backgroundColor, '#2563EB')
  })

  test('separator ที่มี background gradient คอมไพล์เป็น background object', ({ assert }) => {
    const d = design([
      {
        id: 's',
        type: 'separator',
        thickness: '3px',
        background: { type: 'linearGradient', angle: '90deg', startColor: '#F472B6', endColor: '#A78BFA' },
      },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.deepEqual(bubble.body.contents[0].background, {
      type: 'linearGradient', angle: '90deg', startColor: '#F472B6', endColor: '#A78BFA',
    })
  })

  test('progress สร้างแถบยาวตาม percent และแสดงค่า', ({ assert }) => {
    const d = design([
      {
        id: 'p',
        type: 'progress',
        rows: [{ label: 'X-ray', value: '93', percent: 93, color: '#14B8A6' }],
      },
    ])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any
    const row = bubble.body.contents[0].contents[0]

    assert.equal(row.contents[0].text, 'X-ray')
    assert.equal(row.contents[1].contents[0].width, '93%')
    assert.equal(row.contents[1].contents[0].backgroundColor, '#14B8A6')
    assert.equal(row.contents[2].text, '93')
  })

  test('progress percent เกิน 100 ถูกจำกัดไว้ที่ 100', ({ assert }) => {
    const d = design([{ id: 'p', type: 'progress', rows: [{ label: 'x', value: 'x', percent: 150 }] }])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.equal(bubble.body.contents[0].contents[0].contents[1].contents[0].width, '100%')
  })

  test('progress percent ติดลบถูกจำกัดไว้ที่ 0', ({ assert }) => {
    const d = design([{ id: 'p', type: 'progress', rows: [{ label: 'x', value: 'x', percent: -10 }] }])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.equal(bubble.body.contents[0].contents[0].contents[1].contents[0].width, '0%')
  })

  test('progress ไม่ระบุสีใช้สีเขียวอมฟ้าเป็นค่าเริ่มต้น', ({ assert }) => {
    const d = design([{ id: 'p', type: 'progress', rows: [{ label: 'x', value: 'x', percent: 50 }] }])
    const bubble = FlexBuilderService.build(d, 'alt', emptyCtx).contents as any

    assert.equal(bubble.body.contents[0].contents[0].contents[1].contents[0].backgroundColor, '#14B8A6')
  })
})

test.group('FlexBuilderService.buildPlainText — บล็อกใหม่', () => {
  test('header ที่มี metric แสดงเป็นบรรทัด "ค่า ป้าย"', ({ assert }) => {
    const d = design([
      { id: 'h', type: 'header', title: 'สรุป', metricValue: '250', metricLabel: 'ราย (OPD)' },
    ])

    assert.include(FlexBuilderService.buildPlainText(d), '250 ราย (OPD)')
  })

  test('list heading ปรากฏเป็นบรรทัดแรกของกลุ่ม', ({ assert }) => {
    const d = design([
      { id: 'l', type: 'list', heading: 'ผู้ป่วย', rows: [{ label: 'OPD', value: '10' }] },
    ])
    const text = FlexBuilderService.buildPlainText(d)

    assert.include(text, 'ผู้ป่วย')
    assert.include(text, 'OPD: 10')
  })

  test('progress แสดงเป็นบรรทัด "ป้าย: ค่า (percent%)"', ({ assert }) => {
    const d = design([
      { id: 'p', type: 'progress', rows: [{ label: 'X-ray', value: '93', percent: 93 }] },
    ])

    assert.include(FlexBuilderService.buildPlainText(d), 'X-ray: 93 (93%)')
  })
})

test.group('FlexBuilderService.extractVariables — บล็อกใหม่', () => {
  test('เก็บ placeholder จาก metricValue/metricLabel ของ header', ({ assert }) => {
    const d = design([
      { id: 'h', type: 'header', title: 'x', metricValue: '{vn}', metricLabel: 'ราย {org_name}' },
    ])

    assert.sameMembers(FlexBuilderService.extractVariables(d), ['vn', 'org_name'])
  })

  test('เก็บ placeholder จาก heading ของ list', ({ assert }) => {
    const d = design([
      { id: 'l', type: 'list', heading: '{org_name}', rows: [{ label: 'x', value: '{vn}' }] },
    ])

    assert.sameMembers(FlexBuilderService.extractVariables(d), ['org_name', 'vn'])
  })

  test('เก็บ placeholder จาก progress rows', ({ assert }) => {
    const d = design([
      { id: 'p', type: 'progress', rows: [{ label: '{name}', value: '{val}', percent: 50 }] },
    ])

    assert.sameMembers(FlexBuilderService.extractVariables(d), ['name', 'val'])
  })
})
