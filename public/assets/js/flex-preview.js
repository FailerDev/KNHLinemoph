/**
 * FlexPreview — วาด LINE Flex bubble JSON เป็น HTML
 *
 * รับเฉพาะ bubble ที่ FlexBuilderService ฝั่ง server ผลิต ไม่ใช่ Flex ทั้งสเปก
 * เจตนาคือให้ server เป็นคนคอมไพล์นิยามบล็อกเสมอ ไฟล์นี้จึงไม่รู้จักนิยามบล็อก
 * และตัวอย่างกับการ์ดที่ส่งจริงจะไม่มีทางเพี้ยนกัน
 *
 * ถ้าเฟสหลังเพิ่ม property ใหม่ใน FlexBuilderService ต้องเพิ่มการแปลที่นี่ด้วย
 */
(function () {
  'use strict'

  const SIZE_PX = { xxs: 11, xs: 13, sm: 14, md: 16, lg: 19, xl: 22, xxl: 27, '3xl': 34 }
  const SPACING_PX = { none: 0, xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 20 }
  const RADIUS_PX = { none: 0, xs: 2, sm: 4, md: 6, lg: 8, xl: 12, xxl: 16 }

  const isPx = (v) => typeof v === 'string' && /^\d+px$/.test(v)
  // LINE ใช้ px/% ตรงกับหน่วย CSS อยู่แล้ว ไม่ต้องแปลงค่า
  const isCssLength = (v) => typeof v === 'string' && /^\d+(\.\d+)?(px|%)$/.test(v)

  /** สีทึบ (backgroundColor) หรือไล่เฉดสี (background: {type:'linearGradient',...}) */
  function applyBackground(s, node) {
    if (node.background && node.background.type === 'linearGradient') {
      const g = node.background
      s.background = `linear-gradient(${g.angle}, ${g.startColor}, ${g.endColor})`
    } else if (node.backgroundColor) {
      s.background = node.backgroundColor
    }
  }

  function applyBoxStyle(el, node) {
    const s = el.style
    s.display = 'flex'
    s.flexDirection = node.layout === 'horizontal' ? 'row' : 'column'
    if (node.alignItems === 'center') s.alignItems = 'center'
    else if (node.layout === 'horizontal') s.alignItems = 'stretch'
    if (node.justifyContent === 'center') s.justifyContent = 'center'
    applyBackground(s, node)
    if (node.borderColor) s.border = `1px solid ${node.borderColor}`
    if (node.cornerRadius) s.borderRadius = (RADIUS_PX[node.cornerRadius] ?? 6) + 'px'
    if (isPx(node.paddingAll)) s.padding = node.paddingAll
    if (isPx(node.paddingTop)) s.paddingTop = node.paddingTop
    if (isPx(node.paddingBottom)) s.paddingBottom = node.paddingBottom
    if (isPx(node.paddingStart)) s.paddingLeft = node.paddingStart
    if (isPx(node.paddingEnd)) s.paddingRight = node.paddingEnd
    if (node.spacing) s.gap = (SPACING_PX[node.spacing] ?? 4) + 'px'
    if (node.flex !== undefined) s.flex = String(node.flex)
    if (node.margin) s.marginTop = (SPACING_PX[node.margin] ?? 0) + 'px'
    if (isCssLength(node.width)) { s.width = node.width; s.flexShrink = '0' }
    if (isCssLength(node.height)) { s.height = node.height; s.flexShrink = '0' }
    s.minWidth = '0'
  }

  function renderNode(node) {
    if (!node || typeof node !== 'object') return document.createTextNode('')

    if (node.type === 'box') {
      const el = document.createElement('div')
      applyBoxStyle(el, node)
      ;(node.contents || []).forEach((child) => el.appendChild(renderNode(child)))
      return el
    }

    if (node.type === 'text') {
      // textContent ไม่ใช่ innerHTML — ข้อความมาจากฐานข้อมูล ห้ามเปิดช่อง XSS
      const el = document.createElement('div')
      el.textContent = String(node.text ?? '')
      const s = el.style
      s.fontSize = (SIZE_PX[node.size] ?? 14) + 'px'
      s.lineHeight = '1.45'
      s.color = node.color || '#111827'
      if (node.weight === 'bold') s.fontWeight = '700'
      if (node.align === 'end') s.textAlign = 'right'
      else if (node.align === 'center') s.textAlign = 'center'
      if (node.flex !== undefined) s.flex = String(node.flex)
      if (node.margin) s.marginTop = (SPACING_PX[node.margin] ?? 0) + 'px'
      s.whiteSpace = node.wrap ? 'normal' : 'nowrap'
      s.overflow = 'hidden'
      s.textOverflow = 'ellipsis'
      s.minWidth = '0'
      return el
    }

    if (node.type === 'separator') {
      const el = document.createElement('div')
      el.style.borderTop = '1px solid ' + (node.color || '#E2E8F0')
      el.style.marginTop = (SPACING_PX[node.margin] ?? 0) + 'px'
      return el
    }

    if (node.type === 'image') {
      const el = document.createElement('img')
      el.src = node.url
      el.alt = ''
      el.style.width = '100%'
      el.style.display = 'block'
      el.style.objectFit = node.aspectMode === 'cover' ? 'cover' : 'contain'
      el.addEventListener('error', () => {
        const fail = document.createElement('div')
        fail.className = 'flex-preview-imgfail'
        fail.textContent = 'โหลดรูปไม่สำเร็จ — LINE ต้องการ URL แบบ https ที่เปิดสาธารณะ'
        el.replaceWith(fail)
      })
      return el
    }

    if (node.type === 'button') {
      const el = document.createElement('div')
      el.className = 'flex-preview-btn'
      el.style.background = node.color || '#1E3A8A'
      el.textContent = node.action?.label || 'ปุ่ม'
      return el
    }

    return document.createTextNode('')
  }

  window.FlexPreview = {
    /**
     * วาด bubble ลงใน target
     *
     * ตัวอย่างเป็นภาพจำลอง ไม่ใช่เนื้อหาที่ควรให้ screen reader ไล่อ่านทีละกล่อง
     * จึงตั้ง role="img" แล้วใส่ altText เป็น aria-label ให้อ่านทีเดียวจบ
     */
    render(bubble, target, altText) {
      target.innerHTML = ''
      target.setAttribute('role', 'img')
      target.setAttribute('aria-label', altText || 'ตัวอย่างการ์ดแจ้งเตือน')

      if (!bubble || bubble.type !== 'bubble') {
        const empty = document.createElement('div')
        empty.className = 'flex-preview-empty'
        empty.textContent = 'เพิ่มบล็อกเพื่อดูตัวอย่าง'
        target.appendChild(empty)
        return 0
      }

      const card = document.createElement('div')
      card.className = 'flex-preview-bubble'
      // hero เป็นรูปเต็มขอบด้านบนสุด อยู่นอก body คนละ property กันโดยสเปกของ LINE
      if (bubble.hero) card.appendChild(renderNode(bubble.hero))
      if (bubble.body) card.appendChild(renderNode(bubble.body))
      target.appendChild(card)
      return (bubble.body?.contents || []).length
    },
  }
})()
