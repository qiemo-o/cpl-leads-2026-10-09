'use strict';
const assert = require('assert');
const { assess, classifyAll, structuralFields } = require('./rules');

function row(p) {
  return {
    FirstName: p.first == null ? 'Ann' : p.first,
    LastName: p.last == null ? 'Lee' : p.last,
    Gender: p.gender == null ? 'female' : p.gender,
    Phone: p.phone == null ? '3175550100' : p.phone,
    States: p.state,
    City: p.city,
    ZIP: p.zip,
    Address: p.address || '100 Main St',
    Email: p.email || 'ann.lee@example.com',
  };
}
const cases = [
  {
    name: 'full state name and leading 1',
    raw: row({ state: 'Indiana', city: 'Noblesville', zip: '46062', phone: '13175550100' }),
    bucket: '信息齐全', abbr: 'IN', phone: '3175550100', note: '州全称已转缩写',
  },
  {
    name: 'city and state swapped',
    raw: row({ state: 'Denver', city: 'CO', zip: '80230', phone: '3035550100' }),
    bucket: '信息齐全', abbr: 'CO', city: 'Denver', note: '州与城市列对调',
  },
  {
    name: 'US placeholder filled from zip',
    raw: row({ state: 'US', city: 'Irvine', zip: '92617' }),
    bucket: '信息齐全', abbr: 'CA', note: '州由本行邮编还原',
  },
  {
    name: 'bad code replaced from zip',
    raw: row({ first: 'Alec', last: 'Knauss', state: 'MB', city: 'Louisville', zip: '40205', phone: '5024158655' }),
    bucket: '信息齐全', abbr: 'KY', note: '已按邮编改为KY',
  },
  {
    name: 'state and zip disagree',
    raw: row({ state: 'CA', city: 'Youngstown', zip: '44512' }),
    bucket: '无法可靠整理', reason: '州与邮编不一致',
  },
  {
    name: 'empty phone',
    raw: row({ state: 'CA', city: 'Irvine', zip: '92617', phone: '' }),
    bucket: '真的不全', reason: '电话为空',
  },
  {
    name: 'short phone',
    raw: row({ state: 'CA', city: 'Irvine', zip: '92617', phone: '949123' }),
    bucket: '真的不全', reason: '电话号码不足10位',
  },
  {
    name: 'glued phone not truncated',
    raw: row({ state: 'CO', city: 'Denver', zip: '80230', phone: '70359867467035986746' }),
    bucket: '无法可靠整理', reason: '电话位数异常',
  },
  {
    name: 'canadian postal',
    raw: row({ state: 'Ont', city: 'Erin', zip: 'N0B1T0', phone: '5198332383' }),
    bucket: '无法可靠整理', reason: '非美国地址',
  },
  {
    name: 'dotted name split',
    raw: row({ first: 'Isaac.Lee', last: '', state: 'CA', city: 'Glendale', zip: '91205' }),
    bucket: '信息齐全', first: 'Isaac', last: 'Lee', note: '姓名点号拆分',
  },
  {
    name: 'missing last name stays incomplete',
    raw: row({ first: 'Anna', last: '', state: 'CA', city: 'Glendale', zip: '91203' }),
    bucket: '真的不全', reason: '缺姓',
  },
  {
    name: 'email encoding',
    raw: row({ state: 'CA', city: 'Irvine', zip: '92617', email: 'ann%40example.com' }),
    bucket: '信息齐全', email: 'ann@example.com',
  },
  {
    name: 'shifted columns lose the phone',
    raw: row({
      state: 'US', city: 'Michigan', zip: 'Traverse City', phone: 'james@example.com', email: '49684',
    }),
    bucket: '真的不全', reason: '电话缺失', abbr: 'MI', city: 'Traverse City',
  },
  {
    name: 'foreign place is not rewritten from zip',
    raw: row({ state: 'Ecuador, Pichincha', city: 'Quito', zip: '40205', phone: '7035550199' }),
    bucket: '无法可靠整理', reason: '无法识别的州',
  },
  {
    name: 'near state spelling kept when zip agrees',
    raw: row({ state: 'Utha', city: 'Salt Lake City', zip: '84101', phone: '8015550100' }),
    bucket: '信息齐全', abbr: 'UT', note: '州名已校正',
  },
  {
    name: 'nanp rejects area code starting with 1',
    raw: row({ state: 'IA', city: 'Sioux City', zip: '51101', phone: '1712899501' }),
    bucket: '无法可靠整理', reason: '电话不是有效的北美号码',
  },
  {
    name: 'city state suffix stripped',
    raw: row({ state: 'US', city: 'Hilo, HI', zip: '96720', phone: '8085550100' }),
    bucket: '信息齐全', city: 'Hilo', abbr: 'HI', note: '城市已去掉州后缀',
  },
  {
    name: 'email typo domain',
    raw: row({ state: 'CA', city: 'Irvine', zip: '92617', email: 'a@gamil.com', phone: '9495550100' }),
    bucket: '无法可靠整理', reason: '邮箱域名疑似截断或拼写错误',
  },
  {
    name: 'name field is an email',
    raw: row({ first: 'Romandm07@Hotmail.Co', last: 'Garcia', state: 'CA', city: 'Irvine', zip: '92617', phone: '9495550101' }),
    bucket: '无法可靠整理', reason: '名是邮箱',
  },
  {
    name: 'numeric last name',
    raw: row({ last: '76', state: 'CA', city: 'Irvine', zip: '92617', phone: '9495550102' }),
    bucket: '无法可靠整理', reason: '姓不是姓名',
  },
  {
    name: 'broken apostrophe entity',
    raw: row({ last: '039;Dowd', state: 'CA', city: 'Irvine', zip: '92617', phone: '9495550103' }),
    bucket: '信息齐全', last: 'Dowd', note: '姓名已去掉错误编码',
  },
  {
    name: 'address is an email',
    raw: row({ address: 'craig_shrt@yahoo.com', state: 'IL', city: 'Chicago', zip: '60601', phone: '3125550100' }),
    bucket: '无法可靠整理', reason: '地址栏是邮箱',
  },
  {
    name: 'city not the zip primary city is still usable',
    raw: row({ state: 'IL', city: 'Berwyn', zip: '60018', phone: '8475550100' }),
    bucket: '信息齐全', note: '城市不是邮编主城市',
  },
  {
    name: 'city typo corrected from zip',
    raw: row({ state: 'TX', city: 'Conoe', zip: '77306', phone: '9365550100' }),
    bucket: '信息齐全', city: 'Conroe', note: '城市已按邮编校正',
  },
];

let failed = 0;
cases.forEach((c) => {
  const a = assess(c.raw);
  const bucket = a.incomplete.length ? '真的不全' : (a.unreliable.length ? '无法可靠整理' : '信息齐全');
  const reasons = a.incomplete.concat(a.unreliable, a.repairs).join(' | ');
  try {
    assert.strictEqual(bucket, c.bucket, c.name + ' bucket ' + bucket + ' :: ' + reasons);
    if (c.abbr) assert.strictEqual(a.abbr, c.abbr, c.name + ' state');
    if (c.phone) assert.strictEqual(a.phone, c.phone, c.name + ' phone');
    if (c.city) assert.strictEqual(a.city, c.city, c.name + ' city');
    if (c.first) assert.strictEqual(a.first, c.first, c.name);
    if (c.last) assert.strictEqual(a.last, c.last, c.name);
    if (c.email) assert.strictEqual(a.email, c.email, c.name);
    if (c.note) assert.ok(a.repairs.some((n) => n.includes(c.note)) || reasons.includes(c.note), c.name + ' missing ' + c.note + ' in ' + reasons);
    if (c.reason) assert.ok(reasons.includes(c.reason), c.name + ' missing ' + c.reason + ' in ' + reasons);
    console.log('ok', c.name);
  } catch (e) {
    failed++;
    console.error('FAIL', e.message);
  }
});

const dup = classifyAll([
  { row: 2, fields: row({ state: 'NY', city: 'Buffalo', zip: '14201', email: 'same@example.com', phone: '7165550100' }) },
  { row: 3, fields: row({ state: 'NY', city: 'Buffalo', zip: '14201', email: 'same@example.com', phone: '17165550100' }) },
]);
try {
  assert.strictEqual(dup[0].bucket, '信息齐全');
  assert.strictEqual(dup[1].bucket, '无法可靠整理');
  assert.ok(dup[1].unreliable.some((r) => r.includes('重复')));
  console.log('ok duplicate');
} catch (e) {
  failed++;
  console.error('FAIL', e.message);
}
const rawSwap = row({ state: 'Denver', city: 'CO', zip: '80230', phone: '3035550199', email: 'swap@example.com' });
const once = assess(rawSwap);
const moved = structuralFields(rawSwap);
const twice = assess({
  'First name': moved.first, 'Last name': moved.last, Gender: moved.gender, Phone: moved.phone,
  States: moved.state, City: moved.city, ZIP: moved.zip, Address: moved.address, Email: moved.email,
  整理说明: moved.repairs.join('；'),
});
try {
  assert.strictEqual(twice.abbr, once.abbr);
  assert.strictEqual(twice.city, once.city);
  assert.strictEqual(twice.phone, once.phone);
  assert.strictEqual(twice.incomplete.join('|'), once.incomplete.join('|'));
  assert.strictEqual(twice.unreliable.join('|'), once.unreliable.join('|'));
  console.log('ok pre_normalize then clean');
} catch (e) {
  failed++;
  console.error('FAIL', e.message);
}
if (failed) process.exit(1);
console.log('self_check passed');
