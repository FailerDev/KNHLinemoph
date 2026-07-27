import { readFileSync } from 'node:fs'
import path from 'node:path'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'

export interface TableDrift {
  table: string
  /** อยู่ใน schema.sql แต่ไม่มีใน DB จริง — ต้องรัน ALTER เพื่ออัปเดต */
  missingInDb: string[]
  /** มีใน DB จริงแต่ไม่มีใน schema.sql — schema.sql อาจไม่ทันสมัย หรือมีคนเพิ่มคอลัมน์เองนอกรอบ */
  extraInDb: string[]
  /** true = ทั้งตารางยังไม่ถูกสร้างใน DB เลย */
  tableMissing: boolean
}

export interface DriftResult {
  /** false เมื่ออ่านไฟล์ schema.sql ไม่ได้ (เช่น deploy แล้วลืม copy) */
  available: boolean
  reason?: string
  hasDrift: boolean
  tables: TableDrift[]
  checkedAt: string
}

/**
 * แยกชื่อคอลัมน์จาก CREATE TABLE แต่ละก้อนใน schema.sql
 *
 * ไม่ใช่ตัวแยก SQL แบบทั่วไป — ปรับให้เข้ากับรูปแบบที่ไฟล์นี้เขียนเองเท่านั้น:
 * แต่ละบรรทัดคอลัมน์ขึ้นต้นด้วย `ชื่อคอลัมน์` ตามด้วยชนิดข้อมูล ส่วนบรรทัด
 * PRIMARY KEY / UNIQUE KEY / KEY และบรรทัดต่อของ COMMENT ที่ล้นบรรทัด (เช่น
 * result_mode) จะไม่ขึ้นต้นด้วย backtick จึงแยกออกจากกันได้ด้วย regex ต่อบรรทัด
 * แทนที่จะแยกด้วยเครื่องหมายจุลภาค (คอมม่าในข้อความ COMMENT จะทำให้พังได้)
 */
export function parseSchemaTables(sql: string): Record<string, string[]> {
  const tables: Record<string, string[]> = {}
  const tableRe = /CREATE TABLE `(\w+)` \(\n([\s\S]*?)\n\) ENGINE=/g
  const colRe = /^\s*`([a-zA-Z0-9_]+)`\s+[A-Za-z]/gm

  let tableMatch: RegExpExecArray | null
  while ((tableMatch = tableRe.exec(sql))) {
    const [, tableName, body] = tableMatch
    const columns: string[] = []
    let colMatch: RegExpExecArray | null
    colRe.lastIndex = 0
    while ((colMatch = colRe.exec(body))) {
      columns.push(colMatch[1])
    }
    tables[tableName] = columns
  }
  return tables
}

/**
 * SchemaDriftService — เทียบ database/schema.sql (สิ่งที่โค้ดคาดหวัง) กับ
 * โครงสร้างจริงของ APP database ที่เชื่อมต่ออยู่ (สิ่งที่มีอยู่จริง)
 *
 * ใช้ information_schema.columns อ่านจาก DB จริง ไม่ต้องมีสิทธิ์พิเศษเกินกว่า
 * ที่แอปใช้เชื่อมต่ออยู่แล้ว เจตนาไว้ให้แอดมินเห็นตอนเข้าหน้า Settings ว่า
 * production DB ยังตามหลัง schema.sql ที่มากับ build นี้หรือไม่ — ก่อนที่
 * ปัญหาจะไปโผล่เป็น error ตอนใช้งานจริง
 */
export default class SchemaDriftService {
  private static schemaPath(): string {
    return path.join(process.cwd(), 'database', 'schema.sql')
  }

  static async checkDrift(): Promise<DriftResult> {
    const checkedAt = new Date().toISOString()

    let sql: string
    try {
      sql = readFileSync(this.schemaPath(), 'utf8')
    } catch (err: any) {
      return {
        available: false,
        reason: `ไม่พบไฟล์ database/schema.sql (${err?.message ?? err})`,
        hasDrift: false,
        tables: [],
        checkedAt,
      }
    }

    const expected = parseSchemaTables(sql)

    const dbName = env.get('DB_DATABASE') as string
    // db.rawQuery คืน [rows, fields] แบบ driver mysql2 ดิบ — ตามรูปแบบเดียวกับ
    // ที่ cron_service.ts ใช้อยู่แล้วตอน dump `SHOW CREATE TABLE`
    const queryResult = await db
      .connection('mysql')
      .rawQuery(
        'SELECT table_name AS table_name, column_name AS column_name FROM information_schema.columns WHERE table_schema = ?',
        [dbName]
      )
    const rows = queryResult[0] as Array<{ table_name: string; column_name: string }>

    const actual = new Map<string, Set<string>>()
    for (const row of rows) {
      const key = row.table_name.toLowerCase()
      if (!actual.has(key)) actual.set(key, new Set())
      actual.get(key)!.add(row.column_name)
    }

    const tables: TableDrift[] = []
    for (const [table, expectedCols] of Object.entries(expected)) {
      const actualCols = actual.get(table.toLowerCase())

      if (!actualCols) {
        tables.push({ table, missingInDb: expectedCols, extraInDb: [], tableMissing: true })
        continue
      }

      const missingInDb = expectedCols.filter((c) => !actualCols.has(c))
      const extraInDb = [...actualCols].filter((c) => !expectedCols.includes(c))

      if (missingInDb.length > 0 || extraInDb.length > 0) {
        tables.push({ table, missingInDb, extraInDb, tableMissing: false })
      }
    }

    return { available: true, hasDrift: tables.length > 0, tables, checkedAt }
  }
}
