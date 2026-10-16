/*
 * Logic thuần (không đụng tới giao diện) — chạy được cả trong trình duyệt lẫn Node (để kiểm thử).
 *
 * Mô hình dữ liệu:
 *   roster  = { girls: [{id, name}], boys: [{id, name}] }
 *   presetsRaw = { "<tên bạn nữ>": ["<tên bạn nam lượt 1>", "", "<lượt 3>"] }   ("" = ngẫu nhiên)
 *   presets = { girlId: [boyId | null, ...] }   (đã đối chiếu tên -> id)
 *   results = { girlId: [boyId, ...] }           (theo thứ tự đã quay)
 */
(function (root) {
  'use strict';

  function normName(s) {
    return String(s == null ? '' : s).normalize('NFC').replace(/\s+/g, ' ').trim();
  }
  function nameKey(s) {
    return normName(s).toLocaleLowerCase('vi');
  }
  function stripDiacritics(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  }
  function headerKey(s) {
    return stripDiacritics(normName(s)).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  /* ---------- CSV ---------- */

  function detectDelimiter(text) {
    const counts = { ',': 0, ';': 0, '\t': 0 };
    let quoted = false;
    for (const ch of text) {
      if (ch === '\n' || ch === '\r') { if (!quoted) break; }
      if (ch === '"') quoted = !quoted;
      else if (!quoted && ch in counts) counts[ch]++;
    }
    let best = ',';
    for (const d of [';', '\t']) if (counts[d] > counts[best]) best = d;
    return best;
  }

  function parseCSV(text) {
    text = String(text).replace(/^﻿/, '');
    const d = detectDelimiter(text);
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
        } else field += c;
      } else if (c === '"') quoted = true;
      else if (c === d) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(f => f.trim() !== ''));
  }

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /* ---------- Danh sách lớp ---------- */

  function parseGender(v) {
    const k = stripDiacritics(normName(v)).toLowerCase();
    if (['nu', 'f', 'female', 'gai', 'girl'].includes(k)) return 'F';
    if (['nam', 'm', 'male', 'trai', 'boy'].includes(k)) return 'M';
    return null;
  }

  function findColumns(header) {
    const h = header.map(headerKey);
    const find = keys => h.findIndex(c => keys.some(k => c === k || c.includes(k)));
    return {
      name: find(['ho_ten', 'hoten', 'ho_va_ten', 'name', 'ten']),
      gender: find(['gioi_tinh', 'gioitinh', 'gioi', 'gender', 'phai', 'sex']),
      preset: find(['chi_dinh', 'chidinh', 'preset'])
    };
  }

  /** rows (từ parseCSV) -> { roster, presetsRaw, errors, warnings } */
  function buildRoster(rows) {
    const errors = [], warnings = [];
    if (!rows.length) return { roster: null, presetsRaw: {}, errors: ['File trống.'], warnings };
    const cols = findColumns(rows[0]);
    if (cols.name < 0) errors.push('Không tìm thấy cột "Họ tên" ở dòng tiêu đề.');
    if (cols.gender < 0) errors.push('Không tìm thấy cột "Giới tính" (Nam/Nữ) ở dòng tiêu đề.');
    if (errors.length) return { roster: null, presetsRaw: {}, errors, warnings };

    const girls = [], boys = [], presetsRaw = {};
    const seen = new Map();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const name = normName(r[cols.name]);
      if (!name) continue;
      const g = parseGender(r[cols.gender]);
      if (!g) {
        warnings.push(`Dòng ${i + 1}: không rõ giới tính của "${name}" (ghi "Nam" hoặc "Nữ") — đã bỏ qua.`);
        continue;
      }
      const key = nameKey(name);
      if (seen.has(key)) warnings.push(`Dòng ${i + 1}: tên "${name}" bị trùng với dòng ${seen.get(key)}.`);
      else seen.set(key, i + 1);
      const presetCell = cols.preset >= 0 ? normName(r[cols.preset]) : '';
      if (g === 'F') {
        girls.push({ id: 'g' + girls.length, name });
        if (presetCell) {
          presetsRaw[name] = presetCell.split('|').map(p => {
            p = normName(p);
            return p === '*' || p === '?' ? '' : p;
          });
        }
      } else {
        boys.push({ id: 'b' + boys.length, name });
        if (presetCell) warnings.push(`Dòng ${i + 1}: cột "Chỉ định" chỉ dùng cho bạn nữ — đã bỏ qua với "${name}".`);
      }
    }
    if (!girls.length) errors.push('Danh sách không có bạn nữ nào.');
    if (!boys.length) errors.push('Danh sách không có bạn nam nào.');
    return { roster: errors.length ? null : { girls, boys }, presetsRaw, errors, warnings };
  }

  /** Đối chiếu tên trong presetsRaw sang id. Mỗi bạn nam chỉ được chỉ định cho 1 bạn nữ. */
  function resolvePresets(roster, presetsRaw, gifts) {
    const presets = {}, warnings = [];
    if (!roster) return { presets, warnings };
    const girlByKey = new Map(), boyByKey = new Map();
    roster.girls.forEach(g => { if (!girlByKey.has(nameKey(g.name))) girlByKey.set(nameKey(g.name), g); });
    roster.boys.forEach(b => { if (!boyByKey.has(nameKey(b.name))) boyByKey.set(nameKey(b.name), b); });
    const owner = new Map();
    for (const [girlName, list] of Object.entries(presetsRaw || {})) {
      const girl = girlByKey.get(nameKey(girlName));
      if (!girl) { warnings.push(`Chỉ định: không tìm thấy bạn nữ "${girlName}".`); continue; }
      if (list.length > gifts && list.slice(gifts).some(Boolean)) {
        warnings.push(`Chỉ định cho ${girl.name}: có ${list.length} lượt, nhưng mỗi bạn nữ chỉ quay ${gifts} lượt — phần dư bị bỏ qua.`);
      }
      const plan = list.slice(0, gifts).map(boyName => {
        if (!normName(boyName)) return null;
        const boy = boyByKey.get(nameKey(boyName));
        if (!boy) {
          warnings.push(`Chỉ định cho ${girl.name}: không tìm thấy bạn nam "${boyName}" — lượt đó sẽ quay ngẫu nhiên.`);
          return null;
        }
        if (owner.has(boy.id)) {
          warnings.push(`${boy.name} đã được chỉ định cho ${owner.get(boy.id)} — bỏ chỉ định trùng ở ${girl.name}.`);
          return null;
        }
        owner.set(boy.id, girl.name);
        return boy.id;
      });
      while (plan.length && plan[plan.length - 1] === null) plan.pop();
      if (plan.length) presets[girl.id] = plan;
    }
    return { presets, warnings };
  }

  function checkRoster(roster, gifts) {
    const warnings = [];
    if (!roster) return warnings;
    const need = roster.girls.length * gifts;
    if (need > roster.boys.length) {
      warnings.push(`Cần ${need} lượt quay (${roster.girls.length} bạn nữ × ${gifts}) nhưng chỉ có ${roster.boys.length} bạn nam — sẽ có bạn nữ không quay đủ.`);
    }
    return warnings;
  }

  /* ---------- Quay ---------- */

  function assignedSet(results) {
    const s = new Set();
    Object.values(results || {}).forEach(list => list.forEach(id => s.add(id)));
    return s;
  }

  function availableBoys(roster, results) {
    const taken = assignedSet(results);
    return roster.boys.filter(b => !taken.has(b.id));
  }

  /**
   * Chọn bạn nam cho lượt quay tiếp theo của girlId.
   *  - Lượt thứ k có chỉ định và bạn đó còn trống  -> ra đúng bạn đó.
   *  - Ngược lại -> ngẫu nhiên trong số bạn nam còn trống, tránh các bạn
   *    đang được "giữ chỗ" cho lượt chỉ định chưa quay (của mọi bạn nữ).
   * Trả về { boyId, how: 'preset' | 'random' } hoặc null nếu không quay được nữa.
   */
  function pickBoy(roster, presets, results, girlId, gifts, rng) {
    rng = rng || Math.random;
    const taken = assignedSet(results);
    const k = (results[girlId] || []).length;
    if (k >= gifts) return null;
    const avail = roster.boys.filter(b => !taken.has(b.id));
    if (!avail.length) return null;

    const want = (presets[girlId] || [])[k];
    if (want && !taken.has(want)) return { boyId: want, how: 'preset' };

    const reserved = new Set();
    for (const [gid, plan] of Object.entries(presets)) {
      const from = gid === girlId ? k + 1 : (results[gid] || []).length;
      for (let j = from; j < Math.min(plan.length, gifts); j++) {
        if (plan[j] && !taken.has(plan[j])) reserved.add(plan[j]);
      }
    }
    let pool = avail.filter(b => !reserved.has(b.id));
    if (!pool.length) pool = avail;
    return { boyId: pool[Math.floor(rng() * pool.length)].id, how: 'random' };
  }

  /* ---------- Xuất / mã hoá ---------- */

  function resultsToCSV(roster, results, gifts) {
    const boyName = id => (roster.boys.find(b => b.id === id) || {}).name || '';
    const head = ['STT', 'Bạn nữ'];
    for (let i = 1; i <= gifts; i++) head.push('Người tặng ' + i);
    const lines = [head.map(csvCell).join(',')];
    roster.girls.forEach((g, i) => {
      const got = results[g.id] || [];
      const row = [i + 1, g.name];
      for (let j = 0; j < gifts; j++) row.push(got[j] ? boyName(got[j]) : '');
      lines.push(row.map(csvCell).join(','));
    });
    return lines.join('\r\n') + '\r\n';
  }

  // Che mờ file chỉ định để không đọc lướt được khi đưa lên GitHub (không phải bảo mật thật sự).
  const MASK = 'vong-quay-may-man';
  function xorBytes(bytes) {
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ MASK.charCodeAt(i % MASK.length);
    return out;
  }
  function encodePresets(presetsRaw) {
    const bytes = xorBytes(new TextEncoder().encode(JSON.stringify(presetsRaw)));
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return 'VQMM1:' + btoa(bin);
  }
  function decodePresets(text) {
    text = String(text).trim();
    if (!text.startsWith('VQMM1:')) throw new Error('Không đúng định dạng file chỉ định.');
    const bin = atob(text.slice(6));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const obj = JSON.parse(new TextDecoder().decode(xorBytes(bytes)));
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('File chỉ định bị hỏng.');
    return obj;
  }

  const api = {
    normName, nameKey, parseCSV, buildRoster, resolvePresets, checkRoster,
    availableBoys, pickBoy, resultsToCSV, encodePresets, decodePresets
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof window !== 'undefined' ? window : globalThis);
