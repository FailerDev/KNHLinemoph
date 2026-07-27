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
