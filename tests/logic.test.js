// Chạy: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../js/logic.js');

const csv = fs.readFileSync(path.join(__dirname, '..', 'data', 'danh-sach.csv'), 'utf8');

function seeded(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

test('danh sách lớp: 58 bạn, 13 nữ, 45 nam', () => {
  const r = L.buildRoster(L.parseCSV(csv));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.roster.girls.length, 13);
  assert.equal(r.roster.boys.length, 45);
});

test('CSV kiểu Excel: dấu chấm phẩy, BOM, tiêu đề có dấu, cột chỉ định', () => {
  const text = '﻿Họ và tên;Giới tính;Chỉ định\r\nAn;Nữ;"Bình | * | Cường"\r\nBình;Nam;\r\nCường;nam;\r\nDũng;NAM;\r\n';
  const r = L.buildRoster(L.parseCSV(text));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.presetsRaw, { An: ['Bình', '', 'Cường'] });
  const { presets, warnings } = L.resolvePresets(r.roster, r.presetsRaw, 3);
  assert.deepEqual(warnings, []);
  assert.deepEqual(presets, { g0: ['b0', null, 'b1'] });
});

test('chỉ định được ra đúng thứ tự, lượt ngẫu nhiên không lấy người đã giữ chỗ', () => {
  const r = L.buildRoster(L.parseCSV(csv)).roster;
  const raw = {
    'Trần Hà Châu': ['Lê Gia Bảo', '', 'Đặng Gia Bách'],
    'Chu Gia Hân': ['', 'Phan Trí Dũng']
  };
  const { presets, warnings } = L.resolvePresets(r, raw, 3);
  assert.deepEqual(warnings, []);
  const reservedIds = new Set(Object.values(presets).flat().filter(Boolean));
  for (let seed = 1; seed <= 200; seed++) {
    const rng = seeded(seed);
    const results = {};
    // quay theo thứ tự bạn nữ xen kẽ, mỗi bạn 3 lượt
    for (let round = 0; round < 3; round++) {
      for (const g of r.girls) {
        const p = L.pickBoy(r, presets, results, g.id, 3, rng);
        assert.ok(p);
        (results[g.id] = results[g.id] || []).push(p.boyId);
      }
    }
    const name = id => r.boys.find(b => b.id === id).name;
    const chau = r.girls.find(g => g.name === 'Trần Hà Châu').id;
    const han = r.girls.find(g => g.name === 'Chu Gia Hân').id;
    assert.equal(name(results[chau][0]), 'Lê Gia Bảo');
    assert.equal(name(results[chau][2]), 'Đặng Gia Bách');
    assert.equal(name(results[han][1]), 'Phan Trí Dũng');
    assert.ok(!reservedIds.has(results[chau][1]));
    assert.ok(!reservedIds.has(results[han][0]));
    const all = Object.values(results).flat();
    assert.equal(all.length, 39);
    assert.equal(new Set(all).size, 39, 'không bạn nam nào bị chọn 2 lần');
  }
});

test('không quay quá số lượt, chỉ định trùng/sai tên bị cảnh báo', () => {
  const r = L.buildRoster(L.parseCSV(csv)).roster;
  const { presets, warnings } = L.resolvePresets(r, {
    'Trần Hà Châu': ['Lê Gia Bảo'],
    'Chu Gia Hân': ['Lê Gia Bảo', 'Không Có Tên']
  }, 3);
  assert.equal(warnings.length, 2);
  assert.deepEqual(Object.keys(presets), ['g0']);
  const g = r.girls[0].id;
  const results = { [g]: ['b1', 'b2', 'b3'] };
  assert.equal(L.pickBoy(r, presets, results, g, 3), null);
});

test('mã hoá file chỉ định đi-về được, không lộ tên', () => {
  const raw = { 'Trần Hà Châu': ['Lê Gia Bảo', '', 'Đặng Gia Bách'] };
  const enc = L.encodePresets(raw);
  assert.ok(!enc.includes('Bảo') && !/Gia/.test(Buffer.from(enc.slice(6), 'base64').toString('latin1')));
  assert.deepEqual(L.decodePresets(enc), raw);
});
