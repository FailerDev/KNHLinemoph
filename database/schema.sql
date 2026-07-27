-- KNHLinemoph — Database Schema
-- Database : line_notify_system
-- Charset  : utf8mb4_unicode_ci
-- Engine   : InnoDB (MySQL 8+ / MariaDB 10.3+)

CREATE DATABASE IF NOT EXISTS `line_notify_system`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `line_notify_system`;

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
CREATE TABLE `users` (
  `id`             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `username`       VARCHAR(100)    NOT NULL,
  `display_name`   VARCHAR(200)    NOT NULL DEFAULT '',
  `password_hash`  VARCHAR(255)    NOT NULL,
  `role`           ENUM('admin','operator','viewer') NOT NULL DEFAULT 'viewer',
  `is_active`      TINYINT(1)      NOT NULL DEFAULT 1,
  `last_login_at`  DATETIME        NULL,
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- line_groups
-- ------------------------------------------------------------
CREATE TABLE `line_groups` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `group_name`  VARCHAR(200)  NOT NULL,
  `client_key`  VARCHAR(255)  NOT NULL DEFAULT '',
  `secret_key`  VARCHAR(255)  NOT NULL DEFAULT '',
  `api_url`     VARCHAR(500)  NOT NULL DEFAULT '',
  `is_active`   TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- notification_templates
-- ------------------------------------------------------------
CREATE TABLE `notification_templates` (
  `id`               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `template_name`    VARCHAR(200)  NOT NULL,
  `template_content` TEXT          NOT NULL,
  `message_type`     ENUM('text','flex') NOT NULL DEFAULT 'text',
  `flex_design`      JSON          NULL     COMMENT 'block definition used when message_type=flex',
  `alt_text`         VARCHAR(400)  NULL     COMMENT 'altText, may contain {placeholder}',
  `variables`        JSON          NULL,
  `is_active`        TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- notification_items
-- ------------------------------------------------------------
CREATE TABLE `notification_items` (
  `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `item_name`    VARCHAR(200)  NOT NULL,
  `item_key`     VARCHAR(100)  NOT NULL,
  `sql_query`    TEXT          NOT NULL,
  `his_database` VARCHAR(100)  NOT NULL DEFAULT 'hos',
  `description`  VARCHAR(500)  NULL,
  `is_active`      TINYINT(1)   NOT NULL DEFAULT 1,
  `row_template`   TEXT         NULL     COMMENT 'format ต่อ 1 แถว เช่น {dept_name}: {cnt} ราย — ถ้าว่างใช้โหมด single-row',
  `row_separator`  VARCHAR(50)  NULL     COMMENT 'ตัวคั่นระหว่างแถว เช่น \n หรือ , — ค่าเริ่มต้น \n',
  `result_mode`    ENUM('single','joined','rows') NOT NULL DEFAULT 'single'
                   COMMENT 'single=แถวแรกเป็นคอลัมน์, joined=ทุกแถวต่อกันเป็นข้อความ, rows=array ดิบสำหรับตาราง Flex',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_item_key` (`item_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ALTER สำหรับ DB ที่มีอยู่แล้ว:
-- ALTER TABLE notification_items
--   ADD COLUMN `row_template`  TEXT        NULL COMMENT 'format ต่อ 1 แถว' AFTER `is_active`,
--   ADD COLUMN `row_separator` VARCHAR(50) NULL COMMENT 'ตัวคั่น เช่น \n' AFTER `row_template`;

-- ------------------------------------------------------------
-- ALTER รองรับ Flex Message (2026-07-27) สำหรับ DB ที่มีอยู่แล้ว
-- คำสั่ง UPDATE เป็นส่วนบังคับ ไม่ใช่ทางเลือก — ถ้าข้าม item ที่ใช้
-- row_template อยู่เดิมจะเปลี่ยนพฤติกรรมเป็น single เงียบ ๆ
-- หมายเหตุ: อย่าใส่ ; ในข้อความ COMMENT เพราะ tool ที่ split ด้วย ; จะพัง
-- ------------------------------------------------------------
-- ALTER TABLE `notification_templates`
--   ADD COLUMN `message_type` ENUM('text','flex') NOT NULL DEFAULT 'text' AFTER `template_content`,
--   ADD COLUMN `flex_design`  JSON         NULL COMMENT 'block definition used when message_type=flex' AFTER `message_type`,
--   ADD COLUMN `alt_text`     VARCHAR(400) NULL COMMENT 'altText, may contain {placeholder}' AFTER `flex_design`;
--
-- ALTER TABLE `notification_items`
--   ADD COLUMN `result_mode` ENUM('single','joined','rows') NOT NULL DEFAULT 'single'
--     COMMENT 'single=first row as columns, joined=all rows joined, rows=raw array for Flex tables'
--     AFTER `row_separator`;
--
-- UPDATE `notification_items`
--    SET `result_mode` = 'joined'
--  WHERE `row_template` IS NOT NULL AND `row_template` <> '';
--
-- ALTER TABLE `notification_logs`
--   ADD COLUMN `message_type` VARCHAR(10) NOT NULL DEFAULT 'text' AFTER `template_id`,
--   ADD COLUMN `api_status`   SMALLINT    NULL COMMENT 'status field parsed from MOPH JSON body' AFTER `status_code`,
--   ADD COLUMN `payload_json` MEDIUMTEXT  NULL COMMENT 'exact messages array sent, used for resend' AFTER `message_content`;

-- ------------------------------------------------------------
-- notification_schedules
-- ------------------------------------------------------------
CREATE TABLE `notification_schedules` (
  `id`              INT UNSIGNED                    NOT NULL AUTO_INCREMENT,
  `schedule_name`   VARCHAR(200)                   NOT NULL,
  `template_id`     INT UNSIGNED                   NULL,
  `group_ids`       JSON                           NULL,
  `item_ids`        JSON                           NULL,
  `send_time`       VARCHAR(8)                     NOT NULL DEFAULT '08:00:00',
  `repeat_enabled`  TINYINT(1)                    NOT NULL DEFAULT 0,
  `repeat_interval` INT                            NULL,
  `repeat_unit`     ENUM('minutes','hours')        NULL,
  `repeat_end_time` VARCHAR(8)                     NULL,
  `next_send_time`  DATETIME                       NULL,
  `days_of_week`    VARCHAR(20)                    NOT NULL DEFAULT '1,2,3,4,5',
  `schedule_mode`   ENUM('weekly','specific','monthly') NOT NULL DEFAULT 'weekly',
  `specific_dates`  JSON                           NULL,
  `is_active`       TINYINT(1)                    NOT NULL DEFAULT 1,
  `last_sent_date`  DATE                           NULL,
  `created_at`      DATETIME                       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME                       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_active_send` (`is_active`, `send_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- notification_logs
-- ------------------------------------------------------------
CREATE TABLE `notification_logs` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `schedule_id`     INT UNSIGNED  NULL,
  `group_id`        INT UNSIGNED  NULL,
  `template_id`     INT UNSIGNED  NULL,
  `message_type`    VARCHAR(10)   NOT NULL DEFAULT 'text',
  `status_code`     SMALLINT      NULL,
  `api_status`      SMALLINT      NULL     COMMENT 'status field parsed from MOPH JSON body',
  `response_text`   TEXT          NULL,
  `message_content` TEXT          NULL,
  `payload_json`    MEDIUMTEXT    NULL     COMMENT 'exact messages array sent, used for resend',
  `sent_at`         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sent_at`     (`sent_at`),
  KEY `idx_schedule_id` (`schedule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- his_databases
-- ------------------------------------------------------------
CREATE TABLE `his_databases` (
  `id`            INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(100)   NOT NULL,
  `host`          VARCHAR(255)   NOT NULL,
  `port`          SMALLINT UNSIGNED NOT NULL DEFAULT 3306,
  `username`      VARCHAR(100)   NOT NULL,
  `password`      VARCHAR(255)   NOT NULL DEFAULT '',
  `database_name` VARCHAR(100)   NOT NULL,
  `description`   VARCHAR(500)   NULL,
  `is_active`     TINYINT(1)    NOT NULL DEFAULT 1,
  `is_default`    TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- system_settings  (PK = setting_key, no integer id)
-- ------------------------------------------------------------
CREATE TABLE `system_settings` (
  `setting_key`   VARCHAR(100)  NOT NULL,
  `setting_value` TEXT          NULL,
  `updated_by`    INT UNSIGNED  NULL,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- audit_log
-- ------------------------------------------------------------
CREATE TABLE `audit_log` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED NULL,
  `username`    VARCHAR(100) NULL,
  `action`      ENUM('create','update','delete','login','logout','login_failed','export','resend','cron_run','test_send') NOT NULL,
  `target_type` ENUM('schedule','template','item','group','user','his_database','settings','log','cron') NULL,
  `target_id`   INT UNSIGNED NULL,
  `description` TEXT         NULL,
  `before_data` JSON         NULL,
  `after_data`  JSON         NULL,
  `ip_address`  VARCHAR(45)  NULL,
  `user_agent`  VARCHAR(500) NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id`    (`user_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- cdcu_watch_groups  (CDCU OPD disease surveillance groups)
-- ------------------------------------------------------------
CREATE TABLE `cdcu_watch_groups` (
  `id`             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `group_name`     VARCHAR(200)  NOT NULL,
  `icd10_codes`    LONGTEXT      NOT NULL COMMENT 'JSON array of ICD-10 codes to watch, e.g. ["A90","A91","J09"]',
  `template_id`    INT UNSIGNED  NULL     COMMENT 'FK notification_templates; NULL = use built-in default message',
  `line_group_ids` LONGTEXT      NOT NULL COMMENT 'JSON array of line_groups.id to notify',
  `his_database`   VARCHAR(100)  NOT NULL DEFAULT 'hos',
  `time_start`     VARCHAR(8)    NULL     COMMENT 'HH:mm:00 — only alert within window; NULL = no limit',
  `time_end`       VARCHAR(8)    NULL     COMMENT 'HH:mm:00',
  `days_of_week`   VARCHAR(20)   NOT NULL DEFAULT '1,2,3,4,5,6,7' COMMENT '1=Sun … 7=Sat',
  `description`    VARCHAR(500)  NULL,
  `is_active`      TINYINT(1)    NOT NULL DEFAULT 1,
  `mask_name`      TINYINT(1)    NOT NULL DEFAULT 0  COMMENT 'เข้ารหัสชื่อผู้ป่วยก่อนส่ง เช่น นายxxxสันต์ xxxภา',
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- cdcu_sent_logs  (deduplication + audit per patient per LINE group)
-- ------------------------------------------------------------
CREATE TABLE `cdcu_sent_logs` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `watch_group_id`  INT UNSIGNED  NOT NULL,
  `vn`              VARCHAR(20)   NOT NULL,
  `icd10`           VARCHAR(20)   NOT NULL,
  `hn`              VARCHAR(20)   NULL,
  `pt_name`         VARCHAR(300)  NULL,
  `line_group_id`   INT UNSIGNED  NULL,
  `status_code`     SMALLINT      NULL,
  `message_content` TEXT          NULL,
  `sent_at`         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vn_icd10_wg_lg` (`vn`, `icd10`, `watch_group_id`, `line_group_id`),
  KEY `idx_sent_at`      (`sent_at`),
  KEY `idx_watch_group`  (`watch_group_id`),
  KEY `idx_vn`           (`vn`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Seed — notification_items (สรุปผู้มารับบริการรายวัน)
-- Port จาก lineHr.php → getPatientStatistics()
-- his_database = 'hos' (HosXP) — ปรับตาม schema จริง
-- ============================================================
INSERT INTO `notification_items`
  (`item_name`, `item_key`, `sql_query`, `his_database`, `description`, `is_active`, `row_template`, `row_separator`)
VALUES
('ผู้ป่วยนอก OPD', 'vn',
 'SELECT COUNT(vn) AS vn FROM vn_stat WHERE vstdate = ''{date}''',
 'hos', 'จำนวน visit OPD ทั้งหมดวันนี้', 1, NULL, NULL),
('ผู้ป่วยใน IPD', 'an',
 'SELECT COUNT(an) AS an FROM ipt WHERE dchdate IS NULL',
 'hos', 'ผู้ป่วยในที่ยังรักษาอยู่ (ไม่ใช้ {date})', 1, NULL, NULL),
('ผู้ป่วย ER', 'er',
 'SELECT COUNT(vn) AS er FROM er_regist WHERE vstdate = ''{date}''',
 'hos', 'ER ทั้งหมดวันนี้', 1, NULL, NULL),
('X-ray', 'xray',
 'SELECT COUNT(vn) AS xray FROM xray_report WHERE report_date = ''{date}''',
 'hos', 'จำนวนรายงาน X-ray วันนี้', 1, NULL, NULL),
('ทันตกรรม', 'dn',
 'SELECT COUNT(vn) AS dn FROM dtmain WHERE vstdate = ''{date}''',
 'hos', 'ผู้รับบริการทันตกรรมวันนี้', 1, NULL, NULL),
('กายภาพบำบัด', 'ph',
 'SELECT COUNT(vn) AS ph FROM physic_main WHERE vstdate = ''{date}''',
 'hos', 'ผู้รับบริการกายภาพบำบัดวันนี้', 1, NULL, NULL),
('แพทย์แผนไทย', 'h1',
 'SELECT COUNT(vn) AS h1 FROM health_med_service WHERE service_date = ''{date}''',
 'hos', 'ผู้รับบริการแพทย์แผนไทยวันนี้', 1, NULL, NULL),
('PCU', 'pcu',
 'SELECT COUNT(vn) AS pcu FROM ovst WHERE vstdate = ''{date}'' AND main_dep = ''026''',
 'hos', 'ผู้รับบริการ PCU วันนี้', 1, NULL, NULL),
('ส่งเสริมสุขภาพ', 'pp',
 'SELECT COUNT(vn) AS pp FROM ovst WHERE vstdate = ''{date}'' AND main_dep = ''003''',
 'hos', 'ผู้รับบริการส่งเสริมสุขภาพวันนี้', 1, NULL, NULL),
('Refer out', 'reo',
 'SELECT COUNT(vn) AS reo FROM referout WHERE refer_date = ''{date}''',
 'hos', 'จำนวนการส่งต่อวันนี้', 1, NULL, NULL),
('Lab รวม', 'total_lab',
 'SELECT COUNT(vn) AS total_lab FROM lab_head WHERE order_date = ''{date}''',
 'hos', 'จำนวน order lab ทั้งหมดวันนี้', 1, NULL, NULL),
('Lab ยืนยันผลแล้ว', 'confirmed_lab',
 'SELECT SUM(CASE WHEN confirm_report = ''y'' THEN 1 ELSE 0 END) AS confirmed_lab
  FROM lab_head WHERE order_date = ''{date}''',
 'hos', 'Lab ที่ยืนยันผลแล้ว', 1, NULL, NULL),
('Lab ยังไม่ยืนยันผล', 'unconfirmed_lab',
 'SELECT SUM(CASE WHEN confirm_report != ''y'' OR confirm_report IS NULL THEN 1 ELSE 0 END) AS unconfirmed_lab
  FROM lab_head WHERE order_date = ''{date}''',
 'hos', 'Lab ที่ยังไม่ยืนยันผล', 1, NULL, NULL),
('ไม่มี CC/PE/PDX (รวม)', 'total_no_cc_pe',
 'SELECT COUNT(*) AS total_no_cc_pe
  FROM vn_stat vn
  LEFT OUTER JOIN opdscreen ou ON ou.vn = vn.vn
  WHERE vn.vstdate = ''{date}''
    AND (vn.pdx = '''' OR vn.pdx IS NULL)
    AND (ou.cc IS NULL OR ou.pe IS NULL)',
 'hos', 'จำนวนผู้ป่วยที่ยังไม่บันทึก CC/PE/PDX', 1, NULL, NULL),
('Authen สำเร็จ', 'authenn',
 'SELECT COUNT(ov.vn) AS authenn
  FROM visit_pttype ov
  JOIN vn_stat vn ON vn.vn = ov.vn
  WHERE auth_code IS NOT NULL
    AND vn.vstdate = ''{date}''',
 'hos', 'Visit ที่ได้ Authen', 1, NULL, NULL),
('Authen ไม่สำเร็จ', 'authen',
 'SELECT COUNT(ov.vn) AS authen
  FROM visit_pttype ov
  JOIN vn_stat vn ON vn.vn = ov.vn
  WHERE auth_code IS NULL
    AND vn.vstdate = ''{date}''',
 'hos', 'Visit ที่ยังไม่ได้ Authen', 1, NULL, NULL),
('EP ปิดสิทธิสำเร็จ', 'ep_success',
 'SELECT COUNT(o.vn) AS ep_success
  FROM ovst o
  LEFT OUTER JOIN vn_stat v ON v.vn = o.vn
  LEFT OUTER JOIN nhso_confirm_privilege c ON c.vn = o.vn
  WHERE o.vstdate = ''{date}''
    AND c.nhso_authen_code IS NOT NULL',
 'hos', 'ปิดสิทธิ Endpoint สำเร็จ', 1, NULL, NULL),
('EP ยังไม่ปิดสิทธิ', 'ep_failed',
 'SELECT COUNT(o.vn) AS ep_failed
  FROM ovst o
  LEFT OUTER JOIN vn_stat v ON v.vn = o.vn
  LEFT OUTER JOIN nhso_confirm_privilege c ON c.vn = o.vn
  WHERE o.vstdate = ''{date}''
    AND (c.nhso_authen_code IS NULL OR c.nhso_authen_code = '''')',
 'hos', 'ยังไม่ปิดสิทธิ Endpoint', 1, NULL, NULL),
('ไม่มี CC/PE/PDX แยกแผนก', 'no_cc_pe_list',
 'SELECT
    k.department    AS department_name,
    COUNT(*)        AS patient_count,
    GROUP_CONCAT(DISTINCT vn.hn ORDER BY vn.hn SEPARATOR '', '') AS patient_info
  FROM vn_stat vn
  LEFT JOIN patient pt    ON pt.hn   = vn.hn
  LEFT JOIN opdscreen ou  ON ou.vn   = vn.vn
  LEFT JOIN ovst ovst     ON ovst.vn = vn.vn
  LEFT JOIN kskdepartment k ON k.depcode = ovst.main_dep
  WHERE vn.vstdate = ''{date}''
    AND (vn.pdx = '''' OR vn.pdx IS NULL)
    AND (ou.cc IS NULL OR ou.pe IS NULL)
  GROUP BY k.department
  ORDER BY patient_count DESC',
 'hos', 'รายละเอียดผู้ป่วยไม่มี CC/PE/PDX แยกตามแผนก (multi-row)', 1,
 'แผนก: {department_name}\nจำนวน: {patient_count} ราย\nHN: {patient_info}\n------------------------------------------',
 '\n');

-- ============================================================
-- Seed — notification_templates (สรุปผู้มารับบริการรายวัน)
-- ============================================================
INSERT INTO `notification_templates`
  (`template_name`, `template_content`, `variables`, `is_active`)
VALUES
('สรุปผู้มารับบริการรายวัน',
'<< สรุป ผู้มารับบริการ >>
วันที่ {date_th}
เวลา {time} น.

*จำนวนผู้มารับบริการ*
ผู้รับบริการผู้ป่วยนอกทั้งหมด = {vn} ราย
ผู้รับบริการในทั้งหมด = {an} ราย
ผู้รับบริการห้องฉุกเฉินทั้งหมด = {er} ราย
ผู้รับบริการ X-ray ทั้งหมด = {xray} ราย
ผู้รับบริการทันตกรรมทั้งหมด = {dn} ราย
ผู้รับบริการกายภาพบำบัดทั้งหมด = {ph} ราย
ผู้รับบริการแผนไทยทั้งหมด = {h1} ราย
ผู้รับบริการ PCU ทั้งหมด = {pcu} ราย
ผู้รับบริการส่งเสริมสุขภาพฯ ทั้งหมด = {pp} ราย
ผู้รับบริการที่มีการส่งต่อทั้งหมด = {reo} ราย

*************************
*รายงานผลการตรวจแล็บ*
จำนวนการตรวจทั้งหมด: {total_lab} ราย
ยืนยันผลแล้ว: {confirmed_lab} ราย
ยังไม่ยืนยันผล: {unconfirmed_lab} ราย

*************************
*รายงานการออก Authen*
นโยบาย Authen 100%

ได้ Authen {authenn} visit
ไม่ได้ Authen {authen} visit

*รายงานการปิดสิทธิ (Endpoint)*

*ปิดสิทธิสำเร็จ*: {ep_success} ราย
*ยังไม่ปิดสิทธิ*: {ep_failed} ราย

*หมายเหตุ*
- ตรวจสอบเฉพาะผู้ป่วย UC ที่มีรายได้ (income > 0)

*************************
*ผู้ป่วยที่ยังไม่บันทึก CC/PE/PDX*
ทั้งหมด: {total_no_cc_pe} ราย
แบ่งตามแผนก:
{no_cc_pe_list}
*************************',
'["vn","an","er","xray","dn","ph","h1","pcu","pp","reo","total_lab","confirmed_lab","unconfirmed_lab","authenn","authen","ep_success","ep_failed","total_no_cc_pe","no_cc_pe_list"]',
1);

-- ============================================================
-- Seed — system_settings default values
-- ============================================================
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `updated_by`) VALUES
  ('site_title',  'ระบบแจ้งเตือน LINE', NULL),
  ('site_footer', 'KNH Line Notification System', NULL),
  ('org_name',    'โรงพยาบาลแก้งสนามนาง', NULL);

-- ============================================================
-- Seed — default admin user
-- password = "123456"  (bcrypt $2b$10$, compat กับ bcryptjs)
-- เปลี่ยนรหัสผ่านหลัง deploy ครั้งแรก
-- ============================================================
INSERT INTO `users` (`username`, `display_name`, `password_hash`, `role`, `is_active`) VALUES
  ('admin', 'Administrator', '$2b$10$wGfB0/OHU0uoKuXbhRLlA.SzQl/SMfG1xUd/tiW/5ygah8fVmUrT.', 'admin', 1);
