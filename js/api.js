// โหลดข้อมูลจาก Apps Script (หรือข้อมูลจำลอง) และส่งแบบฟอร์มแสดงความประสงค์ช่วยเหลือ
// เมื่อเว็บเปิดจาก Apps Script โดยตรง จะเรียกฟังก์ชันฝั่งเซิร์ฟเวอร์ผ่าน google.script.run
window.API = (() => {
  const cfg = window.APP_CONFIG;
  const gas = () => window.google && window.google.script && window.google.script.run;

  function gasCall(fn, ...args) {
    return new Promise((resolve, reject) => {
      window.google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(err => reject(new Error((err && err.message) || 'เชื่อมต่อระบบไม่สำเร็จ')))[fn](...args);
    });
  }
  const STORE_KEY = 'catalog-data-v1';
  const FRESH_MS = 5 * 60 * 1000;
  let data = null;

  function readStore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved && saved.src === sourceUrl()) return saved;
    } catch (e) { /* โหมดส่วนตัว/บล็อก storage */ }
    return null;
  }

  function writeStore(d) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ t: Date.now(), src: sourceUrl(), d })); } catch (e) { /* เต็มหรือถูกบล็อก */ }
  }

  function sourceUrl() {
    if (gas()) return 'gas';
    return cfg.API_URL ? `${cfg.API_URL}?action=data` : cfg.MOCK_URL;
  }

  // คำนวณค่าที่ใช้แสดงผลซ้ำบ่อย ๆ
  function prepare(d) {
    d.households.forEach(h => {
      h.needs = h.needs || [];
      h.categories = h.categories || [];
      h.dimensions = h.dimensions || [];
      h.photos = h.photos || [];
      h.vulnerable = h.vulnerable || {};
      h.missing = h.missing || [];
      h.amphoeCode = h.amphoeCode || String(h.id).split('-')[0];
    });
    d.amphoes = d.amphoes || [];
    d.sponsors = d.sponsors || [];
    return d;
  }

  async function fetchFresh() {
    let d;
    if (gas()) {
      d = JSON.parse(await gasCall('apiData'));
    } else {
      const res = await fetch(sourceUrl(), { cache: 'no-store' });
      if (!res.ok) throw new Error(`โหลดข้อมูลไม่สำเร็จ (HTTP ${res.status})`);
      d = await res.json();
    }
    if (d.error) throw new Error(d.error);
    writeStore(d);
    return prepare(d);
  }

  // ใช้ข้อมูลที่เก็บไว้ก่อนถ้ายังใหม่ เพื่อให้เปิดใน LINE ได้เร็ว
  async function load(force) {
    if (data && !force) return data;
    const saved = !force && readStore();
    if (saved && Date.now() - saved.t < FRESH_MS) {
      data = prepare(saved.d);
      return data;
    }
    try {
      data = await fetchFresh();
    } catch (err) {
      if (!saved) throw err;
      data = prepare(saved.d); // ออฟไลน์: ใช้ข้อมูลเก่า
    }
    return data;
  }

  async function pledge(payload) {
    if (gas()) {
      const out = await gasCall('apiPledge', payload);
      if (out.ok) { try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ } }
      return out;
    }
    if (!cfg.API_URL) {
      await new Promise(r => setTimeout(r, 600));
      return { ok: true, mock: true };
    }
    // text/plain เพื่อไม่ให้เกิด CORS preflight กับ Apps Script
    const res = await fetch(cfg.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'pledge', ...payload }),
    });
    const out = await res.json();
    if (out.ok) { try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ } }
    return out;
  }

  function clearCache() {
    data = null;
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
  }

  // ---------- เจ้าหน้าที่ (Staff.gs) — ทดลองในเครื่องใช้ข้อมูลจำลอง รหัสอำเภอ 123456 จังหวัด 000000 ----------
  const STAFF_FNS = ['staffLogin', 'staffLogout', 'staffList', 'staffSave', 'staffPhotos', 'staffUploadPhoto',
    'staffPledges', 'staffUpdatePledge', 'staffReports', 'staffReportSave', 'staffReportPhotos', 'staffReportUploadPhoto',
    'staffReportDelete'];

  async function staffCall(fn, ...args) {
    if (gas()) return gasCall(fn, ...args);
    if (cfg.API_URL) {
      // หน้าเว็บที่โฮสต์นอก Apps Script (GitHub Pages): ส่งผ่าน doPost — text/plain เพื่อไม่ให้เกิด CORS preflight
      let res;
      try {
        res = await fetch(cfg.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'staff', fn, args }),
        });
      } catch (e) {
        throw new Error('เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
      }
      if (!res.ok) throw new Error(`ระบบขัดข้อง (HTTP ${res.status}) กรุณาลองใหม่`);
      return res.json();
    }
    await new Promise(r => setTimeout(r, 250));
    return mockStaff[fn](...args);
  }

  const mockStaff = (() => {
    let rows = null;
    const photos = {};
    const reportPhotos = {};
    const reports = [
      { id: 'RP-RN-0001', amphoeCode: 'RN', amphoe: 'ระโนด', hhId: 'RN-0001', round: 1, reportDate: '2026-11-10',
        sponsor: 'มูลนิธิตัวอย่าง', project: 'ภายใต้บันทึกข้อตกลงความร่วมมือในการแก้ไขปัญหาความยากจนเชิงบูรณาการ',
        name: 'นายตัวอย่าง หนึ่ง', age: 63, members: 4, occupation: 'ค้าขาย', workplace: 'ทำขนมส่งขายตามตลาดอำเภอระโนด',
        helpDetail: 'ได้รับอุปกรณ์ทำขนม ได้แก่ เตาแก๊ส หม้อนึ่ง และถาดอบ จากมูลนิธิตัวอย่าง ส่งมอบเมื่อ 1 พ.ย. 2569',
        change: '- ครอบครัวมีรายได้มากขึ้น สะดวกในการประกอบอาชีพทำขนมมากขึ้น เนื่องจากมีอุปกรณ์ในการทำที่ดีขึ้น',
        problems: '', reporter: 'นายพัฒนากร ทดสอบ', reporterPhone: '08x-xxx-xxxx' },
    ];
    const pledges = [
      { row: 2, date: '2026-11-10T03:00:00Z', target: 'HY-0001', org: 'บริษัท ตัวอย่าง จำกัด', contact: 'คุณสมศรี',
        phone: '08x-xxx-xxxx', email: '', items: 'ซ่อมหลังคาและเปลี่ยนผนังบ้าน', types: 'สิ่งของ/วัสดุ', message: '', followUp: 'ใหม่', handler: '' },
    ];
    async function all() {
      if (rows) return rows;
      const d = await load();
      rows = d.households.map(h => ({
        id: h.id, amphoeCode: h.amphoeCode, amphoe: h.amphoe, name: h.name, houseNo: h.houseNo, moo: h.moo,
        tambon: h.tambon, members: h.members || '', elderly: h.vulnerable.elderly || 0, disabled: h.vulnerable.disabled || 0,
        bedridden: h.vulnerable.bedridden || 0, children: h.vulnerable.children || 0, problem: h.problem,
        dimensions: h.dimensions.slice(), needs: h.needs.map(n => n.item), categories: h.categories.slice(),
        urgency: h.urgency || '', helpReceived: h.helpReceived, status: h.status, consent: !h.missing.length,
        approved: !h.missing.length, officer: h.officer, officerPhone: h.officerPhone, note: '', missing: h.missing.slice(),
      }));
      return rows;
    }
    const session = token => {
      const code = String(token || '').replace(/^mock-/, '');
      if (!code) throw new Error('หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่');
      return code;
    };
    const allowed = (token, code) => {
      const s = session(token);
      return s === 'ALL' ? code : s;
    };
    return {
      async staffLogin(code, pin) {
        const d = await load();
        if (pin !== (code === 'ALL' ? '000000' : '123456')) return { ok: false, error: 'รหัสไม่ถูกต้อง (ทดลอง: 123456 / จังหวัด 000000)' };
        const amphoes = d.amphoes.map(a => ({ code: a.code, name: a.name }));
        return { ok: true, token: 'mock-' + code, code, amphoes: code === 'ALL' ? amphoes : amphoes.filter(a => a.code === code) };
      },
      staffLogout: () => ({ ok: true }),
      async staffList(token, code) {
        const c = allowed(token, code);
        const d = await load();
        const a = d.amphoes.find(x => x.code === c);
        const list = (await all()).filter(h => h.amphoeCode === c);
        return { ok: true, amphoe: { code: a.code, name: a.name }, households: list, tambons: [...new Set(list.map(h => h.tambon))] };
      },
      async staffSave(token, h) {
        const c = allowed(token, h.amphoeCode);
        if (!h.name || !h.moo || !h.tambon) return { ok: false, error: 'กรุณากรอกชื่อหัวหน้าครัวเรือน หมู่ และตำบล' };
        const list = await all();
        const d = await load();
        let row = list.find(x => x.id === h.id);
        if (!row) {
          const n = list.filter(x => x.amphoeCode === c).length + 1;
          row = { id: c + '-' + String(n).padStart(4, '0'), amphoeCode: c, amphoe: d.amphoes.find(x => x.code === c).name };
          list.push(row);
        }
        Object.assign(row, h, { id: row.id, amphoeCode: c, approved: !!(h.consent && h.approved) });
        row.missing = [!row.members && 'จำนวนสมาชิก', !row.problem && 'สภาพปัญหาและความเดือดร้อน', !row.needs.length && 'ความต้องการ'].filter(Boolean);
        return { ok: true, household: JSON.parse(JSON.stringify(row)) };
      },
      staffPhotos: (token, id) => ({ ok: true, photos: (photos[id] || ['', '', '', '']).slice() }),
      staffUploadPhoto(token, id, slot, dataUrl) {
        photos[id] = photos[id] || ['', '', '', ''];
        photos[id][slot] = dataUrl;
        return { ok: true };
      },
      staffPledges: () => ({ ok: true, pledges: pledges.slice(), statuses: ['ใหม่', 'ติดต่อแล้ว', 'กำลังดำเนินการ', 'ส่งมอบแล้ว', 'ยกเลิก'] }),
      staffUpdatePledge(token, row, followUp, handler) {
        const p = pledges.find(x => x.row === row);
        if (p) Object.assign(p, { followUp, handler });
        return { ok: true };
      },
      async staffReports(token, code) {
        const c = allowed(token, code);
        return { ok: true, reports: reports.filter(r => r.amphoeCode === c).map(r => Object.assign({}, r)) };
      },
      async staffReportSave(token, r) {
        const c = allowed(token, r.id ? r.id.split('-')[1] : r.amphoeCode);
        const hh = (await all()).find(x => x.id === r.hhId && x.amphoeCode === c);
        if (!hh) return { ok: false, error: 'กรุณาเลือกผู้ได้รับความช่วยเหลือจากรายการครัวเรือนใน Catalog' };
        const d = await load();
        let row = reports.find(x => x.id === r.id);
        if (!row) {
          const n = reports.filter(x => x.amphoeCode === c).length + 1;
          row = { id: `RP-${c}-${String(n).padStart(4, '0')}`, amphoeCode: c };
          reports.unshift(row);
        }
        const num = v => (Number(v) > 0 ? Number(v) : '');
        Object.assign(row, r, { id: row.id, amphoeCode: c, amphoe: d.amphoes.find(x => x.code === c).name, name: hh.name,
          round: num(r.round) || 1, age: num(r.age), members: num(r.members) || num(hh.members) });
        return { ok: true, report: Object.assign({}, row) };
      },
      staffReportPhotos: (token, id) => ({ ok: true, photos: (reportPhotos[id] || new Array(7).fill('')).slice() }),
      staffReportUploadPhoto(token, id, slot, dataUrl) {
        reportPhotos[id] = reportPhotos[id] || new Array(7).fill('');
        reportPhotos[id][slot] = dataUrl || '';
        return { ok: true };
      },
      staffReportDelete(token, id) {
        const i = reports.findIndex(x => x.id === id);
        if (i >= 0) reports.splice(i, 1);
        return { ok: true };
      },
    };
  })();

  const staff = Object.fromEntries(STAFF_FNS.map(fn => [fn.replace(/^staff/, '').replace(/^./, c => c.toLowerCase()),
    (...args) => staffCall(fn, ...args)]));

  return { load, pledge, clearCache, staff };
})();
