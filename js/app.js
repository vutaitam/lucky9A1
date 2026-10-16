/* Giao diện + lưu trữ (localStorage). Trang: #/ (chọn bạn nữ), #/quay/<id>, #/ket-qua, #/quan-tri */
(function () {
  'use strict';
  const L = window.Logic;
  const STORE_KEY = 'vong-quay-may-man.v1';
  const LIST_URL = 'data/danh-sach.csv';
  const PRESET_URL = 'data/chi-dinh.dat';
  const AVATAR = ['#ff5e7e', '#ff9f43', '#f7b731', '#20bf6b', '#0fb9b1', '#45aaf2', '#4b7bec',
    '#a55eea', '#fd79a8', '#e17055', '#00b894', '#6c5ce7', '#e84393'];
  const DEFAULT_SETTINGS = { className: 'Lớp 9A1', gifts: 3, spinSeconds: 6, sound: true };

  const app = document.getElementById('app');
  let state = loadState();
  let wheel = null;
  let spinning = false;
  let showPresets = false;

  /* ---------- lưu trữ ---------- */

  function blankState() {
    return {
      roster: null, source: '', rosterWarnings: [],
      presetsRaw: {}, presetsSource: '',
      results: {}, history: [],
      settings: Object.assign({}, DEFAULT_SETTINGS)
    };
  }
  function loadState() {
    const s = blankState();
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved) {
        Object.assign(s, saved);
        s.settings = Object.assign({}, DEFAULT_SETTINGS, saved.settings || {});
      }
    } catch (e) { /* bộ nhớ bị chặn hoặc hỏng: dùng trạng thái trống */ }
    return s;
  }
  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      toast('⚠️ Trình duyệt không cho lưu dữ liệu (đang ở chế độ ẩn danh?). Tải lại trang sẽ mất kết quả.');
    }
  }

  /* ---------- tiện ích ---------- */

  const $ = sel => app.querySelector(sel);
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  let toastTimer = 0;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
  }
  const gifts = () => Math.max(1, Number(state.settings.gifts) || 3);
  const girlIndex = id => state.roster.girls.findIndex(g => g.id === id);
  const girlById = id => state.roster && state.roster.girls.find(g => g.id === id);
  const boyName = id => (state.roster.boys.find(b => b.id === id) || {}).name || '?';
  const got = id => state.results[id] || [];
  const colorOf = id => AVATAR[girlIndex(id) % AVATAR.length];
  function initial(name) {
    const parts = name.split(' ');
    return parts[parts.length - 1].charAt(0).toUpperCase();
  }
  function resolved() {
    return L.resolvePresets(state.roster, state.presetsRaw, gifts());
  }
  function totals() {
    const total = state.roster.girls.length * gifts();
    const done = state.roster.girls.reduce((n, g) => n + Math.min(got(g.id).length, gifts()), 0);
    return { total, done };
  }
  function decodeText(buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { /* thử bảng mã khác */ }
    try { return new TextDecoder('windows-1258').decode(buf); } catch (e) { return new TextDecoder().decode(buf); }
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const hasPresets = raw => Object.values(raw || {}).some(list => list.some(Boolean));

  /* ---------- nhập dữ liệu ---------- */

  function importList(text, source, quiet) {
    const res = L.buildRoster(L.parseCSV(text));
    if (res.errors.length) { if (!quiet) toast('❌ ' + res.errors.join(' ')); return false; }
    const hasResults = state.roster && Object.values(state.results).some(a => a.length);
    if (hasResults && !quiet &&
        !confirm('Nhập danh sách mới sẽ XOÁ toàn bộ kết quả quay hiện tại. Tiếp tục?')) return false;
    state.roster = res.roster;
    state.source = source;
    state.rosterWarnings = res.warnings;
    state.results = {};
    state.history = [];
    if (hasPresets(res.presetsRaw)) { state.presetsRaw = res.presetsRaw; state.presetsSource = source; }
    saveState();
    if (!quiet) {
      toast(`✅ Đã nhập ${res.roster.girls.length} bạn nữ, ${res.roster.boys.length} bạn nam` +
        (res.warnings.length ? ` · ${res.warnings.length} cảnh báo` : ''));
    }
    return true;
  }

  async function fetchText(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return decodeText(await r.arrayBuffer());
  }

  async function readFile(file) {
    return decodeText(await file.arrayBuffer());
  }

  /* ---------- điều hướng ---------- */

  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    return { page: parts[0] || '', id: parts[1] };
  }

  function render() {
    if (wheel) { wheel.destroy(); wheel = null; }
    spinning = false;
    closeModal();
    const r = route();
    document.querySelectorAll('[data-nav]').forEach(a => {
      a.classList.toggle('active', a.dataset.nav === (r.page || 'home'));
    });
    document.getElementById('footClass').textContent = state.settings.className;
    window.scrollTo(0, 0);
    if (r.page === 'quan-tri') return renderAdmin();
    if (!state.roster) return renderSetup();
    if (r.page === 'quay' && girlById(r.id)) return renderSpin(r.id);
    if (r.page === 'ket-qua') return renderResults();
    renderHome();
  }

  /* ---------- trang: chưa có dữ liệu ---------- */

  function renderSetup() {
    app.innerHTML = `
      <section class="card setup pop-in">
        <div class="big-emoji">🎡</div>
        <h1>Chào mừng đến Vòng Quay May Mắn!</h1>
        <p>Chưa có danh sách lớp. Hãy chọn file danh sách (.csv) để bắt đầu nhé.</p>
        <label class="btn primary">📂 Chọn file danh sách
          <input type="file" id="listFile" accept=".csv,.txt,text/csv" hidden>
        </label>
        <p class="small">File cần có cột <b>Họ tên</b> và <b>Giới tính</b> (Nam/Nữ); cột <b>Chỉ định</b> là tuỳ chọn.</p>
      </section>`;
    $('#listFile').addEventListener('change', async e => {
      const f = e.target.files[0];
      if (f && importList(await readFile(f), f.name)) render();
    });
  }

  /* ---------- trang chủ: chọn bạn nữ ---------- */

  function giftIcons(n) {
    let s = '';
    for (let i = 0; i < gifts(); i++) s += `<span class="${i < n ? 'on' : 'off'}">🎁</span>`;
    return s;
  }

  function progressBar(done, total) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    return `<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="bar" style="width:${pct}%"></div>
      </div>
      <p class="progress-label"><b>${done}</b>/${total} món quà đã tìm được người tặng</p>`;
  }

  function renderHome() {
    const { done, total } = totals();
    const allDone = done >= total;
    app.innerHTML = `
      <section class="hero">
        <p class="eyebrow">${esc(state.settings.className)} · Mùa tặng quà 💝</p>
        <h1 class="title">Vòng Quay <span>May Mắn</span></h1>
        <p class="sub">Ai sẽ là người tặng quà cho bạn? Quay để biết ngay! ✨</p>
        ${progressBar(done, total)}
      </section>
      ${allDone ? `<div class="banner pop-in">🎉 Tất cả các bạn nữ đã tìm đủ người tặng quà! <a href="#/ket-qua">Xem bảng kết quả →</a></div>`
                : `<p class="hint">👇 Bạn nữ nào sẽ quay? Chạm vào tên của mình nhé!</p>`}
      <div class="girl-grid">
        ${state.roster.girls.map((g, i) => {
          const n = Math.min(got(g.id).length, gifts());
          const full = n >= gifts();
          return `<a class="girl-card ${full ? 'done' : ''}" href="#/quay/${g.id}" style="--c:${AVATAR[i % AVATAR.length]};--d:${i * 40}ms">
              <span class="avatar">${esc(initial(g.name))}</span>
              <span class="g-name">${esc(g.name)}</span>
              <span class="gifts">${giftIcons(n)}</span>
              <span class="status">${full ? 'Đã đủ quà 💖' : n ? `Đã quay ${n}/${gifts()}` : 'Chưa quay'}</span>
            </a>`;
        }).join('')}
      </div>`;
  }

  /* ---------- trang quay ---------- */

  function renderSpin(girlId) {
    const girl = girlById(girlId);
    const mine = got(girlId);
    const full = mine.length >= gifts();
    const avail = L.availableBoys(state.roster, state.results);
    const canSpin = !full && avail.length > 0;
    let slots = '';
    for (let k = 0; k < gifts(); k++) {
      const b = mine[k];
      const cls = b ? 'filled' : k === mine.length ? 'next' : 'empty';
      slots += `<li class="slot ${cls}"><span class="num">${k + 1}</span>
        <span class="who">${b ? esc(boyName(b)) : k === mine.length ? 'Lượt quay tiếp theo…' : '???'}</span>
        <span class="ico">${b ? '🎁' : '❔'}</span></li>`;
    }
    app.innerHTML = `
      <div class="spin-page">
        <aside class="spin-side card">
          <a class="back" href="#/">← Chọn bạn khác</a>
          <div class="girl-badge" style="--c:${colorOf(girlId)}">
            <span class="avatar">${esc(initial(girl.name))}</span>
            <div><small>Lượt quay của</small><b>${esc(girl.name)}</b></div>
          </div>
          <h3>Những người sẽ tặng quà cho bạn</h3>
          <ol class="slots">${slots}</ol>
          <p class="left-info">${full ? '💖 Bạn đã có đủ người tặng quà rồi!'
            : avail.length ? `Còn <b>${avail.length}</b> bạn nam trên vòng quay` : 'Hết bạn nam để quay rồi 😅'}</p>
        </aside>
        <div class="wheel-zone">
          <div class="wheel-wrap">
            <svg class="pointer" id="pointer" viewBox="0 0 60 80" aria-hidden="true">
              <defs><linearGradient id="pg" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stop-color="#ff4f8b"/><stop offset="1" stop-color="#d4145a"/></linearGradient></defs>
              <path d="M30 78 L6 26 A26 26 0 1 1 54 26 Z" fill="url(#pg)" stroke="#fff" stroke-width="4"/>
              <circle cx="30" cy="26" r="9" fill="#fff"/>
            </svg>
            <canvas id="wheel" aria-label="Vòng quay tên các bạn nam"></canvas>
            <button class="hub ${canSpin ? 'ready' : ''}" id="spinBtn" ${canSpin ? '' : 'disabled'}>
              ${full ? '💖<small>ĐỦ RỒI</small>' : 'QUAY'}
            </button>
          </div>
          <p class="wheel-hint">${canSpin ? 'Bấm <b>QUAY</b> ở giữa vòng (hoặc phím Space) 🍀' : ''}</p>
        </div>
      </div>`;
    wheel = new window.Wheel($('#wheel'));
    wheel.setItems(avail.map(b => b.name));
    if (canSpin) $('#spinBtn').addEventListener('click', () => doSpin(girlId));
  }

  let wiggleAt = 0;
  function wiggle() {
    const now = performance.now();
    if (now - wiggleAt < 40) return;
    wiggleAt = now;
    const p = document.getElementById('pointer');
    if (!p) return;
    p.classList.remove('tick');
    void p.getBoundingClientRect();
    p.classList.add('tick');
  }

  async function doSpin(girlId) {
    if (spinning || !wheel) return;
    Sound.audio && Sound.enabled && Sound.audio();
    const avail = L.availableBoys(state.roster, state.results);
    const pick = L.pickBoy(state.roster, resolved().presets, state.results, girlId, gifts());
    if (!pick) { toast('Không thể quay thêm được nữa.'); return; }
    const idx = avail.findIndex(b => b.id === pick.boyId);
    spinning = true;
    const btn = $('#spinBtn');
    btn.disabled = true;
    btn.classList.remove('ready');
    btn.classList.add('busy');
    // Lưu kết quả ngay khi bắt đầu quay: tải lại trang giữa chừng cũng không quay lại được.
    (state.results[girlId] = state.results[girlId] || []).push(pick.boyId);
    state.history.push({ girl: girlId, boy: pick.boyId, how: pick.how, at: Date.now() });
    saveState();
    const myWheel = wheel;
    await wheel.spinTo(idx, Math.max(2, Number(state.settings.spinSeconds) || 6) * 1000, () => {
      Sound.tick(); wiggle();
    });
    if (wheel !== myWheel) return;
    spinning = false;
    Sound.win();
    Confetti.burst();
    setTimeout(() => showWin(girlId, pick.boyId), 350);
  }

  function showWin(girlId, boyId) {
    const girl = girlById(girlId);
    const n = got(girlId).length;
    const more = n < gifts() && L.availableBoys(state.roster, state.results).length > 0;
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `
      <div class="modal pop-in" role="dialog" aria-modal="true" aria-labelledby="winTitle">
        <div class="modal-emoji">🎉</div>
        <p class="modal-kicker">Món quà thứ ${n}/${gifts()} của <b>${esc(girl.name)}</b></p>
        <h2 id="winTitle">sẽ do bạn này tặng:</h2>
        <div class="winner">${esc(boyName(boyId))}</div>
        <p class="modal-note">${more ? 'Quay tiếp để tìm người tặng quà tiếp theo nhé!' : '💖 Đã đủ người tặng quà rồi. Chúc bạn nhận quà vui vẻ!'}</p>
        <div class="modal-actions">
          ${more ? `<button class="btn primary" data-act="again">🎡 Quay tiếp (${n + 1}/${gifts()})</button>`
                 : `<a class="btn primary" href="#/ket-qua">🏆 Xem bảng kết quả</a>`}
          <a class="btn ghost" href="#/">🏠 Về trang chủ</a>
        </div>
      </div>`;
    document.body.appendChild(back);
    const again = back.querySelector('[data-act="again"]');
    if (again) { again.addEventListener('click', render); again.focus(); }
  }

  function closeModal() {
    document.querySelectorAll('.modal-back').forEach(m => m.remove());
  }

  /* ---------- bảng kết quả ---------- */

  function renderResults() {
    const { done, total } = totals();
    const avail = L.availableBoys(state.roster, state.results);
    app.innerHTML = `
      <section class="hero compact">
        <h1 class="title">🏆 Bảng <span>Kết Quả</span></h1>
        ${progressBar(done, total)}
      </section>
      <div class="result-grid">
        ${state.roster.girls.map((g, i) => {
          const mine = got(g.id);
          let items = '';
          for (let k = 0; k < gifts(); k++) {
            items += mine[k] ? `<li>🎁 ${esc(boyName(mine[k]))}</li>` : `<li class="wait">⏳ đang chờ quay…</li>`;
          }
          return `<article class="result-card" style="--c:${AVATAR[i % AVATAR.length]};--d:${i * 40}ms">
              <header><span class="avatar">${esc(initial(g.name))}</span><b>${esc(g.name)}</b></header>
              <ol>${items}</ol>
            </article>`;
        }).join('')}
      </div>
      <section class="card leftover">
        <h2>🙋‍♂️ Các bạn nam chưa được gọi tên (${avail.length})</h2>
        <div class="chips">${avail.map(b => `<span class="chip">${esc(b.name)}</span>`).join('') || '<em>Không còn ai.</em>'}</div>
      </section>`;
  }

  /* ---------- quản trị ---------- */

  function renderAdmin() {
    const s = state.settings;
    const r = state.roster;
    if (!r) {
      app.innerHTML = `<section class="card admin"><h1>⚙️ Quản trị</h1>
        <p>Chưa có danh sách lớp.</p>
        <label class="btn primary">📂 Nhập file danh sách (.csv)<input type="file" id="listFile" accept=".csv,.txt" hidden></label>
        </section>`;
      $('#listFile').addEventListener('change', onListFile);
      return;
    }
    const res = resolved();
    const warnings = [].concat(state.rosterWarnings || [], res.warnings, L.checkRoster(r, gifts()));
    const presetCount = Object.values(res.presets).reduce((n, p) => n + p.filter(Boolean).length, 0);

    let presetTable = '';
    if (showPresets) {
      const opts = r.boys.map(b => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('');
      presetTable = `<div class="table-wrap"><table class="ptable"><thead><tr><th>Bạn nữ</th>` +
        Array.from({ length: gifts() }, (_, k) => `<th>Lượt ${k + 1}</th>`).join('') + `</tr></thead><tbody>` +
        r.girls.map(g => {
          const raw = state.presetsRaw[g.name] || [];
          const mine = got(g.id);
          return `<tr><td>${esc(g.name)}</td>` + Array.from({ length: gifts() }, (_, k) => {
            const val = raw[k] || '';
            const doneMark = mine[k] ? `<small class="${res.presets[g.id] && res.presets[g.id][k] === mine[k] ? 'ok' : ''}">đã ra: ${esc(boyName(mine[k]))}</small>` : '';
            return `<td><select data-girl="${esc(g.name)}" data-k="${k}">
                <option value="">🎲 Ngẫu nhiên</option>${opts}</select>${doneMark}
                <span hidden data-val="${esc(val)}"></span></td>`;
          }).join('') + `</tr>`;
        }).join('') + `</tbody></table></div>`;
    }

    app.innerHTML = `
      <section class="admin">
        <h1 class="title small">⚙️ Quản trị</h1>
        <p class="admin-note">Trang dành cho người tổ chức — đừng cho các bạn xem nhé 🤫. Mọi dữ liệu chỉ lưu trong trình duyệt của máy này.</p>

        <div class="card">
          <h2>📋 Danh sách lớp</h2>
          <p><b>${r.girls.length}</b> bạn nữ · <b>${r.boys.length}</b> bạn nam · nguồn: <code>${esc(state.source)}</code></p>
          <details><summary>Xem danh sách bạn nữ</summary><p>${r.girls.map(g => esc(g.name)).join(', ')}</p></details>
          <div class="row">
            <label class="btn">📂 Nhập file danh sách khác<input type="file" id="listFile" accept=".csv,.txt" hidden></label>
            <button class="btn" id="reloadList">🔄 Tải lại từ ${esc(LIST_URL)}</button>
          </div>
          ${warnings.length ? `<ul class="warn">${warnings.map(w => `<li>⚠️ ${esc(w)}</li>`).join('')}</ul>` : '<p class="ok">✅ Không có cảnh báo.</p>'}
        </div>

        <div class="card">
          <h2>🎯 Chỉ định kết quả</h2>
          <p>Đang có <b>${presetCount}</b> lượt được chỉ định${state.presetsSource ? ` (nguồn: <code>${esc(state.presetsSource)}</code>)` : ''}.
             Lượt nào để “Ngẫu nhiên” sẽ quay ngẫu nhiên trong các bạn nam còn lại (không đụng tới người đã được chỉ định cho bạn khác).</p>
          <div class="row">
            <button class="btn primary" id="togglePresets">${showPresets ? '🙈 Ẩn bảng chỉ định' : '👀 Hiện bảng chỉ định'}</button>
            <button class="btn" id="exportPresets">⬇️ Tải file chi-dinh.dat</button>
            <label class="btn">📂 Nhập file chỉ định<input type="file" id="presetFile" accept=".dat,.csv,.txt" hidden></label>
            <button class="btn danger" id="clearPresets">🧹 Xoá hết chỉ định</button>
          </div>
          ${presetTable}
        </div>

        <div class="card">
          <h2>🛠 Cài đặt</h2>
          <form id="settingsForm" class="form">
            <label>Tên lớp <input name="className" value="${esc(s.className)}" maxlength="40"></label>
            <label>Số người tặng quà cho mỗi bạn nữ <input name="gifts" type="number" min="1" max="10" value="${gifts()}"></label>
            <label>Thời gian quay (giây) <input name="spinSeconds" type="number" min="2" max="15" value="${esc(s.spinSeconds)}"></label>
            <button class="btn primary" type="submit">💾 Lưu cài đặt</button>
          </form>
        </div>

        <div class="card">
          <h2>🏆 Kết quả đã quay</h2>
          <div class="table-wrap"><table class="rtable"><tbody>
            ${r.girls.map(g => {
              const mine = got(g.id);
              return `<tr><td><b>${esc(g.name)}</b></td>
                <td>${mine.map(id => esc(boyName(id))).join(', ') || '<em>chưa quay</em>'}</td>
                <td>${mine.length ? `<button class="btn tiny" data-undo="${g.id}">↩️ Xoá lượt cuối</button>` : ''}</td></tr>`;
            }).join('')}
          </tbody></table></div>
          <div class="row">
            <button class="btn" id="exportResults">⬇️ Xuất kết quả (CSV)</button>
            <button class="btn danger" id="clearResults">🗑 Xoá toàn bộ kết quả</button>
          </div>
        </div>

        <div class="card">
          <h2>🧨 Khôi phục</h2>
          <p>Xoá mọi dữ liệu đã lưu trên trình duyệt này (danh sách, chỉ định, kết quả, cài đặt).</p>
          <button class="btn danger" id="wipe">Xoá toàn bộ dữ liệu</button>
        </div>
      </section>`;

    $('#listFile').addEventListener('change', onListFile);
    $('#reloadList').addEventListener('click', async () => {
      try {
        if (importList(await fetchText(LIST_URL), LIST_URL)) render();
      } catch (e) { toast('❌ Không tải được ' + LIST_URL + ' (mở trang qua http/GitHub Pages, không mở trực tiếp file).'); }
    });
    $('#togglePresets').addEventListener('click', () => { showPresets = !showPresets; render(); });
    $('#exportPresets').addEventListener('click', () => {
      download('chi-dinh.dat', L.encodePresets(state.presetsRaw), 'text/plain');
    });
    $('#presetFile').addEventListener('change', async e => {
      const f = e.target.files[0];
      if (!f) return;
      const text = await readFile(f);
      try {
        let raw;
        if (text.trim().startsWith('VQMM1:')) raw = L.decodePresets(text);
        else {
          const b = L.buildRoster(L.parseCSV(text));
          if (b.errors.length) throw new Error(b.errors.join(' '));
          raw = b.presetsRaw;
        }
        state.presetsRaw = raw;
        state.presetsSource = f.name;
        saveState();
        toast('✅ Đã nhập chỉ định từ ' + f.name);
        render();
      } catch (err) { toast('❌ ' + err.message); }
    });
    $('#clearPresets').addEventListener('click', () => {
      if (!confirm('Xoá hết chỉ định? Mọi lượt quay sẽ là ngẫu nhiên.')) return;
      state.presetsRaw = {};
      state.presetsSource = 'local';
      saveState();
      render();
    });
    app.querySelectorAll('.ptable select').forEach(sel => {
      sel.value = sel.parentElement.querySelector('[data-val]').dataset.val;
      sel.addEventListener('change', () => {
        const name = sel.dataset.girl, k = Number(sel.dataset.k);
        const list = (state.presetsRaw[name] || []).slice();
        while (list.length <= k) list.push('');
        list[k] = sel.value;
        state.presetsRaw[name] = list;
        state.presetsSource = 'local';
        saveState();
        render();
      });
    });
    $('#settingsForm').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      state.settings.className = String(fd.get('className') || '').trim() || DEFAULT_SETTINGS.className;
      state.settings.gifts = Math.min(10, Math.max(1, parseInt(fd.get('gifts'), 10) || 3));
      state.settings.spinSeconds = Math.min(15, Math.max(2, Number(fd.get('spinSeconds')) || 6));
      saveState();
      toast('💾 Đã lưu cài đặt');
      render();
    });
    app.querySelectorAll('[data-undo]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.undo;
      const g = girlById(id);
      const list = got(id);
      if (!confirm(`Xoá lượt cuối của ${g.name} (${boyName(list[list.length - 1])})?`)) return;
      list.pop();
      saveState();
      render();
    }));
    $('#exportResults').addEventListener('click', () => {
      download('ket-qua-vong-quay.csv', '﻿' + L.resultsToCSV(r, state.results, gifts()), 'text/csv;charset=utf-8');
    });
    $('#clearResults').addEventListener('click', () => {
      if (!confirm('Xoá TOÀN BỘ kết quả đã quay? Không hoàn tác được.')) return;
      state.results = {};
      state.history = [];
      saveState();
      render();
    });
    $('#wipe').addEventListener('click', () => {
      if (!confirm('Xoá toàn bộ dữ liệu trên trình duyệt này?')) return;
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* bỏ qua */ }
      state = blankState();
      location.hash = '#/';
      boot();
    });
  }

  async function onListFile(e) {
    const f = e.target.files[0];
    if (f && importList(await readFile(f), f.name)) render();
  }

  /* ---------- khởi động ---------- */

  function applySound() {
    Sound.enabled = !!state.settings.sound;
    const b = document.getElementById('soundBtn');
    b.textContent = Sound.enabled ? '🔊' : '🔇';
    b.setAttribute('aria-pressed', String(Sound.enabled));
  }

  async function boot() {
    applySound();
    if (!state.roster) {
      try { importList(await fetchText(LIST_URL), LIST_URL, true); } catch (e) { /* mở trực tiếp file: nhập tay */ }
    } else if (state.source === LIST_URL) {
      // File danh sách trên web đã được sửa: chưa quay lượt nào thì tự cập nhật, có kết quả rồi thì chỉ báo.
      try {
        const text = await fetchText(LIST_URL);
        const fresh = L.buildRoster(L.parseCSV(text)).roster;
        if (fresh && JSON.stringify(fresh) !== JSON.stringify(state.roster)) {
          if (Object.values(state.results).some(a => a.length)) {
            toast('ℹ️ Danh sách lớp trên web đã thay đổi — vào Quản trị → “Tải lại” để cập nhật.');
          } else importList(text, LIST_URL, true);
        }
      } catch (e) { /* mất mạng: dùng danh sách đã lưu */ }
    }
    if (state.roster && state.presetsSource !== 'local' && !hasPresets(state.presetsRaw)) {
      try {
        state.presetsRaw = L.decodePresets(await fetchText(PRESET_URL));
        state.presetsSource = PRESET_URL;
        saveState();
      } catch (e) { /* không có file chỉ định: quay ngẫu nhiên */ }
    }
    render();
  }

  window.addEventListener('hashchange', render);
  document.getElementById('soundBtn').addEventListener('click', () => {
    state.settings.sound = !state.settings.sound;
    saveState();
    applySound();
  });
  document.getElementById('fsBtn').addEventListener('click', () => {
    const d = document;
    if (d.fullscreenElement) d.exitFullscreen && d.exitFullscreen();
    else d.documentElement.requestFullscreen && d.documentElement.requestFullscreen().catch(() => {});
  });
  // Bấm 3 lần liên tiếp vào logo để vào trang quản trị.
  document.getElementById('brand').addEventListener('click', e => {
    if (e.detail === 3) { e.preventDefault(); location.hash = '#/quan-tri'; }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !spinning) closeModal();
    if ((e.code === 'Space' || e.key === 'Enter') && route().page === 'quay' && !document.querySelector('.modal-back')) {
      const btn = document.getElementById('spinBtn');
      if (btn && !btn.disabled && document.activeElement === document.body) { e.preventDefault(); btn.click(); }
    }
  });

  boot();
})();
