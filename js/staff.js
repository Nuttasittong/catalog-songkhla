// หน้าเจ้าหน้าที่: เข้าระบบด้วยรหัสอำเภอ → รายการครัวเรือน → เพิ่ม/แก้ไข + ถ่ายรูป → ผู้แสดงความประสงค์ช่วยเหลือ
// ใช้ได้เฉพาะเว็บที่เปิดจาก Apps Script (API.staff เรียก Staff.gs) — ในเครื่องใช้ข้อมูลจำลอง
window.Staff = (() => {
  const { esc, enc } = UI;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const KEY = 'catalog-staff-v1';
  const LAST_AMPHOE = 'catalog-staff-amphoe';
  const OFFICER = 'catalog-staff-officer';
  const STATUSES = UI.STATUS_ORDER;

  // เบราว์เซอร์บางตัวบล็อกที่เก็บข้อมูลในกรอบหน้าเว็บของ Apps Script — แม้แต่การอ้างถึง sessionStorage ก็ error ได้
  // จึงเข้าถึงผ่านฟังก์ชันใน try เสมอ และถ้าใช้ไม่ได้ จะจำ session ไว้ในหน่วยความจำแทน
  const area = session => { try { return session ? window.sessionStorage : window.localStorage; } catch (e) { return null; } };
  const store = {
    get(k, s) { try { return JSON.parse(area(s).getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v, s) { try { v == null ? area(s).removeItem(k) : area(s).setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  // จำการเข้าระบบไว้ในเครื่อง (ปิดแอป LINE/เบราว์เซอร์แล้วเปิดใหม่ไม่ต้องเข้าระบบซ้ำ) — เซิร์ฟเวอร์ตัดสิทธิ์เองเมื่อไม่ใช้งาน 6 ชั่วโมง
  let session = store.get(KEY) || store.get(KEY, true);
  let listCache = null; // { code, households, tambons }

  function setSession(s) {
    session = s;
    listCache = null;
    store.set(KEY, s);
    store.set(KEY, null, true);
  }

  // เรียก API: ถ้า session หมดอายุ พากลับหน้าเข้าระบบ
  async function call(fn, ...args) {
    try {
      const out = await API.staff[fn](session && session.token, ...args);
      if (out && out.ok === false) throw new Error(out.error || 'ทำรายการไม่สำเร็จ');
      return out;
    } catch (err) {
      if (/หมดเวลา|เข้าสู่ระบบ/.test(err.message)) {
        setSession(null);
        App.toast('กรุณาเข้าสู่ระบบใหม่');
        location.hash = '#/staff';
      }
      throw err;
    }
  }

  const current = () => session && (session.current || session.amphoes[0].code);

  async function loadList(force) {
    if (!force && listCache && listCache.code === current()) return listCache;
    const out = await call('list', current());
    listCache = { code: current(), amphoe: out.amphoe, households: out.households, tambons: out.tambons };
    return listCache;
  }

  async function render(parts, q, view) {
    if (!session) return renderLogin(view);
    const page = parts[0] || '';
    view.innerHTML = '<div class="loading"><span class="spinner"></span>กำลังโหลด…</div>';
    try {
      if (page === 'new') return await renderEdit(view, null);
      if (page === 'edit') return await renderEdit(view, parts[1]);
      if (page === 'pledges') return await renderPledges(view);
      if (page === 'reports' || page === 'report') return await StaffReport.render(page, parts, q, view, reportCtx);
      return await renderList(view, q);
    } catch (err) {
      if (session) view.innerHTML = `<div class="empty-state box"><h1>โหลดข้อมูลไม่สำเร็จ</h1><p>${esc(err.message)}</p>
        <a class="btn btn-cta" href="#/staff">ลองใหม่</a></div>`;
    }
  }

  // ---------- เข้าระบบ ----------
  async function renderLogin(view) {
    const d = await API.load();
    const last = store.get(LAST_AMPHOE) || '';
    view.innerHTML = `<div class="staff-login box">
      <div class="big-icon" aria-hidden="true">🔐</div>
      <h1>สำหรับเจ้าหน้าที่</h1>
      <p class="muted">บันทึกและแก้ไขข้อมูลครัวเรือน ถ่ายรูป และติดตามผู้แสดงความประสงค์ช่วยเหลือ</p>
      <form class="form" id="staff-login" novalidate>
        <label>อำเภอ
          <select name="code" required>
            ${d.amphoes.map(a => `<option value="${esc(a.code)}"${a.code === last ? ' selected' : ''}>อ.${esc(a.name)}</option>`).join('')}
            <option value="ALL"${last === 'ALL' ? ' selected' : ''}>ระดับจังหวัด (ทุกอำเภอ)</option>
          </select></label>
        <label>รหัสเจ้าหน้าที่ (6 หลัก)
          <input name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="6" required></label>
        <p class="form-error" role="alert"></p>
        <button class="btn btn-cta btn-block" type="submit">เข้าสู่ระบบ</button>
      </form>
      <p class="muted small">ขอรหัสได้จากผู้ดูแลระบบระดับจังหวัด · เข้าใช้ได้ครั้งละ 6 ชั่วโมง</p>
    </div>`;
    const form = $('#staff-login');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const err = $('.form-error', form);
      const btn = $('button', form);
      const code = form.code.value;
      const pin = form.pin.value.trim();
      if (!/^\d{6}$/.test(pin)) { err.textContent = 'กรุณาใส่รหัส 6 หลัก'; return; }
      btn.disabled = true;
      btn.textContent = 'กำลังตรวจสอบ…';
      try {
        const out = await API.staff.login(code, pin);
        if (!out.ok) throw new Error(out.error);
        store.set(LAST_AMPHOE, code);
        setSession({ token: out.token, code: out.code, amphoes: out.amphoes, current: out.amphoes[0].code });
        location.hash = '#/staff/list';
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false;
        btn.textContent = 'เข้าสู่ระบบ';
      }
    });
  }

  function staffBar(title) {
    const multi = session.amphoes.length > 1;
    return `<div class="staff-bar">
      <div class="staff-who">🧑‍💼 <b>${esc(title)}</b>
        ${multi ? `<select id="staff-amphoe" aria-label="เลือกอำเภอ">${session.amphoes.map(a =>
          `<option value="${esc(a.code)}"${a.code === current() ? ' selected' : ''}>อ.${esc(a.name)}</option>`).join('')}</select>` : ''}
      </div>
      <div class="staff-actions">
        <a class="btn btn-small btn-outline" href="#/staff/list">📋 ครัวเรือน</a>
        <a class="btn btn-small btn-outline" href="#/staff/reports">📝 รายงานผล</a>
        <a class="btn btn-small btn-outline" href="#/staff/pledges">📨 ผู้ประสงค์ช่วยเหลือ</a>
        <button class="btn btn-small btn-light" id="staff-logout">ออกจากระบบ</button>
      </div>
    </div>`;
  }

  function bindBar(view, rerender) {
    $('#staff-logout', view).addEventListener('click', async () => {
      try { await API.staff.logout(session.token); } catch (e) { /* ignore */ }
      setSession(null);
      location.hash = '#/staff';
    });
    const sel = $('#staff-amphoe', view);
    if (sel) {
      sel.addEventListener('change', () => {
        setSession(Object.assign({}, session, { current: sel.value }));
        rerender();
      });
    }
  }

  // ---------- รายการครัวเรือน ----------
  const FILTERS = {
    all: ['ทั้งหมด', () => true],
    missing: ['ข้อมูลไม่ครบ', h => h.missing.length],
    consent: ['รอหนังสือยินยอม', h => !h.consent],
    approve: ['รออนุมัติเผยแพร่', h => h.consent && !h.approved],
    live: ['เผยแพร่แล้ว', h => h.approved],
  };

  function tags(h) {
    const out = [];
    if (h.missing.length) out.push(`<span class="badge st-wait">⚠ ขาด: ${esc(h.missing.join(', '))}</span>`);
    if (!h.consent) out.push('<span class="badge urg-2">📝 รอหนังสือยินยอม</span>');
    else if (!h.approved) out.push('<span class="badge st-pledged">⏳ รออนุมัติเผยแพร่</span>');
    else out.push('<span class="badge st-done">🌐 เผยแพร่แล้ว</span>');
    out.push(UI.statusBadge(h.status));
    return out.join(' ');
  }

  async function renderList(view, q) {
    const list = await loadList();
    const st = { f: FILTERS[q.get('f')] ? q.get('f') : 'all', q: q.get('q') || '' };
    view.innerHTML = `${staffBar('อ.' + list.amphoe.name)}
      <div class="staff-filters">${Object.entries(FILTERS).map(([k, [label, fn]]) =>
        `<button class="chip${k === st.f ? ' on' : ''}" data-f="${k}">${label} <b>${list.households.filter(fn).length}</b></button>`).join('')}</div>
      <input type="search" id="staff-q" class="staff-search" placeholder="🔍 ค้นหาชื่อ รหัส ตำบล" value="${esc(st.q)}">
      <div id="staff-items" class="staff-list"></div>
      <a class="fab" href="#/staff/new">＋ เพิ่มครัวเรือน</a>`;
    bindBar(view, () => renderList(view, new URLSearchParams()));

    const draw = () => {
      history.replaceState(null, '', '#/staff/list?' + new URLSearchParams(st));
      const ql = st.q.trim().toLowerCase();
      const rows = list.households.filter(FILTERS[st.f][1])
        .filter(h => !ql || [h.id, h.name, h.tambon, 'ม.' + h.moo].join(' ').toLowerCase().includes(ql))
        .sort((a, b) => a.tambon.localeCompare(b.tambon, 'th') || (Number(a.moo) || 0) - (Number(b.moo) || 0) || a.id.localeCompare(b.id));
      $('#staff-items', view).innerHTML = rows.length ? rows.map(h => `<a class="staff-item" href="#/staff/edit/${enc(h.id)}">
          <div class="si-main"><b>${esc(h.name)}</b><small>${esc(h.id)} · ${UI.address(h)}</small></div>
          <div class="si-tags">${tags(h)}</div></a>`).join('')
        : '<div class="empty-state">ยังไม่มีครัวเรือนในกลุ่มนี้ — กด “＋ เพิ่มครัวเรือน”</div>';
    };
    draw();
    $$('[data-f]', view).forEach(b => b.addEventListener('click', () => {
      st.f = b.dataset.f;
      $$('[data-f]', view).forEach(x => x.classList.toggle('on', x === b));
      draw();
    }));
    let typing;
    $('#staff-q', view).addEventListener('input', e => {
      clearTimeout(typing);
      typing = setTimeout(() => { st.q = e.target.value; draw(); }, 200);
    });
  }

  // ---------- เพิ่ม/แก้ไขครัวเรือน ----------
  const VULN = [['elderly', '👵 ผู้สูงอายุ'], ['disabled', '♿ ผู้พิการ'], ['bedridden', '🛏️ ผู้ป่วยติดเตียง'], ['children', '🧒 เด็ก']];
  const PHOTO_SLOTS = [['🏠', 'ภาพบ้าน'], ['👨‍👩‍👧', 'ภาพครอบครัว'], ['🛠️', 'ภาพสภาพปัญหา'], ['🌿', 'ภาพความเป็นอยู่']];

  const stepper = (name, value, label) => `<div class="stepper-field"><span>${label}</span>
    <div class="stepper"><button type="button" data-step="-1" aria-label="ลด">−</button>
      <input name="${name}" type="number" inputmode="numeric" min="0" max="50" value="${esc(value || 0)}">
      <button type="button" data-step="1" aria-label="เพิ่ม">＋</button></div></div>`;

  const chips = (name, options, selected) => `<div class="chips wrap">${options.map(o =>
    `<label class="chip-check"><input type="checkbox" name="${name}" value="${esc(o)}"${selected.includes(o) ? ' checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`;

  const needRow = v => `<div class="need-row"><input name="need" value="${esc(v)}" placeholder="เช่น ซ่อมหลังคา">
    <button type="button" class="need-del" aria-label="ลบรายการ">✕</button></div>`;

  async function renderEdit(view, id) {
    const list = await loadList();
    const isNew = !id;
    const last = store.get(OFFICER) || {};
    const h = isNew ? { amphoeCode: current(), name: '', houseNo: '', moo: '', tambon: '', members: '', elderly: 0, disabled: 0,
      bedridden: 0, children: 0, problem: '', dimensions: [], needs: [], categories: [], urgency: '', helpReceived: '',
      status: STATUSES[0], consent: false, approved: false, officer: last.officer || '', officerPhone: last.officerPhone || '', note: '' }
      : list.households.find(x => x.id === id);
    if (!h) throw new Error('ไม่พบครัวเรือน ' + id);

    view.innerHTML = `${staffBar('อ.' + list.amphoe.name)}
    <a class="back" href="#/staff/list">← รายการครัวเรือน</a>
    <div class="page-head"><h1>${isNew ? '＋ เพิ่มครัวเรือน' : '✏️ ' + esc(h.name)}</h1>
      ${isNew ? '' : `<p class="muted">${esc(h.id)} · ${tags(h)}</p>
        <a class="btn btn-small btn-outline rp-from-hh" href="#/staff/report/new?hh=${enc(h.id)}">📝 เขียนรายงานผลการช่วยเหลือ</a>`}</div>
    <form class="form staff-form" id="hh-form" novalidate>
      <section class="box"><h2>1. ข้อมูลครัวเรือน</h2>
        <label>ชื่อ-นามสกุล หัวหน้าครัวเรือน <em>*</em><input name="name" required value="${esc(h.name)}" placeholder="เช่น นางสมใจ ใจดี"></label>
        <div class="three">
          <label>บ้านเลขที่<input name="houseNo" value="${esc(h.houseNo)}" placeholder="45/2"></label>
          <label>หมู่ที่ <em>*</em><input name="moo" type="number" inputmode="numeric" min="1" max="30" required value="${esc(h.moo)}"></label>
          <label>ตำบล <em>*</em><input name="tambon" required list="tambon-list" value="${esc(h.tambon)}">
            <datalist id="tambon-list">${list.tambons.map(t => `<option value="${esc(t)}">`).join('')}</datalist></label>
        </div>
      </section>

      <section class="box"><h2>2. สมาชิกในครัวเรือน</h2>
        <div class="steppers">${stepper('members', h.members, '👥 จำนวนสมาชิกทั้งหมด *')}
          ${VULN.map(([k, label]) => stepper(k, h[k], label)).join('')}</div>
      </section>

      <section class="box"><h2>3. สภาพปัญหาและความเดือดร้อน <em>*</em></h2>
        <textarea name="problem" rows="4" placeholder="เล่าสั้น ๆ 2–4 ประโยค ว่าครัวเรือนเดือดร้อนเรื่องอะไร">${esc(h.problem)}</textarea>
        <p class="field-label">มิติปัญหา (TPMAP)</p>${chips('dimensions', UI.DIMENSIONS, h.dimensions)}
      </section>

      <section class="box"><h2>4. ความต้องการ <em>*</em></h2>
        <p class="muted small">บรรทัดละ 1 รายการ ไม่ต้องใส่จำนวนเงิน</p>
        <div id="needs">${(h.needs.length ? h.needs : ['']).map(needRow).join('')}</div>
        <button type="button" class="btn btn-small btn-outline" id="need-add">＋ เพิ่มรายการ</button>
        <p class="field-label">หมวดความต้องการ</p>${chips('categories', UI.CATEGORIES.map(c => c.key), h.categories)}
        <p class="field-label">ความเร่งด่วน</p>
        <div class="seg">${[[3, '🔥 เร่งด่วนมาก'], [2, 'เร่งด่วน'], [1, 'ปกติ']].map(([v, l]) =>
          `<label><input type="radio" name="urgency" value="${v}"${Number(h.urgency) === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
      </section>

      <section class="box"><h2>5. รูปภาพ</h2>
        ${isNew ? '<p class="notice">บันทึกข้อมูลครั้งแรกก่อน แล้วจึงเพิ่มรูปได้</p>' : `
        <p class="muted small">แตะช่องเพื่อถ่ายรูปหรือเลือกจากอัลบั้ม ระบบย่อรูปให้อัตโนมัติ · หลีกเลี่ยงรูปที่เห็นหน้าเด็กชัดเจน</p>
        <div class="photo-slots">${PHOTO_SLOTS.map(([icon, label], i) => `<label class="photo-slot" data-slot="${i}">
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden>
          <span class="ps-img"><span class="ps-empty">${icon}<small>แตะเพื่อเพิ่มรูป</small></span></span>
          <span class="ps-label">${label}</span><span class="ps-state"></span></label>`).join('')}</div>`}
      </section>

      <section class="box"><h2>6. การช่วยเหลือและสถานะ</h2>
        <label>การช่วยเหลือที่ได้รับแล้ว<textarea name="helpReceived" rows="2">${esc(h.helpReceived)}</textarea></label>
        <label>สถานะ<select name="status">${STATUSES.map(s => `<option${s === h.status ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      </section>

      <section class="box"><h2>7. การเผยแพร่ (PDPA)</h2>
        <label class="check"><input type="checkbox" name="consent"${h.consent ? ' checked' : ''}>
          <span><b>มีหนังสือยินยอมที่หัวหน้าครัวเรือนลงนามแล้ว</b></span></label>
        <label class="check"><input type="checkbox" name="approved"${h.approved ? ' checked' : ''}${h.consent ? '' : ' disabled'}>
          <span><b>อนุมัติให้แสดงบนเว็บ</b><br><small class="muted">ตรวจข้อมูลแล้ว เผยแพร่ได้ (ต้องมีหนังสือยินยอมก่อน)</small></span></label>
      </section>

      <section class="box"><h2>8. ผู้ดูแลและหมายเหตุ</h2>
        <div class="two">
          <label>พัฒนากรผู้ดูแล<input name="officer" value="${esc(h.officer)}"></label>
          <label>เบอร์พัฒนากร (แสดงบนเว็บ)<input name="officerPhone" type="tel" inputmode="tel" value="${esc(h.officerPhone)}"></label>
        </div>
        <label>หมายเหตุภายใน (ไม่แสดงบนเว็บ)<textarea name="note" rows="2" placeholder="เช่น เบอร์โทรครัวเรือน">${esc(h.note)}</textarea></label>
      </section>

      <div class="save-bar">
        <p class="form-error" role="alert"></p>
        <a class="btn btn-outline" href="#/staff/list" id="hh-cancel">ยกเลิก</a>
        <button class="btn btn-cta" type="submit">💾 บันทึก</button>
      </div>
    </form>`;
    bindBar(view, () => { location.hash = '#/staff/list'; });

    const form = $('#hh-form', view);
    let dirty = false;
    form.addEventListener('input', () => { dirty = true; });
    $('#hh-cancel', view).addEventListener('click', async e => {
      if (!dirty) return;
      e.preventDefault();
      if (await UI.ask('ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?', 'ออกโดยไม่บันทึก', true)) location.hash = '#/staff/list';
    });
    form.consent.addEventListener('change', () => {
      form.approved.disabled = !form.consent.checked;
      if (!form.consent.checked) form.approved.checked = false;
    });
    form.addEventListener('click', e => {
      const step = e.target.closest('[data-step]');
      if (step) {
        const input = $('input', step.parentElement);
        input.value = Math.max(0, Math.min(50, (Number(input.value) || 0) + Number(step.dataset.step)));
        dirty = true;
      }
      const del = e.target.closest('.need-del');
      if (del) {
        const rows = $$('.need-row', form);
        if (rows.length > 1) del.parentElement.remove(); else $('input', rows[0]).value = '';
        dirty = true;
      }
    });
    const addNeed = () => {
      $('#needs', form).insertAdjacentHTML('beforeend', needRow(''));
      $$('.need-row input', form).pop().focus();
    };
    $('#need-add', form).addEventListener('click', addNeed);
    $('#needs', form).addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.name === 'need') { e.preventDefault(); addNeed(); }
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const err = $('.save-bar .form-error', view);
      err.textContent = '';
      const val = n => form[n].value.trim();
      const checked = n => $$(`input[name="${n}"]:checked`, form).map(x => x.value);
      const data = {
        id: h.id, amphoeCode: h.amphoeCode || current(), name: val('name'), houseNo: val('houseNo'), moo: val('moo'),
        tambon: val('tambon'), members: val('members'), elderly: val('elderly'), disabled: val('disabled'),
        bedridden: val('bedridden'), children: val('children'), problem: val('problem'), dimensions: checked('dimensions'),
        needs: $$('input[name="need"]', form).map(x => x.value.trim()).filter(Boolean), categories: checked('categories'),
        urgency: (checked('urgency')[0] || ''), helpReceived: val('helpReceived'), status: val('status'),
        consent: form.consent.checked, approved: form.approved.checked, officer: val('officer'),
        officerPhone: val('officerPhone'), note: val('note'),
      };
      if (!data.name || !data.moo || !data.tambon) {
        err.textContent = 'กรุณากรอกชื่อหัวหน้าครัวเรือน หมู่ และตำบล';
        (form[!data.name ? 'name' : !data.moo ? 'moo' : 'tambon']).focus();
        return;
      }
      const btn = $('button[type=submit]', form);
      btn.disabled = true;
      btn.textContent = 'กำลังบันทึก…';
      try {
        const out = await call('save', data);
        store.set(OFFICER, { officer: data.officer, officerPhone: data.officerPhone });
        const saved = out.household;
        const i = listCache.households.findIndex(x => x.id === saved.id);
        if (i >= 0) listCache.households[i] = saved; else listCache.households.push(saved);
        if (saved.tambon && !listCache.tambons.includes(saved.tambon)) listCache.tambons.push(saved.tambon);
        API.clearCache();
        dirty = false;
        App.toast(saved.missing.length ? 'บันทึกแล้ว (ยังขาด: ' + saved.missing.join(', ') + ')' : 'บันทึกแล้ว ✅');
        if (isNew) location.hash = '#/staff/edit/' + enc(saved.id);
        else renderEdit(view, saved.id);
      } catch (ex) {
        err.textContent = ex.message;
      } finally {
        btn.disabled = false;
        btn.textContent = '💾 บันทึก';
      }
    });

    if (!isNew) bindPhotos(view, h.id);
  }

  // ---------- รูปภาพ ----------
  async function shrink(file, max = 1280, quality = 0.82) {
    let img;
    try {
      img = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) {
      img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error('อ่านไฟล์รูปไม่ได้'));
        im.src = URL.createObjectURL(file);
      });
    }
    const r = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * r);
    c.height = Math.round(img.height * r);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  }

  function showPhoto(slotEl, src) {
    $('.ps-img', slotEl).innerHTML = src && src !== 'has-photo' ? `<img src="${esc(src)}" alt="">`
      : src ? '<span class="ps-empty">✅<small>มีรูปแล้ว</small></span>'
      : `<span class="ps-empty">${PHOTO_SLOTS[slotEl.dataset.slot][0]}<small>แตะเพื่อเพิ่มรูป</small></span>`;
  }

  async function bindPhotos(view, id) {
    const slots = $$('.photo-slot', view);
    slots.forEach(el => {
      $('.ps-state', el).textContent = 'กำลังโหลด…';
      $('input', el).addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        const state = $('.ps-state', el);
        try {
          state.textContent = 'กำลังย่อรูป…';
          const dataUrl = await shrink(file);
          showPhoto(el, dataUrl);
          el.classList.add('uploading');
          state.textContent = 'กำลังอัปโหลด…';
          await call('uploadPhoto', id, Number(el.dataset.slot), dataUrl);
          state.textContent = '✅ บันทึกรูปแล้ว';
          API.clearCache();
        } catch (ex) {
          state.textContent = '❌ ' + ex.message;
        } finally {
          el.classList.remove('uploading');
          e.target.value = '';
        }
      });
    });
    try {
      const out = await call('photos', id);
      slots.forEach((el, i) => { showPhoto(el, out.photos[i]); $('.ps-state', el).textContent = ''; });
    } catch (ex) {
      slots.forEach(el => { $('.ps-state', el).textContent = ''; });
    }
  }

  // ---------- ผู้แสดงความประสงค์ช่วยเหลือ ----------
  async function renderPledges(view) {
    const list = await loadList();
    const out = await call('pledges', current());
    view.innerHTML = `${staffBar('อ.' + list.amphoe.name)}
      <div class="page-head"><h1>📨 ผู้แสดงความประสงค์ช่วยเหลือ</h1>
        <p class="muted">ติดต่อกลับภายใน 3 วันทำการ แล้วบันทึกสถานะการติดต่อ</p></div>
      <div class="staff-list">${out.pledges.length ? out.pledges.map(p => `<article class="box pledge" data-row="${p.row}">
        <div class="pl-head"><b>${esc(p.org)}</b><span class="badge ${p.followUp === 'ใหม่' ? 'urg-3' : 'st-done'}">${esc(p.followUp || 'ใหม่')}</span></div>
        <p class="muted small">${UI.thaiDate(p.date)} · เป้าหมาย ${esc(p.target)}</p>
        <p>👤 ${esc(p.contact)} ${p.phone ? `· <a target="_top" href="tel:${esc(p.phone.replace(/[^\d+]/g, ''))}">📞 ${esc(p.phone)}</a>` : ''}
          ${p.email ? `· <a href="mailto:${esc(p.email)}" target="_blank">${esc(p.email)}</a>` : ''}</p>
        ${p.items ? `<p>🎁 ${esc(p.items)}</p>` : ''}${p.types ? `<p class="muted small">รูปแบบ: ${esc(p.types)}</p>` : ''}
        ${p.message ? `<p class="story">“${esc(p.message)}”</p>` : ''}
        <div class="pl-edit">
          <select aria-label="สถานะการติดต่อ">${out.statuses.map(s => `<option${s === (p.followUp || 'ใหม่') ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>
          <input placeholder="ผู้รับเรื่อง" value="${esc(p.handler)}">
          <button class="btn btn-small btn-cta">บันทึก</button>
        </div></article>`).join('')
        : '<div class="empty-state box">ยังไม่มีผู้แสดงความประสงค์ช่วยเหลือในอำเภอนี้</div>'}</div>`;
    bindBar(view, () => renderPledges(view));
    $$('.pledge', view).forEach(card => {
      $('button', card).addEventListener('click', async () => {
        const btn = $('button', card);
        btn.disabled = true;
        try {
          await call('updatePledge', Number(card.dataset.row), $('select', card).value, $('input', card).value.trim());
          App.toast('บันทึกสถานะแล้ว');
          renderPledges(view);
        } catch (ex) {
          App.toast(ex.message);
          btn.disabled = false;
        }
      });
    });
  }

  // ฟังก์ชันที่หน้ารายงานผล (report.js) ใช้ร่วม
  const reportCtx = { call, staffBar, bindBar, loadList, current, store, shrink };

  return { render };
})();
