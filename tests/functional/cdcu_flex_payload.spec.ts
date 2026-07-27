import { test } from '@japa/runner'
import NotificationTemplate from '#models/notification_template'
import CdcuService from '#services/cdcu_service'
import type { FlexDesign } from '#types/flex_design'

/**
 * CdcuService.buildPayload คือเมธอด private — เข้าถึงผ่าน cast `as any` ในเทสต์
 * เจตนา ไม่ export ออกไปเป็น public API เพียงเพื่อให้เทสต์เรียกได้
 */
const svc = CdcuService as any

const TEST_TEMPLATE_NAME = '__cdcu flex payload test__'

const flexDesign: FlexDesign = {
  version: 1,
  blocks: [
    { id: 'h', type: 'header', title: 'แจ้งเตือน CDCU', subtitle: '{org_name} • {icd10}' },
    { id: 'n', type: 'note', text: 'ผู้ป่วย {pt_name} HN:{hn}', tone: 'danger' },
  ],
}

const patient = { pt_name: 'นายxxxสันต์', hn: '123456', icd10: 'A90', vn: '999' }

async function removeTestTemplates() {
  await NotificationTemplate.query().where('template_name', TEST_TEMPLATE_NAME).delete()
}

test.group('CdcuService.buildPayload', (group) => {
  group.each.setup(async () => {
    await removeTestTemplates()
    return () => removeTestTemplates()
  })

  test('ไม่มี templateId ใช้ข้อความ default เสมอ', async ({ assert }) => {
    const payload = await svc.buildPayload(null, patient, 'รพ.ทดสอบ')

    assert.equal(payload.messageType, 'text')
    assert.equal(payload.messages[0].type, 'text')
    assert.include(payload.logText, 'นายxxxสันต์')
  })

  test('เทมเพลต text แทนค่า patient ลงในข้อความ', async ({ assert }) => {
    const tpl = new NotificationTemplate()
    tpl.templateName = TEST_TEMPLATE_NAME
    tpl.templateContent = 'ผู้ป่วย {pt_name} ICD:{icd10} ที่ {org_name}'
    tpl.messageType = 'text'
    tpl.isActive = true
    await tpl.save()

    const payload = await svc.buildPayload(tpl.id, patient, 'รพ.ทดสอบ')

    assert.equal(payload.messageType, 'text')
    assert.equal(payload.logText, 'ผู้ป่วย นายxxxสันต์ ICD:A90 ที่ รพ.ทดสอบ')
  })

  test('เทมเพลต flex คอมไพล์เป็น flex message จริง', async ({ assert }) => {
    const tpl = new NotificationTemplate()
    tpl.templateName = TEST_TEMPLATE_NAME
    tpl.templateContent = 'สำรอง'
    tpl.messageType = 'flex'
    tpl.altText = 'แจ้งเตือน {icd10}'
    tpl.flexDesign = flexDesign
    tpl.isActive = true
    await tpl.save()

    const payload = await svc.buildPayload(tpl.id, patient, 'รพ.ทดสอบ')

    assert.equal(payload.messageType, 'flex')
    const message = payload.messages[0]
    assert.equal(message.type, 'flex')
    assert.equal(message.contents.type, 'bubble')
    assert.notInclude(message.altText, '{icd10}')
    assert.equal(message.altText, 'แจ้งเตือน A90')

    // ชื่อที่ mask แล้วต้องไปโผล่ในบล็อก ไม่ใช่ชื่อจริง (การ mask ต้องเกิดก่อนเข้าฟังก์ชันนี้)
    const noteText = message.contents.body.contents[1].contents[0].contents[0].text
    assert.include(noteText, 'นายxxxสันต์')
  })

  test('เทมเพลต flex ที่คอมไพล์ล้มเหลวถอยไปส่งข้อความธรรมดาแทน', async ({ assert }) => {
    const tpl = new NotificationTemplate()
    tpl.templateName = TEST_TEMPLATE_NAME
    tpl.templateContent = 'สำรอง {pt_name}'
    tpl.messageType = 'flex'
    tpl.altText = 'alt'
    tpl.flexDesign = {
      version: 1,
      blocks: [{ id: 'huge', type: 'note', text: 'ก'.repeat(12_000) }],
    }
    tpl.isActive = true
    await tpl.save()

    const payload = await svc.buildPayload(tpl.id, patient, 'รพ.ทดสอบ')

    assert.equal(payload.messageType, 'text')
    assert.isAbove(payload.logText.trim().length, 0)
  })

  test('templateId ที่ไม่มีอยู่จริงถอยไปใช้ข้อความ default', async ({ assert }) => {
    const payload = await svc.buildPayload(999_999, patient, 'รพ.ทดสอบ')

    assert.equal(payload.messageType, 'text')
    assert.include(payload.logText, 'นายxxxสันต์')
  })
})
