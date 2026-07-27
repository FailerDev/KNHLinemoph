import { test } from '@japa/runner'
import FlexPreviewService from '#services/flex_preview_service'
import FlexBuilderService from '#services/flex_builder_service'
import { parseFlexDesign } from '#validators/flex_design'
import type { FlexDesign } from '#types/flex_design'

const design: FlexDesign = {
  version: 1,
  blocks: [
    { id: 'h', type: 'header', title: 'สรุป {org_name}', subtitle: '{date_th}' },
    { id: 'k', type: 'kpi', columns: 2, cells: [{ label: 'OPD', value: '{vn}' }] },
    {
      id: 't',
      type: 'table',
      itemKey: 'doctor_summary',
      columns: [
        { source: 'name', label: 'แพทย์', flex: 5 },
        { source: 'opd', label: 'OPD', flex: 2, align: 'end' },
      ],
    },
  ],
}

test.group('FlexPreviewService', () => {
  test('เติมค่าจำลองให้ทุกตัวแปรที่ยังไม่มีค่า', async ({ assert }) => {
    const ctx = await FlexPreviewService.buildContext(design, false)

    assert.isString(ctx.placeholders.org_name)
    assert.isNotEmpty(ctx.placeholders.org_name)
    assert.isString(ctx.placeholders.date_th)
    assert.equal(ctx.placeholders.vn, '123')
  })

  test('สร้างแถวจำลองที่คอลัมน์ตรงกับที่บล็อกตารางประกาศไว้', async ({ assert }) => {
    const ctx = await FlexPreviewService.buildContext(design, false)
    const rows = ctx.tables.doctor_summary

    assert.lengthOf(rows, 3)
    assert.property(rows[0], 'name')
    assert.property(rows[0], 'opd')
  })

  test('ตัวอย่างไม่เหลือ {placeholder} ดิบให้ผู้ใช้เห็น', async ({ assert }) => {
    const ctx = await FlexPreviewService.buildContext(design, false)
    const built = FlexBuilderService.build(design, 'สรุป {org_name} {date_th}', ctx)

    assert.notInclude(JSON.stringify(built.contents), '{vn}')
    assert.notInclude(built.altText, '{')
  })

  test('ตัวอย่างไม่มีคำเตือนเรื่องหา item ตารางไม่เจอ', async ({ assert }) => {
    const ctx = await FlexPreviewService.buildContext(design, false)
    const built = FlexBuilderService.build(design, 'alt', ctx)

    assert.lengthOf(built.warnings, 0)
  })

  test('โหมดไม่ live ไม่แตะฐาน HIS เลย', async ({ assert }) => {
    // ถ้าเผลอไปเรียก fetchItemData จะพังหรือช้าเพราะ HIS อาจไม่พร้อมในเครื่อง dev
    const started = Date.now()
    await FlexPreviewService.buildContext(design, false)

    assert.isBelow(Date.now() - started, 2000)
  })
})

test.group('parseFlexDesign กับข้อมูลที่ผ่าน builder จริง', () => {
  test('นิยามที่ builder ผลิตผ่าน validator', async ({ assert }) => {
    const parsed = await parseFlexDesign(JSON.stringify(design))
    assert.lengthOf(parsed.blocks, 3)
  })

  test('นิยามที่ผ่าน validator แล้วคอมไพล์ได้จริง', async ({ assert }) => {
    const parsed = await parseFlexDesign(JSON.stringify(design))
    const ctx = await FlexPreviewService.buildContext(parsed, false)
    const built = FlexBuilderService.build(parsed, 'alt', ctx)

    assert.equal((built.contents as any).type, 'bubble')
    assert.lengthOf((built.contents as any).body.contents, 3)
  })
})
