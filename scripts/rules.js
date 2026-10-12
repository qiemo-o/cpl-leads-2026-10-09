// 清洗规则。只使用「这一行里面已经有的内容」，不用其它行投票猜州。
'use strict';
const path = require('path');

function loadZipState() {
  const candidates = [
    'zip-state',
    path.join(__dirname, '..', 'node_modules', 'zip-state'),
  ];
  for (const id of candidates) {
    try {
      const mod = require(id);
      return typeof mod === 'function' ? mod : (mod.default || mod);
    } catch (e) { /* next */ }
  }
  throw new Error('未找到 zip-state，请在技能目录执行 npm install');
}
const zipState = loadZipState();
function loadZipCodes() {
  const candidates = ['zipcodes', path.join(__dirname, '..', 'node_modules', 'zipcodes')];
  for (const id of candidates) {
    try { return require(id); } catch (e) { /* next */ }
  }
  throw new Error('未找到 zipcodes，请在技能目录执行 npm install');
}
const zipcodes = loadZipCodes();

const STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico',
  VI: 'Virgin Islands', GU: 'Guam', AS: 'American Samoa', MP: 'Northern Mariana Islands',
};
const FULL = {};
for (const [a, name] of Object.entries(STATES)) FULL[name.toLowerCase()] = a;

// 高置信别名。两位字母不做模糊匹配。
const ALIAS = {
  'washington dc': 'DC', 'washington d.c.': 'DC', 'washington d.c': 'DC', 'd.c.': 'DC', 'd.c': 'DC',
  'district of columbia': 'DC',
  'nueva jersey': 'NJ', 'pennsylvanie': 'PA', 'pensilvania': 'PA',
  'flórida': 'FL', 'florida': 'FL', 'fla': 'FL', 'fla.': 'FL',
  'ill': 'IL', 'ill.': 'IL',
  'mississsippi': 'MS', 'mississipi': 'MS',
  'calif': 'CA', 'calif.': 'CA',
  'tenn': 'TN', 'tenn.': 'TN',
  'mass': 'MA', 'mass.': 'MA',
  'conn': 'CT', 'conn.': 'CT',
  'mich': 'MI', 'mich.': 'MI',
  'minn': 'MN', 'minn.': 'MN',
  'ariz': 'AZ', 'ariz.': 'AZ',
  'okla': 'OK', 'okla.': 'OK',
  'wash': 'WA', 'wash.': 'WA',
  'ore': 'OR', 'ore.': 'OR',
  'wis': 'WI', 'wis.': 'WI',
  'kans': 'KS', 'kans.': 'KS',
  'nebr': 'NE', 'nebr.': 'NE',
};
const CA_PROV = {
  ab: 'AB', alberta: 'AB', bc: 'BC', 'british columbia': 'BC', mb: 'MB', manitoba: 'MB',
  nb: 'NB', 'new brunswick': 'NB', nl: 'NL', newfoundland: 'NL', ns: 'NS', 'nova scotia': 'NS',
  nt: 'NT', nu: 'NU', on: 'ON', ont: 'ON', ontario: 'ON', pe: 'PE', 'prince edward island': 'PE',
  qc: 'QC', quebec: 'QC', québec: 'QC', sk: 'SK', saskatchewan: 'SK', yt: 'YT', yukon: 'YT',
};
const MILITARY = new Set(['AA', 'AE', 'AP']);
const COUNTRY2 = new Set(['FR', 'MX', 'UK', 'DE', 'CN', 'JP', 'BR', 'IT', 'ES', 'AU', 'NL', 'BE', 'SE', 'NO', 'CH', 'AT', 'IE', 'PT', 'RU', 'PL', 'KR', 'HK', 'TW']);
const SUSPECT_DOMAIN = new Set([
  'gmail.con', 'gnail.com', 'gmal.com', 'gamil.com', 'gmial.com', 'gmai.com',
  'gmail.co', 'gmail.c', 'hotmail.co', 'hotmail.c', 'hotmal.com', 'hotmial.com', 'hotamil.com',
  'yahoo.c', 'yahooo.com', 'yaho.com', 'icloud.co', 'icloud.c', 'outlook.co', 'outlook.c',
  'outlok.com', 'hotnail.com',
]);
// 州全称同时也是常见城市名时，不把城市判成「只有州名」。
const CITY_SAME_AS_STATE_OK = new Set(['new york', 'washington']);

const HEADER = {
  firstname: 'first', first: 'first', fname: 'first', givenname: 'first',
  lastname: 'last', last: 'last', lname: 'last', surname: 'last', familyname: 'last',
  gender: 'gender', sex: 'gender',
  phone: 'phone', telephone: 'phone', tel: 'phone', mobile: 'phone', phonenumber: 'phone',
  states: 'state', state: 'state',
  city: 'city',
  zip: 'zip', zipcode: 'zip', postalcode: 'zip', postal: 'zip',
  address: 'address', addr: 'address', street: 'address', streetaddress: 'address',
  email: 'email', emailaddress: 'email', emai: 'email',
  名: 'first', 姓: 'last', 性别: 'gender', 电话号码: 'phone', 州缩写: 'state', 州: 'state',
  城市: 'city', 邮政编码: 'zip', 街道地址: 'address', 电子邮件地址: 'email', 整理说明: 'note',
};

function trim(v) {
  return String(v == null ? '' : v).replace(/[\u00a0\u200b]/g, ' ').trim();
}
function fold(s) {
  return trim(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ');
}
function compactHeader(h) {
  const raw = trim(h);
  if (HEADER[raw]) return HEADER[raw];
  const k = raw.toLowerCase().replace(/[\s_\-./]+/g, '');
  return HEADER[k] || '';
}
function canonRow(obj) {
  const out = { first: '', last: '', gender: '', phone: '', state: '', city: '', zip: '', address: '', email: '', note: '' };
  for (const [k, v] of Object.entries(obj || {})) {
    const slot = compactHeader(k);
    if (!slot) continue;
    if (!out[slot]) out[slot] = trim(v);
  }
  return out;
}
function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}
function isCountry(s) {
  return /^(us|usa|u\.s\.|u\.s\.a\.|united states|united states of america)$/i.test(fold(s).replace(/\./g, ''));
}
function isCaPostal(s) {
  return /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(trim(s));
}
function isZipShape(s) {
  const t = trim(s);
  return /^\d{5}$/.test(t) || /^\d{5}-\d{4}$/.test(t) || /^\d{9}$/.test(t);
}
function hasEmail(s) { return trim(s).includes('@'); }
function looksLikePlace(s) {
  const t = trim(s);
  if (t.length < 2 || !/[A-Za-z\u00C0-\u024f]/.test(t)) return false;
  if (hasEmail(t) || isCountry(t) || isZipShape(t)) return false;
  return true;
}
function canadaOf(s) {
  const k = fold(s).replace(/\./g, '');
  return CA_PROV[k] || '';
}
function militaryText(s) {
  return /armed forces|\bapo\b|\bfpo\b|\bdpo\b/i.test(trim(s));
}

function asState(raw) {
  const original = trim(raw);
  if (!original || isCountry(original)) return null;
  const dashed = original.match(/^([A-Za-z]{2})\s*[-/]\s+.+$/) || original.match(/^.+\s*[-/]\s*([A-Za-z]{2})\.?$/);
  if (dashed && STATES[dashed[1].toUpperCase()]) {
    return { abbr: dashed[1].toUpperCase(), note: '州名已校正' };
  }
  const dotted = original.replace(/[.．]/g, '').replace(/\s+/g, '');
  if (/^[A-Za-z]{2}$/.test(dotted) && STATES[dotted.toUpperCase()]) {
    const abbr = dotted.toUpperCase();
    const note = original.toUpperCase() === abbr ? '' : '州缩写已大写';
    return { abbr, note };
  }
  const key = fold(original);
  if (ALIAS[key] && STATES[ALIAS[key]]) {
    const abbr = ALIAS[key];
    const note = FULL[key] ? '州全称已转缩写' : '州名已校正';
    return { abbr, note };
  }
  if (FULL[key]) return { abbr: FULL[key], note: '州全称已转缩写' };
  if (canadaOf(original) || militaryText(original)) return null;
  if (key.length >= 6) {
    let best = null, hits = 0;
    for (const name of Object.keys(FULL)) {
      if (lev(key, name) === 1) { best = FULL[name]; hits++; }
    }
    if (hits === 1) return { abbr: best, note: '州名已校正' };
  }
  return null;
}
function zipRegion(zip) {
  const m = trim(zip).match(/^(\d{5})/);
  if (!m) return '';
  const r = zipState(m[1]);
  return r ? String(r).toUpperCase() : '';
}
function acceptable(abbr) { return !!(abbr && STATES[abbr] && !MILITARY.has(abbr)); }
function stateTypo(raw) {
  const key = fold(raw).replace(/[^a-z]/g, '');
  if (!/^[a-z]{4,}$/.test(key) || key !== fold(raw).replace(/\s+/g, '')) return null;
  let bestD = 99;
  const hits = [];
  for (const name of Object.keys(FULL)) {
    const d = lev(key, name);
    if (d < bestD && d <= 2) { bestD = d; hits.length = 0; hits.push(FULL[name]); }
    else if (d === bestD && d <= 2) hits.push(FULL[name]);
  }
  return hits.length === 1 ? { abbr: hits[0] } : null;
}
function zipCanReplaceState(state, city, fromZip) {
  const token = trim(state);
  if (!acceptable(fromZip) || !trim(city)) return false;
  if (!token || isCountry(token)) return true;
  if (fold(token) === fold(city)) return true;
  const typo = stateTypo(token);
  if (typo && typo.abbr === fromZip) return true;
  if (/^[A-Za-z]{2}$/.test(token)) {
    const up = token.toUpperCase();
    if (!MILITARY.has(up) && !COUNTRY2.has(up)) return true;
  }
  return false;
}

function finishPhone(d, note) {
  const area = d.slice(0, 3);
  const ex = d.slice(3, 6);
  const n11 = (x) => x[1] === '1' && x[2] === '1';
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(d) || n11(area) || n11(ex)) {
    return { unreliable: '电话不是有效的北美号码' };
  }
  return { phone: d, note };
}
function normPhone(raw) {
  const s = trim(raw);
  if (!s || s.includes('@')) return { incomplete: s.includes('@') ? '电话缺失（电话列里是邮箱）' : '电话为空' };
  const d = s.replace(/\D/g, '');
  const fancy = /[^\d]/.test(s);
  if (d.length === 10) return finishPhone(d, fancy ? '电话已去格式符号' : '');
  if (d.length === 11 && d[0] === '1') return finishPhone(d.slice(1), '电话已去国家码');
  if (d.length === 13 && d.startsWith('001')) return finishPhone(d.slice(3), '电话已去国际前缀');
  if (d.length < 10) return { incomplete: '电话号码不足10位' };
  return { unreliable: '电话位数异常无法安全整理（' + d.length + '位）' };
}
function normZip(raw) {
  const s = trim(raw);
  if (!s) return { incomplete: '邮编为空' };
  if (isCaPostal(s)) return { unreliable: '非美国地址（加拿大邮编）' };
  if (/^\d{5}$/.test(s) || /^\d{5}-\d{4}$/.test(s)) return { ok: s.length === 5 ? s : s };
  if (/^\d{9}$/.test(s)) return { ok: s.slice(0, 5) + '-' + s.slice(5), note: '邮编已格式化为ZIP+4' };
  if (/^\d{4}$/.test(s)) return { unreliable: '邮编仅4位，补零不一定正确' };
  if (/[A-Za-z]/.test(s)) return { unreliable: '邮编栏不是邮编: ' + s };
  return { unreliable: '邮编长度异常: ' + s };
}
function normEmail(raw) {
  const original = trim(raw);
  if (!original) return { incomplete: '邮箱为空' };
  let s = original.replace(/%40/gi, '@').replace(/^[<('"]+/, '').replace(/[<>)\]\s,;]+$/g, '');
  if (s.startsWith('@')) s = s.slice(1);
  const at = s.lastIndexOf('@');
  if (at >= 0) s = s.slice(0, at) + '@' + s.slice(at + 1).replace(/,/g, '.').toLowerCase();
  if (!s.includes('@')) {
    return isZipShape(original) ? { unreliable: '邮箱栏是邮编，列错位未能还原' } : { incomplete: '邮箱无效' };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return { unreliable: '邮箱格式异常', email: s };
  const domain = s.slice(s.lastIndexOf('@') + 1);
  const tld = domain.slice(domain.lastIndexOf('.') + 1);
  if (SUSPECT_DOMAIN.has(domain) || ['comm', 'con', 'cmo', 'nett'].includes(tld) || /\.[a-z]$/i.test(domain)) {
    return { unreliable: '邮箱域名疑似截断或拼写错误', email: s };
  }
  const changed = s.toLowerCase() !== original.toLowerCase();
  return { email: s, note: changed ? '邮箱已整理' : '' };
}
function normGender(raw) {
  const s = trim(raw).toLowerCase();
  if (!s) return { val: '' };
  if (s === 'male' || s === 'female') return { val: s };
  if (['m', 'man', 'boy'].includes(s)) return { val: 'male', note: '性别已规范' };
  if (['f', 'woman', 'girl'].includes(s)) return { val: 'female', note: '性别已规范' };
  return { val: '', unreliable: '性别无法识别: ' + trim(raw) };
}

function tidyName(s) {
  const before = trim(s);
  const value = before.replace(/&#0*39;|'|&#x0*27;|0*39;/gi, '').replace(/\s+/g, ' ').trim();
  return { value, note: value && value !== before ? '姓名已去掉错误编码' : '' };
}
function nameProblem(s, label) {
  const t = trim(s);
  if (!t) return '';
  if (t.includes('@')) return label + '是邮箱';
  if (!/[A-Za-z\u00C0-\u024f]/.test(t)) return label + '不是姓名';
  return '';
}
const STREET = /\b(st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|way|pl|place|ter|terrace|cir|circle|pkwy|parkway|hwy|highway|trl|trail|loop|run|path|pike|aly|alley|rte|route|xing|crossing|box)\b/i;
function addressProblem(address) {
  const s = trim(address);
  if (!s) return { incomplete: '地址缺失' };
  if (s.includes('@')) return { unreliable: '地址栏是邮箱' };
  if (!/[A-Za-z]/.test(s)) return { unreliable: '地址不像街道' };
  if (!/\d/.test(s) && !STREET.test(s)) return { unreliable: '地址不像街道' };
  return {};
}
function normCityKey(s) {
  let t = fold(s).replace(/\./g, '');
  t = t.replace(/\bbch\b/g, 'beach').replace(/\b(hts|hgts)\b/g, 'heights').replace(/\bflt\b/g, 'flintridge')
    .replace(/\b(spgs|sprgs)\b/g, 'springs').replace(/\bvlg\b/g, 'village').replace(/\bjct\b/g, 'junction')
    .replace(/\bft\b/g, 'fort').replace(/\bmt\b/g, 'mount').replace(/\bst\b/g, 'saint')
    .replace(/\bn\b/g, 'north').replace(/\bs\b/g, 'south').replace(/\be\b/g, 'east').replace(/\bw\b/g, 'west');
  return t.replace(/[^a-z0-9]/g, '');
}
function cityAgainstZip(city, zip) {
  const z5 = trim(zip).slice(0, 5);
  const info = zipcodes.lookup(z5);
  if (!info || !info.city) return { unknown: true };
  const key = normCityKey(city);
  const dbKey = normCityKey(info.city);
  if (!key) return { unknown: true };
  if (key === dbKey) {
    const compact = fold(city).replace(/[^a-z0-9]/g, '');
    const dbCompact = fold(info.city).replace(/[^a-z0-9]/g, '');
    if (compact !== dbCompact) return { ok: true, city: info.city, note: '城市已按邮编校正' };
    return { ok: true, city };
  }
  const d = lev(key, dbKey);
  const limit = key.length >= 8 ? 2 : 1;
  if (key.length >= 4 && d > 0 && d <= limit) return { ok: true, city: info.city, note: '城市已按邮编校正' };
  return { ok: false, primary: info.city };
}
function structuralFields(raw) {
  const src = canonRow(raw);
  let first = src.first, last = src.last, gender = src.gender, phone = src.phone;
  let state = src.state, city = src.city, zip = src.zip, address = src.address, email = src.email;
  const repairs = [];
  if (asState(city) && !isZipShape(zip) && isZipShape(email) && hasEmail(phone)) {
    state = city;
    city = zip;
    zip = email;
    email = phone;
    phone = '';
    repairs.push('列错位：州/城市/邮编/邮箱已按内容还原，原电话列是邮箱');
  } else if ((isCountry(state) || !trim(state)) && asState(city) && !isZipShape(zip) && looksLikePlace(zip)) {
    state = city;
    city = zip;
    zip = '';
    repairs.push('列错位：城市在邮编列、州名在城市列');
  } else if (asState(city) && looksLikePlace(state) && !asState(state) && !isCountry(state)) {
    const place = state;
    state = city;
    city = place;
    repairs.push('州与城市列对调');
  }
  return { first, last, gender, phone, state, city, zip, address, email, repairs, originalPhone: src.phone, note: src.note };
}

function assess(raw, priorNotes) {
  const repairs = [];
  const incomplete = [];
  const unreliable = [];
  const moved = structuralFields(raw);
  const originalPhone = moved.originalPhone;
  let first = moved.first, last = moved.last, gender = moved.gender, phone = moved.phone;
  let state = moved.state, city = moved.city, zip = moved.zip, address = moved.address, email = moved.email;
  if (priorNotes) repairs.push(...String(priorNotes).split(/[;；]\s*/).map(trim).filter(Boolean));
  else if (moved.note) repairs.push(...moved.note.split(/[;；]\s*/).map(trim).filter(Boolean));
  for (const note of moved.repairs) if (!repairs.includes(note)) repairs.push(note);

  const tn1 = tidyName(first);
  const tn2 = tidyName(last);
  first = tn1.value;
  last = tn2.value;
  if (tn1.note) repairs.push(tn1.note);
  if (tn2.note && tn2.note !== tn1.note) repairs.push(tn2.note);

  if (first && !last) {
    const m = first.match(/^([A-Za-z]{2,})[.'’·]([A-Za-z]{2,})$/);
    if (m) { first = m[1]; last = m[2]; repairs.push('姓名点号拆分'); }
  }

  let abbr = '';
  if (isCaPostal(zip)) {
    unreliable.push('非美国地址（加拿大邮编）');
  } else if (militaryText(state) || MILITARY.has(zipRegion(zip))) {
    unreliable.push('军事或海外军邮地址');
  } else {
    const known = STATES[trim(state).toUpperCase()] ? { abbr: trim(state).toUpperCase(), note: '' } : asState(state);
    if (known && acceptable(known.abbr)) {
      abbr = known.abbr;
      if (known.note && !repairs.includes(known.note)) repairs.push(known.note);
    } else if (canadaOf(state) && !zipRegion(zip)) {
      unreliable.push('非美国地址（加拿大省份 ' + canadaOf(state) + '）');
    } else if (isCountry(state) || !trim(state) || !known) {
      const fromZip = zipRegion(zip);
      if (zipCanReplaceState(state, city, fromZip)) {
        abbr = fromZip;
        const token = trim(state);
        const typo = stateTypo(token);
        repairs.push(!token || isCountry(token)
          ? '州由本行邮编还原'
          : (fold(token) === fold(city) ? '州栏重复了城市名，已按邮编改为' + fromZip
            : (typo ? '州名已校正' : '州栏无法识别（' + token + '），已按邮编改为' + fromZip)));
      } else if (MILITARY.has(fromZip)) {
        unreliable.push('军事或海外军邮地址');
      } else if (!trim(state) || isCountry(state)) {
        incomplete.push('州缺失');
      } else {
        unreliable.push('无法识别的州: ' + trim(state));
      }
    }
  }

  const ph = normPhone(phone);
  if (!trim(phone) && repairs.some((r) => r.includes('原电话列是邮箱'))) incomplete.push('电话缺失（列错位后无电话）');
  else if (ph.incomplete) incomplete.push(ph.incomplete);
  else if (ph.unreliable) unreliable.push(ph.unreliable);
  else if (ph.note) repairs.push(ph.note);

  let zipOk = '';
  if (!unreliable.includes('非美国地址（加拿大邮编）')) {
    const z = normZip(zip);
    if (z.incomplete) incomplete.push(z.incomplete);
    else if (z.unreliable) unreliable.push(z.unreliable);
    else { zipOk = z.ok; if (z.note) repairs.push(z.note); }
  }

  const em = normEmail(email);
  if (em.incomplete) incomplete.push(em.incomplete);
  else if (em.unreliable) unreliable.push(em.unreliable);
  else if (em.note) repairs.push(em.note);

  const addr = addressProblem(address);
  if (addr.incomplete) incomplete.push(addr.incomplete);
  else if (addr.unreliable) unreliable.push(addr.unreliable);

  if (abbr && trim(city)) {
    const re = new RegExp(',\\s*' + abbr + '\\.?\\s*$', 'i');
    if (re.test(city)) {
      city = city.replace(re, '').trim();
      repairs.push('城市已去掉州后缀');
    }
  }

  if (!trim(city)) incomplete.push('城市缺失');
  else if (abbr && asState(city) && asState(city).abbr === abbr) {
    const c = fold(city);
    const full = STATES[abbr].toLowerCase();
    if (!CITY_SAME_AS_STATE_OK.has(c) && (c === full || c === abbr.toLowerCase())) {
      incomplete.push('城市缺失');
      city = '';
    }
  }

  let stateZipOk = !abbr || !zipOk;
  if (abbr && zipOk) {
    const zs = zipRegion(zipOk);
    if (!zs) unreliable.push('邮编前缀无法对应州');
    else if (MILITARY.has(zs)) unreliable.push('军事或海外军邮地址');
    else if (zs !== abbr) unreliable.push('州与邮编不一致: 州' + abbr + '，邮编属于' + zs);
    else stateZipOk = true;
  }

  if (stateZipOk && trim(city) && zipOk) {
    const hit = cityAgainstZip(city, zipOk);
    if (hit.ok === false) repairs.push('城市不是邮编主城市（' + hit.primary + '），未改城市');
    else if (hit.ok && hit.city) {
      city = hit.city;
      if (hit.note) repairs.push(hit.note);
    }
  }

  const g = normGender(gender);
  if (g.unreliable) unreliable.push(g.unreliable);
  else if (g.note) repairs.push(g.note);

  if (!trim(first) && !trim(last)) incomplete.push('名和姓都缺失');
  else if (!trim(first)) incomplete.push('缺名');
  else if (!trim(last)) incomplete.push('缺姓');
  const np1 = nameProblem(first, '名');
  const np2 = nameProblem(last, '姓');
  if (np1) unreliable.push(np1);
  if (np2) unreliable.push(np2);

  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  return {
    first: trim(first), last: trim(last), gender: g.val || '',
    address: trim(address), city: trim(city), abbr, full: abbr ? STATES[abbr] : '',
    email: em.email || '', zip: zipOk, phoneRaw: originalPhone,
    phone: ph.phone || '',
    repairs: uniq(repairs), incomplete: uniq(incomplete), unreliable: uniq(unreliable),
  };
}

function classifyAll(items) {
  const seen = new Set();
  return items.map((item) => {
    const a = assess(item.fields);
    let bucket = a.incomplete.length ? '真的不全' : (a.unreliable.length ? '无法可靠整理' : '信息齐全');
    if (bucket === '信息齐全') {
      const key = a.phone + '|' + a.email.toLowerCase();
      if (seen.has(key)) {
        bucket = '无法可靠整理';
        a.unreliable.push('重复记录（电话+邮箱重复）');
      } else seen.add(key);
    }
    const zipDerived = a.repairs.some((n) => n.startsWith('州由本行邮编') || n.startsWith('州栏无法识别') || n.startsWith('州栏重复了城市名'));
    return Object.assign(a, { bucket, row: item.row, zipDerived });
  });
}

const TARGET = ['名', '姓', '街道地址', '城市', '州缩写', '电子邮件地址', '邮政编码', '电话号码', '性别', '州全称', '处理后电话号码', '国家', '数据来源', '备注'];

function toCleanRecord(a, source) {
  return {
    名: a.first, 姓: a.last, 街道地址: a.address, 城市: a.city, 州缩写: a.abbr,
    电子邮件地址: a.email, 邮政编码: a.zip, 电话号码: a.phoneRaw, 性别: a.gender,
    州全称: a.full, 处理后电话号码: a.phone, 国家: 'US', 数据来源: source, 备注: '', 整理说明: a.repairs.join('；'),
  };
}

module.exports = {
  STATES, TARGET, canonRow, assess, classifyAll, toCleanRecord, structuralFields, zipRegion, trim,
};
