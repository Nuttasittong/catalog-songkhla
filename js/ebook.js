// สร้างหน้า Catalog E-book รายอำเภอ (ใช้ทั้งโหมดพลิกหน้าและโหมดพิมพ์ PDF)
window.Ebook = (() => {
  const { esc } = UI;
  const cfg = window.APP_CONFIG;
  const TOC_PER_PAGE = 16;
  const LOGOS = `<span class="pg-logos">
    <img src="${UI.asset('img/logo-cdd.png')}" alt="ตรากรมการพัฒนาชุมชน"><img src="${UI.asset('img/seal-songkhla.png')}" alt="ตราจังหวัดสงขลา"></span>`;
  // รูปตกแต่งจากโฟลเดอร์ "รูปภาพสำหรับใช้ตกแต่ง Catalog" (เตรียมด้วย tools/prepare_deco_images.py)
  const deco = (name, alt, cls) => `<img class="${cls}" src="${UI.asset(`img/deco/${name}.webp`)}" alt="${alt}">`;
  const NEEDS_PER_PAGE = 6;
  const QR_PER_PAGE = 9;

  function sortHouseholds(hs) {
    return hs.slice().sort((a, b) =>
      a.tambon.localeCompare(b.tambon, 'th') ||
      (Number(a.moo) || 0) - (Number(b.moo) || 0) ||
      a.id.localeCompare(b.id));
  }

  function groupBy(arr, fn) {
    const m = new Map();
    arr.forEach(x => {
      const k = fn(x);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    });
    return m;
  }

  function cover(a, hs, color) {
    const tambons = new Set(hs.map(h => h.tambon)).size;
    const needCount = hs.reduce((s, h) => s + h.needs.length, 0);
    return `<div class="pg pg-cover" style="--ac:${color}">
      <div class="cv-top">${LOGOS}<span>${esc(cfg.ORG)}</span>${deco('logo-1org1csr', 'โครงการ 1 องค์กร 1 CSR', 'cv-csr')}</div>
      <div class="cv-mid">
        <div class="cv-kicker">CATALOG</div>
        <h1>ครัวเรือนยากจน<br>และได้รับความเดือดร้อน</h1>
        <div class="cv-amphoe">อำเภอ${esc(a.name)}</div>
        <div class="cv-prov">จังหวัด${esc(cfg.PROVINCE)}</div>
      </div>
      <div class="cv-slogan">${deco('slogan', 'พลังรัฐ พลังเอกชน พลังชุมชน ร่วมแก้จนคนสงขลา', '')}</div>
      <div class="cv-bottom">
        <div class="cv-stats">
          <div><b>${hs.length}</b><span>ครัวเรือน</span></div>
          <div><b>${tambons}</b><span>ตำบล</span></div>
          <div><b>${needCount}</b><span>รายการความต้องการ</span></div>
        </div>
        ${deco('mascots-hi5', 'มาสคอต ศจพ.สงขลา', 'cv-mascots')}
      </div>
      <div class="cv-foot">ปี พ.ศ. ${UI.thaiYear()} · ร่วมเป็นส่วนหนึ่งในการช่วยเหลือ ผ่านโครงการ CSR</div>
    </div>`;
  }

  function summary(a, hs, color) {
    const byTambon = groupBy(hs, h => h.tambon);
    const rows = [...byTambon].map(([t, list]) => `<tr><td>ต.${esc(t)}</td><td>${list.length}</td>
      <td>${list.reduce((s, h) => s + h.needs.length, 0)}</td></tr>`).join('');
    const max = Math.max(1, ...UI.CATEGORIES.map(c => hs.filter(h => h.categories.includes(c.key)).length));
    const bars = UI.CATEGORIES.map(c => {
      const n = hs.filter(h => h.categories.includes(c.key)).length;
      return `<div class="sm-bar"><span class="sm-lbl">${c.icon} ${esc(c.key)}</span>
        <span class="sm-track"><span style="width:${n / max * 100}%;background:${c.color}"></span></span><b>${n}</b></div>`;
    }).join('');
    return `<div class="pg pg-summary" style="--ac:${color}">
      <div class="pg-band"><span>ภาพรวมอำเภอ${esc(a.name)}</span><b>สรุป</b></div>
      <h2>ครัวเรือนเป้าหมายแยกรายตำบล</h2>
      <table class="pg-table"><thead><tr><th>ตำบล</th><th>ครัวเรือน</th><th>รายการความต้องการ</th></tr></thead>
        <tbody>${rows}</tbody></table>
      <h2>ความต้องการแยกตามหมวด</h2>
      <div class="sm-bars">${bars}</div>
      <h2>ร่วมช่วยเหลือง่าย ๆ 3 ขั้นตอน</h2>
      <ol class="sm-steps">
        <li><b>เลือกครัวเรือน</b> ที่ตรงกับนโยบาย CSR ของหน่วยงาน</li>
        <li><b>สแกน QR</b> ในหน้ารวม QR ท้ายเล่ม แล้วกด “ฉันอยากช่วย”</li>
        <li><b>พัฒนากรประสาน</b> การส่งมอบ และรายงานผลพร้อมภาพก่อน–หลัง</li>
      </ol>
      ${deco('banner-opportunity', 'แสงแห่งโอกาส เริ่มจากการไม่ทิ้งกัน', 'sm-banner')}
    </div>`;
  }

  function tocPages(a, hs, color, firstHousePage) {
    const pages = [];
    for (let i = 0; i < hs.length; i += TOC_PER_PAGE) {
      const rows = hs.slice(i, i + TOC_PER_PAGE).map((h, j) => `<li>
        <span class="toc-id">${esc(h.id)}</span>
        <span class="toc-name">${esc(h.name)}<small>${UI.address(h)}</small></span>
        <span class="toc-pg">${firstHousePage + 2 * (i + j)}</span></li>`).join('');
      pages.push(`<div class="pg pg-toc" style="--ac:${color}">
        <div class="pg-band"><span>อำเภอ${esc(a.name)}</span><b>สารบัญ</b></div>
        <ol class="toc">${rows}</ol>
      </div>`);
    }
    return pages;
  }

  function housePage(a, h, color, pageNo) {
    const pending = '<i class="muted">อยู่ระหว่างสำรวจข้อมูล</i>';
    return `<div class="pg pg-house" style="--ac:${color}">
      <div class="pg-band"><span>อ.${esc(h.amphoe)} · ต.${esc(h.tambon)}</span><b>${esc(h.id)}</b></div>
      <div class="pg-top">
        <div class="pg-photo">${UI.photo(h)}</div>
        <div class="pg-who">
          <div class="pg-badges">${UI.statusBadge(h.status)} ${UI.urgencyBadge(h.urgency)}</div>
          <h2>${esc(h.name)}</h2>
          <div class="pg-line">📍 ${UI.address(h)}</div>
          <div class="pg-line">👥 สมาชิก ${h.members ? esc(h.members) + ' คน' : '–'}</div>
          <div class="pg-vuln">${UI.vulnChips(h.vulnerable)}</div>
          ${h.demo ? '<span class="badge demo">ข้อมูลตัวอย่าง</span>' : ''}
        </div>
      </div>
      <section class="pg-sec">
        <h3>สภาพปัญหาและความเดือดร้อน</h3>
        <p class="clamp">${h.problem ? esc(h.problem) : pending}</p>
        <div class="pg-tags">${UI.dimChips(h.dimensions)}${UI.catChips(h.categories)}</div>
      </section>
      <section class="pg-sec">
        <h3>ความต้องการในการขอรับความช่วยเหลือ</h3>
        ${h.needs.length ? UI.needList(h.needs, NEEDS_PER_PAGE) : `<p>${pending}</p>`}
      </section>
      <section class="pg-sec">
        <h3>การช่วยเหลือครัวเรือน</h3>
        <p class="clamp-2">${h.helpReceived ? esc(h.helpReceived) : 'ยังไม่ได้รับการช่วยเหลือ'}</p>
      </section>
      <span class="pg-no-float">${pageNo}</span>
    </div>`;
  }

  // หน้าภาพครัวเรือน 4 ช่อง — ชื่อช่องเป็นแนวทางให้พัฒนากรถ่ายรูปให้ครบ
  const PHOTO_SLOTS = [['🏠', 'ภาพบ้าน'], ['👨‍👩‍👧', 'ภาพครอบครัว'], ['🛠️', 'ภาพสภาพปัญหา'], ['🌿', 'ภาพความเป็นอยู่']];

  function photoPage(a, h, color, pageNo) {
    const cells = PHOTO_SLOTS.map(([icon, label], i) => {
      const src = h.photos[i];
      const body = src
        ? `<img src="${esc(src)}" alt="${label} ${esc(h.id)}" loading="lazy" referrerpolicy="no-referrer">`
        : `<div class="pp-empty"><span aria-hidden="true">${icon}</span><small>รอภาพถ่าย</small></div>`;
      return `<figure class="pp-cell">${body}<figcaption>${label}</figcaption></figure>`;
    }).join('');
    return `<div class="pg pg-photos" style="--ac:${color}">
      <div class="pg-band"><span>ภาพครัวเรือน · ${esc(h.name)}</span><b>${esc(h.id)}</b></div>
      <div class="pp-grid">${cells}</div>
      <span class="pg-no-float">${pageNo}</span>
    </div>`;
  }

  // หน้ารวม QR ท้ายเล่ม (หน้าละ 9 ครัวเรือน) แทนการพิมพ์ QR ท้ายทุกหน้า
  function qrPages(a, hs, color, firstHousePage) {
    const pages = [];
    for (let i = 0; i < hs.length; i += QR_PER_PAGE) {
      const cards = hs.slice(i, i + QR_PER_PAGE).map((h, j) => {
        const note = h.needs.length ? `${h.needs.length} รายการความต้องการ` : esc(h.status);
        return `<div class="qr-card">
          <div class="qr-img">${UI.qr(UI.siteUrl('#/h/' + h.id))}</div>
          <b>${esc(h.id)}</b>
          <span class="qr-name">${esc(h.name)}</span>
          <small>${note} · หน้า ${firstHousePage + 2 * (i + j)}</small>
        </div>`;
      }).join('');
      pages.push(`<div class="pg pg-qrs" style="--ac:${color}">
        <div class="pg-band"><span>อำเภอ${esc(a.name)}</span><b>สแกนเพื่อร่วมช่วยเหลือ</b></div>
        <div class="qr-intro">
          <p>สแกน QR ของครัวเรือนที่ต้องการ เพื่อดูข้อมูลล่าสุดและกด “ฉันอยากช่วย”
            · ติดต่อ ${esc(a.coordinator || '')}${a.phone ? ' โทร ' + esc(a.phone) : ''}</p>
          ${deco('mascot-owl', 'มาสคอตนกฮูก ดูดี', 'qr-mascot')}
        </div>
        <div class="qr-grid">${cards}</div>
      </div>`);
    }
    return pages;
  }

  // หน้าคั่น ใช้เมื่อต้องเลื่อนให้หน้าข้อมูลครัวเรือนอยู่ซ้ายและหน้าภาพอยู่ขวาของหน้าคู่
  function guidePage(a, color) {
    return `<div class="pg pg-guide" style="--ac:${color}">
      <div class="pg-band"><span>อำเภอ${esc(a.name)}</span><b>วิธีอ่าน</b></div>
      <div class="gd-body">
        <h2>วิธีอ่าน Catalog</h2>
        <div class="gd-spread">
          <div><b>หน้าซ้าย</b><span>ข้อมูลครัวเรือน สภาพปัญหา และรายการความต้องการ</span></div>
          <div><b>หน้าขวา</b><span>ภาพบ้าน ครอบครัว สภาพปัญหา และความเป็นอยู่</span></div>
        </div>
        <p>สแกน QR ในหน้ารวม QR ท้ายเล่มเพื่อดูข้อมูลล่าสุด และกด “ฉันอยากช่วย” เจ้าหน้าที่จะติดต่อกลับภายใน 3 วันทำการ</p>
        <p class="gd-contact"><b>ผู้ประสานงาน</b><br>${esc(a.coordinator || '')}${a.phone ? '<br>โทร ' + esc(a.phone) : ''}</p>
      </div>
      ${deco('mascot-bird', 'มาสคอตนก CD', 'gd-mascot')}
    </div>`;
  }

  function backCover(a, color) {
    const target = cfg.LINE_OA_URL || UI.siteUrl('#/list?amphoe=' + a.code);
    return `<div class="pg pg-back" style="--ac:${color}">
      <div class="bk-mid">
        ${LOGOS}
        <h2>ร่วมเปลี่ยนชีวิตครัวเรือน<br>อำเภอ${esc(a.name)}</h2>
        <div class="bk-row">
          ${deco('mascot-bird', 'มาสคอตนก CD', 'bk-mascot')}
          <div class="bk-qr">${UI.qr(target)}</div>
          ${deco('mascot-owl', 'มาสคอตนกฮูก ดูดี', 'bk-mascot')}
        </div>
        <p>${cfg.LINE_OA_URL ? 'สแกนเพื่อเพิ่มเพื่อน LINE OA และเปิด Catalog ออนไลน์' : 'สแกนเพื่อเปิด Catalog ออนไลน์'}</p>
      </div>
      <div class="bk-partners">
        ${deco('logo-sjp', 'ศจพ.', '')}${deco('logo-1org1csr', 'โครงการ 1 องค์กร 1 CSR', '')}
      </div>
      <div class="bk-contact">
        <b>ติดต่อประสานงาน</b>
        <span>${esc(a.coordinator || '')}${a.phone ? ' โทร ' + esc(a.phone) : ''}</span>
        <span>${esc(cfg.ORG)}${cfg.ORG_PHONE ? ' โทร ' + esc(cfg.ORG_PHONE) : ''}</span>
      </div>
    </div>`;
  }

  // คืนค่าเป็นอาร์เรย์ HTML ทีละหน้า
  function pages(a, households) {
    const hs = sortHouseholds(households);
    const color = UI.amphoeColor(a.code);
    const tocCount = Math.max(1, Math.ceil(hs.length / TOC_PER_PAGE));
    // ปกหน้าอยู่เดี่ยว แล้วเป็นหน้าคู่ (1–2, 3–4, …) หน้าข้อมูลครัวเรือนจึงต้องอยู่ลำดับคี่ (นับจาก 0)
    const needGuide = (2 + tocCount) % 2 === 0;
    const firstHousePage = 3 + tocCount + (needGuide ? 1 : 0); // เลขหน้าแบบนับจาก 1
    return [
      cover(a, hs, color),
      summary(a, hs, color),
      ...tocPages(a, hs, color, firstHousePage),
      ...(needGuide ? [guidePage(a, color)] : []),
      ...hs.flatMap((h, i) => [
        housePage(a, h, color, firstHousePage + 2 * i),
        photoPage(a, h, color, firstHousePage + 2 * i + 1),
      ]),
      ...qrPages(a, hs, color, firstHousePage),
      backCover(a, color),
    ];
  }

  function mount(el, pageHtml, onPage) {
    el.innerHTML = pageHtml.map(p => `<div class="page">${p}</div>`).join('');
    const total = pageHtml.length;
    if (window.St && window.St.PageFlip) {
      const pf = new window.St.PageFlip(el, {
        width: 420, height: 594, size: 'stretch',
        minWidth: 260, maxWidth: 640, minHeight: 368, maxHeight: 905,
        showCover: true, usePortrait: true, mobileScrollSupport: false,
        maxShadowOpacity: 0.35, flippingTime: 650,
      });
      pf.loadFromHTML(el.querySelectorAll('.page'));
      pf.on('flip', e => onPage(e.data, total));
      onPage(0, total);
      return {
        next: () => pf.flipNext(),
        prev: () => pf.flipPrev(),
        destroy: () => { try { pf.destroy(); } catch (e) { /* ลบไปแล้ว */ } },
      };
    }
    // สำรอง: ปัดเลื่อนทีละหน้า หากโหลดไลบรารีพลิกหน้าไม่ได้
    el.classList.add('book-scroll');
    const go = d => el.scrollBy({ left: d * el.clientWidth, behavior: 'smooth' });
    el.addEventListener('scroll', () => onPage(Math.round(el.scrollLeft / el.clientWidth), total), { passive: true });
    onPage(0, total);
    return { next: () => go(1), prev: () => go(-1), destroy: () => {} };
  }

  function print(pageHtml, title) {
    const root = document.getElementById('print-root');
    root.innerHTML = pageHtml.map(p => `<div class="print-page">${p}</div>`).join('');
    const oldTitle = document.title;
    document.title = title;
    document.body.classList.add('printing');
    const done = () => {
      document.body.classList.remove('printing');
      root.innerHTML = '';
      document.title = oldTitle;
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    // รอให้รูปโหลดก่อนสั่งพิมพ์
    const imgs = [...root.querySelectorAll('img')].filter(i => !i.complete);
    Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; })))
      .then(() => setTimeout(() => window.print(), 150));
  }

  return { pages, mount, print, sortHouseholds };
})();
