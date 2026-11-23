// แบบรายงานผลการช่วยเหลือครัวเรือนเป้าหมาย (หน้าเจ้าหน้าที่) — กรอกผ่านเว็บ อัปโหลดรูป และพิมพ์เป็นหน้า A4
// ผู้ได้รับความช่วยเหลือเลือกจากครัวเรือนใน Catalog เท่านั้น
// เส้นทาง: #/staff/reports · #/staff/report/new?hh=<รหัสครัวเรือน>|from=<รหัสรายงาน> · #/staff/report/edit/<id> · #/staff/report/view/<id>
window.StaffReport = (() => {
  const { esc, enc } = UI;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const DEFAULTS = 'catalog-report-defaults';
  const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

  // ช่องรูป 5 ช่อง (ต้องตรงกับ REPORT_PHOTOS ใน Report.gs)
  const PHOTOS = [
    ['🤝', 'ภาพการช่วยเหลือ 1'], ['🤝', 'ภาพการช่วยเหลือ 2'], ['🤝', 'ภาพการช่วยเหลือ 3'],
    ['🙂', 'ภาพผู้ได้รับความช่วยเหลือ'], ['🏠', 'ภาพที่อยู่อาศัย'],
  ];
  const PHOTO_GROUPS = [
    ['ภาพการช่วยเหลือ (แถวบนของรายงาน)', [0, 1, 2]],
    ['ภาพผู้ได้รับความช่วยเหลือ และที่อยู่อาศัย', [3, 4]],
  ];

  let ctx = null;          // ฟังก์ชันจาก Staff: call, staffBar, bindBar, loadList, current, store, shrink
  let cache = null;        // { code, reports }
  const photoCache = {};   // id -> [dataUrl x5]

  const today = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };

  async function loadReports(force) {
    if (!force && cache && cache.code === ctx.current()) return cache;
    const out = await ctx.call('reports', ctx.current());
    cache = { code: ctx.current(), reports: out.reports };
    return cache;
  }

  async function photosOf(id, force) {
    if (!force && photoCache[id]) return photoCache[id];
    const out = await ctx.call('reportPhotos', id);
    photoCache[id] = out.photos;
    return out.photos;
  }

  async function render(page, parts, q, view, context) {
    ctx = context;
    if (cache && cache.code !== ctx.current()) cache = null;
    if (page === 'reports') return renderList(view, q);
    const mode = parts[1];
    if (mode === 'new') return renderForm(view, null, q);
    if (mode === 'edit') return renderForm(view, parts[2], q);
    if (mode === 'view') return renderView(view, parts[2]);
    location.hash = '#/staff/reports';
  }

  // ---------- รายการรายงาน ----------
  async function renderList(view, q) {
    const [list, { reports }] = await Promise.all([ctx.loadList(), loadReports()]);
    const sponsors = [...new Set(reports.map(r => r.sponsor).filter(Boolean))];
    const st = { s: sponsors.includes(q.get('s')) ? q.get('s') : '', q: q.get('q') || '' };
    view.innerHTML = `${ctx.staffBar('อ.' + list.amphoe.name)}
      <div class="page-head"><h1>📝 รายงานผลการช่วยเหลือ</h1>
        <p class="muted">แบบรายงานผลการช่วยเหลือครัวเรือนเป้าหมาย 1 รายงานต่อ 1 หน้า A4 · พิมพ์หรือบันทึกเป็น PDF ได้</p></div>
      <div class="rp-tools">
        ${sponsors.length > 1 ? `<select id="rp-sponsor" aria-label="ผู้ให้การช่วยเหลือ"><option value="">ทุกผู้ให้การช่วยเหลือ</option>
          ${sponsors.map(s => `<option${s === st.s ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>` : ''}
        <input type="search" id="rp-q" class="staff-search" placeholder="🔍 ค้นหาชื่อ รหัส ผู้ให้การช่วยเหลือ" value="${esc(st.q)}">
        <button class="btn btn-small btn-outline" id="rp-print-all">🖨️ พิมพ์ทั้งหมด</button>
      </div>
      <div id="rp-items" class="staff-list"></div>
      <a class="fab" href="#/staff/report/new">＋ รายงานใหม่</a>`;
    ctx.bindBar(view, () => { cache = null; renderList(view, new URLSearchParams()); });

    const filtered = () => {
      const ql = st.q.trim().toLowerCase();
      return reports.filter(r => !st.s || r.sponsor === st.s)
        .filter(r => !ql || [r.id, r.hhId, r.name, r.occupation, r.sponsor].join(' ').toLowerCase().includes(ql));
    };
    const draw = () => {
      history.replaceState(null, '', '#/staff/reports?' + new URLSearchParams(st));
      const rows = filtered();
      $('#rp-print-all', view).textContent = `🖨️ พิมพ์ทั้งหมด (${rows.length})`;
      $('#rp-print-all', view).disabled = !rows.length;
      $('#rp-items', view).innerHTML = rows.length ? rows.map(r => `<a class="staff-item" href="#/staff/report/view/${enc(r.id)}">
          <div class="si-main"><b>${esc(r.name)}</b><small>${esc(r.id)} · ครั้งที่ ${esc(r.round)} · ${UI.thaiDate(r.reportDate)}</small></div>
          <div class="si-tags">${r.hhId ? `<span class="badge st-pledged">🏠 ${esc(r.hhId)}</span>` : ''}
            ${r.sponsor ? `<span class="badge st-wait">🤝 ${esc(r.sponsor)}</span>` : ''}</div></a>`).join('')
        : `<div class="empty-state box">${reports.length ? 'ไม่พบรายงานที่ค้นหา' : 'ยังไม่มีรายงาน — กด “＋ รายงานใหม่” เพื่อเริ่มกรอก'}</div>`;
    };
    draw();
    const sel = $('#rp-sponsor', view);
    if (sel) sel.addEventListener('change', () => { st.s = sel.value; draw(); });
    let typing;
    $('#rp-q', view).addEventListener('input', e => {
      clearTimeout(typing);
      typing = setTimeout(() => { st.q = e.target.value; draw(); }, 200);
    });
    $('#rp-print-all', view).addEventListener('click', e => printMany(filtered(), e.currentTarget));
  }

  async function printMany(reports, btn) {
    if (reports.length > 40 && !(await UI.ask(`พิมพ์ ${reports.length} รายงาน อาจใช้เวลาโหลดรูปนาน ต้องการทำต่อหรือไม่?`, 'พิมพ์ต่อ'))) return;
    const label = btn.textContent;
    btn.disabled = true;
    try {
      const pages = [];
      for (let i = 0; i < reports.length; i++) {
        btn.textContent = `กำลังเตรียม ${i + 1}/${reports.length}…`;
        pages.push(fittedHtml(reports[i], await photosOf(reports[i].id)));
      }
      Ebook.print(pages, `รายงานผลการช่วยเหลือ อ.${reports[0].amphoe}`);
    } catch (ex) {
      App.toast(ex.message);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  // ---------- หน้ารายงาน A4 (ตามแบบรายงานเดิมของสำนักงาน) ----------
  const FRAME = `<svg class="rp-frame" viewBox="0 0 210 297" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 0H64C46 4 26 12 12 26 8 30 4 33 0 35Z" fill="#1D3F94"/>
    <path d="M64 0h16C58 5 34 15 18 30 12 35 6 38 0 40v-5c4-2 8-5 12-9C26 12 46 4 64 0Z" fill="#C9A43B"/>
    <path d="M210 297H132c30-4 56-12 78-24Z" fill="#1D3F94"/>
    <path d="M60 297h24c46-4 90-14 126-32v5c-36 16-78 25-122 27Z" fill="#C9A43B"/>
    <rect x="3" y="3" width="204" height="291" fill="none" stroke="#1D3F94" stroke-width="1.2"/></svg>`;

  function photo(src, i, caption) {
    const img = src && src !== 'has-photo' ? `<img src="${esc(src)}" alt="">`
      : `<span class="rp-ph">${PHOTOS[i][0]}<small>${esc(PHOTOS[i][1])}</small></span>`;
    return `<figure class="rp-photo rp-p${i}">${img}${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
  }

  const item = (no, label, value, unit) => `<p class="rp-item"><span>${no}. ${label}</span>
    <b>${value === '' || value == null ? '-' : esc(value)}</b>${unit && value !== '' && value != null ? ` ${unit}` : ''}</p>`;

  function pageHtml(r, photos) {
    photos = photos || [];
    const top = [0, 1, 2].filter(i => photos[i]);
    const topSlots = top.length >= 2 ? top : [0, 1, 2];
    const logo = path => `<img src="${UI.asset(path)}" alt="">`;
    return `<div class="pg rp">${FRAME}
      <header class="rp-head">${logo('img/logo-cdd.png')}
        <div><b>แบบรายงานผลการช่วยเหลือครัวเรือนเป้าหมาย</b>
          ${r.project ? `<span>${esc(r.project).replace(/\n/g, '<br>')}</span>` : ''}
          ${r.sponsor ? `<span>ระหว่าง กรมการพัฒนาชุมชน กับ ${esc(r.sponsor)}</span>` : ''}</div>
        ${logo('img/seal-songkhla.png')}</header>
      <div class="rp-place"><b>จังหวัดสงขลา อำเภอ${esc(r.amphoe)}</b>
        <span>ครั้งที่ ${esc(r.round || 1)} · ${UI.thaiDate(r.reportDate)}</span></div>
      <div class="rp-row rp-top n${topSlots.length}">${topSlots.map(i => photo(photos[i], i, 'ภาพการช่วยเหลือ')).join('')}</div>
      <div class="rp-mid">
        <div class="rp-col">
          ${photo(photos[3], 3, 'ภาพของผู้ที่ได้รับความช่วยเหลือ')}
          <div class="rp-box"><p class="rp-item"><span>6. รายละเอียดการช่วยเหลือ</span></p>
            <p class="rp-text">${esc(r.helpDetail || '-').replace(/\n/g, '<br>')}</p></div>
        </div>
        <div class="rp-col">
          <div class="rp-box">${item(1, 'ชื่อ - นามสกุล', r.name)}${item(2, 'อายุ', r.age, 'ปี')}
            ${item(3, 'จำนวนสมาชิกในครัวเรือน', r.members, 'คน')}${item(4, 'ประกอบอาชีพ', r.occupation)}
            ${item(5, 'สถานที่ประกอบอาชีพ', r.workplace)}</div>
          ${photo(photos[4], 4, 'ภาพที่อยู่อาศัยของผู้ได้รับความช่วยเหลือ')}
        </div>
      </div>
      <div class="rp-row rp-end">
        <div class="rp-box"><p class="rp-item"><span>7. ความเปลี่ยนแปลงด้านคุณภาพชีวิต</span></p>
          <p class="rp-text">${esc(r.change || '-').replace(/\n/g, '<br>')}</p></div>
        <div class="rp-box"><p class="rp-item"><span>8. ปัญหา/อุปสรรค</span></p>
          <p class="rp-text">${esc(r.problems || '-').replace(/\n/g, '<br>')}</p></div>
      </div>
      <footer class="rp-foot">${r.reporter ? `ผู้รายงาน: ${esc(r.reporter)}${r.reporterPhone ? ' โทร ' + esc(r.reporterPhone) : ''}` : ''}
        <span>${esc(r.id || '')}</span></footer>
    </div>`;
  }

  // ข้อความยาวเกินกรอบ: ลดขนาดตัวอักษรในกรอบนั้นทีละน้อยจนพอดี (หน่วย cqw จึงได้ผลเท่ากันทั้งบนจอและตอนพิมพ์)
  function fit(root) {
    root.querySelectorAll('.rp-box, .rp-head div').forEach(box => {
      let size = parseFloat(getComputedStyle(box).fontSize) / (root.querySelector('.rp').clientWidth / 100);
      for (let i = 0; i < 12 && box.scrollHeight > box.clientHeight + 1 && size > 1.45; i++) {
        size -= 0.1;
        box.style.fontSize = size.toFixed(2) + 'cqw';
      }
    });
  }

  // สร้างหน้าในกรอบที่มองไม่เห็นเพื่อปรับขนาดตัวอักษร แล้วคืน HTML สำหรับพิมพ์
  function fittedHtml(r, photos) {
    const box = document.createElement('div');
    box.className = 'page rp-preview';
    box.style.cssText = 'position:fixed;left:-10000px;top:0;width:760px;';
    box.innerHTML = pageHtml(r, photos);
    document.body.appendChild(box);
    fit(box);
    const html = box.innerHTML;
    box.remove();
    return html;
  }

  async function renderView(view, id) {
    const [list, { reports }] = await Promise.all([ctx.loadList(), loadReports()]);
    const r = reports.find(x => x.id === id);
    if (!r) throw new Error('ไม่พบรายงาน ' + id);
    view.innerHTML = `${ctx.staffBar('อ.' + list.amphoe.name)}
      <a class="back" href="#/staff/reports">← รายการรายงาน</a>
      <div class="rp-actions">
        <a class="btn btn-small btn-outline" href="#/staff/report/edit/${enc(r.id)}">✏️ แก้ไข</a>
        <button class="btn btn-small btn-cta" id="rp-print">🖨️ พิมพ์ / บันทึก PDF</button>
        <a class="btn btn-small btn-outline" href="#/staff/report/new?from=${enc(r.id)}">＋ รายงานครั้งถัดไป</a>
        <button class="btn btn-small btn-light" id="rp-del">🗑️ ลบ</button>
      </div>
      <div class="rp-preview page"><div class="loading"><span class="spinner"></span>กำลังโหลดรูป…</div></div>`;
    ctx.bindBar(view, () => { location.hash = '#/staff/reports'; });
    const preview = $('.rp-preview', view);
    let photos = [];
    preview.innerHTML = pageHtml(r, photos);
    fit(preview);
    try {
      photos = await photosOf(r.id);
      preview.innerHTML = pageHtml(r, photos);
      fit(preview);
    } catch (ex) {
      App.toast('โหลดรูปไม่สำเร็จ: ' + ex.message);
    }
    $('#rp-print', view).addEventListener('click', () => Ebook.print([fittedHtml(r, photos)], `รายงานผล ${r.name} ครั้งที่ ${r.round}`));
    $('#rp-del', view).addEventListener('click', async e => {
      const btn = e.currentTarget;
      if (!(await UI.ask(`ลบรายงานของ ${r.name} (ครั้งที่ ${r.round})?\nรูปของรายงานจะถูกย้ายไปถังขยะ Google Drive`, '🗑️ ลบรายงาน', true))) return;
      btn.disabled = true;
      btn.textContent = 'กำลังลบ…';
      try {
        await ctx.call('reportDelete', r.id);
        cache.reports = cache.reports.filter(x => x.id !== r.id);
        delete photoCache[r.id];
        App.toast('ลบรายงานแล้ว');
        location.hash = '#/staff/reports';
      } catch (ex) {
        App.toast(ex.message);
        btn.disabled = false;
        btn.textContent = '🗑️ ลบ';
      }
    });
  }

  // ---------- กรอก/แก้ไขรายงาน ----------
  async function renderForm(view, id, q) {
    const [list, { reports }] = await Promise.all([ctx.loadList(), loadReports()]);
    const isNew = !id;
    const def = ctx.store.get(DEFAULTS) || {};
    let r;
    if (!isNew) {
      r = reports.find(x => x.id === id);
      if (!r) throw new Error('ไม่พบรายงาน ' + id);
    } else {
      const from = reports.find(x => x.id === q.get('from'));
      const base = { sponsor: def.sponsor || '', project: def.project || '',
        reporter: def.reporter || '', reporterPhone: def.reporterPhone || '' };
      r = Object.assign({ hhId: '', round: 1, name: '', age: '', members: '', occupation: '', workplace: '', helpDetail: '',
        change: '', problems: '' }, base);
      if (from) { // รายงานครั้งถัดไป: ยกข้อมูลเดิมมา เปลี่ยนเฉพาะผลลัพธ์และรูป
        const keep = ['hhId', 'sponsor', 'project', 'name', 'age', 'members', 'occupation', 'workplace', 'helpDetail'];
        keep.forEach(k => { r[k] = from[k]; });
        const rounds = reports.filter(x => (from.hhId ? x.hhId === from.hhId : x.name === from.name) && x.sponsor === from.sponsor).map(x => Number(x.round) || 1);
        r.round = Math.max(...rounds, 1) + 1;
      }
      const hh = list.households.find(h => h.id === (q.get('hh') || r.hhId));
      if (hh && !from) Object.assign(r, { hhId: hh.id, name: hh.name, members: hh.members || '' });
      r.reportDate = today();
    }
    const sponsors = [...new Set(reports.map(x => x.sponsor).concat(def.sponsor || []).filter(Boolean))];
    const projects = [...new Set(reports.map(x => x.project).filter(Boolean))];
    const occupations = [...new Set(reports.map(x => x.occupation).filter(Boolean))];
    const households = list.households.slice().sort((a, b) => a.name.localeCompare(b.name, 'th'));
    const opts = arr => arr.map(v => `<option value="${esc(v)}">`).join('');

    view.innerHTML = `${ctx.staffBar('อ.' + list.amphoe.name)}
    <a class="back" href="${isNew ? '#/staff/reports' : '#/staff/report/view/' + enc(r.id)}">← ${isNew ? 'รายการรายงาน' : 'ดูรายงาน'}</a>
    <div class="page-head"><h1>${isNew ? '📝 รายงานผลใหม่' : '✏️ แก้ไขรายงาน ' + esc(r.id)}</h1>
      <p class="muted">กรอกเท่าที่มีข้อมูล ช่องที่ไม่มีให้เว้นว่าง (ในรายงานจะแสดง “-”)</p></div>
    <form class="form staff-form" id="rp-form" novalidate>
      <section class="box"><h2>ข้อมูลโครงการ</h2>
        <label>ผู้ให้การช่วยเหลือ (หน่วยงาน/มูลนิธิ/บริษัท)<input name="sponsor" list="rp-sponsors" value="${esc(r.sponsor)}" placeholder="เช่น มูลนิธิป่อเต็กตึ๊ง">
          <datalist id="rp-sponsors">${opts(sponsors)}</datalist></label>
        <label>โครงการ/บันทึกข้อตกลง (หัวรายงาน)<textarea name="project" rows="2"
          placeholder="เช่น ภายใต้บันทึกข้อตกลงความร่วมมือในการแก้ไขปัญหาความยากจนเชิงบูรณาการ">${esc(r.project)}</textarea></label>
        ${projects.some(p => p !== r.project) ? `<div class="chips wrap rp-suggest">${projects.filter(p => p !== r.project).slice(0, 3).map(p => `<button type="button" class="chip" data-fill="project" data-value="${esc(p)}">↺ ${esc(p.length > 40 ? p.slice(0, 40) + '…' : p)}</button>`).join('')}</div>` : ''}
        <div class="two">
          <label>ครั้งที่รายงาน<input name="round" type="number" inputmode="numeric" min="1" max="99" value="${esc(r.round)}"></label>
          <label>วันที่ติดตาม<input name="reportDate" type="date" value="${esc(r.reportDate)}"></label>
        </div>
      </section>

      <section class="box"><h2>ผู้ได้รับความช่วยเหลือ</h2>
        ${households.length ? '' : `<p class="notice">ยังไม่มีครัวเรือนของอำเภอนี้ใน Catalog —
          <a href="#/staff/new">＋ เพิ่มครัวเรือน</a> ก่อน แล้วจึงเขียนรายงานได้</p>`}
        <label>1. ชื่อ-นามสกุล (เลือกจากครัวเรือนใน Catalog) <em>*</em>
          <select name="hhId" required><option value="">— เลือกผู้ได้รับความช่วยเหลือ —</option>
            ${households.map(h => `<option value="${esc(h.id)}"${h.id === r.hhId ? ' selected' : ''}>${esc(h.name)} (${esc(h.id)} · ${UI.address(h)})</option>`).join('')}
            ${r.hhId && !households.some(h => h.id === r.hhId) ? `<option value="${esc(r.hhId)}" selected>${esc(r.name)} (${esc(r.hhId)})</option>` : ''}
          </select></label>
        <div class="two">
          <label>2. อายุ (ปี)<input name="age" type="number" inputmode="numeric" min="0" max="120" value="${esc(r.age)}"></label>
          <label>3. จำนวนสมาชิกในครัวเรือน (คน)<input name="members" type="number" inputmode="numeric" min="0" max="50" value="${esc(r.members)}"></label>
        </div>
        <label>4. ประกอบอาชีพ (ประเภท)<input name="occupation" list="rp-occ" value="${esc(r.occupation)}" placeholder="เช่น ค้าขาย รับจ้างเย็บผ้า">
          <datalist id="rp-occ">${opts(occupations.concat(['ค้าขาย', 'รับจ้าง', 'เกษตรกรรม', 'เลี้ยงสัตว์', 'แปรรูปอาหาร']))}</datalist></label>
        <label>5. สถานที่ประกอบอาชีพ<textarea name="workplace" rows="2" placeholder="เช่น ทำขนมส่งขายตามตลาดอำเภอระโนด">${esc(r.workplace)}</textarea></label>
        <button type="button" class="btn btn-small btn-light" id="rp-use-addr" hidden>📍 ใช้ที่อยู่บ้านจาก Catalog</button>
      </section>

      <section class="box"><h2>รายละเอียดการช่วยเหลือ</h2>
        <label>6. รายละเอียดการช่วยเหลือ<textarea name="helpDetail" rows="5"
          placeholder="เล่าว่าได้รับความช่วยเหลืออะไร จากใคร เมื่อไร เช่น ได้รับอุปกรณ์ทำขนม (เตาแก๊ส หม้อนึ่ง ถาดอบ) จากมูลนิธิ… ส่งมอบเมื่อ…">${esc(r.helpDetail)}</textarea></label>
      </section>

      <section class="box"><h2>ผลลัพธ์</h2>
        <label>7. ความเปลี่ยนแปลงด้านคุณภาพชีวิต<textarea name="change" rows="3"
          placeholder="เช่น ครอบครัวมีรายได้มากขึ้น มีที่อยู่อาศัยปลอดภัยขึ้น">${esc(r.change)}</textarea></label>
        <label>8. ปัญหา/อุปสรรค<textarea name="problems" rows="2" placeholder="ไม่มี ให้เว้นว่าง">${esc(r.problems)}</textarea></label>
      </section>

      <section class="box"><h2>รูปภาพ</h2>
        <p class="muted small">แตะช่องเพื่อถ่ายรูปหรือเลือกจากอัลบั้ม ระบบย่อรูปให้อัตโนมัติ${isNew ? ' · รูปจะอัปโหลดเมื่อกดบันทึก' : ''}</p>
        ${PHOTO_GROUPS.map(([title, slots]) => `<p class="field-label">${title}</p>
          <div class="photo-slots rp-slots n${slots.length}">${slots.map(i => `<label class="photo-slot" data-slot="${i}">
            <input type="file" accept="${ACCEPT}" hidden>
            <span class="ps-img"><span class="ps-empty">${PHOTOS[i][0]}<small>แตะเพื่อเพิ่มรูป</small></span></span>
            <span class="ps-label">${esc(PHOTOS[i][1].replace(/^ภาพ/, ''))}</span><span class="ps-state"></span>
            <button type="button" class="ps-del" hidden aria-label="ลบรูป">✕ ลบรูป</button></label>`).join('')}</div>`).join('')}
      </section>

      <section class="box"><h2>ผู้รายงาน</h2>
        <div class="two">
          <label>ชื่อผู้รายงาน<input name="reporter" value="${esc(r.reporter)}"></label>
          <label>เบอร์โทร<input name="reporterPhone" type="tel" inputmode="tel" value="${esc(r.reporterPhone)}"></label>
        </div>
      </section>

      <div class="save-bar">
        <p class="form-error" role="alert"></p>
        <a class="btn btn-outline" href="${isNew ? '#/staff/reports' : '#/staff/report/view/' + enc(r.id)}" id="rp-cancel">ยกเลิก</a>
        <button class="btn btn-cta" type="submit">💾 บันทึกรายงาน</button>
      </div>
    </form>`;
    ctx.bindBar(view, () => { location.hash = '#/staff/reports'; });

    const form = $('#rp-form', view);
    let dirty = false;
    form.addEventListener('input', () => { dirty = true; });
    $('#rp-cancel', view).addEventListener('click', async e => {
      if (!dirty) return;
      e.preventDefault();
      const href = e.currentTarget.getAttribute('href');
      if (await UI.ask('ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?', 'ออกโดยไม่บันทึก', true)) location.hash = href;
    });

    // เลือกครัวเรือนจาก Catalog → เติมชื่อและจำนวนสมาชิก
    const addrBtn = $('#rp-use-addr', form);
    const selectedHh = () => list.households.find(h => h.id === form.hhId.value);
    const syncAddr = () => { addrBtn.hidden = !selectedHh(); };
    form.hhId.addEventListener('change', () => {
      const h = selectedHh();
      if (h && h.members) form.members.value = h.members;
      syncAddr();
    });
    addrBtn.addEventListener('click', () => {
      const h = selectedHh();
      if (h) {
        form.workplace.value = [h.houseNo, h.moo && 'ม.' + h.moo, h.tambon && 'ต.' + h.tambon, 'อ.' + list.amphoe.name, 'จ.สงขลา']
          .filter(Boolean).join(' ');
        dirty = true;
      }
    });
    syncAddr();

    $$('[data-fill]', form).forEach(b => b.addEventListener('click', () => {
      form[b.dataset.fill].value = b.dataset.value;
      dirty = true;
    }));

    const pending = {}; // รูปที่เลือกไว้ก่อนบันทึกรายงานใหม่: slot -> dataUrl
    bindPhotos(view, isNew ? null : r.id, pending);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const err = $('.save-bar .form-error', view);
      err.textContent = '';
      const val = n => form[n].value.trim();
      const data = {
        id: r.id, amphoeCode: ctx.current(), hhId: form.hhId.value, round: val('round'), reportDate: val('reportDate'),
        sponsor: val('sponsor'), project: val('project'), age: val('age'),
        members: val('members'), occupation: val('occupation'), workplace: val('workplace'), helpDetail: val('helpDetail'),
        change: val('change'), problems: val('problems'), reporter: val('reporter'), reporterPhone: val('reporterPhone'),
      };
      if (!data.hhId) { err.textContent = 'กรุณาเลือกผู้ได้รับความช่วยเหลือจากรายการครัวเรือนใน Catalog'; form.hhId.focus(); return; }
      const btn = $('button[type=submit]', form);
      btn.disabled = true;
      btn.textContent = 'กำลังบันทึก…';
      try {
        const out = await ctx.call('reportSave', data);
        const saved = out.report;
        ctx.store.set(DEFAULTS, { sponsor: data.sponsor, project: data.project,
          reporter: data.reporter, reporterPhone: data.reporterPhone });
        const i = cache.reports.findIndex(x => x.id === saved.id);
        if (i >= 0) cache.reports[i] = saved; else cache.reports.unshift(saved);
        const slots = Object.keys(pending);
        for (let k = 0; k < slots.length; k++) {
          btn.textContent = `กำลังอัปโหลดรูป ${k + 1}/${slots.length}…`;
          await ctx.call('reportUploadPhoto', saved.id, Number(slots[k]), pending[slots[k]]);
        }
        if (slots.length || photoCache[saved.id]) delete photoCache[saved.id];
        dirty = false;
        App.toast('บันทึกรายงานแล้ว ✅');
        location.hash = '#/staff/report/view/' + enc(saved.id);
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false;
        btn.textContent = '💾 บันทึกรายงาน';
      }
    });
  }

  function showPhoto(el, src) {
    const i = Number(el.dataset.slot);
    $('.ps-img', el).innerHTML = src ? `<img src="${esc(src)}" alt="">`
      : `<span class="ps-empty">${PHOTOS[i][0]}<small>แตะเพื่อเพิ่มรูป</small></span>`;
    $('.ps-del', el).hidden = !src;
  }

  async function bindPhotos(view, id, pending) {
    const slots = $$('.photo-slot', view);
    slots.forEach(el => {
      const i = Number(el.dataset.slot);
      const state = $('.ps-state', el);
      $('input', el).addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          state.textContent = 'กำลังย่อรูป…';
          const dataUrl = await ctx.shrink(file, 1280, 0.8);
          showPhoto(el, dataUrl);
          if (!id) { pending[i] = dataUrl; state.textContent = 'รออัปโหลดเมื่อบันทึก'; return; }
          el.classList.add('uploading');
          state.textContent = 'กำลังอัปโหลด…';
          await ctx.call('reportUploadPhoto', id, i, dataUrl);
          if (photoCache[id]) photoCache[id][i] = dataUrl;
          state.textContent = '✅ บันทึกรูปแล้ว';
        } catch (ex) {
          state.textContent = '❌ ' + ex.message;
        } finally {
          el.classList.remove('uploading');
          e.target.value = '';
        }
      });
      $('.ps-del', el).addEventListener('click', async e => {
        e.preventDefault();
        e.stopPropagation();
        if (!id) { delete pending[i]; showPhoto(el, ''); state.textContent = ''; return; }
        if (!(await UI.ask('ลบรูป ' + PHOTOS[i][1] + '?', 'ลบรูป', true))) return;
        try {
          state.textContent = 'กำลังลบ…';
          await ctx.call('reportUploadPhoto', id, i, '');
          if (photoCache[id]) photoCache[id][i] = '';
          showPhoto(el, '');
          state.textContent = 'ลบรูปแล้ว';
        } catch (ex) {
          state.textContent = '❌ ' + ex.message;
        }
      });
    });
    if (!id) return;
    slots.forEach(el => { $('.ps-state', el).textContent = 'กำลังโหลด…'; });
    try {
      const photos = await photosOf(id);
      slots.forEach(el => { showPhoto(el, photos[el.dataset.slot]); $('.ps-state', el).textContent = ''; });
    } catch (ex) {
      slots.forEach(el => { $('.ps-state', el).textContent = ''; });
    }
  }

  return { render, pageHtml };
})();
