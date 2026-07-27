import { test } from '@japa/runner'
import NotificationTemplate from '#models/notification_template'
import NotificationService from '#services/notification_service'
import type { FlexDesign } from '#types/flex_design'

/**
 * ยืนยันว่าเทมเพลต flex เดินทางครบวงจรผ่านฐานข้อมูลจริง
 *
 * unit test จับจุดนี้ไม่ได้ เพราะ MariaDB เก็บคอลัมน์ JSON เป็น longtext
 * แล้วคืนมาเป็น string ส่วน MySQL 8 คืนเป็น object ที่ parse แล้ว
 * ถ้า consume ของ model พังจะรู้ตอนส่งจริงเท่านั้น
 */
const TEST_TEMPLATE_NAME = '__flex roundtrip test__'

const testDesign: FlexDesign = {
  version: 1,
  size: 'mega',
  theme: { primary: '#1E3A8A' },
  blocks: [
    { id: 'h', type: 'header', title: 'ทดสอบ Flex', subtitle: '{org_name} • {date_th}' },
    {
      id: 'k',
      type: 'kpi',
      columns: 2,
      cells: [
        { label: 'ตัวอย่าง A', value: '123', unit: 'ราย', tone: 'info' },
        { label: 'ตัวอย่าง B', value: '45', unit: 'ราย', tone: 'ok' },
      ],
    },
    { id: 'n', type: 'note', text: 'ข้อความทดสอบ', tone: 'warn' },
  ],
}

async function removeTestTemplates() {
  await NotificationTemplate.query().where('template_name', TEST_TEMPLATE_NAME).delete()
}

test.group('เทมเพลต flex เดินทางผ่าน DB ได้ครบ', (group) => {
  group.each.setup(async () => {
    await removeTestTemplates()
    return () => removeTestTemplates()
  })

  test('บันทึกแล้วอ่านกลับได้นิยามบล็อกเดิม', async ({ assert }) => {
    const tpl = new NotificationTemplate()
    tpl.templateName = TEST_TEMPLATE_NAME
    tpl.templateContent = 'ทดสอบ Flex {date_th}'
    tpl.messageType = 'flex'
    tpl.altText = 'ทดสอบ Flex {date_th}'
    tpl.flexDesign = testDesign
    tpl.variables = ['org_name', 'date_th']
    tpl.isActive = true
    await tpl.save()

    const reloaded = await NotificationTemplate.findOrFail(tpl.id)

    assert.equal(reloaded.messageType, 'flex')
    assert.isNotNull(reloaded.flexDesign)
    assert.deepEqual(reloaded.flexDesign, testDesign)
  })

  test('buildPayload สร้าง flex message ที่ส่งได้จริง', async ({ assert }) => {
    const tpl = new NotificationTemplate()
    tpl.templateName = TEST_TEMPLATE_NAME
    tpl.templateContent = 'ทดสอบ Flex {date_th}'
    tpl.messageType = 'flex'
    tpl.altText = 'ทดสอบ Flex {date_th}'
    tpl.flexDesign = testDesign
    tpl.variables = ['org_name', 'date_th']
    tpl.isActive = true
    await tpl.save()

    const payload = await NotificationService.buildPayload(tpl.id, [])

    assert.equal(payload.messageType, 'flex')
    assert.lengthOf(payload.messages, 1)

    const message = payload.messages[0] as any
    assert.equal(message.type, 'flex')
    assert.equal(message.contents.type, 'bubble')
    assert.equal(message.contents.body.layout, 'vertical')
    assert.lengthOf(message.contents.body.contents, 3)

    // {date_th} ต้องถูกแทนค่าแล้ว ไม่หลงเหลือใน altText
    assert.notInclude(message.altText, '{date_th}')
    assert.equal(payload.logText, message.altText)
  })

  test('เทมเพลต text เดิมยังได้ payload ชนิด text เหมือนเดิม', async ({ assert }) => {
    const tpl = new NotificationTemplate()
    tpl.templateName = TEST_TEMPLATE_NAME
    tpl.templateContent = 'สรุปวันที่ {date_th}'
    tpl.messageType = 'text'
    tpl.variables = ['date_th']
    tpl.isActive = true
    await tpl.save()

    const payload = await NotificationService.buildPayload(tpl.id, [])

    assert.equal(payload.messageType, 'text')
    assert.equal((payload.messages[0] as any).type, 'text')
    assert.notInclude(payload.logText, '{date_th}')
    assert.lengthOf(payload.warnings, 0)
  })

  test('เทมเพลต flex ที่ flex_design เสียถอยไปส่งข้อความธรรมดา', async ({ assert }) => {
    const tpl = new NotificationTemplate()
    tpl.templateName = TEST_TEMPLATE_NAME
    tpl.templateContent = 'ข้อความสำรอง {date_th}'
    tpl.messageType = 'flex'
    tpl.altText = 'alt'
    // บล็อก note ยาวเกิน 10KB และไม่มีตารางให้ลดแถว จึงคอมไพล์ไม่ผ่าน
    tpl.flexDesign = {
      version: 1,
      blocks: [{ id: 'huge', type: 'note', text: 'ก'.repeat(12_000) }],
    }
    tpl.isActive = true
    await tpl.save()

    const payload = await NotificationService.buildPayload(tpl.id, [])

    assert.equal(payload.messageType, 'text')
    assert.isAtLeast(payload.warnings.length, 1)
    assert.include(payload.warnings[0], 'คอมไพล์ Flex ล้มเหลว')
    // ยังต้องมีเนื้อหาส่งออกไป ไม่ใช่ข้อความว่าง
    assert.isAbove(payload.logText.trim().length, 0)
  })
})
