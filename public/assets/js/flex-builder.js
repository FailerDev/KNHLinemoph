/**
 * FlexBuilder — แก้ไขนิยามบล็อกของการ์ด Flex
 *
 * ไฟล์นี้รู้จักแต่ "นิยามบล็อก" ไม่รู้จัก Flex JSON เลย การคอมไพล์เป็นบับเบิล
 * เกิดที่ server เสมอ (POST /templates/flex/preview) แล้ว FlexPreview วาดผลลัพธ์
 * จึงไม่มีทางที่ตัวอย่างกับการ์ดที่ส่งจริงจะเพี้ยนกัน
 *
 * ต้องการ: window.FlexPreview (flex-preview.js), window.App (app.js),
 *          window.FLEX_BUILDER_DATA (ตั้งค่าจาก templates.edge)
 */
(function () {
  'use strict'

  const TONES = [
    { value: 'muted', label: 'ปกติ (เทา)' },
    { value: 'info', label: 'ข้อมูล (น้ำเงิน)' },
    { value: 'ok', label: 'ปกติดี (เขียว)' },
    { value: 'warn', label: 'เฝ้าระวัง (ส้ม)' },
    { value: 'danger', label: 'เร่งด่วน (แดง)' },
  ]
  const ALIGNS = [
    { value: 'start', label: 'ชิดซ้าย' },
    { value: 'center', label: 'กึ่งกลาง' },
    { value: 'end', label: 'ชิดขวา' },
  ]

  let uid = 0
  const nextId = () => `b${Date.now().toString(36)}${(uid++).toString(36)}`

  /** นิยามบล็อกแต่ละชนิด: ป้ายในรายการ ไอคอน ค่าเริ่มต้น และฟอร์มคุณสมบัติ */
  const BLOCKS = {
    header: {
      label: 'หัวข้อ',
      icon: 'bi-type-h1',
      make: () => ({ id: nextId(), type: 'header', title: 'หัวข้อการแจ้งเตือน', subtitle: '{org_name} • {date_th}' }),
      summary: (b) => b.title || 'หัวข้อ',
    },
    kpi: {
      label: 'การ์ดตัวเลข',
      icon: 'bi-grid-1x2',
      make: () => ({
        id: nextId(),
        type: 'kpi',
        columns: 2,
        cells: [
          { label: 'รายการ A', value: '0', unit: 'ราย', tone: 'info' },
          { label: 'รายการ B', value: '0', unit: 'ราย', tone: 'ok' },
        ],
      }),
      summary: (b) => `${(b.cells || []).length} ช่อง`,
    },
    list: {
      label: 'รายการคู่',
      icon: 'bi-list-ul',
      make: () => ({ id: nextId(), type: 'list', rows: [{ label: 'รายการ', value: '0' }] }),
      summary: (b) => `${(b.rows || []).length} แถว`,
    },
    table: {
      label: 'ตาราง',
      icon: 'bi-table',
      make: () => ({
        id: nextId(),
        type: 'table',
        itemKey: '',
        maxRows: 15,
        showHeader: true,
        emptyText: 'ไม่พบข้อมูล',
        columns: [{ source: '', label: 'คอลัมน์', flex: 4, align: 'start' }],
      }),
      summary: (b) => b.itemKey || 'ยังไม่ได้เลือกข้อมูล',
    },
    note: {
      label: 'ข้อความเตือน',
      icon: 'bi-exclamation-triangle',
      make: () => ({ id: nextId(), type: 'note', text: 'ข้อความหมายเหตุ', tone: 'warn' }),
      summary: (b) => b.text || 'หมายเหตุ',
    },
    image: {
      label: 'รูปภาพ',
      icon: 'bi-image',
      make: () => ({ id: nextId(), type: 'image', url: 'https://', aspectRatio: '20:13' }),
      summary: (b) => b.url || 'รูปภาพ',
    },
    button: {
      label: 'ปุ่มลิงก์',
      icon: 'bi-hand-index',
      make: () => ({ id: nextId(), type: 'button', label: 'เปิดดูรายละเอียด', uri: 'https://' }),
      summary: (b) => b.label || 'ปุ่ม',
    },
    separator: {
      label: 'เส้นคั่น',
      icon: 'bi-dash-lg',
      make: () => ({ id: nextId(), type: 'separator' }),
      summary: () => 'เส้นคั่น',
    },
  }

  const state = {
    design: null,
    altText: '',
    selectedId: null,
  }

  let previewTimer = null
  let previewSeq = 0

  // ---------- helpers ----------

  const $ = (id) => document.getElementById(id)

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag)
    Object.entries(props).forEach(([k, v]) => {
      if (v === undefined || v === null) return
      if (k === 'class') node.className = v
      else if (k === 'text') node.textContent = v
      else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v)
      else node.setAttribute(k, v)
    })
    children.forEach((c) => node.appendChild(c))
    return node
  }

  function announce(message) {
    const region = $('flexAnnounce')
    if (region) region.textContent = message
  }

  function blankDesign() {
    return {
      version: 1,
      size: 'mega',
      theme: { primary: '#1E3A8A' },
      blocks: [BLOCKS.header.make()],
    }
  }

  function selectedBlock() {
    return (state.design.blocks || []).find((b) => b.id === state.selectedId) || null
  }

  // ---------- ฟอร์มคุณสมบัติ ----------

  function field(labelText, control, hint) {
    const wrap = el('div', { class: 'flex-field' })
    const id = control.id || `fld${uid++}`
    control.id = id
    wrap.appendChild(el('label', { for: id, text: labelText }))
    wrap.appendChild(control)
    if (hint) wrap.appendChild(el('div', { class: 'flex-hint', text: hint }))
    return wrap
  }

  function textInput(value, onInput, opts = {}) {
    const input = el('input', {
      type: 'text',
      class: 'form-control form-control-sm',
      value: value ?? '',
      placeholder: opts.placeholder,
      'aria-label': opts.ariaLabel,
    })
    input.addEventListener('input', () => onInput(input.value))
    return input
  }

  function numberInput(value, onInput, opts = {}) {
    const input = el('input', {
      type: 'number',
      class: 'form-control form-control-sm',
      value: String(value ?? ''),
      min: opts.min,
      max: opts.max,
      'aria-label': opts.ariaLabel,
    })
    input.addEventListener('input', () => onInput(input.value === '' ? undefined : Number(input.value)))
    return input
  }

  function selectInput(options, value, onChange, opts = {}) {
    const sel = el('select', { class: 'form-select form-select-sm', 'aria-label': opts.ariaLabel })
    options.forEach((o) => {
      const option = el('option', { value: o.value, text: o.label })
      if (String(o.value) === String(value ?? '')) option.selected = true
      sel.appendChild(option)
    })
    sel.addEventListener('change', () => onChange(sel.value))
    return sel
  }

  /** รายชื่อตัวแปรที่แทรกลงในค่าได้ — ตัวแปรระบบ + รายการข้อมูลทุก item */
  function availableVariables() {
    const data = window.FLEX_BUILDER_DATA || {}
    const sys = (data.systemVars || []).map((v) => ({ key: v.key, label: v.label }))
    const items = (data.itemVars || []).map((v) => ({
      key: v.key,
      label: v.result_mode === 'rows' ? `${v.name} (จำนวนแถว)` : v.name,
    }))
    return sys.concat(items)
  }

  /**
   * select เล็ก ๆ สำหรับแทรก {ตัวแปร} ลงในช่องค่า โดยไม่ต้องพิมพ์ชื่อเอง
   * เลือกแล้วเรียก onPick แล้วรีเซ็ตกลับเป็นตัวเลือกแรกเสมอ ตัวมันเองไม่ถือค่า
   */
  function variablePicker(onPick, ariaLabel) {
    const vars = availableVariables()
    const sel = el('select', {
      class: 'form-select form-select-sm flex-var-picker',
      'aria-label': ariaLabel || 'แทรกตัวแปร',
      title: 'แทรกตัวแปรจากรายการข้อมูล',
    })
    sel.appendChild(el('option', { value: '', text: vars.length ? 'แทรกตัวแปร…' : '(ยังไม่มีรายการข้อมูล)' }))
    vars.forEach((v) => sel.appendChild(el('option', { value: v.key, text: `${v.label} {${v.key}}` })))
    sel.addEventListener('change', () => {
      if (!sel.value) return
      onPick(sel.value)
      sel.value = ''
    })
    return sel
  }

  /**
   * ฟิลด์ข้อความที่มีตัวเลือกแทรกตัวแปรอยู่ข้าง ๆ ให้
   * ใช้กับหัวข้อ/บรรทัดรอง/ข้อความเตือน/ปุ่ม ที่มักอ้างตัวแปรอย่าง {org_name}
   */
  function textFieldWithPicker(labelText, value, onInput, opts = {}) {
    const wrap = el('div', { class: 'flex-field' })
    const inputId = `fld${uid++}`
    wrap.appendChild(el('label', { for: inputId, text: labelText }))

    const row = el('div', { class: 'd-flex gap-1' })
    const input = textInput(value, onInput, { placeholder: opts.placeholder })
    input.id = inputId
    row.appendChild(input)
    row.appendChild(
      variablePicker((key) => {
        input.value = `${input.value}{${key}}`
        onInput(input.value)
      }, opts.pickerLabel || `แทรกตัวแปรใน ${labelText}`)
    )
    wrap.appendChild(row)

    if (opts.hint) wrap.appendChild(el('div', { class: 'flex-hint', text: opts.hint }))
    return wrap
  }

  /** ค่าที่ LINE Flex Message รองรับสำหรับ aspectRatio ของบล็อกรูปภาพ */
  const ASPECT_RATIOS = [
    { value: '20:13', label: 'แนวนอนกว้าง 20:13 (ค่าเริ่มต้น)' },
    { value: '1:1', label: 'จัตุรัส 1:1' },
    { value: '16:9', label: 'แนวนอนจอกว้าง 16:9' },
    { value: '4:3', label: 'แนวนอนมาตรฐาน 4:3' },
    { value: '2:1', label: 'พาโนรามา 2:1' },
    { value: '3:4', label: 'แนวตั้ง 3:4' },
    { value: '9:16', label: 'แนวตั้งสูง 9:16' },
    { value: '1:2', label: 'แนวตั้งสูงมาก 1:2' },
  ]

  function subRowControls(list, index, rerender) {
    const box = el('div', { class: 'd-flex flex-column gap-1' })
    box.appendChild(
      el('button', {
        type: 'button',
        class: 'flex-block-move',
        'aria-label': `ลบแถวที่ ${index + 1}`,
        title: 'ลบแถวนี้',
        onclick: () => {
          if (list.length <= 1) {
            App.error('ลบไม่ได้', 'ต้องมีอย่างน้อย 1 แถว')
            return
          }
          list.splice(index, 1)
          rerender()
        },
      }, [el('i', { class: 'bi bi-x-lg', 'aria-hidden': 'true' })])
    )
    return box
  }

  function renderProps() {
    const host = $('flexBlockProps')
    if (!host) return
    host.innerHTML = ''

    const block = selectedBlock()
    if (!block) {
      host.appendChild(el('div', { class: 'flex-block-empty', text: 'เลือกบล็อกทางซ้ายเพื่อแก้ไข' }))
      return
    }

    const refresh = () => {
      renderList()
      renderProps()
      schedulePreview()
    }
    const touch = () => {
      renderList()
      schedulePreview()
    }

    host.appendChild(
      el('div', {
        class: 'flex-hint mb-2',
        text: `กำลังแก้: ${BLOCKS[block.type].label}`,
      })
    )

    if (block.type === 'header') {
      host.appendChild(
        textFieldWithPicker('หัวข้อ', block.title, (v) => { block.title = v; touch() }, {
          pickerLabel: 'แทรกตัวแปรในหัวข้อ',
        })
      )
      host.appendChild(
        textFieldWithPicker('บรรทัดรอง', block.subtitle, (v) => { block.subtitle = v; touch() }, {
          pickerLabel: 'แทรกตัวแปรในบรรทัดรอง',
          hint: 'เลือกตัวแปรจากช่องขวา หรือพิมพ์เอง เช่น {org_name}',
        })
      )
    }

    if (block.type === 'note') {
      host.appendChild(
        textFieldWithPicker('ข้อความ', block.text, (v) => { block.text = v; touch() }, {
          pickerLabel: 'แทรกตัวแปรในข้อความ',
        })
      )
      host.appendChild(
        field('โทนสี', selectInput(TONES, block.tone || 'muted', (v) => { block.tone = v; touch() }))
      )
    }

    if (block.type === 'image') {
      host.appendChild(
        field('URL รูป', textInput(block.url, (v) => { block.url = v; touch() }),
          'ต้องเป็น https และเปิดสาธารณะ LINE จึงจะโหลดได้')
      )
      host.appendChild(
        field('สัดส่วนรูป',
          selectInput(ASPECT_RATIOS, block.aspectRatio || '20:13', (v) => { block.aspectRatio = v; touch() }),
          'อัตราส่วน กว้าง:สูง ของกรอบรูป — ดูผลจริงได้จากตัวอย่างด้านขวา')
      )
    }

    if (block.type === 'button') {
      host.appendChild(
        textFieldWithPicker('ข้อความบนปุ่ม', block.label, (v) => { block.label = v; touch() }, {
          pickerLabel: 'แทรกตัวแปรในข้อความบนปุ่ม',
          hint: 'สูงสุด 40 ตัวอักษร',
        })
      )
      host.appendChild(field('ลิงก์', textInput(block.uri, (v) => { block.uri = v; touch() })))
    }

    if (block.type === 'kpi') {
      host.appendChild(
        field('จำนวนช่องต่อแถว',
          selectInput([{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }],
            block.columns, (v) => { block.columns = Number(v); touch() }))
      )
      block.cells = block.cells || []
      block.cells.forEach((cell, i) => {
        const row = el('div', { class: 'flex-subrow' })
        const grid = el('div', { class: 'flex-grow-1 d-flex flex-column gap-1' })
        grid.appendChild(textInput(cell.label, (v) => { cell.label = v; touch() }, { placeholder: 'ป้าย', ariaLabel: `ป้ายช่องที่ ${i + 1}` }))
        const valueRow = el('div', { class: 'd-flex gap-1' })
        const valueInput = textInput(cell.value, (v) => { cell.value = v; touch() }, { placeholder: 'ค่า เช่น {vn}', ariaLabel: `ค่าช่องที่ ${i + 1}` })
        valueRow.appendChild(valueInput)
        valueRow.appendChild(variablePicker((key) => {
          cell.value = `{${key}}`
          valueInput.value = cell.value
          touch()
        }, `แทรกตัวแปรในค่าช่องที่ ${i + 1}`))
        grid.appendChild(valueRow)
        const pair = el('div', { class: 'd-flex gap-1' })
        pair.appendChild(textInput(cell.unit, (v) => { cell.unit = v; touch() }, { placeholder: 'หน่วย', ariaLabel: `หน่วยช่องที่ ${i + 1}` }))
        pair.appendChild(selectInput(TONES, cell.tone || 'muted', (v) => { cell.tone = v; touch() }, { ariaLabel: `โทนสีช่องที่ ${i + 1}` }))
        grid.appendChild(pair)
        row.appendChild(grid)
        row.appendChild(subRowControls(block.cells, i, refresh))
        host.appendChild(row)
      })
      host.appendChild(addButton('เพิ่มช่อง', () => {
        block.cells.push({ label: 'รายการใหม่', value: '0', tone: 'muted' })
        refresh()
      }))
    }

    if (block.type === 'list') {
      block.rows = block.rows || []
      block.rows.forEach((row, i) => {
        const wrap = el('div', { class: 'flex-subrow' })
        const grid = el('div', { class: 'flex-grow-1 d-flex flex-column gap-1' })
        grid.appendChild(textInput(row.label, (v) => { row.label = v; touch() }, { placeholder: 'ป้าย', ariaLabel: `ป้ายแถวที่ ${i + 1}` }))
        const valueRow = el('div', { class: 'd-flex gap-1' })
        const valueInput = textInput(row.value, (v) => { row.value = v; touch() }, { placeholder: 'ค่า', ariaLabel: `ค่าแถวที่ ${i + 1}` })
        valueRow.appendChild(valueInput)
        valueRow.appendChild(variablePicker((key) => {
          row.value = `{${key}}`
          valueInput.value = row.value
          touch()
        }, `แทรกตัวแปรในค่าแถวที่ ${i + 1}`))
        grid.appendChild(valueRow)
        const pair = el('div', { class: 'd-flex gap-1' })
        pair.appendChild(selectInput(TONES, row.tone || 'muted', (v) => { row.tone = v; touch() }, { ariaLabel: `โทนสีแถวที่ ${i + 1}` }))
        grid.appendChild(pair)
        wrap.appendChild(grid)
        wrap.appendChild(subRowControls(block.rows, i, refresh))
        host.appendChild(wrap)
      })
      host.appendChild(addButton('เพิ่มแถว', () => {
        block.rows.push({ label: 'รายการใหม่', value: '0' })
        refresh()
      }))
    }

    if (block.type === 'table') {
      const rowItems = (window.FLEX_BUILDER_DATA?.itemVars || []).filter((i) => i.result_mode === 'rows')
      const options = [{ value: '', label: '— เลือกรายการข้อมูล —' }]
        .concat(rowItems.map((i) => ({ value: i.key, label: `${i.name} (${i.key})` })))

      host.appendChild(
        field('รายการข้อมูล',
          selectInput(options, block.itemKey, (v) => { block.itemKey = v; touch() }),
          rowItems.length
            ? 'แสดงเฉพาะ item ที่ตั้งโหมดผลลัพธ์เป็น "หลายแถว"'
            : 'ยังไม่มี item โหมด "หลายแถว" — ไปตั้งค่าที่หน้ารายการข้อมูล')
      )
      host.appendChild(
        field('จำนวนแถวสูงสุด',
          numberInput(block.maxRows ?? 15, (v) => { block.maxRows = v; touch() }, { min: 1, max: 30 }),
          'สูงสุด 30 — ถ้าข้อความยาวจนเกินขีดจำกัด ระบบจะลดให้เองอัตโนมัติ')
      )
      host.appendChild(
        field('ข้อความเมื่อไม่มีข้อมูล', textInput(block.emptyText, (v) => { block.emptyText = v; touch() }))
      )

      const showHeader = el('div', { class: 'form-check mb-2' })
      const cb = el('input', { type: 'checkbox', class: 'form-check-input', id: 'flexTblHead' })
      cb.checked = block.showHeader !== false
      cb.addEventListener('change', () => { block.showHeader = cb.checked; touch() })
      showHeader.appendChild(cb)
      showHeader.appendChild(el('label', { class: 'form-check-label', for: 'flexTblHead', text: 'แสดงหัวตาราง' }))
      host.appendChild(showHeader)

      host.appendChild(el('div', { class: 'flex-hint mb-1', text: 'คอลัมน์ (ชื่อคอลัมน์ต้องตรงกับที่ SQL คืนมา)' }))
      block.columns = block.columns || []
      block.columns.forEach((col, i) => {
        const wrap = el('div', { class: 'flex-subrow' })
        const grid = el('div', { class: 'flex-grow-1 d-flex flex-column gap-1' })
        grid.appendChild(textInput(col.source, (v) => { col.source = v; touch() }, { placeholder: 'ชื่อคอลัมน์จาก SQL', ariaLabel: `ชื่อคอลัมน์ที่ ${i + 1}` }))
        grid.appendChild(textInput(col.label, (v) => { col.label = v; touch() }, { placeholder: 'หัวตาราง', ariaLabel: `หัวตารางคอลัมน์ที่ ${i + 1}` }))
        const trio = el('div', { class: 'd-flex gap-1' })
        trio.appendChild(numberInput(col.flex ?? 2, (v) => { col.flex = v ?? 0; touch() }, { min: 0, max: 12, ariaLabel: `ความกว้างคอลัมน์ที่ ${i + 1}` }))
        trio.appendChild(selectInput(ALIGNS, col.align || 'start', (v) => { col.align = v; touch() }, { ariaLabel: `การจัดวางคอลัมน์ที่ ${i + 1}` }))
        trio.appendChild(selectInput(TONES, col.tone || 'muted', (v) => { col.tone = v; touch() }, { ariaLabel: `โทนสีคอลัมน์ที่ ${i + 1}` }))
        grid.appendChild(trio)
        wrap.appendChild(grid)
        wrap.appendChild(subRowControls(block.columns, i, refresh))
        host.appendChild(wrap)
      })
      host.appendChild(addButton('เพิ่มคอลัมน์', () => {
        block.columns.push({ source: '', label: 'คอลัมน์', flex: 2, align: 'start' })
        refresh()
      }))
    }

    if (block.type === 'separator') {
      host.appendChild(el('div', { class: 'flex-hint', text: 'เส้นคั่นไม่มีค่าให้ตั้ง' }))
    }
  }

  function addButton(text, onClick) {
    return el('button', {
      type: 'button',
      class: 'btn-modern btn-soft btn-sm w-100 mt-1',
      onclick: onClick,
    }, [el('i', { class: 'bi bi-plus-lg', 'aria-hidden': 'true' }), document.createTextNode(' ' + text)])
  }

  // ---------- รายการบล็อก ----------

  function moveBlock(index, delta) {
    const blocks = state.design.blocks
    const target = index + delta
    if (target < 0 || target >= blocks.length) return
    const [moved] = blocks.splice(index, 1)
    blocks.splice(target, 0, moved)
    state.selectedId = moved.id
    renderList()
    schedulePreview()
    announce(`ย้าย ${BLOCKS[moved.type].label} ไปตำแหน่งที่ ${target + 1}`)
    document.querySelector(`[data-block-id="${moved.id}"]`)?.focus()
  }

  function removeBlock(index) {
    const blocks = state.design.blocks
    const [removed] = blocks.splice(index, 1)
    if (state.selectedId === removed.id) {
      state.selectedId = blocks[Math.min(index, blocks.length - 1)]?.id ?? null
    }
    renderList()
    renderProps()
    schedulePreview()
    announce(`ลบ ${BLOCKS[removed.type].label} แล้ว เหลือ ${blocks.length} บล็อก`)
  }

  function renderList() {
    const list = $('flexBlockList')
    if (!list) return
    list.innerHTML = ''

    const blocks = state.design.blocks || []
    if (blocks.length === 0) {
      list.appendChild(el('li', { class: 'flex-block-empty', text: 'ยังไม่มีบล็อก — กด "เพิ่มบล็อก"' }))
      return
    }

    blocks.forEach((block, index) => {
      const def = BLOCKS[block.type]
      const item = el('li', {
        class: 'flex-block-item',
        role: 'option',
        tabindex: block.id === state.selectedId ? '0' : '-1',
        'aria-selected': block.id === state.selectedId ? 'true' : 'false',
        'data-block-id': block.id,
      })

      item.appendChild(el('i', { class: `bi ${def.icon}`, 'aria-hidden': 'true' }))
      item.appendChild(el('span', {
        class: 'flex-block-label',
        text: `${def.label} · ${String(def.summary(block)).slice(0, 22)}`,
      }))

      item.appendChild(el('button', {
        type: 'button', class: 'flex-block-move', title: 'เลื่อนขึ้น',
        'aria-label': `เลื่อน ${def.label} ขึ้น`,
        disabled: index === 0 ? 'disabled' : null,
        onclick: (e) => { e.stopPropagation(); moveBlock(index, -1) },
      }, [el('i', { class: 'bi bi-chevron-up', 'aria-hidden': 'true' })]))

      item.appendChild(el('button', {
        type: 'button', class: 'flex-block-move', title: 'เลื่อนลง',
        'aria-label': `เลื่อน ${def.label} ลง`,
        disabled: index === blocks.length - 1 ? 'disabled' : null,
        onclick: (e) => { e.stopPropagation(); moveBlock(index, 1) },
      }, [el('i', { class: 'bi bi-chevron-down', 'aria-hidden': 'true' })]))

      item.appendChild(el('button', {
        type: 'button', class: 'flex-block-move', title: 'ลบบล็อก',
        'aria-label': `ลบบล็อก ${def.label}`,
        onclick: async (e) => {
          e.stopPropagation()
          const ok = await App.confirm({ title: `ลบบล็อก ${def.label}?`, confirmText: 'ลบ', danger: true })
          if (ok) removeBlock(index)
        },
      }, [el('i', { class: 'bi bi-x-lg', 'aria-hidden': 'true' })]))

      item.addEventListener('click', () => {
        state.selectedId = block.id
        renderList()
        renderProps()
      })

      item.addEventListener('keydown', (e) => {
        const blocksNow = state.design.blocks
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          const next = blocksNow[index + (e.key === 'ArrowDown' ? 1 : -1)]
          if (!next) return
          state.selectedId = next.id
          renderList()
          renderProps()
          document.querySelector(`[data-block-id="${next.id}"]`)?.focus()
        } else if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
          e.preventDefault()
          moveBlock(index, e.key === 'ArrowRight' ? 1 : -1)
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          state.selectedId = block.id
          renderList()
          renderProps()
        }
      })

      list.appendChild(item)
    })
  }

  // ---------- ตัวอย่าง ----------

  function schedulePreview() {
    clearTimeout(previewTimer)
    previewTimer = setTimeout(() => runPreview(false), 600)
  }

  async function runPreview(live) {
    const target = $('flexPreviewTarget')
    if (!target) return

    const seq = ++previewSeq
    const res = await App.ajax(
      '/templates/flex/preview',
      {
        flex_design: JSON.stringify(state.design),
        alt_text: state.altText,
        live: live ? '1' : '0',
      },
      { loader: live, autoToast: false }
    )
    // ผลลัพธ์ที่มาช้ากว่าคำขอถัดไปต้องทิ้ง ไม่งั้นตัวอย่างจะกระพริบย้อนหลัง
    if (seq !== previewSeq) return

    const meta = $('flexPreviewMeta')
    const msg = $('flexPreviewMsg')
    msg.innerHTML = ''

    if (!res.success) {
      meta.textContent = ''
      msg.appendChild(el('div', { class: 'flex-preview-err', text: res.message || 'สร้างตัวอย่างไม่สำเร็จ' }))
      return
    }

    const data = res.data
    FlexPreview.render(data.contents, target, data.altText)

    meta.innerHTML = ''
    meta.appendChild(el('span', { text: `${data.bytes.toLocaleString('en-US')} bytes` }))
    meta.appendChild(el('span', { text: live ? 'ข้อมูลจริง' : 'ข้อมูลตัวอย่าง' }))

    ;(data.warnings || []).forEach((w) => {
      msg.appendChild(el('div', { class: 'flex-preview-warn', text: w }))
    })
  }

  // ---------- การเชื่อมต่อกับฟอร์ม ----------

  function bindOnce() {
    if (bindOnce.done) return
    bindOnce.done = true

    const addSel = $('flexAddBlock')
    addSel?.addEventListener('change', () => {
      const type = addSel.value
      if (!type || !BLOCKS[type]) return
      const block = BLOCKS[type].make()
      state.design.blocks.push(block)
      state.selectedId = block.id
      addSel.value = ''
      renderList()
      renderProps()
      schedulePreview()
      announce(`เพิ่ม ${BLOCKS[type].label} แล้ว รวม ${state.design.blocks.length} บล็อก`)
      document.querySelector(`[data-block-id="${block.id}"]`)?.focus()
    })

    $('flexAltText')?.addEventListener('input', (e) => {
      state.altText = e.target.value
      schedulePreview()
    })

    $('flexThemePrimary')?.addEventListener('input', (e) => {
      state.design.theme = state.design.theme || {}
      state.design.theme.primary = e.target.value
      schedulePreview()
    })

    $('flexLiveBtn')?.addEventListener('click', () => runPreview(true))

    $('flexTestSendBtn')?.addEventListener('click', async () => {
      const groupId = $('flexTestGroup')?.value
      if (!groupId) {
        App.error('ยังไม่ได้เลือกกลุ่ม', 'กรุณาเลือกกลุ่ม LINE ที่จะส่งทดสอบ')
        return
      }
      const ok = await App.confirm({
        title: 'ส่งทดสอบเข้าห้อง LINE จริง?',
        text: 'ข้อความจะเข้าห้องจริง สมาชิกในกลุ่มจะเห็น',
        confirmText: 'ส่งเลย',
      })
      if (!ok) return

      const res = await App.ajax('/templates/flex/test-send', {
        group_id: groupId,
        flex_design: JSON.stringify(state.design),
        alt_text: state.altText,
      })
      if (res.success) App.success('ส่งแล้ว', res.message)
    })
  }

  // ---------- API ที่ templates.edge เรียกใช้ ----------

  window.FlexBuilder = {
    /** โหลดนิยามเข้า builder — design เป็น null จะเริ่มการ์ดเปล่า */
    open(design, altText) {
      bindOnce()
      let next = design
      if (typeof next === 'string') {
        try { next = JSON.parse(next) } catch { next = null }
      }
      state.design = next && Array.isArray(next.blocks) ? next : blankDesign()
      state.design.version = 1
      state.design.blocks.forEach((b) => { if (!b.id) b.id = nextId() })
      state.altText = altText || ''
      state.selectedId = state.design.blocks[0]?.id ?? null

      const altInput = $('flexAltText')
      if (altInput) altInput.value = state.altText
      const themeInput = $('flexThemePrimary')
      if (themeInput) themeInput.value = state.design.theme?.primary || '#1E3A8A'

      renderList()
      renderProps()
      runPreview(false)
    },

    getDesign() {
      return state.design
    },

    getAltText() {
      return state.altText
    },
  }
})()
