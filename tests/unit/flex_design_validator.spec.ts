import { test } from '@japa/runner'
import { parseFlexDesign } from '#validators/flex_design'

const valid = {
  version: 1,
  size: 'mega',
  theme: { primary: '#1E3A8A' },
  blocks: [
    { id: 'h', type: 'header', title: 'หัวข้อ', subtitle: '{date_th}' },
    { id: 'k', type: 'kpi', columns: 2, cells: [{ label: 'OPD', value: '{vn}', tone: 'info' }] },
    { id: 's', type: 'separator' },
  ],
}

test.group('parseFlexDesign', () => {
  test('รับนิยามบล็อกที่ถูกต้อง', async ({ assert }) => {
    const parsed = await parseFlexDesign(JSON.stringify(valid))
    assert.lengthOf(parsed.blocks, 3)
    assert.equal(parsed.blocks[0].type, 'header')
  })

  test('รับ object ที่ parse มาแล้วได้ด้วย', async ({ assert }) => {
    const parsed = await parseFlexDesign(valid)
    assert.lengthOf(parsed.blocks, 3)
  })

  test('ปฏิเสธ JSON ที่ parse ไม่ได้', async ({ assert }) => {
    await assert.rejects(() => parseFlexDesign('{ ไม่ใช่ json'), /JSON/)
  })

  test('ปฏิเสธค่าว่าง', async ({ assert }) => {
    await assert.rejects(() => parseFlexDesign(''))
    await assert.rejects(() => parseFlexDesign(null))
  })

  test('ปฏิเสธเมื่อไม่มี blocks', async ({ assert }) => {
    await assert.rejects(() => parseFlexDesign(JSON.stringify({ version: 1 })))
  })

  test('ปฏิเสธชนิดบล็อกที่ไม่รู้จัก', async ({ assert }) => {
    const bad = { version: 1, blocks: [{ id: 'x', type: 'carousel' }] }
    await assert.rejects(() => parseFlexDesign(JSON.stringify(bad)))
  })

  test('ปฏิเสธโทนสีที่ไม่อยู่ในห้าค่า', async ({ assert }) => {
    const bad = { version: 1, blocks: [{ id: 'n', type: 'note', text: 'x', tone: 'rainbow' }] }
    await assert.rejects(() => parseFlexDesign(JSON.stringify(bad)))
  })

  test('ปฏิเสธสีธีมที่ไม่ใช่ hex', async ({ assert }) => {
    const bad = { version: 1, theme: { primary: 'red' }, blocks: [] }
    await assert.rejects(() => parseFlexDesign(JSON.stringify(bad)))
  })

  test('ปฏิเสธตารางที่ไม่มีคอลัมน์', async ({ assert }) => {
    const bad = { version: 1, blocks: [{ id: 't', type: 'table', itemKey: 'x', columns: [] }] }
    await assert.rejects(() => parseFlexDesign(JSON.stringify(bad)))
  })

  test('ปฏิเสธ maxRows ที่เกิน 30', async ({ assert }) => {
    const bad = {
      version: 1,
      blocks: [
        {
          id: 't',
          type: 'table',
          itemKey: 'x',
          maxRows: 999,
          columns: [{ source: 'a', label: 'A', flex: 1 }],
        },
      ],
    }
    await assert.rejects(() => parseFlexDesign(JSON.stringify(bad)))
  })

  test('ปฏิเสธ uri ของปุ่มที่ไม่ใช่ URL', async ({ assert }) => {
    const bad = {
      version: 1,
      blocks: [{ id: 'b', type: 'button', label: 'ปุ่ม', uri: 'javascript:alert(1)' }],
    }
    await assert.rejects(() => parseFlexDesign(JSON.stringify(bad)))
  })

  test('รับตารางที่ครบถ้วน', async ({ assert }) => {
    const good = {
      version: 1,
      blocks: [
        {
          id: 't',
          type: 'table',
          itemKey: 'doctor_summary',
          maxRows: 15,
          showHeader: true,
          emptyText: 'ไม่พบข้อมูล',
          columns: [
            { source: 'name', label: 'แพทย์', flex: 5, align: 'start' },
            { source: 'opd', label: 'OPD', flex: 2, align: 'end', tone: 'info' },
          ],
        },
      ],
    }
    const parsed = await parseFlexDesign(JSON.stringify(good))
    assert.equal((parsed.blocks[0] as any).columns.length, 2)
  })

  test('รับ aspectRatio ที่ LINE รองรับ', async ({ assert }) => {
    const good = {
      version: 1,
      blocks: [{ id: 'i', type: 'image', url: 'https://example.com/a.png', aspectRatio: '16:9' }],
    }
    const parsed = await parseFlexDesign(JSON.stringify(good))
    assert.equal((parsed.blocks[0] as any).aspectRatio, '16:9')
  })

  test('ปฏิเสธ aspectRatio ที่ LINE ไม่รองรับ', async ({ assert }) => {
    const bad = {
      version: 1,
      blocks: [{ id: 'i', type: 'image', url: 'https://example.com/a.png', aspectRatio: '5:5' }],
    }
    await assert.rejects(() => parseFlexDesign(JSON.stringify(bad)))
  })

  test('รับสี hex 8 หลักที่มีความโปร่งใส (header.background)', async ({ assert }) => {
    const good = {
      version: 1,
      blocks: [{ id: 'h', type: 'header', title: 'x', background: '#FFFFFF33' }],
    }
    const parsed = await parseFlexDesign(JSON.stringify(good))
    assert.equal((parsed.blocks[0] as any).background, '#FFFFFF33')
  })

  test('ปฏิเสธสี hex ที่ผิดรูปแบบใน header.titleColor', async ({ assert }) => {
    const bad = {
      version: 1,
      blocks: [{ id: 'h', type: 'header', title: 'x', titleColor: 'red' }],
    }
    await assert.rejects(() => parseFlexDesign(JSON.stringify(bad)), /สีตัวอักษรหัวข้อ/)
  })

  test('รับ gradient background ที่ถูกต้องบน theme', async ({ assert }) => {
    const good = {
      version: 1,
      theme: {
        background: { type: 'linearGradient', angle: '135deg', startColor: '#4F46E5', endColor: '#06B6D4' },
      },
      blocks: [],
    }
    const parsed = await parseFlexDesign(JSON.stringify(good))
    assert.deepEqual(parsed.theme!.background, {
      type: 'linearGradient',
      angle: '135deg',
      startColor: '#4F46E5',
      endColor: '#06B6D4',
    })
  })

  test('ปฏิเสธ gradient ที่ไม่มี startColor', async ({ assert }) => {
    const bad = {
      version: 1,
      theme: { background: { type: 'linearGradient', angle: '135deg', endColor: '#06B6D4' } },
      blocks: [],
    }
    await assert.rejects(() => parseFlexDesign(JSON.stringify(bad)), /startColor/)
  })

  test('ปฏิเสธ gradient ที่ type ไม่ใช่ linearGradient', async ({ assert }) => {
    const bad = {
      version: 1,
      theme: { background: { type: 'radial', angle: '135deg', startColor: '#000000', endColor: '#FFFFFF' } },
      blocks: [],
    }
    await assert.rejects(() => parseFlexDesign(JSON.stringify(bad)), /linearGradient/)
  })

  test('ปฏิเสธ angle ที่ไม่มีหน่วย deg', async ({ assert }) => {
    const bad = {
      version: 1,
      theme: { background: { type: 'linearGradient', angle: '135', startColor: '#000000', endColor: '#FFFFFF' } },
      blocks: [],
    }
    await assert.rejects(() => parseFlexDesign(JSON.stringify(bad)), /angle/)
  })

  test('รับบล็อก image ที่ hero:true', async ({ assert }) => {
    const good = {
      version: 1,
      blocks: [{ id: 'i', type: 'image', url: 'https://example.com/a.png', hero: true }],
    }
    const parsed = await parseFlexDesign(JSON.stringify(good))
    assert.isTrue((parsed.blocks[0] as any).hero)
  })

  test('รับบล็อก progress ที่ถูกต้อง', async ({ assert }) => {
    const good = {
      version: 1,
      blocks: [
        {
          id: 'p',
          type: 'progress',
          rows: [{ label: 'X-ray', value: '93%', percent: 93, color: '#14B8A6' }],
        },
      ],
    }
    const parsed = await parseFlexDesign(JSON.stringify(good))
    assert.equal((parsed.blocks[0] as any).rows[0].percent, 93)
  })

  test('ปฏิเสธ progress ที่ percent เกิน 100', async ({ assert }) => {
    const bad = {
      version: 1,
      blocks: [{ id: 'p', type: 'progress', rows: [{ label: 'x', value: 'x', percent: 150 }] }],
    }
    await assert.rejects(() => parseFlexDesign(JSON.stringify(bad)))
  })

  test('รับ kpi cell ที่กำหนดสีเอง (bg/color/border)', async ({ assert }) => {
    const good = {
      version: 1,
      blocks: [
        {
          id: 'k',
          type: 'kpi',
          columns: 2,
          variant: 'card',
          cells: [{ label: 'OPD', value: '10', bg: '#1E293B', color: '#38BDF8', border: '#334155' }],
        },
      ],
    }
    const parsed = await parseFlexDesign(JSON.stringify(good))
    const cell = (parsed.blocks[0] as any).cells[0]
    assert.equal(cell.bg, '#1E293B')
    assert.equal(cell.color, '#38BDF8')
    assert.equal(cell.border, '#334155')
  })

  test('รับ list ที่มี heading + stripeColor (สไตล์แถบข้าง)', async ({ assert }) => {
    const good = {
      version: 1,
      blocks: [
        {
          id: 'l',
          type: 'list',
          heading: 'ผู้ป่วย',
          stripeColor: '#2563EB',
          rows: [{ label: 'OPD', value: '10' }],
        },
      ],
    }
    const parsed = await parseFlexDesign(JSON.stringify(good))
    assert.equal((parsed.blocks[0] as any).stripeColor, '#2563EB')
  })

  test('ปฏิเสธการ์ดที่มีบล็อกเกิน 30 ชิ้น', async ({ assert }) => {
    const bad = {
      version: 1,
      blocks: Array.from({ length: 31 }, (_, i) => ({
        id: `n${i}`,
        type: 'note',
        text: 'x',
      })),
    }
    await assert.rejects(() => parseFlexDesign(JSON.stringify(bad)))
  })
})
