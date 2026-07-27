import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from '@japa/runner'
import SchemaDriftService, {
  parseSchemaTables,
  parseSchemaColumnDefinitions,
} from '#services/schema_drift_service'

test.group('parseSchemaTables — แยกคอลัมน์จาก CREATE TABLE', () => {
  test('แยกชื่อคอลัมน์พื้นฐานได้ถูกต้อง', ({ assert }) => {
    const sql = `
CREATE TABLE \`widgets\` (
  \`id\`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  \`name\`       VARCHAR(200)  NOT NULL,
  \`is_active\`  TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`
    const tables = parseSchemaTables(sql)
    assert.deepEqual(tables.widgets, ['id', 'name', 'is_active'])
  })

  test('บรรทัด COMMENT ที่ล้นไปบรรทัดถัดไปไม่ถูกนับเป็นคอลัมน์ซ้ำ (result_mode)', ({
    assert,
  }) => {
    const sql = `
CREATE TABLE \`notification_items\` (
  \`id\`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  \`row_separator\` VARCHAR(50)   NULL     COMMENT 'ตัวคั่นระหว่างแถว เช่น \\n หรือ , — ค่าเริ่มต้น \\n',
  \`result_mode\`   ENUM('single','joined','rows') NOT NULL DEFAULT 'single'
                   COMMENT 'single=แถวแรกเป็นคอลัมน์, joined=ทุกแถวต่อกันเป็นข้อความ, rows=array ดิบสำหรับตาราง Flex',
  \`created_at\`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`
    const tables = parseSchemaTables(sql)
    assert.deepEqual(tables.notification_items, [
      'id',
      'row_separator',
      'result_mode',
      'created_at',
    ])
  })

  test('คอมม่าในข้อความ COMMENT ไม่ทำให้แยกคอลัมน์ผิด (icd10_codes)', ({ assert }) => {
    const sql = `
CREATE TABLE \`cdcu_watch_groups\` (
  \`id\`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  \`group_name\`    VARCHAR(200)  NOT NULL,
  \`icd10_codes\`   LONGTEXT      NOT NULL COMMENT 'JSON array of ICD-10 codes to watch, e.g. ["A90","A91","J09"]',
  \`template_id\`   INT UNSIGNED  NULL     COMMENT 'FK notification_templates; NULL = use built-in default message',
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`
    const tables = parseSchemaTables(sql)
    assert.deepEqual(tables.cdcu_watch_groups, [
      'id',
      'group_name',
      'icd10_codes',
      'template_id',
    ])
  })

  test('อ่านไฟล์ database/schema.sql จริง — notification_templates ต้องมีคอลัมน์ Flex', ({
    assert,
  }) => {
    const sql = readFileSync(path.join(process.cwd(), 'database', 'schema.sql'), 'utf8')
    const tables = parseSchemaTables(sql)

    assert.isDefined(tables.notification_templates)
    assert.includeMembers(tables.notification_templates, [
      'message_type',
      'flex_design',
      'alt_text',
      'variables',
    ])

    assert.isDefined(tables.cdcu_watch_groups)
    assert.include(tables.cdcu_watch_groups, 'icd10_codes')

    assert.isDefined(tables.notification_items)
    assert.include(tables.notification_items, 'result_mode')
  })
})

test.group('parseSchemaColumnDefinitions — แยกนิยามคอลัมน์เต็มสำหรับสร้าง ALTER SQL', () => {
  test('เก็บ type/NULL/DEFAULT ต่อคอลัมน์ ตัดคอมม่าท้ายบรรทัดออก', ({ assert }) => {
    const sql = `
CREATE TABLE \`widgets\` (
  \`id\`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  \`message_type\` ENUM('text','flex') NOT NULL DEFAULT 'text',
  \`flex_design\`  JSON NULL COMMENT 'block definition used when message_type=flex',
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`
    const defs = parseSchemaColumnDefinitions(sql)
    assert.equal(defs.widgets.id, 'INT UNSIGNED  NOT NULL AUTO_INCREMENT')
    assert.equal(defs.widgets.message_type, "ENUM('text','flex') NOT NULL DEFAULT 'text'")
    assert.equal(
      defs.widgets.flex_design,
      "JSON NULL COMMENT 'block definition used when message_type=flex'"
    )
  })
})

test.group('SchemaDriftService.generateAlterSql — SQL แนะนำสำหรับ copy ไปรันเอง', () => {
  const schemaSql = `
CREATE TABLE \`notification_templates\` (
  \`id\`               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  \`template_name\`    VARCHAR(200)  NOT NULL,
  \`message_type\`     ENUM('text','flex') NOT NULL DEFAULT 'text',
  \`flex_design\`      JSON          NULL     COMMENT 'block definition used when message_type=flex',
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`

  test('คอลัมน์ที่ขาดใน DB ได้ ALTER ... ADD COLUMN ตรงกับ schema.sql', ({ assert }) => {
    const sql = SchemaDriftService.generateAlterSql(
      [
        {
          table: 'notification_templates',
          missingInDb: ['message_type', 'flex_design'],
          extraInDb: [],
          tableMissing: false,
        },
      ],
      schemaSql
    )
    assert.include(
      sql,
      "ALTER TABLE `notification_templates` ADD COLUMN `message_type` ENUM('text','flex') NOT NULL DEFAULT 'text';"
    )
    assert.include(
      sql,
      "ALTER TABLE `notification_templates` ADD COLUMN `flex_design` JSON          NULL     COMMENT 'block definition used when message_type=flex';"
    )
  })

  test('คอลัมน์ที่เกินใน DB ได้แค่คอมเมนต์เตือน ไม่มีคำสั่ง DROP COLUMN ที่รันได้จริง', ({
    assert,
  }) => {
    const sql = SchemaDriftService.generateAlterSql(
      [
        {
          table: 'notification_templates',
          missingInDb: [],
          extraInDb: ['legacy_column'],
          tableMissing: false,
        },
      ],
      schemaSql
    )
    const executableLines = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
    assert.isEmpty(executableLines.filter((l) => l.length > 0))
    assert.include(sql, 'legacy_column')
  })

  test('ตารางที่ยังไม่มีใน DB ได้แค่คอมเมนต์ให้ไปดู schema.sql เอง ไม่สร้างคำสั่ง CREATE TABLE ที่รันได้จริง', ({
    assert,
  }) => {
    const sql = SchemaDriftService.generateAlterSql(
      [{ table: 'brand_new_table', missingInDb: ['id'], extraInDb: [], tableMissing: true }],
      schemaSql
    )
    const executableLines = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
    assert.isEmpty(executableLines.filter((l) => l.length > 0))
    assert.include(sql, 'brand_new_table')
  })
})
