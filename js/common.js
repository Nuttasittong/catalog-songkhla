// ค่าคงที่และตัวช่วยแสดงผลที่ใช้ร่วมกันระหว่างหน้าเว็บและ E-book
window.UI = (() => {
  const cfg = window.APP_CONFIG;

  // ต้องตรงกับรายการใน apps-script/Config.gs
  const CATEGORIES = [
    { key: 'ที่อยู่อาศัย', icon: '🏠', color: '#B45309' },
    { key: 'อาชีพ/รายได้', icon: '🌱', color: '#15803D' },
    { key: 'การศึกษา', icon: '🎓', color: '#1D4ED8' },
    { key: 'สุขภาพ', icon: '🩺', color: '#BE123C' },
    { key: 'น้ำ-ไฟ', icon: '💧', color: '#0369A1' },
    { key: 'ของใช้จำเป็น', icon: '🧺', color: '#7C3AED' },
  ];
  const CAT = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

  const STATUS_ORDER = ['รอการช่วยเหลือ', 'มีผู้ประสงค์ช่วย', 'กำลังดำเนินการ', 'ช่วยเหลือแล้ว'];
  const STATUS = {
    'รอการช่วยเหลือ': { cls: 'st-wait', icon: '⏳' },
    'มีผู้ประสงค์ช่วย': { cls: 'st-pledged', icon: '🤝' },
    'กำลังดำเนินการ': { cls: 'st-progress', icon: '🔧' },
    'ช่วยเหลือแล้ว': { cls: 'st-done', icon: '✅' },
  };

  const URGENCY = {
    3: { label: 'เร่งด่วนมาก', cls: 'urg-3' },
    2: { label: 'เร่งด่วน', cls: 'urg-2' },
    1: { label: 'ปกติ', cls: 'urg-1' },
  };

  // มิติปัญหาตาม TPMAP
  const DIMENSIONS = ['สุขภาพ', 'ความเป็นอยู่', 'การศึกษา', 'รายได้', 'การเข้าถึงบริการรัฐ'];

  const VULNERABLE = [
    ['elderly', '👵', 'ผู้สูงอายุ'],
    ['disabled', '♿', 'ผู้พิการ'],
    ['bedridden', '🛏️', 'ผู้ป่วยติดเตียง'],
    ['children', '🧒', 'เด็ก'],
  ];

  // สีธีม (น้ำเงินตามโลโก้กรมการพัฒนาชุมชน) ใช้กับแถบหัว E-book ทุกอำเภอ
  const THEME_COLOR = '#1D3F94';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = encodeURIComponent;

  function thaiDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const thaiYear = () => new Date().getFullYear() + 543;

  const amphoeColor = () => THEME_COLOR;

  // ลิงก์หน้าเว็บ (ใช้แชร์และทำ QR) — เว็บที่ Apps Script เสิร์ฟส่ง # เข้าไปในหน้าไม่ได้ จึงใช้ ?p= แทน
  function siteUrl(hash) {
    const base = (cfg.SITE_URL || (location.origin + location.pathname)).replace(/#.*$/, '');
    if (/script\.google\.com/.test(base)) return base.split('?')[0] + (hash ? '?p=' + encodeURIComponent(hash.replace(/^#/, '')) : '');
    return base + (hash || '');
  }

  // path รูปในเว็บ → data URI เมื่อรวมเป็นไฟล์เดียวสำหรับ Apps Script (window.ASSETS สร้างโดย tools/build_gas.py)
  const asset = path => (window.ASSETS && window.ASSETS[path]) || path;

  function statusBadge(s) {
    const st = STATUS[s] || STATUS['รอการช่วยเหลือ'];
    return `<span class="badge ${st.cls}">${st.icon} ${esc(s || 'รอการช่วยเหลือ')}</span>`;
  }

  function urgencyBadge(u) {
    const x = URGENCY[u];
    return x ? `<span class="badge ${x.cls}">${u == 3 ? '🔥 ' : ''}${x.label}</span>` : '';
  }

  function catChips(cats) {
    return (cats || []).map(c => {
      const x = CAT[c] || { icon: '•', color: '#5B6661' };
      return `<span class="chip-cat" style="--c:${x.color}">${x.icon} ${esc(c)}</span>`;
    }).join('');
  }

  function dimChips(dims) {
    return (dims || []).map(d => `<span class="chip-dim">${esc(d)}</span>`).join('');
  }

  function vulnChips(v) {
    return VULNERABLE.filter(([k]) => Number(v && v[k]) > 0)
      .map(([k, icon, label]) => `<span class="chip-vuln">${icon} ${label} ${Number(v[k])}</span>`).join('');
  }

  function address(h, withAmphoe) {
    const parts = [];
    if (h.houseNo) parts.push(esc(h.houseNo));
    if (h.moo) parts.push('ม.' + esc(h.moo));
    if (h.tambon) parts.push('ต.' + esc(h.tambon));
    if (withAmphoe && h.amphoe) parts.push('อ.' + esc(h.amphoe));
    return parts.join(' ');
  }

  // รูปแรกของครัวเรือน หรือภาพแทนตามหมวดความต้องการ
  function photo(h, idx = 0) {
    const src = h.photos && h.photos[idx];
    if (src) {
      return `<img src="${esc(src)}" alt="ภาพครัวเรือน ${esc(h.id)}" loading="lazy" referrerpolicy="no-referrer">`;
    }
    const c = CAT[h.categories && h.categories[0]];
    return `<div class="ph" style="--ph:${c ? c.color : amphoeColor(h.amphoeCode)}">
      <span aria-hidden="true">${c ? c.icon : '🏠'}</span><small>ยังไม่มีรูปภาพ</small></div>`;
  }

  // รายการความต้องการของครัวเรือน (เน้นสิ่งที่ต้องการ ไม่แสดงจำนวนเงิน)
  function needList(needs, max) {
    if (!needs || !needs.length) return '';
    const shown = max ? needs.slice(0, max) : needs;
    const more = max && needs.length > max ? `<li class="more">และอีก ${needs.length - max} รายการ</li>` : '';
    return `<ul class="need-list">${shown.map(n => `<li>${esc(n.item)}</li>`).join('')}${more}</ul>`;
  }

  // QR เป็น SVG ปรับขนาดได้ (ต้องโหลด qrcode-generator ก่อน)
  function qr(text) {
    if (typeof window.qrcode !== 'function') return '';
    try {
      const q = window.qrcode(0, 'M');
      q.addData(text);
      q.make();
      return q.createSvgTag(2, 0).replace(/\s(width|height)="[^"]*"/g, '');
    } catch (e) {
      return '';
    }
  }

  // กล่องยืนยันบนหน้าเว็บ — ใช้แทน confirm() ซึ่งถูกบล็อกในกรอบหน้าเว็บของ Apps Script และเบราว์เซอร์ในแอป LINE
  function ask(message, okLabel, danger) {
    return new Promise(resolve => {
      const d = document.createElement('div');
      d.className = 'ask-backdrop';
      d.innerHTML = `<div class="ask box" role="alertdialog" aria-modal="true"><p>${esc(message).replace(/\n/g, '<br>')}</p>
        <div class="ask-actions"><button type="button" class="btn btn-outline" data-a="0">ยกเลิก</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-cta'}" data-a="1">${esc(okLabel || 'ตกลง')}</button></div></div>`;
      const done = v => { d.remove(); document.removeEventListener('keydown', key); resolve(v); };
      const key = e => { if (e.key === 'Escape') done(false); };
      d.addEventListener('click', e => {
        const b = e.target.closest('[data-a]');
        if (b) done(b.dataset.a === '1'); else if (e.target === d) done(false);
      });
      document.addEventListener('keydown', key);
      document.body.appendChild(d);
      d.querySelector('[data-a="1"]').focus();
    });
  }

  return {
    CATEGORIES, CAT, STATUS, STATUS_ORDER, URGENCY, DIMENSIONS, VULNERABLE,
    esc, enc, thaiDate, thaiYear, amphoeColor, siteUrl, asset, statusBadge, urgencyBadge,
    catChips, dimChips, vulnChips, address, photo, needList, qr, ask,
  };
})();
