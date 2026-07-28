-- ============================================================
-- รายงาน: สรุปผู้มารับบริการรายวัน
-- Port จาก lineHr.php → getPatientStatistics()
-- ============================================================
-- วิธีใช้:
--   1. รัน ALTER TABLE ก่อน (ถ้ายังไม่ได้รัน):
--      ALTER TABLE notification_items
--        ADD COLUMN `row_template`  TEXT        NULL AFTER `is_active`,
--        ADD COLUMN `row_separator` VARCHAR(50) NULL AFTER `row_template`;
--   2. mysql -u root line_notify_system < example_data.sql
-- ============================================================

USE `line_notify_system`;

-- ล้างของเดิม (ถ้ารันซ้ำ)
DELETE FROM `notification_items` WHERE `item_key` IN (
  'vn','an','er','xray','dn','ph','h1','pcu','pp','reo',
  'total_lab','confirmed_lab','unconfirmed_lab',
  'total_no_cc_pe','authenn','authen',
  'ep_success','ep_failed','no_cc_pe_list'
);
DELETE FROM `notification_templates` WHERE `template_name` = 'สรุปผู้มารับบริการรายวัน';

-- ============================================================
-- notification_items — single-row (18 รายการ)
-- ============================================================
INSERT INTO `notification_items`
  (`item_name`, `item_key`, `sql_query`, `his_database`, `description`, `is_active`, `row_template`, `row_separator`)
VALUES

-- OPD
('ผู้ป่วยนอก OPD', 'vn',
 'SELECT COUNT(vn) AS vn FROM vn_stat WHERE vstdate = ''{date}''',
 'hos', 'จำนวน visit OPD ทั้งหมดวันนี้', 1, NULL, NULL),

-- IPD (ผู้ป่วยใน — นับผู้ป่วยที่ยังไม่ Discharge)
('ผู้ป่วยใน IPD', 'an',
 'SELECT COUNT(an) AS an FROM ipt WHERE dchdate IS NULL',
 'hos', 'ผู้ป่วยในที่ยังรักษาอยู่ (ไม่ใช้ {date})', 1, NULL, NULL),

-- ER
('ผู้ป่วย ER', 'er',
 'SELECT COUNT(vn) AS er FROM er_regist WHERE vstdate = ''{date}''',
 'hos', 'ER ทั้งหมดวันนี้', 1, NULL, NULL),

-- X-ray
('X-ray', 'xray',
 'SELECT COUNT(vn) AS xray FROM xray_report WHERE report_date = ''{date}''',
 'hos', 'จำนวนรายงาน X-ray วันนี้', 1, NULL, NULL),

-- ทันตกรรม
('ทันตกรรม', 'dn',
 'SELECT COUNT(vn) AS dn FROM dtmain WHERE vstdate = ''{date}''',
 'hos', 'ผู้รับบริการทันตกรรมวันนี้', 1, NULL, NULL),

-- กายภาพบำบัด
('กายภาพบำบัด', 'ph',
 'SELECT COUNT(vn) AS ph FROM physic_main WHERE vstdate = ''{date}''',
 'hos', 'ผู้รับบริการกายภาพบำบัดวันนี้', 1, NULL, NULL),

-- แพทย์แผนไทย
('แพทย์แผนไทย', 'h1',
 'SELECT COUNT(vn) AS h1 FROM health_med_service WHERE service_date = ''{date}''',
 'hos', 'ผู้รับบริการแพทย์แผนไทยวันนี้', 1, NULL, NULL),

-- PCU (main_dep=026)
('PCU', 'pcu',
 'SELECT COUNT(vn) AS pcu FROM ovst WHERE vstdate = ''{date}'' AND main_dep = ''026''',
 'hos', 'ผู้รับบริการ PCU วันนี้', 1, NULL, NULL),

-- ส่งเสริมสุขภาพ (main_dep=003)
('ส่งเสริมสุขภาพ', 'pp',
 'SELECT COUNT(vn) AS pp FROM ovst WHERE vstdate = ''{date}'' AND main_dep = ''003''',
 'hos', 'ผู้รับบริการส่งเสริมสุขภาพวันนี้', 1, NULL, NULL),

-- ส่งต่อ (Refer out)
('Refer out', 'reo',
 'SELECT COUNT(vn) AS reo FROM referout WHERE refer_date = ''{date}''',
 'hos', 'จำนวนการส่งต่อวันนี้', 1, NULL, NULL),

-- Lab รวม
('Lab รวม', 'total_lab',
 'SELECT COUNT(vn) AS total_lab FROM lab_head WHERE order_date = ''{date}''',
 'hos', 'จำนวน order lab ทั้งหมดวันนี้', 1, NULL, NULL),

-- Lab ยืนยันแล้ว
('Lab ยืนยันผลแล้ว', 'confirmed_lab',
 'SELECT SUM(CASE WHEN confirm_report = ''y'' THEN 1 ELSE 0 END) AS confirmed_lab
  FROM lab_head WHERE order_date = ''{date}''',
 'hos', 'Lab ที่ยืนยันผลแล้ว', 1, NULL, NULL),

-- Lab ยังไม่ยืนยัน
('Lab ยังไม่ยืนยันผล', 'unconfirmed_lab',
 'SELECT SUM(CASE WHEN confirm_report != ''y'' OR confirm_report IS NULL THEN 1 ELSE 0 END) AS unconfirmed_lab
  FROM lab_head WHERE order_date = ''{date}''',
 'hos', 'Lab ที่ยังไม่ยืนยันผล', 1, NULL, NULL),

-- ผู้ป่วยที่ยังไม่บันทึก CC/PE/PDX (จำนวนรวม)
('ไม่มี CC/PE/PDX (รวม)', 'total_no_cc_pe',
 'SELECT COUNT(*) AS total_no_cc_pe
  FROM vn_stat vn
  LEFT OUTER JOIN opdscreen ou ON ou.vn = vn.vn
  WHERE vn.vstdate = ''{date}''
    AND (vn.pdx = '''' OR vn.pdx IS NULL)
    AND (ou.cc IS NULL OR ou.pe IS NULL)',
 'hos', 'จำนวนผู้ป่วยที่ยังไม่บันทึก CC/PE/PDX', 1, NULL, NULL),

-- Authen สำเร็จ
('Authen สำเร็จ', 'authenn',
 'SELECT COUNT(ov.vn) AS authenn
  FROM visit_pttype ov
  JOIN vn_stat vn ON vn.vn = ov.vn
  WHERE auth_code IS NOT NULL
    AND vn.vstdate = ''{date}''',
 'hos', 'Visit ที่ได้ Authen', 1, NULL, NULL),

-- Authen ไม่สำเร็จ
('Authen ไม่สำเร็จ', 'authen',
 'SELECT COUNT(ov.vn) AS authen
  FROM visit_pttype ov
  JOIN vn_stat vn ON vn.vn = ov.vn
  WHERE auth_code IS NULL
    AND vn.vstdate = ''{date}''',
 'hos', 'Visit ที่ยังไม่ได้ Authen', 1, NULL, NULL),

-- EP ปิดสิทธิสำเร็จ
('EP ปิดสิทธิสำเร็จ', 'ep_success',
 'SELECT COUNT(o.vn) AS ep_success
  FROM ovst o
  LEFT OUTER JOIN vn_stat v ON v.vn = o.vn
  LEFT OUTER JOIN nhso_confirm_privilege c ON c.vn = o.vn
  WHERE o.vstdate = ''{date}''
    AND c.nhso_authen_code IS NOT NULL',
 'hos', 'ปิดสิทธิ Endpoint สำเร็จ', 1, NULL, NULL),

-- EP ยังไม่ปิดสิทธิ
('EP ยังไม่ปิดสิทธิ', 'ep_failed',
 'SELECT COUNT(o.vn) AS ep_failed
  FROM ovst o
  LEFT OUTER JOIN vn_stat v ON v.vn = o.vn
  LEFT OUTER JOIN nhso_confirm_privilege c ON c.vn = o.vn
  WHERE o.vstdate = ''{date}''
    AND (c.nhso_authen_code IS NULL OR c.nhso_authen_code = '''')',
 'hos', 'ยังไม่ปิดสิทธิ Endpoint', 1, NULL, NULL);

-- ============================================================
-- notification_items — multi-row (1 รายการ)
-- รายละเอียดผู้ป่วยไม่มี CC/PE/PDX แยกตามแผนก
-- ============================================================
INSERT INTO `notification_items`
  (`item_name`, `item_key`, `sql_query`, `his_database`, `description`, `is_active`, `row_template`, `row_separator`)
VALUES
('ไม่มี CC/PE/PDX แยกแผนก', 'no_cc_pe_list',
 'SELECT
    k.department    AS department_name,
    COUNT(*)        AS patient_count,
    GROUP_CONCAT(DISTINCT vn.hn ORDER BY vn.hn SEPARATOR '', '') AS patient_info
  FROM vn_stat vn
  LEFT JOIN patient pt    ON pt.hn  = vn.hn
  LEFT JOIN opdscreen ou  ON ou.vn  = vn.vn
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
-- notification_templates — 1 template หลัก
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
