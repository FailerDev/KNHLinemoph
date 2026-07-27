import env from '#start/env'

export interface LineApiResult {
  /** HTTP status code (0 = network error) */
  code: number
  /**
   * ค่า `status` ที่แกะจาก JSON body ของ MOPH — null เมื่อ body ไม่ใช่ JSON
   * หรือไม่มี field นี้ MOPH ตอบ HTTP 200 แม้ key ผิด สถานะจริงอยู่ตรงนี้
   */
  apiStatus: number | null
  response: string
  success: boolean
  attempts: number
}

export interface LineApiTarget {
  apiUrl: string
  clientKey: string
  secretKey: string
}

export type LineMessage =
  | { type: 'text'; text: string }
  | { type: 'flex'; altText: string; contents: Record<string, unknown> }

export interface LineApiOptions {
  timeout?: number
  maxRetries?: number
}

/**
 * LINE / MOPH push API client.
 *
 * Port of app/lib/LineAPI.php. Uses Node's built-in fetch with an
 * AbortController for timeout. Retries on 5xx and network errors
 * with the same exponential backoff schedule as the PHP original
 * (300ms, 600ms, 1200ms).
 */
export default class LineApiService {
  /** ส่ง messages array ตรง ๆ — รองรับทั้ง text และ flex */
  static async sendPayload(
    target: LineApiTarget,
    messages: LineMessage[],
    options: LineApiOptions = {}
  ): Promise<LineApiResult> {
    if (!Array.isArray(messages) || messages.length === 0) {
      return {
        code: 400,
        apiStatus: null,
        response: 'Message payload is empty',
        success: false,
        attempts: 0,
      }
    }

    const timeoutSec = options.timeout ?? env.get('LINE_API_TIMEOUT', 30)
    const maxRetries = Math.max(0, options.maxRetries ?? 2)

    const body = JSON.stringify({ messages })
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'client-key': target.clientKey,
      'secret-key': target.secretKey,
    }

    let attempt = 0
    let last: LineApiResult = {
      code: 0,
      apiStatus: null,
      response: 'Not attempted',
      success: false,
      attempts: 0,
    }

    while (attempt <= maxRetries) {
      attempt++
      const result = await this.doRequest(target.apiUrl, headers, body, timeoutSec)
      last = { ...result, attempts: attempt }

      if (result.success) return last

      // client error ไม่ว่ามาจาก HTTP หรือจาก body — ลองใหม่ไปก็ได้ผลเดิม
      if (result.code >= 400 && result.code < 500) break
      if (result.apiStatus !== null && result.apiStatus >= 400 && result.apiStatus < 500) break

      if (attempt <= maxRetries) {
        const delayMs = 300 * 2 ** (attempt - 1)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    last.success = false
    return last
  }

  static async sendMessage(
    target: LineApiTarget,
    message: string,
    options: LineApiOptions = {}
  ): Promise<LineApiResult> {
    const trimmed = String(message ?? '').trim()
    if (!trimmed) {
      return {
        code: 400,
        apiStatus: null,
        response: 'Message is empty',
        success: false,
        attempts: 0,
      }
    }

    return this.sendPayload(target, [{ type: 'text', text: message }], options)
  }

  private static async doRequest(
    url: string,
    headers: Record<string, string>,
    body: string,
    timeoutSec: number
  ): Promise<Omit<LineApiResult, 'attempts'>> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutSec * 1000)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      })
      const text = await res.text()

      const httpOk = res.status >= 200 && res.status < 300
      const apiStatus = this.parseApiStatus(text)
      const apiOk = apiStatus === null || (apiStatus >= 200 && apiStatus < 300)

      return {
        code: res.status,
        apiStatus,
        response: text,
        success: httpOk && apiOk,
      }
    } catch (err: any) {
      return {
        code: 0,
        apiStatus: null,
        response: 'Network error: ' + (err?.message ?? String(err)),
        success: false,
      }
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * MOPH ตอบ HTTP 200 เกือบทุกกรณี แม้ key ผิด — สถานะจริงอยู่ใน field
   * `status` ของ JSON body ตาม E:\line\MOPH_FLEX_GUIDE.md
   */
  private static parseApiStatus(body: string): number | null {
    try {
      const parsed = JSON.parse(body)
      if (parsed && typeof parsed === 'object' && typeof parsed.status === 'number') {
        return parsed.status
      }
    } catch {
      // body ไม่ใช่ JSON — ปล่อยให้ HTTP status ตัดสินอย่างเดียว
    }
    return null
  }
}
