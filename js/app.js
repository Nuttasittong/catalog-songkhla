// หน้าเว็บหลัก: router แบบ hash และหน้าต่าง ๆ ของ Catalog
(() => {
  'use strict';
  const { esc, enc } = UI;
  const cfg = window.APP_CONFIG;
  const view = document.getElementById('view');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  let data = null;
  // รูปตกแต่งจากโฟลเดอร์ "รูปภาพสำหรับใช้ตกแต่ง Catalog"
  const deco = (name, alt, cls) => `<img class="${cls || ''}" src="${UI.asset(`img/deco/${name}.webp`)}" alt="${alt}" loading="lazy">`;
  let liffProfile = null;
  const leaveHooks = [];

  // ---------- ตัวช่วยทั่วไป ----------
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(qs || '') };
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function amphoeByCode(code) {
    return data.amphoes.find(a => a.code === code);
  }

  function householdsOf(code) {
    return data.households.filter(h => h.amphoeCode === code);
  }

  function findHousehold(id) {
    return data.households.find(h => h.id === id);
  }

  function stats(hs) {
    return {
      total: hs.length,
      waiting: hs.filter(h => h.status === 'รอการช่วยเหลือ').length,
      helping: hs.filter(h => h.status === 'มีผู้ประสงค์ช่วย' || h.status === 'กำลังดำเนินการ').length,
      done: hs.filter(h => h.status === 'ช่วยเหลือแล้ว').length,
      needs: hs.reduce((s, h) => s + h.needs.length, 0),
    };
  }

  function mockBanner() {
    return data.mock
      ? '<div class="notice">🧪 โหมดทดลอง: แสดงข้อมูลจำลอง ครัวเรือนที่มีป้าย “ข้อมูลตัวอย่าง” เป็นข้อมูลสมมติ</div>'
      : '';
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  async function initLiff() {
    if (!cfg.LIFF_ID) return;
    try {
      await loadScript('https://static.line-scdn.net/liff/edge/2/sdk.js');
      await window.liff.init({ liffId: cfg.LIFF_ID });
      if (window.liff.isLoggedIn()) liffProfile = await window.liff.getProfile();
    } catch (e) {
      console.warn('LIFF init ไม่สำเร็จ', e);
    }
  }

  async function share(h) {
    const url = UI.siteUrl('#/h/' + h.id);
    const needs = h.needs.map(n => n.item).join(', ');
    const text = `ร่วมช่วยเหลือครัวเรือน ${h.id} อ.${h.amphoe} จ.${cfg.PROVINCE}`
      + (needs ? `\nความต้องการ: ${needs}` : '') + `\n${url}`;
    const liff = window.liff;
    if (liff && liff.isApiAvailable && liff.isApiAvailable('shareTargetPicker')) {
      try { await liff.shareTargetPicker([{ type: 'text', text }]); return; } catch (e) { /* ใช้วิธีอื่นแทน */ }
    }
    if (navigator.share) {
      try { await navigator.share({ title: 'Catalog ครัวเรือนยากจน', text, url }); return; } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    window.open('https://line.me/R/share?text=' + enc(text), '_blank', 'noopener');
  }

  function card(h) {
    return `<a class="card" href="#/h/${enc(h.id)}">
      <div class="card-photo">${UI.photo(h)}
        <div class="card-badges">${UI.statusBadge(h.status)}${h.urgency == 3 ? UI.urgencyBadge(3) : ''}</div>
      </div>
      <div class="card-body">
        <div class="card-meta">${esc(h.id)} · ต.${esc(h.tambon)} อ.${esc(h.amphoe)}</div>
        <h3>${esc(h.name)}${h.demo ? ' <span class="badge demo">ตัวอย่าง</span>' : ''}</h3>
        <div class="tags">${UI.catChips(h.categories)}</div>
        <p class="card-problem">${h.problem ? esc(h.problem) : '<i class="muted">อยู่ระหว่างสำรวจข้อมูล</i>'}</p>
        <div class="card-foot">${UI.needList(h.needs, 3)}</div>
      </div>
    </a>`;
  }

  // ---------- หน้าแรก ----------
  function renderHome() {
    const hs = data.households;
    const s = stats(hs);
    const urgent = hs.filter(h => h.urgency == 3 && h.status !== 'ช่วยเหลือแล้ว').slice(0, 10);
    const amphoeTiles = data.amphoes.map(a => {
      const n = householdsOf(a.code).length;
      return `<a class="amphoe-tile${n ? '' : ' empty'}" href="#/list?amphoe=${enc(a.code)}" style="--ac:${UI.amphoeColor(a.code)}">
        <b>${esc(a.name)}</b><small>${n ? n + ' ครัวเรือน' : 'ยังไม่มีข้อมูล'}</small></a>`;
    }).join('');
    const catTiles = UI.CATEGORIES.map(c => {
      const n = hs.filter(h => h.categories.includes(c.key) && h.status !== 'ช่วยเหลือแล้ว').length;
      return `<a class="cat-tile" href="#/list?cat=${enc(c.key)}" style="--c:${c.color}">
        <span class="cat-icon" aria-hidden="true">${c.icon}</span><b>${esc(c.key)}</b><small>${n} ครัวเรือน</small></a>`;
    }).join('');

    view.innerHTML = `${mockBanner()}
    <section class="hero">
      <div class="hero-text">
        <div class="hero-slogan">${deco('slogan', 'พลังรัฐ พลังเอกชน พลังชุมชน ร่วมแก้จนคนสงขลา')}</div>
        <h1>ร่วมเปลี่ยนชีวิตครัวเรือนยากจนในจังหวัด${esc(cfg.PROVINCE)}</h1>
        <p>เลือกครัวเรือนที่ตรงกับนโยบาย CSR ของหน่วยงานคุณ แล้วกด “ฉันอยากช่วย” พัฒนากรจะประสานการส่งมอบและรายงานผลให้</p>
        <div class="hero-actions">
          <a class="btn btn-cta" href="#/list?status=${enc('รอการช่วยเหลือ')}">ดูครัวเรือนที่รอความช่วยเหลือ</a>
          <a class="btn btn-light" href="#/ebook">📖 เปิด Catalog E-book</a>
        </div>
      </div>
      ${deco('mascots-hi5', 'มาสคอต ศจพ.สงขลา', 'hero-art')}
    </section>

    <section class="stats">
      <div class="stat"><b>${s.total}</b><span>ครัวเรือนเป้าหมาย</span></div>
      <div class="stat warn"><b>${s.waiting}</b><span>รอความช่วยเหลือ</span></div>
      <div class="stat ok"><b>${s.done}</b><span>ช่วยเหลือแล้ว</span></div>
      <div class="stat"><b>${s.helping}</b><span>อยู่ระหว่างประสานช่วยเหลือ</span></div>
    </section>

    <section class="section">
      <h2 class="sec-title">ช่วยตามความต้องการ</h2>
      <div class="cat-grid">${catTiles}</div>
    </section>

    ${urgent.length ? `<section class="section">
      <div class="sec-head"><h2 class="sec-title">🔥 เร่งด่วนมาก</h2>
        <a href="#/list?urg=3">ดูทั้งหมด →</a></div>
      <div class="strip">${urgent.map(card).join('')}</div>
    </section>` : ''}

    <section class="section">
      <div class="sec-head"><h2 class="sec-title">เลือกอำเภอ</h2><a href="#/dashboard">ภาพรวมรายอำเภอ →</a></div>
      <div class="amphoe-grid">${amphoeTiles}</div>
    </section>

    <section class="section steps">
      ${deco('banner-opportunity', 'แสงแห่งโอกาส เริ่มจากการไม่ทิ้งกัน', 'steps-banner')}
      <h2 class="sec-title">ช่วยเหลือง่าย ๆ 3 ขั้นตอน</h2>
      <ol>
        <li><span>1</span><b>เลือกครัวเรือน</b><small>กรองตามอำเภอ ตำบล หรือหมวดความต้องการ</small></li>
        <li><span>2</span><b>กด “ฉันอยากช่วย”</b><small>กรอกชื่อหน่วยงานและเบอร์ติดต่อ ใช้เวลาไม่ถึง 1 นาที</small></li>
        <li><span>3</span><b>พัฒนากรประสานส่งมอบ</b><small>พร้อมรายงานผลและภาพก่อน–หลัง สำหรับรายงาน CSR/ESG</small></li>
      </ol>
    </section>
    ${footer()}`;
  }

  function footer() {
    return `<footer class="foot">
      <div class="partners">
        <img src="${UI.asset('img/logo-cdd.png')}" alt="กรมการพัฒนาชุมชน" loading="lazy">
        <img src="${UI.asset('img/seal-songkhla.png')}" alt="จังหวัดสงขลา" loading="lazy">
        ${deco('logo-sjp', 'ศจพ.')}
        ${deco('logo-1org1csr', 'โครงการ 1 องค์กร 1 CSR')}
      </div>
      <p>${esc(cfg.ORG)}${cfg.ORG_PHONE ? ' · โทร ' + esc(cfg.ORG_PHONE) : ''}</p>
      <p>ข้อมูล ณ ${UI.thaiDate(data.updated)} · <button class="linkbtn" id="refresh">อัปเดตข้อมูล</button>
        · <a href="#/about">นโยบายข้อมูลส่วนบุคคล</a> · <a href="#/staff">🔐 สำหรับเจ้าหน้าที่</a></p>
    </footer>`;
  }

  // ---------- รายการครัวเรือน ----------
  const SORTS = {
    urgent: 'เร่งด่วนก่อน',
    area: 'ตามตำบล/หมู่',
    id: 'ตามรหัส',
  };

  function renderList(_, q) {
    const st = {
      q: q.get('q') || '', amphoe: q.get('amphoe') || '', tambon: q.get('tambon') || '',
      cat: q.get('cat') || '', status: q.get('status') || '', urg: q.get('urg') || '',
      sort: q.get('sort') || 'urgent',
    };
    const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
    const moreOpen = st.urg || st.sort !== 'urgent';

    view.innerHTML = `${mockBanner()}
    <div class="page-head"><h1>ครัวเรือนเป้าหมาย</h1></div>
    <div class="filters">
      <input type="search" id="f-q" placeholder="🔍 ค้นหาชื่อ รหัส ตำบล หรือความต้องการ" value="${esc(st.q)}" aria-label="ค้นหา">
      <div class="chips" role="group" aria-label="หมวดความต้องการ">
        <button class="chip${st.cat ? '' : ' on'}" data-cat="">ทั้งหมด</button>
        ${UI.CATEGORIES.map(c => `<button class="chip${st.cat === c.key ? ' on' : ''}" data-cat="${esc(c.key)}">${c.icon} ${esc(c.key)}</button>`).join('')}
      </div>
      <div class="filter-row">
        <select id="f-amphoe" aria-label="อำเภอ">${opt('', 'ทุกอำเภอ', st.amphoe)}${data.amphoes.map(a => opt(a.code, 'อ.' + a.name, st.amphoe)).join('')}</select>
        <select id="f-tambon" aria-label="ตำบล"></select>
        <select id="f-status" aria-label="สถานะ">${opt('', 'ทุกสถานะ', st.status)}${UI.STATUS_ORDER.map(s => opt(s, s, st.status)).join('')}</select>
        <button class="btn btn-small btn-outline" id="f-more" aria-expanded="${moreOpen}">⚙️ ตัวกรองเพิ่ม</button>
      </div>
      <div class="filter-row" id="f-more-row"${moreOpen ? '' : ' hidden'}>
        <select id="f-urg" aria-label="ความเร่งด่วน">${opt('', 'ทุกระดับความเร่งด่วน', st.urg)}${[3, 2, 1].map(u => opt(String(u), UI.URGENCY[u].label, st.urg)).join('')}</select>
        <select id="f-sort" aria-label="เรียงลำดับ">${Object.entries(SORTS).map(([k, l]) => opt(k, 'เรียง: ' + l, st.sort)).join('')}</select>
      </div>
    </div>
    <div id="area-banner"></div>
    <p class="result-count" id="count" aria-live="polite"></p>
    <div class="card-grid" id="results"></div>`;

    const fillTambons = () => {
      const pool = st.amphoe ? householdsOf(st.amphoe) : data.households;
      const tambons = [...new Set(pool.map(h => h.tambon))].sort((a, b) => a.localeCompare(b, 'th'));
      if (!tambons.includes(st.tambon)) st.tambon = '';
      $('#f-tambon').innerHTML = opt('', 'ทุกตำบล', st.tambon) + tambons.map(t => opt(t, 'ต.' + t, st.tambon)).join('');
    };

    const update = () => {
      const params = new URLSearchParams(Object.entries(st).filter(([k, v]) => v && !(k === 'sort' && v === 'urgent')));
      history.replaceState(null, '', '#/list' + (params.toString() ? '?' + params : ''));
      const list = filterHouseholds(st);
      $('#count').textContent = `พบ ${list.length} ครัวเรือน`;
      $('#results').innerHTML = list.length ? list.map(card).join('')
        : '<div class="empty-state">ไม่พบครัวเรือนตามเงื่อนไข ลองล้างตัวกรองบางรายการ</div>';
      renderAreaBanner(st, list);
    };

    fillTambons();
    update();

    let typing;
    $('#f-q').addEventListener('input', e => {
      clearTimeout(typing);
      typing = setTimeout(() => { st.q = e.target.value; update(); }, 200);
    });
    $$('.chip[data-cat]').forEach(b => b.addEventListener('click', () => {
      st.cat = b.dataset.cat;
      $$('.chip[data-cat]').forEach(x => x.classList.toggle('on', x === b));
      update();
    }));
    $('#f-amphoe').addEventListener('change', e => { st.amphoe = e.target.value; fillTambons(); update(); });
    $('#f-tambon').addEventListener('change', e => { st.tambon = e.target.value; update(); });
    $('#f-status').addEventListener('change', e => { st.status = e.target.value; update(); });
    $('#f-urg').addEventListener('change', e => { st.urg = e.target.value; update(); });
    $('#f-sort').addEventListener('change', e => { st.sort = e.target.value; update(); });
    $('#f-more').addEventListener('click', e => {
      const row = $('#f-more-row');
      row.hidden = !row.hidden;
      e.currentTarget.setAttribute('aria-expanded', String(!row.hidden));
    });
  }

  function filterHouseholds(st) {
    const ql = st.q.trim().toLowerCase();
    const list = data.households.filter(h =>
      (!st.amphoe || h.amphoeCode === st.amphoe) &&
      (!st.tambon || h.tambon === st.tambon) &&
      (!st.cat || h.categories.includes(st.cat)) &&
      (!st.status || h.status === st.status) &&
      (!st.urg || String(h.urgency) === st.urg) &&
      (!ql || [h.id, h.name, h.tambon, h.amphoe, h.problem, ...h.needs.map(n => n.item)]
        .join(' ').toLowerCase().includes(ql)));
    const statusRank = h => UI.STATUS_ORDER.indexOf(h.status);
    const sorters = {
      urgent: (a, b) => statusRank(a) - statusRank(b) || (b.urgency || 0) - (a.urgency || 0) || a.id.localeCompare(b.id),
      area: (a, b) => a.tambon.localeCompare(b.tambon, 'th') || (Number(a.moo) || 0) - (Number(b.moo) || 0) || a.id.localeCompare(b.id),
      id: (a, b) => a.id.localeCompare(b.id),
    };
    return list.sort(sorters[st.sort] || sorters.urgent);
  }

  // ชวนช่วยเหลือทั้งตำบล/อำเภอ เมื่อกรองพื้นที่แล้ว
  function renderAreaBanner(st, list) {
    const el = $('#area-banner');
    const open = list.filter(h => h.status !== 'ช่วยเหลือแล้ว');
    if (!st.amphoe || open.length < 2) { el.innerHTML = ''; return; }
    const a = amphoeByCode(st.amphoe);
    const area = st.tambon ? `ต.${st.tambon} อ.${a.name}` : `อ.${a.name}`;
    const needCount = open.reduce((s, h) => s + h.needs.length, 0);
    const qs = new URLSearchParams({ amphoe: st.amphoe, ...(st.tambon ? { tambon: st.tambon } : {}) });
    el.innerHTML = `<div class="area-banner">
      <div><b>สนใจช่วยทั้งพื้นที่ ${esc(area)}?</b>
        <small>${open.length} ครัวเรือน${needCount ? ` · ${needCount} รายการความต้องการ` : ''} — เหมาะกับโครงการ CSR ระดับชุมชน</small></div>
      <a class="btn btn-small btn-cta" href="#/help/area?${qs}">ช่วยทั้งพื้นที่</a></div>`;
  }

  // ---------- รายละเอียดครัวเรือน ----------
  function renderDetail([id]) {
    const h = findHousehold(id);
    if (!h) return renderNotFound();
    const a = amphoeByCode(h.amphoeCode) || {};
    const pending = '<i class="muted">อยู่ระหว่างสำรวจข้อมูล</i>';
    const gallery = h.photos.length
      ? `<div class="gallery">${h.photos.map((_, i) => `<div class="gallery-item">${UI.photo(h, i)}</div>`).join('')}</div>`
      : `<div class="gallery"><div class="gallery-item">${UI.photo(h)}</div></div>`;
    const done = h.status === 'ช่วยเหลือแล้ว';
    const contact = h.officer || a.coordinator || '';
    const phone = h.officerPhone || a.phone || '';
    const sponsors = data.sponsors.filter(s => (s.households || []).includes(h.id));

    view.innerHTML = `${mockBanner()}
    <a class="back" href="#/list?amphoe=${enc(h.amphoeCode)}">← ครัวเรือนอำเภอ${esc(h.amphoe)}</a>
    <article class="detail">
      ${gallery}
      <div class="detail-head">
        <div class="badges">${UI.statusBadge(h.status)} ${UI.urgencyBadge(h.urgency)} ${h.demo ? '<span class="badge demo">ข้อมูลตัวอย่าง</span>' : ''}</div>
        <div class="card-meta">${esc(h.id)}</div>
        <h1>${esc(h.name)}</h1>
        <p class="addr">📍 ${UI.address(h, true)} จ.${esc(cfg.PROVINCE)}</p>
        <div class="members">
          <span class="chip-vuln">👥 สมาชิก ${h.members ? esc(h.members) + ' คน' : '–'}</span>
          ${UI.vulnChips(h.vulnerable)}
        </div>
      </div>

      <section class="box">
        <h2>สภาพปัญหาและความเดือดร้อน</h2>
        <p>${h.problem ? esc(h.problem) : pending}</p>
        ${h.dimensions.length ? `<div class="tags"><small class="muted">มิติปัญหา (TPMAP):</small> ${UI.dimChips(h.dimensions)}</div>` : ''}
      </section>

      <section class="box">
        <h2>ความต้องการในการขอรับความช่วยเหลือ</h2>
        <div class="tags">${UI.catChips(h.categories)}</div>
        ${h.needs.length ? UI.needList(h.needs) : `<p>${pending}</p>`}
      </section>

      <section class="box">
        <h2>การช่วยเหลือครัวเรือน</h2>
        <p>${h.helpReceived ? esc(h.helpReceived) : 'ยังไม่ได้รับการช่วยเหลือ'}</p>
        ${sponsors.length ? `<p class="thanks">🏅 ขอขอบคุณ ${sponsors.map(s => `<b>${esc(s.name)}</b>`).join(', ')}</p>` : ''}
      </section>

      <section class="box contact">
        <h2>ผู้ประสานงาน</h2>
        <p>${esc(contact) || '–'}</p>
        ${phone ? `<a class="btn btn-outline" target="_top" href="tel:${esc(phone.replace(/[^\d+]/g, ''))}">📞 โทร ${esc(phone)}</a>` : ''}
        <p class="muted small">เพื่อความเป็นส่วนตัวของครัวเรือน กรุณาติดต่อผ่านพัฒนากรผู้ประสานงานทุกครั้ง</p>
      </section>
      <p class="sdg">🎯 สอดคล้องกับเป้าหมายการพัฒนาที่ยั่งยืน SDG 1 ขจัดความยากจน และ SDG 10 ลดความเหลื่อมล้ำ</p>
    </article>

    <div class="cta-bar">
      ${done ? `<a class="btn btn-light" href="#/list?status=${enc('รอการช่วยเหลือ')}">✅ ช่วยเหลือครบแล้ว · ดูครัวเรือนอื่น</a>`
        : `<a class="btn btn-cta" href="#/help/${enc(h.id)}">💛 ฉันอยากช่วย</a>`}
      <button class="btn btn-outline" id="share">แชร์</button>
    </div>`;
    $('#share').addEventListener('click', () => share(h));
  }

  // ---------- แบบฟอร์มแสดงความประสงค์ช่วยเหลือ ----------
  function renderHelp([id], q) {
    let target, title, needs, amphoeCode, back;
    if (id === 'area') {
      amphoeCode = q.get('amphoe');
      const a = amphoeByCode(amphoeCode);
      if (!a) return renderNotFound();
      const tambon = q.get('tambon') || '';
      const hs = householdsOf(amphoeCode).filter(h => (!tambon || h.tambon === tambon) && h.status !== 'ช่วยเหลือแล้ว');
      target = `พื้นที่:${a.name}${tambon ? '/' + tambon : ''}`;
      title = `ช่วยเหลือทั้งพื้นที่ ${tambon ? 'ต.' + tambon + ' ' : ''}อ.${a.name} (${hs.length} ครัวเรือน)`;
      needs = hs.map(h => ({ item: `${h.id} ${h.name}` }));
      back = `#/list?amphoe=${enc(amphoeCode)}${tambon ? '&tambon=' + enc(tambon) : ''}`;
    } else {
      const h = findHousehold(id);
      if (!h) return renderNotFound();
      target = h.id;
      amphoeCode = h.amphoeCode;
      title = `${h.id} · ${h.name} · ต.${h.tambon} อ.${h.amphoe}`;
      needs = h.needs;
      back = `#/h/${enc(h.id)}`;
    }
    const TYPES = ['เงินทุน', 'สิ่งของ/วัสดุ', 'แรงงาน/จิตอาสา', 'จ้างงานสมาชิกครัวเรือน', 'รับซื้อผลผลิต', 'อื่น ๆ'];

    view.innerHTML = `<a class="back" href="${back}">← ย้อนกลับ</a>
    <div class="page-head"><h1>💛 แสดงความประสงค์ช่วยเหลือ</h1>
      <p class="muted">${esc(title)}</p></div>
    <form class="form box" id="pledge" novalidate>
      <label>ชื่อหน่วยงาน / บริษัท / มูลนิธิ <em>*</em>
        <input name="org" required autocomplete="organization" placeholder="เช่น บริษัท ตัวอย่าง จำกัด"></label>
      <label>ชื่อผู้ประสานงาน <em>*</em>
        <input name="contact" required autocomplete="name" value="${esc(liffProfile ? liffProfile.displayName : '')}"></label>
      <div class="two">
        <label>เบอร์โทรศัพท์ <em>*</em>
          <input name="phone" required type="tel" inputmode="tel" autocomplete="tel" pattern="0[0-9\\- ]{8,11}" placeholder="08x-xxx-xxxx"></label>
        <label>อีเมล
          <input name="email" type="email" autocomplete="email"></label>
      </div>
      ${needs.length ? `<fieldset><legend>รายการที่ต้องการช่วย</legend>
        <label class="check all"><input type="checkbox" id="all-items"> เลือกทั้งหมด</label>
        ${needs.map(n => `<label class="check"><input type="checkbox" name="items" value="${esc(n.item)}">
          <span>${esc(n.item)}</span></label>`).join('')}
      </fieldset>` : ''}
      <fieldset><legend>รูปแบบการช่วยเหลือ</legend>
        <div class="chips wrap">${TYPES.map(t => `<label class="chip-check"><input type="checkbox" name="types" value="${esc(t)}"><span>${esc(t)}</span></label>`).join('')}</div>
      </fieldset>
      <label>ข้อความถึงเจ้าหน้าที่
        <textarea name="message" rows="3" placeholder="เช่น ช่วงเวลาที่สะดวกให้ติดต่อ หรือเงื่อนไขของหน่วยงาน"></textarea></label>
      <label class="hp" aria-hidden="true">เว็บไซต์<input name="website" tabindex="-1" autocomplete="off"></label>
      <label class="check consent"><input type="checkbox" name="consent" required>
        <span>ยินยอมให้${esc(cfg.ORG)}และสำนักงานพัฒนาชุมชนอำเภอ ใช้ข้อมูลข้างต้นเพื่อติดต่อประสานการช่วยเหลือ
          และเผยแพร่ชื่อหน่วยงานในทำเนียบผู้สนับสนุน (<a href="#/about" target="_blank">นโยบายข้อมูลส่วนบุคคล</a>)</span></label>
      <p class="form-error" id="form-error" role="alert"></p>
      <button class="btn btn-cta btn-block" type="submit">ส่งความประสงค์ช่วยเหลือ</button>
    </form>`;

    const form = $('#pledge');
    const all = $('#all-items');
    if (all) {
      all.addEventListener('change', () => $$('input[name=items]', form).forEach(c => { c.checked = all.checked; }));
    }
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const err = $('#form-error');
      err.textContent = '';
      if (!form.checkValidity()) {
        const bad = form.querySelector(':invalid');
        err.textContent = bad.name === 'consent' ? 'กรุณาติ๊กยินยอมการใช้ข้อมูลเพื่อการประสานงาน'
          : bad.name === 'phone' ? 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (ขึ้นต้นด้วย 0)'
          : 'กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบ';
        bad.focus();
        return;
      }
      const fd = new FormData(form);
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'กำลังส่ง…';
      try {
        const out = await API.pledge({
          target, amphoeCode,
          org: fd.get('org').trim(), contact: fd.get('contact').trim(), phone: fd.get('phone').trim(),
          email: fd.get('email').trim(), items: fd.getAll('items').join(', '), types: fd.getAll('types').join(', '),
          message: fd.get('message').trim(), website: fd.get('website'),
          lineUserId: liffProfile ? liffProfile.userId : '',
        });
        if (!out.ok) throw new Error(out.error || 'ส่งข้อมูลไม่สำเร็จ');
        renderThanks(amphoeCode, out.mock);
      } catch (ex) {
        err.textContent = ex.message + ' กรุณาลองใหม่ หรือโทรติดต่อสำนักงานพัฒนาชุมชน';
        btn.disabled = false;
        btn.textContent = 'ส่งความประสงค์ช่วยเหลือ';
      }
    });
  }

  function renderThanks(amphoeCode, mock) {
    const a = amphoeByCode(amphoeCode) || {};
    view.innerHTML = `<div class="thanks-page box">
      ${deco('mascot-owl', 'มาสคอตนกฮูก ดูดี ขอบคุณ', 'thanks-mascot')}
      <h1>ขอบคุณที่ร่วมช่วยเหลือ</h1>
      <p>เราได้รับความประสงค์ของท่านแล้ว พัฒนากรผู้ประสานงานจะติดต่อกลับภายใน 3 วันทำการ</p>
      ${mock ? '<p class="notice">🧪 โหมดทดลอง: ยังไม่ได้ส่งข้อมูลจริง</p>' : ''}
      <p><b>${esc(a.coordinator || cfg.ORG)}</b>${a.phone ? `<br>โทร ${esc(a.phone)}` : ''}</p>
      <a class="btn btn-cta" href="#/list?status=${enc('รอการช่วยเหลือ')}">ดูครัวเรือนอื่น</a>
      ${window.liff && window.liff.isInClient && window.liff.isInClient() ? '<button class="btn btn-outline" id="close-liff">กลับไปที่ LINE</button>' : ''}
    </div>`;
    const c = $('#close-liff');
    if (c) c.addEventListener('click', () => window.liff.closeWindow());
  }

  // ---------- E-book ----------
  function renderEbook([code]) {
    if (!code) {
      view.innerHTML = `<div class="page-head"><h1>📖 Catalog E-book</h1>
        <p class="muted">เลือกอำเภอเพื่อเปิดอ่านแบบพลิกหน้า พิมพ์ หรือบันทึกเป็น PDF</p></div>
        <div class="amphoe-grid">${data.amphoes.map(a => {
          const n = householdsOf(a.code).length;
          return `<a class="amphoe-tile${n ? '' : ' empty'}" href="${n ? '#/ebook/' + enc(a.code) : '#/ebook'}" style="--ac:${UI.amphoeColor(a.code)}">
            <b>${esc(a.name)}</b><small>${n ? n + ' ครัวเรือน' : 'ยังไม่มีข้อมูล'}</small></a>`;
        }).join('')}</div>`;
      return;
    }
    const a = amphoeByCode(code);
    const hs = a ? householdsOf(code) : [];
    if (!a || !hs.length) return renderNotFound();
    const pages = Ebook.pages(a, hs);

    view.innerHTML = `<div class="ebook-bar">
      <a class="back" href="#/ebook">← เลือกอำเภอ</a>
      <h1>Catalog อำเภอ${esc(a.name)}</h1>
      <div class="ebook-actions">
        <button class="btn btn-small btn-outline" id="eb-print">🖨️ พิมพ์ / บันทึก PDF</button>
        ${a.ebookPdf ? `<a class="btn btn-small btn-outline" href="${esc(a.ebookPdf)}" target="_blank" rel="noopener">⬇️ ดาวน์โหลด PDF</a>` : ''}
      </div>
    </div>
    <div class="ebook-stage"><div id="book"></div></div>
    <div class="ebook-nav">
      <button class="btn btn-small btn-outline" id="eb-prev" aria-label="หน้าก่อนหน้า">‹ ก่อนหน้า</button>
      <span id="eb-page" aria-live="polite"></span>
      <button class="btn btn-small btn-outline" id="eb-next" aria-label="หน้าถัดไป">ถัดไป ›</button>
    </div>
    <p class="muted small center">ปัดหรือแตะที่มุมหน้าเพื่อพลิก · แตะ QR หรือสแกนเพื่อเปิดหน้าครัวเรือน</p>`;

    const ctl = Ebook.mount($('#book'), pages, (i, n) => { $('#eb-page').textContent = `หน้า ${i + 1} / ${n}`; });
    leaveHooks.push(ctl.destroy);
    $('#eb-prev').addEventListener('click', ctl.prev);
    $('#eb-next').addEventListener('click', ctl.next);
    $('#eb-print').addEventListener('click', () => Ebook.print(pages, `Catalog ครัวเรือนยากจน อำเภอ${a.name}`));
    const onKey = e => {
      if (e.key === 'ArrowRight') ctl.next();
      if (e.key === 'ArrowLeft') ctl.prev();
    };
    document.addEventListener('keydown', onKey);
    leaveHooks.push(() => document.removeEventListener('keydown', onKey));
  }

  // ---------- ทำเนียบผู้สนับสนุน ----------
  function renderSponsors() {
    const sp = data.sponsors.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const helped = new Set(sp.flatMap(s => s.households || [])).size;
    view.innerHTML = `${mockBanner()}
    <div class="page-head"><h1>🏅 ทำเนียบผู้ให้การสนับสนุน</h1>
      <p class="muted">ขอขอบคุณหน่วยงานที่ร่วมเปลี่ยนชีวิตครัวเรือนยากจนในจังหวัด${esc(cfg.PROVINCE)}</p></div>
    <section class="stats three">
      <div class="stat"><b>${sp.length}</b><span>หน่วยงาน</span></div>
      <div class="stat ok"><b>${helped}</b><span>ครัวเรือนที่ได้รับการช่วยเหลือ</span></div>
      <div class="stat"><b>${sp.reduce((s, x) => s + (x.households || []).length, 0)}</b><span>ครั้งที่ส่งมอบความช่วยเหลือ</span></div>
    </section>
    <div class="sponsor-list">${sp.length ? sp.map(s => `<article class="box sponsor">
      <div class="sponsor-head"><h2>${esc(s.name)}</h2>${s.demo ? '<span class="badge demo">ตัวอย่าง</span>' : ''}</div>
      <p class="muted small">${UI.thaiDate(s.date)}</p>
      ${s.items ? `<p>🎁 ${esc(s.items)}</p>` : ''}
      ${s.story ? `<p class="story">“${esc(s.story)}”</p>` : ''}
      ${(s.before || s.after) ? `<div class="before-after">
        ${s.before ? `<figure><img src="${esc(s.before)}" alt="ก่อนช่วยเหลือ" loading="lazy" referrerpolicy="no-referrer"><figcaption>ก่อน</figcaption></figure>` : ''}
        ${s.after ? `<figure><img src="${esc(s.after)}" alt="หลังช่วยเหลือ" loading="lazy" referrerpolicy="no-referrer"><figcaption>หลัง</figcaption></figure>` : ''}
      </div>` : ''}
      <div class="tags">${(s.households || []).map(id => `<a class="chip-dim" href="#/h/${enc(id)}">${esc(id)}</a>`).join('')}</div>
    </article>`).join('') : '<div class="empty-state">ยังไม่มีข้อมูลผู้สนับสนุน — ร่วมเป็นหน่วยงานแรกได้เลย</div>'}</div>`;
  }

  // ---------- ภาพรวมรายอำเภอ ----------
  function renderDashboard() {
    const rows = data.amphoes.map(a => {
      const hs = householdsOf(a.code);
      const s = stats(hs);
      const pct = s.total ? Math.round(s.done / s.total * 100) : 0;
      const by = st => hs.filter(h => h.status === st).length;
      return `<tr>
        <th scope="row"><a href="#/list?amphoe=${enc(a.code)}">${esc(a.name)}</a></th>
        <td>${s.total}</td><td>${by('รอการช่วยเหลือ')}</td><td>${by('มีผู้ประสงค์ช่วย')}</td>
        <td>${by('กำลังดำเนินการ')}</td><td>${s.done}</td>
        <td>${s.needs}</td>
        <td><div class="bar mini"><span style="width:${pct}%"></span></div><small>${pct}%</small></td></tr>`;
    }).join('');
    const s = stats(data.households);
    view.innerHTML = `<div class="page-head"><h1>📊 ภาพรวมรายอำเภอ</h1>
      <p class="muted">ความคืบหน้าการช่วยเหลือครัวเรือนเป้าหมาย 16 อำเภอ</p></div>
    <section class="stats">
      <div class="stat"><b>${s.total}</b><span>ครัวเรือนเป้าหมาย</span></div>
      <div class="stat warn"><b>${s.waiting}</b><span>รอความช่วยเหลือ</span></div>
      <div class="stat ok"><b>${s.done}</b><span>ช่วยเหลือแล้ว</span></div>
      <div class="stat"><b>${s.helping}</b><span>อยู่ระหว่างประสานช่วยเหลือ</span></div>
    </section>
    <div class="table-wrap box"><table class="dash">
      <thead><tr><th>อำเภอ</th><th>ครัวเรือน</th><th>รอช่วย</th><th>มีผู้ประสงค์</th><th>ดำเนินการ</th>
        <th>ช่วยแล้ว</th><th>รายการความต้องการ</th><th>ความคืบหน้า</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  // ---------- วิธีช่วยเหลือ / ข้อมูลส่วนบุคคล ----------
  function renderAbout() {
    view.innerHTML = `<div class="page-head"><h1>ℹ️ วิธีร่วมช่วยเหลือ</h1></div>
    <section class="box project">
      ${deco('logo-1org1csr', 'โครงการ 1 องค์กร 1 CSR', 'project-logo')}
      <div>
        <h2>โครงการ 1 องค์กร 1 CSR</h2>
        <p>ชวนหน่วยงานภาคเอกชนร่วมเป็นพลังแก้ปัญหาความยากจนของครัวเรือนเป้าหมายในจังหวัด${esc(cfg.PROVINCE)}
          ภายใต้แนวคิด <b>“พลังรัฐ พลังเอกชน พลังชุมชน ร่วมแก้จนคนสงขลา”</b> ร่วมกับศูนย์อำนวยการขจัดความยากจนและพัฒนาคนทุกช่วงวัย (ศจพ.)</p>
        ${deco('logo-sjp', 'ศจพ.', 'project-sjp')}
      </div>
    </section>
    <section class="box prose">
      <h2>ขั้นตอนสำหรับหน่วยงานภาคเอกชน</h2>
      <ol>
        <li>เลือกครัวเรือนจากหน้า <a href="#/list">ครัวเรือน</a> หรือเปิด <a href="#/ebook">Catalog E-book</a> รายอำเภอ</li>
        <li>กดปุ่ม <b>“ฉันอยากช่วย”</b> เลือกรายการ แล้วกรอกชื่อหน่วยงานและเบอร์ติดต่อ</li>
        <li>สำนักงานพัฒนาชุมชนอำเภอติดต่อกลับภายใน 3 วันทำการ เพื่อนัดหมายและประสานการส่งมอบ</li>
        <li>หลังส่งมอบ หน่วยงานจะได้รับรายงานผลพร้อมภาพก่อน–หลัง และหนังสือขอบคุณ สำหรับใช้ในรายงาน CSR/ESG</li>
      </ol>
      <p>หน่วยงานที่ต้องการช่วยเหลือทั้งหมู่บ้านหรือตำบล เลือกอำเภอในหน้า “ครัวเรือน” แล้วกด <b>“ช่วยทั้งพื้นที่”</b></p>
    </section>
    <section class="box prose">
      <h2>สิทธิประโยชน์ทางภาษี</h2>
      <p>การบริจาคเงินหรือทรัพย์สินผ่านหน่วยงานของรัฐอาจนำไปหักลดหย่อนหรือหักเป็นรายจ่ายได้ตามประมวลรัษฎากร
        กรุณาตรวจสอบเงื่อนไขล่าสุดกับ <a href="https://www.rd.go.th" target="_blank" rel="noopener">กรมสรรพากร</a> และสอบถามเจ้าหน้าที่เรื่องการออกใบอนุโมทนาบัตร/ใบรับบริจาค</p>
    </section>
    <section class="box prose" id="privacy">
      <h2>นโยบายข้อมูลส่วนบุคคล</h2>
      <ul>
        <li>ข้อมูลครัวเรือนทุกรายเผยแพร่โดย<b>ได้รับความยินยอมเป็นหนังสือจากเจ้าของข้อมูล</b> เพื่อวัตถุประสงค์ประสานความช่วยเหลือเท่านั้น</li>
        <li>เราไม่เผยแพร่เลขประจำตัวประชาชนหรือเบอร์โทรศัพท์ของครัวเรือน กรุณาติดต่อผ่านพัฒนากรผู้ประสานงาน</li>
        <li>ห้ามนำข้อมูลครัวเรือนไปใช้เพื่อการค้า การเมือง หรือวัตถุประสงค์อื่น</li>
        <li>ข้อมูลของหน่วยงานผู้แสดงความประสงค์ใช้เพื่อการติดต่อประสานงาน และแสดงชื่อหน่วยงานในทำเนียบผู้สนับสนุน</li>
        <li>เจ้าของข้อมูลขอถอนความยินยอมหรือแก้ไขข้อมูลได้ที่สำนักงานพัฒนาชุมชนอำเภอ</li>
      </ul>
    </section>
    <section class="box prose">
      <h2>ติดต่อสำนักงานพัฒนาชุมชน</h2>
      <ul class="contacts">${data.amphoes.map(a => `<li><b>อ.${esc(a.name)}</b> <span>${esc(a.coordinator || '')}</span>
        ${a.phone ? `<a target="_top" href="tel:${esc(a.phone.replace(/[^\d+]/g, ''))}">${esc(a.phone)}</a>` : ''}</li>`).join('')}</ul>
      ${cfg.LINE_OA_URL ? `<a class="btn btn-line" href="${esc(cfg.LINE_OA_URL)}" target="_blank" rel="noopener">เพิ่มเพื่อน LINE OA</a>` : ''}
    </section>`;
  }

  function renderNotFound() {
    view.innerHTML = `<div class="empty-state box">${deco('mascot-bird', 'มาสคอตนก CD', 'empty-mascot')}<h1>ไม่พบหน้าที่ต้องการ</h1>
      <p>ข้อมูลอาจถูกปรับปรุงหรือยังไม่ได้เผยแพร่</p><a class="btn btn-cta" href="#/">กลับหน้าแรก</a></div>`;
  }

  // ---------- router ----------
  const routes = {
    '': renderHome, list: renderList, h: renderDetail, help: renderHelp,
    ebook: renderEbook, sponsors: renderSponsors, dashboard: renderDashboard, about: renderAbout,
    staff: (parts, q) => Staff.render(parts, q, view),
  };
  const NAV_OF = { h: 'list', help: 'list', dashboard: 'home', '': 'home' };
  window.App = { toast }; // ให้ staff.js ใช้แจ้งเตือนร่วมกัน

  async function route() {
    leaveHooks.splice(0).forEach(fn => { try { fn(); } catch (e) { /* ignore */ } });
    const { parts, q } = parseHash();
    const name = parts[0] || '';
    const nav = NAV_OF[name] || name;
    $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === nav));
    if (!data) view.innerHTML = '<div class="loading"><span class="spinner"></span>กำลังโหลดข้อมูล…</div>';
    try {
      data = await API.load();
    } catch (err) {
      view.innerHTML = `<div class="empty-state box"><h1>โหลดข้อมูลไม่สำเร็จ</h1><p>${esc(err.message)}</p>
        <button class="btn btn-cta" onclick="location.reload()">ลองใหม่</button></div>`;
      return;
    }
    (routes[name] || renderNotFound)(parts.slice(1), q);
    window.scrollTo(0, 0);
  }

  view.addEventListener('click', async e => {
    if (e.target.id === 'refresh') {
      e.target.disabled = true;
      try {
        data = await API.load(true);
        toast('อัปเดตข้อมูลล่าสุดแล้ว');
        route();
      } catch (err) {
        toast('อัปเดตไม่สำเร็จ: ' + err.message);
        e.target.disabled = false;
      }
    }
  });

  // เปิดหน้าที่ระบุจากลิงก์ ?p= (เว็บที่ Apps Script เสิร์ฟ)
  // ลิงก์รูปแบบ ?p=/h/RN-0001 (QR ที่พิมพ์ไว้จากลิงก์ Apps Script เดิม) ใช้ได้กับหน้าเว็บทุกที่
  let start = cfg.START_ROUTE;
  if (!start) { try { start = new URLSearchParams(location.search).get('p'); } catch (e) { start = ''; } }
  if (start && !location.hash) {
    const clean = String(start).replace(/^#/, '');
    try {
      history.replaceState(null, '', (cfg.GAS ? '' : location.pathname) + '#' + clean);
    } catch (e) { location.hash = clean; }
  }
  window.addEventListener('hashchange', route);
  const liffReady = Promise.race([initLiff(), new Promise(r => setTimeout(r, 4000))]);
  liffReady.then(route);
})();
