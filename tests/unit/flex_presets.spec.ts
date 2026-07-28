import { test } from '@japa/runner'
import { ALL_FLEX_PRESETS } from '#data/flex_presets'
import { parseFlexDesign } from '#validators/flex_design'
import FlexBuilderService from '#services/flex_builder_service'
import type { BuildContext } from '#types/flex_design'

/** ค่าจำลองครอบคลุมทั้งตัวแปรระบบ รายการข้อมูลจริง และตัวแปร CDCU */
function sampleContext(vars: string[]): BuildContext {
  const placeholders: Record<string, string> = {
    date: '2026-07-27',
    time: '14:05:00',
    date_th: '27 กรกฎาคม 2569',
    weekday: 'วันจันทร์',
    org_name: 'โรงพยาบาลตัวอย่าง',
    site_title: 'ระบบแจ้งเตือน',
    site_footer: '',
  }
  for (const key of vars) {
    if (placeholders[key] === undefined) placeholders[key] = '42'
  }
  return { placeholders, tables: {} }
}

test.group('การ์ดสำเร็จรูป (flex_presets.ts) — ผ่าน validator จริง', () => {
  for (const preset of ALL_FLEX_PRESETS) {
    test(`${preset.id}: นิยามบล็อกผ่าน flexDesignValidator`, async ({ assert }) => {
      const parsed = await parseFlexDesign(JSON.stringify(preset.design))
      assert.isAbove(parsed.blocks.length, 0)
    })
  }
})

test.group('การ์ดสำเร็จรูป — คอมไพล์ได้จริงและไม่เกินขีดจำกัดขนาด', () => {
  for (const preset of ALL_FLEX_PRESETS) {
    test(`${preset.id}: คอมไพล์สำเร็จ ไม่มี {placeholder} หลงเหลือ`, ({ assert }) => {
      const vars = FlexBuilderService.extractVariables(preset.design, preset.altText)
      const ctx = sampleContext(vars)

      const result = FlexBuilderService.build(preset.design, preset.altText, ctx)

      assert.equal((result.contents as any).type, 'bubble')
      assert.notInclude(result.altText, '{')
      assert.notInclude(JSON.stringify(result.contents), '{vn}')
      assert.isBelow(result.bytes, 10_000, `${preset.id} ใหญ่เกิน 10KB (${result.bytes} bytes)`)
    })

    test(`${preset.id}: ข้อความสำรอง (plain text) ไม่ว่างเปล่า`, ({ assert }) => {
      const vars = FlexBuilderService.extractVariables(preset.design, preset.altText)
      const ctx = sampleContext(vars)
      const text = FlexBuilderService.buildPlainText(preset.design, ctx)

      assert.isAbove(text.trim().length, 0)
    })
  }

  test('preset id ไม่ซ้ำกันทั้งชุด', ({ assert }) => {
    const ids = ALL_FLEX_PRESETS.map((p) => p.id)
    assert.equal(new Set(ids).size, ids.length)
  })

  test('มีอย่างน้อยหนึ่ง preset ในหมวด cdcu', ({ assert }) => {
    assert.isTrue(ALL_FLEX_PRESETS.some((p) => p.category === 'cdcu'))
  })

  test('preset หมวด general มีครบ 10 ดีไซน์ (9 ตามสเปกเดิม + ส้มดอกจานแท่งสัดส่วน)', ({
    assert,
  }) => {
    const general = ALL_FLEX_PRESETS.filter((p) => p.category === 'general')
    assert.lengthOf(general, 10)
  })
})
