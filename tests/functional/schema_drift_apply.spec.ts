import { test } from '@japa/runner'
import SchemaDriftService from '#services/schema_drift_service'

/**
 * ทดสอบกับ APP DB จริง (functional) — ไม่จำลอง drift ปลอมใน DB จริงเพราะเสี่ยง
 * ต่อโครงสร้างจริง แค่ยืนยันพฤติกรรมความปลอดภัยพื้นฐาน: ถ้าไม่มีส่วนต่างจริง
 * (schema.sql ตรงกับ DB) ต้องไม่มีการรัน ALTER ใด ๆ เลยและคืนค่าว่างเปล่า
 */
test.group('SchemaDriftService.applyMissingColumns — ปลอดภัยเมื่อไม่มี drift', () => {
  test('ไม่มี drift จริง -> ไม่รัน SQL อะไรเลย คืน applied ว่างเปล่า', async ({ assert }) => {
    const before = await SchemaDriftService.checkDrift()
    if (!before.available || before.hasDrift) {
      // ข้ามเทสต์นี้ถ้าสภาพแวดล้อมมี drift อยู่จริง — ไม่ใช่สิ่งที่เทสต์นี้ต้องยืนยัน
      return
    }

    const result = await SchemaDriftService.applyMissingColumns()
    assert.deepEqual(result.applied, [])
    assert.isFalse(result.drift.hasDrift)
  })
})
