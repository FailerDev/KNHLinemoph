import { test } from '@japa/runner'
import LineApiService, { type LineApiTarget } from '#services/line_api_service'

const target: LineApiTarget = {
  apiUrl: 'https://example.test/api/notify/send',
  clientKey: 'ck',
  secretKey: 'sk',
}

/** แทน global fetch ด้วยคำตอบที่กำหนดไว้ล่วงหน้า และเก็บ body ที่ถูกส่ง */
function stubFetch(responses: Array<{ status: number; body: string }>) {
  const calls: Array<{ url: string; body: string }> = []
  let index = 0
  const original = globalThis.fetch

  globalThis.fetch = (async (url: string, init: any) => {
    calls.push({ url: String(url), body: String(init?.body ?? '') })
    const res = responses[Math.min(index, responses.length - 1)]
    index += 1
    return {
      status: res.status,
      text: async () => res.body,
    }
  }) as unknown as typeof fetch

  return {
    calls,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

test.group('LineApiService — ตีความผลลัพธ์จาก MOPH', (group) => {
  let stub: ReturnType<typeof stubFetch> | null = null

  group.each.teardown(() => {
    stub?.restore()
    stub = null
  })

  test('HTTP 200 พร้อม status 200 ถือว่าสำเร็จ', async ({ assert }) => {
    stub = stubFetch([{ status: 200, body: '{"status":200,"message":"Succesfully"}' }])

    const result = await LineApiService.sendMessage(target, 'สวัสดี', { timeout: 5 })

    assert.isTrue(result.success)
    assert.equal(result.apiStatus, 200)
    assert.equal(result.attempts, 1)
  })

  test('HTTP 200 พร้อม status 401 ถือว่าล้มเหลว และไม่ retry', async ({ assert }) => {
    // MOPH ตอบ HTTP 200 แม้ key ผิด สถานะจริงอยู่ใน body เท่านั้น
    // ตรรกะเดิมดู HTTP status อย่างเดียว จึงบันทึกการส่งที่ล้มเหลวว่าสำเร็จ
    stub = stubFetch([{ status: 200, body: '{"status":401,"message":"Unauthorized"}' }])

    const result = await LineApiService.sendMessage(target, 'สวัสดี', { timeout: 5 })

    assert.isFalse(result.success)
    assert.equal(result.code, 200)
    assert.equal(result.apiStatus, 401)
    assert.equal(result.attempts, 1)
    assert.lengthOf(stub.calls, 1)
  })

  test('HTTP 200 ที่ body ไม่ใช่ JSON ถือว่าสำเร็จ', async ({ assert }) => {
    stub = stubFetch([{ status: 200, body: 'OK' }])

    const result = await LineApiService.sendMessage(target, 'สวัสดี', { timeout: 5 })

    assert.isTrue(result.success)
    assert.isNull(result.apiStatus)
  })

  test('HTTP 500 ลองใหม่จนครบแล้วรายงานล้มเหลว', async ({ assert }) => {
    stub = stubFetch([{ status: 500, body: 'server error' }])

    const result = await LineApiService.sendMessage(target, 'สวัสดี', {
      timeout: 5,
      maxRetries: 2,
    })

    assert.isFalse(result.success)
    assert.equal(result.attempts, 3)
    assert.lengthOf(stub.calls, 3)
  }).timeout(5000)

  test('HTTP 400 ไม่ retry', async ({ assert }) => {
    stub = stubFetch([{ status: 400, body: 'bad request' }])

    const result = await LineApiService.sendMessage(target, 'สวัสดี', { timeout: 5 })

    assert.isFalse(result.success)
    assert.lengthOf(stub.calls, 1)
  })

  test('HTTP 200 พร้อม status 500 ยัง retry เพราะเป็นความผิดฝั่ง server', async ({ assert }) => {
    stub = stubFetch([{ status: 200, body: '{"status":500}' }])

    const result = await LineApiService.sendMessage(target, 'สวัสดี', {
      timeout: 5,
      maxRetries: 1,
    })

    assert.isFalse(result.success)
    assert.lengthOf(stub.calls, 2)
  }).timeout(5000)
})

test.group('LineApiService.sendPayload', (group) => {
  let stub: ReturnType<typeof stubFetch> | null = null

  group.each.teardown(() => {
    stub?.restore()
    stub = null
  })

  test('ส่ง messages array ตามที่ให้มาโดยไม่ดัดแปลง', async ({ assert }) => {
    stub = stubFetch([{ status: 200, body: '{"status":200}' }])
    const bubble = { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } }

    await LineApiService.sendPayload(
      target,
      [{ type: 'flex', altText: 'สรุปรายวัน', contents: bubble }],
      { timeout: 5 }
    )

    const sent = JSON.parse(stub.calls[0].body)
    assert.deepEqual(sent, {
      messages: [{ type: 'flex', altText: 'สรุปรายวัน', contents: bubble }],
    })
  })

  test('messages ว่างคืน 400 โดยไม่ยิง request', async ({ assert }) => {
    stub = stubFetch([{ status: 200, body: '{"status":200}' }])

    const result = await LineApiService.sendPayload(target, [], { timeout: 5 })

    assert.isFalse(result.success)
    assert.equal(result.code, 400)
    assert.lengthOf(stub.calls, 0)
  })

  test('sendMessage ส่งเป็น message ชนิด text', async ({ assert }) => {
    stub = stubFetch([{ status: 200, body: '{"status":200}' }])

    await LineApiService.sendMessage(target, 'สวัสดี', { timeout: 5 })

    const sent = JSON.parse(stub.calls[0].body)
    assert.deepEqual(sent, { messages: [{ type: 'text', text: 'สวัสดี' }] })
  })

  test('ข้อความว่างคืน 400 โดยไม่ยิง request', async ({ assert }) => {
    stub = stubFetch([{ status: 200, body: '{"status":200}' }])

    const result = await LineApiService.sendMessage(target, '   ', { timeout: 5 })

    assert.isFalse(result.success)
    assert.equal(result.code, 400)
    assert.lengthOf(stub.calls, 0)
  })

  test('ส่ง header client-key และ secret-key', async ({ assert }) => {
    stub = stubFetch([{ status: 200, body: '{"status":200}' }])
    let seenHeaders: Record<string, string> = {}

    const original = globalThis.fetch
    globalThis.fetch = (async (_url: string, init: any) => {
      seenHeaders = init.headers
      return { status: 200, text: async () => '{"status":200}' }
    }) as unknown as typeof fetch

    await LineApiService.sendMessage(target, 'สวัสดี', { timeout: 5 })
    globalThis.fetch = original

    assert.equal(seenHeaders['client-key'], 'ck')
    assert.equal(seenHeaders['secret-key'], 'sk')
    assert.equal(seenHeaders['Content-Type'], 'application/json')
  })
})
