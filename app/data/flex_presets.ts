import type { FlexDesign } from '#types/flex_design'

export interface FlexPreset {
  id: string
  name: string
  description: string
  category: 'general' | 'cdcu'
  altText: string
  design: FlexDesign
}

/**
 * การ์ดสำเร็จรูป — พอร์ตจาก E:\line\flexDesigns.php (ดีไซน์ 1-9; ดีไซน์ 10
 * เป็น carousel เลื่อนไปเฟสถัดไปตามสเปก)
 *
 * ใช้ {vn} {an} {er} {reo} {xray} {dn} {ph} {h1} {pcu} {pp} {total_lab}
 * {confirmed_lab} {unconfirmed_lab} {authenn} {authen} {ep_success}
 * {ep_failed} {total_no_cc_pe} ซึ่งตรงกับ item_key จริงที่ seed ไว้แล้วใน
 * database/schema.sql — เลือก preset แล้วข้อมูลจริงจะโผล่ทันทีไม่ต้องสร้าง
 * item เพิ่ม
 *
 * ปรับจากต้นฉบับ 3 จุดโดยตั้งใจ:
 *  1. ตัดปุ่ม "ดู Dashboard" ของดีไซน์ 1 ออก — URL เดิมเป็น IP ภายในเครือข่าย
 *     ของ รพ.ต้นทาง ใส่มาแบบ hardcode จะพังหรือชี้ผิดที่ทันทีที่ใช้ รพ.อื่น
 *  2. ตัดเลขนำหน้าชื่อ '[1]'..'[9]' ออก เดิมเป็นแค่ label เพื่อจำตอนทดสอบ
 *     CLI ไม่มีความหมายในการใช้งานจริง
 *  3. aspectRatio ของดีไซน์ 6 เปลี่ยนจาก '20:9' เป็น '16:9' — ไม่ใช่ค่าที่
 *     LINE Flex Message รองรับจริง (ดู ASPECT_RATIOS ใน validator)
 */
export const FLEX_PRESETS: FlexPreset[] = [
  {
    id: 'navy-dashboard',
    name: 'ราชนาวี — Dashboard ราชการ',
    description: 'หัวข้อพื้นน้ำเงิน + KPI 4 ช่อง + ตารางบริการ + หมายเหตุงานค้าง',
    category: 'general',
    altText: 'สรุปผู้มารับบริการประจำวัน {date_th}',
    design: {
      version: 1,
      size: 'mega',
      theme: { primary: '#1E3A8A', background: '#FFFFFF' },
      blocks: [
        {
          id: 'h',
          type: 'header',
          title: '🏥 สรุปผู้มารับบริการประจำวัน',
          subtitle: '{org_name} • {date_th} • {time} น.',
        },
        {
          id: 'k',
          type: 'kpi',
          columns: 2,
          cells: [
            { label: '👤 OPD', value: '{vn}', unit: 'ราย', tone: 'info' },
            { label: '🏥 IPD', value: '{an}', unit: 'ราย', tone: 'ok' },
            { label: '🚨 ER', value: '{er}', unit: 'ราย', tone: 'danger' },
            { label: '🚑 Refer', value: '{reo}', unit: 'ราย', tone: 'warn' },
          ],
        },
        {
          id: 'l',
          type: 'list',
          rows: [
            { label: '💀 X-ray', value: '{xray}' },
            { label: '🦷 ทันตกรรม', value: '{dn}' },
            { label: '🚶 กายภาพบำบัด', value: '{ph}' },
          ],
        },
        {
          id: 'n',
          type: 'note',
          text: '⚠️ ค้างบันทึก CC/PE/PDX: {total_no_cc_pe} ราย',
          tone: 'danger',
        },
      ],
    },
  },

  {
    id: 'minimal-white',
    name: 'กระดาษขาว — มินิมอล',
    description: 'พื้นขาวสะอาด แถบสีบาง ตัวเลขเด่นไม่มีกล่อง เหมาะรายงานที่ต้องอ่านเร็ว',
    category: 'general',
    altText: 'สรุปผู้มารับบริการ OPD {vn} ราย {date_th}',
    design: {
      version: 1,
      size: 'mega',
      theme: { primary: '#2563EB', background: '#FDFCFB' },
      blocks: [
        { id: 'bar', type: 'separator', thickness: '4px', color: '#2563EB' },
        {
          id: 'h',
          type: 'header',
          title: 'สรุปผู้มารับบริการ',
          subtitle: '{org_name} • {date_th} • {time} น.',
          background: '#FDFCFB',
          titleColor: '#111827',
          subtitleColor: '#9CA3AF',
        },
        {
          id: 'k',
          type: 'kpi',
          columns: 2,
          variant: 'stat',
          cells: [
            { label: 'ผู้ป่วยนอก OPD', value: '{vn}', tone: 'info' },
            { label: 'ผู้ป่วยใน IPD', value: '{an}', tone: 'ok' },
            { label: 'ฉุกเฉิน ER', value: '{er}', tone: 'danger' },
            { label: 'ส่งต่อ Refer', value: '{reo}', tone: 'ok' },
          ],
        },
        {
          id: 'l',
          type: 'list',
          rows: [
            { label: 'X-ray', value: '{xray}' },
            { label: 'ทันตกรรม', value: '{dn}' },
            { label: 'กายภาพบำบัด', value: '{ph}' },
            { label: 'Lab ยืนยันแล้ว', value: '{confirmed_lab}/{total_lab}' },
          ],
        },
        { id: 'n', type: 'note', text: 'ค้างบันทึก CC/PE/PDX {total_no_cc_pe} ราย', tone: 'warn' },
        {
          id: 'f',
          type: 'note',
          text: 'ข้อมูลจาก HOSxP',
          bg: '#FDFCFB',
          color: '#9CA3AF',
        },
      ],
    },
  },

  {
    id: 'midnight',
    name: 'มิดไนต์ — พื้นเข้ม ตัวเลขนีออน',
    description: 'ธีมเข้มทั้งใบ การ์ด KPI ขอบบาง ตัวเลขสีนีออน เหมาะรายงานกะดึก',
    category: 'general',
    altText: 'Night Report — {date_th}',
    design: {
      version: 1,
      size: 'mega',
      theme: { primary: '#0F172A', background: '#0F172A' },
      blocks: [
        {
          id: 'h',
          type: 'header',
          title: 'Night Report — {date_th}',
          subtitle: '{org_name} · อัปเดต {time} น.',
          background: '#0F172A',
          titleColor: '#F8FAFC',
          subtitleColor: '#64748B',
        },
        {
          id: 'k',
          type: 'kpi',
          columns: 2,
          cells: [
            { label: 'OPD', value: '{vn}', bg: '#1E293B', border: '#334155', color: '#38BDF8' },
            { label: 'IPD', value: '{an}', bg: '#1E293B', border: '#334155', color: '#4ADE80' },
            { label: 'ER', value: '{er}', bg: '#1E293B', border: '#334155', color: '#FB7185' },
            { label: 'REFER', value: '{reo}', bg: '#1E293B', border: '#334155', color: '#FBBF24' },
          ],
        },
        {
          id: 'l',
          type: 'list',
          labelColor: '#94A3B8',
          rows: [
            { label: '🧪 Lab ยืนยันผล', value: '{confirmed_lab} / {total_lab}', color: '#E2E8F0' },
            { label: '🔑 Authen สำเร็จ', value: '{authenn} / {vn}', color: '#E2E8F0' },
            { label: '📲 ปิดสิทธิ์ Endpoint', value: '{ep_success}', color: '#E2E8F0' },
          ],
        },
        {
          id: 'n',
          type: 'note',
          text: '⚠ ค้าง CC/PE/PDX {total_no_cc_pe} ราย',
          bg: '#FB718519',
          color: '#FB7185',
        },
        { id: 'f', type: 'note', text: 'HOSxP', bg: '#0F172A', color: '#475569' },
      ],
    },
  },

  {
    id: 'health-teal',
    name: 'เฮลท์เทียล — ไล่เฉดเขียว + แถบข้อมูล',
    description: 'หัวการ์ดไล่เฉดเขียว ตัวเลขเด่นกลางจอ แถบสัดส่วนงานบริการ',
    category: 'general',
    altText: 'ผู้มารับบริการวันนี้ OPD {vn} ราย {date_th}',
    design: {
      version: 1,
      size: 'mega',
      theme: { primary: '#0D9488', background: '#FFFFFF' },
      blocks: [
        {
          id: 'h',
          type: 'header',
          title: 'ผู้มารับบริการวันนี้ · {date_th}',
          background: { type: 'linearGradient', angle: '135deg', startColor: '#0D9488', endColor: '#059669' },
          titleColor: '#CCFBF1',
          metricValue: '{vn}',
          metricLabel: 'ราย (OPD)',
        },
        {
          id: 'chips',
          type: 'kpi',
          columns: 3,
          variant: 'chip',
          cells: [
            { label: 'IPD', value: '{an}' },
            { label: 'ER', value: '{er}' },
            { label: 'Refer', value: '{reo}' },
          ],
        },
        {
          id: 'p',
          type: 'progress',
          rows: [
            { label: '💀 X-ray', value: '{xray}', percent: 93 },
            { label: '🦷 ทันตกรรม', value: '{dn}', percent: 50 },
            { label: '🚶 กายภาพ', value: '{ph}', percent: 40 },
            { label: '🌿 แผนไทย', value: '{h1}', percent: 27 },
          ],
        },
        {
          id: 'n',
          type: 'note',
          text: '✅ Lab ยืนยันแล้ว {confirmed_lab}/{total_lab} · Authen {authenn}/{vn}',
          tone: 'ok',
        },
        { id: 'f', type: 'note', text: 'HOSxP · {time} น.', tone: 'muted' },
      ],
    },
  },

  {
    id: 'pastel',
    name: 'พาสเทล — การ์ดโค้งมนโทนอ่อน',
    description: 'สีพาสเทลอบอุ่น เน้นส่วนงานค้างที่ต้องรีบเคลียร์',
    category: 'general',
    altText: 'สรุปเช้านี้ {date_th}',
    design: {
      version: 1,
      size: 'mega',
      theme: { primary: '#7C3AED', background: '#FDFCFB' },
      blocks: [
        {
          id: 'h',
          type: 'header',
          title: '🌤 สรุปเช้านี้ · {date_th}',
          subtitle: '{org_name}',
          background: '#FDFCFB',
          titleColor: '#44403C',
          subtitleColor: '#A8A29E',
        },
        {
          id: 'k',
          type: 'kpi',
          columns: 2,
          cells: [
            { label: '👤 OPD', value: '{vn}', bg: '#EDE9FE', color: '#7C3AED', labelColor: '#6D28D9' },
            { label: '🏥 IPD', value: '{an}', bg: '#D1FAE5', color: '#059669', labelColor: '#047857' },
            { label: '🚨 ER', value: '{er}', bg: '#FFE4E6', color: '#E11D48', labelColor: '#BE123C' },
            { label: '🚑 Refer', value: '{reo}', bg: '#D1FAE5', color: '#059669', labelColor: '#047857' },
          ],
        },
        {
          id: 'n',
          type: 'note',
          text: '⚠️ งานค้างที่ต้องตาม',
          bg: '#FEF3C7',
          color: '#B45309',
        },
        {
          id: 'l',
          type: 'list',
          labelColor: '#92400E',
          rows: [
            { label: 'CC/PE/PDX ยังไม่บันทึก', value: '{total_no_cc_pe} ราย', color: '#B45309' },
            { label: 'Lab รอยืนยันผล', value: '{unconfirmed_lab} ราย', color: '#B45309' },
            { label: 'ยังไม่ได้ Authen', value: '{authen} visit', color: '#B45309' },
          ],
        },
        { id: 'f', type: 'note', text: 'มีอะไรค้าง รีบเคลียร์ก่อนเที่ยงนะ 💪', bg: '#FDFCFB', color: '#A8A29E' },
      ],
    },
  },

  {
    id: 'hero-image',
    name: 'ฮีโร่รูปภาพ — รูปเต็มขอบด้านบน',
    description: 'ใส่รูป รพ. หรือรูปกิจกรรมเต็มขอบด้านบนสุด ตามด้วยสรุปตัวเลข',
    category: 'general',
    altText: 'สรุปผู้มารับบริการประจำวัน {date_th}',
    design: {
      version: 1,
      size: 'mega',
      theme: { primary: '#1D4ED8', background: '#FFFFFF' },
      blocks: [
        {
          id: 'hero',
          type: 'image',
          hero: true,
          url: 'https://picsum.photos/seed/hospital/700/300',
          aspectRatio: '16:9',
        },
        {
          id: 'h',
          type: 'header',
          title: 'สรุปผู้มารับบริการประจำวัน',
          subtitle: '{org_name} • {date_th} • {time} น.',
          background: '#FFFFFF',
          titleColor: '#111827',
          subtitleColor: '#9CA3AF',
        },
        {
          id: 'k',
          type: 'kpi',
          columns: 4,
          variant: 'stat',
          cells: [
            { label: 'OPD', value: '{vn}', tone: 'info' },
            { label: 'IPD', value: '{an}', tone: 'ok' },
            { label: 'ER', value: '{er}', tone: 'danger' },
            { label: 'Refer', value: '{reo}', tone: 'warn' },
          ],
        },
        {
          id: 'n',
          type: 'note',
          text: '⚠️ ค้าง CC/PE/PDX {total_no_cc_pe} ราย · Lab รอผล {unconfirmed_lab}',
          tone: 'warn',
        },
      ],
    },
  },

  {
    id: 'glass',
    name: 'กลาสสี — ไล่เฉดม่วงฟ้า การ์ดโปร่งแสง',
    description: 'พื้นไล่เฉดสีม่วง-ฟ้าเต็มใบ ตัวเลขในการ์ดโปร่งแสงสไตล์ glassmorphism',
    category: 'general',
    altText: 'Daily Summary {date_th}',
    design: {
      version: 1,
      size: 'mega',
      theme: {
        primary: '#4F46E5',
        background: { type: 'linearGradient', angle: '160deg', startColor: '#4F46E5', endColor: '#06B6D4' },
      },
      blocks: [
        {
          id: 'h',
          type: 'header',
          title: 'Daily Summary',
          subtitle: '{org_name} • {date_th}',
          background: { type: 'linearGradient', angle: '160deg', startColor: '#4F46E5', endColor: '#06B6D4' },
          titleColor: '#FFFFFF',
          subtitleColor: '#C7D2FE',
        },
        {
          id: 'k',
          type: 'kpi',
          columns: 2,
          variant: 'chip',
          cells: [
            { label: '👤 OPD', value: '{vn}', bg: '#FFFFFF33', color: '#FFFFFF' },
            { label: '🏥 IPD', value: '{an}', bg: '#FFFFFF33', color: '#FFFFFF' },
            { label: '🚨 ER', value: '{er}', bg: '#FFFFFF33', color: '#FFFFFF' },
            { label: '🚑 Refer', value: '{reo}', bg: '#FFFFFF33', color: '#FFFFFF' },
          ],
        },
        {
          id: 'l',
          type: 'list',
          labelColor: '#E0E7FF',
          rows: [
            { label: '🧪 Lab', value: '{confirmed_lab}/{total_lab} ยืนยันแล้ว', color: '#FFFFFF' },
            { label: '🔑 Authen', value: '{authenn}/{vn} visit', color: '#FFFFFF' },
            { label: '⚠️ ค้าง CC/PE', value: '{total_no_cc_pe} ราย', color: '#FDE68A' },
          ],
        },
        { id: 'f', type: 'note', text: 'HOSxP · อัปเดต {time} น.', bg: '#FFFFFF00', color: '#C7D2FE' },
      ],
    },
  },

  {
    id: 'neon-cyber',
    name: 'นีออนไซเบอร์ — ดำสนิท เส้นไล่เฉดชมพู-ม่วง',
    description: 'พื้นดำสนิท แถบไล่เฉดสีบางด้านบน ตัวเลขนีออนหลายสี สไตล์แดชบอร์ดไซไฟ',
    category: 'general',
    altText: 'KSN Daily Report {date_th}',
    design: {
      version: 1,
      size: 'mega',
      theme: { primary: '#0B0F19', background: '#0B0F19' },
      blocks: [
        {
          id: 'bar',
          type: 'separator',
          thickness: '3px',
          background: { type: 'linearGradient', angle: '90deg', startColor: '#F472B6', endColor: '#A78BFA' },
        },
        {
          id: 'h',
          type: 'header',
          title: 'KSN DAILY REPORT',
          subtitle: '{date_th} • {time} น. • {org_name}',
          background: '#0B0F19',
          titleColor: '#F472B6',
          subtitleColor: '#6B7280',
        },
        {
          id: 'k',
          type: 'kpi',
          columns: 4,
          variant: 'stat',
          cells: [
            { label: 'OPD', value: '{vn}', color: '#A78BFA' },
            { label: 'IPD', value: '{an}', color: '#34D399' },
            { label: 'ER', value: '{er}', color: '#F472B6' },
            { label: 'REF', value: '{reo}', color: '#FBBF24' },
          ],
        },
        { id: 's', type: 'separator', color: '#1F2937' },
        {
          id: 'stats',
          type: 'kpi',
          columns: 3,
          variant: 'chip',
          cells: [
            { label: 'LAB', value: '{confirmed_lab}/{total_lab}', color: '#34D399', bg: '#00000000' },
            { label: 'AUTH', value: '{authenn}/{vn}', color: '#A78BFA', bg: '#00000000' },
            { label: 'CC/PE', value: '{total_no_cc_pe}', color: '#F472B6', bg: '#00000000' },
          ],
        },
      ],
    },
  },

  {
    id: 'side-stripe',
    name: 'แถบข้าง — จัดหมวดสไตล์ editorial',
    description: 'แยกหมวดข้อมูลด้วยแถบสีข้างและหัวข้อกลุ่ม เหมาะรายงานที่มีหลายหมวด',
    category: 'general',
    altText: 'สรุปผู้มารับบริการ {date_th}',
    design: {
      version: 1,
      size: 'mega',
      theme: { primary: '#2563EB', background: '#FFFFFF' },
      blocks: [
        {
          id: 'h',
          type: 'header',
          title: 'สรุปผู้มารับบริการ',
          subtitle: '{org_name} • {date_th} • {time} น.',
          background: '#FFFFFF',
          titleColor: '#111827',
          subtitleColor: '#9CA3AF',
        },
        {
          id: 'l1',
          type: 'list',
          heading: 'ผู้ป่วย',
          stripeColor: '#2563EB',
          rows: [
            { label: 'ผู้ป่วยนอก OPD', value: '{vn} ราย' },
            { label: 'ผู้ป่วยใน IPD', value: '{an} ราย' },
            { label: 'ฉุกเฉิน ER', value: '{er} ราย' },
            { label: 'ส่งต่อ Refer', value: '{reo} ราย' },
          ],
        },
        {
          id: 'l2',
          type: 'list',
          heading: 'บริการ',
          stripeColor: '#0D9488',
          rows: [
            { label: 'X-ray', value: '{xray}' },
            { label: 'ทันตกรรม', value: '{dn}' },
            { label: 'กายภาพบำบัด', value: '{ph}' },
          ],
        },
        {
          id: 'l3',
          type: 'list',
          heading: 'แล็บ / สิทธิ์',
          stripeColor: '#7C3AED',
          rows: [
            { label: 'Lab ยืนยันผล', value: '{confirmed_lab} / {total_lab}' },
            { label: 'Authen สำเร็จ', value: '{authenn} / {vn}' },
          ],
        },
        {
          id: 'l4',
          type: 'list',
          heading: 'งานค้าง',
          stripeColor: '#DC2626',
          rows: [{ label: 'CC/PE/PDX ยังไม่บันทึก', value: '{total_no_cc_pe} ราย' }],
        },
        { id: 'f', type: 'note', text: 'HOSxP · IT', tone: 'muted' },
      ],
    },
  },

  {
    id: 'orange-daily-bars',
    name: 'รายงานผู้รับบริการรายวัน — ส้มดอกจาน',
    description: 'รายงานสรุปผู้รับบริการประจำวัน หัวการ์ดไล่เฉดส้ม ตัวเลข OPD เด่น พร้อมแท่งสัดส่วนผู้ป่วยและบริการ',
    category: 'general',
    altText: 'สรุปผู้มารับบริการวันนี้ OPD {vn} ราย {date_th}',
    design: {
      version: 1,
      size: 'mega',
      theme: { primary: '#EA580C', background: '#FFFFFF' },
      blocks: [
        {
          id: 'h',
          type: 'header',
          title: '{org_name} · {date_th} · {time} น.',
          background: { type: 'linearGradient', angle: '135deg', startColor: '#FDBA74', endColor: '#EA580C' },
          titleColor: '#FFEDD5',
          metricValue: '{vn}',
          metricLabel: 'ราย (OPD วันนี้)',
        },
        {
          id: 'p1',
          type: 'progress',
          heading: '👥 ผู้ป่วยที่มารับบริการ',
          rows: [
            { label: '🏥 OPD', value: '{vn}', percent: 100, color: '#EA580C' },
            { label: '🛏️ IPD', value: '{an}', percent: 45, color: '#EA580C' },
            { label: '🚨 ER', value: '{er}', percent: 20, color: '#EA580C' },
            { label: '🚑 Refer', value: '{reo}', percent: 10, color: '#EA580C' },
          ],
        },
        {
          id: 'l1',
          type: 'list',
          heading: '🩺 บริการอื่น ๆ',
          rows: [
            { label: 'X-ray', value: '{xray} ราย' },
            { label: 'ทันตกรรม', value: '{dn} ราย' },
            { label: 'กายภาพบำบัด', value: '{ph} ราย' },
            { label: 'แผนไทย', value: '{h1} ราย' },
            { label: 'PCU', value: '{pcu} ราย' },
            { label: 'ส่งเสริมสุขภาพ', value: '{pp} ราย' },
          ],
        },
        { id: 'sep1', type: 'separator' },
        {
          id: 'l2',
          type: 'list',
          heading: '📊 สถานะการดำเนินงาน',
          rows: [
            { label: 'Lab ยืนยันแล้ว', value: '{confirmed_lab}/{total_lab} ราย' },
            { label: 'Lab ยังไม่ยืนยัน', value: '{unconfirmed_lab} ราย', tone: 'warn' },
            { label: 'Authen ได้/ไม่ได้', value: '{authenn} / {authen}' },
            { label: 'ปิดสิทธิ์ Endpoint สำเร็จ/ค้าง', value: '{ep_success} / {ep_failed} ราย' },
          ],
        },
        {
          id: 'n1',
          type: 'note',
          tone: 'warn',
          text: '⚠️ ยังไม่บันทึก CC/PE/PDX ทั้งหมด {total_no_cc_pe} ราย\n{no_cc_pe_list}',
        },
      ],
    },
  },
]

/** preset สำหรับ CDCU — ใช้ตัวแปรผู้ป่วยจาก CDCU_VAR_LABELS ใน templates_controller.ts */
export const CDCU_FLEX_PRESET: FlexPreset = {
  id: 'cdcu-alert',
  name: 'แจ้งเตือน CDCU — ผู้ป่วยเฝ้าระวัง',
  description: 'การ์ดแจ้งเตือนผู้ป่วยรายบุคคล สำหรับผูกกับกลุ่มเฝ้าระวัง CDCU โดยเฉพาะ',
  category: 'cdcu',
  altText: 'แจ้งเตือน CDCU: {icd10} HN {hn}',
  design: {
    version: 1,
    size: 'mega',
    theme: { primary: '#B91C1C', background: '#FFFFFF' },
    blocks: [
      {
        id: 'h',
        type: 'header',
        title: '🚨 แจ้งเตือนผู้ป่วยเฝ้าระวัง',
        subtitle: '{org_name} • {vstdate_th} {vsttime}',
      },
      {
        id: 'k1',
        type: 'kpi',
        // เต็มความกว้างการ์ดโดยตั้งใจ — HN บางที่มีหลายหลัก ถ้าแบ่งคอลัมน์จะพับ
        // บรรทัดดูไม่เรียบร้อย (เจอจริงตอนทดสอบส่ง)
        columns: 1,
        cells: [{ label: 'HN', value: '{hn}', tone: 'muted' }],
      },
      {
        id: 'k2',
        type: 'kpi',
        columns: 2,
        cells: [
          { label: 'ICD-10', value: '{icd10}', tone: 'danger' },
          { label: 'อายุ', value: '{age}', unit: 'ปี', tone: 'info' },
        ],
      },
      {
        id: 'l',
        type: 'list',
        rows: [
          { label: 'ชื่อผู้ป่วย', value: '{pt_name}' },
          { label: 'โรค', value: '{icd10_name}' },
        ],
      },
      { id: 'n', type: 'note', text: 'CC: {cc}', tone: 'warn' },
      {
        id: 'v',
        type: 'list',
        heading: 'สัญญาณชีพ',
        rows: [
          { label: 'อุณหภูมิ', value: '{temperature}' },
          { label: 'ชีพจร', value: '{pulse}' },
          { label: 'RR', value: '{rr}' },
          { label: 'ความดัน', value: '{bps}/{bpd}' },
        ],
      },
      { id: 'f', type: 'note', text: 'เบอร์โทร {hometel} • ที่อยู่ {informaddr}', tone: 'muted' },
    ],
  },
}

export const ALL_FLEX_PRESETS: FlexPreset[] = [...FLEX_PRESETS, CDCU_FLEX_PRESET]
