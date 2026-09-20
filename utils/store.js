const config = require('../config');
const cloud = require('./cloud');

const KEY = 'ielts_vocab_state';
const MASTER_LV = 3;

const state = {
  v: 1,
  plan: Object.assign({}, config.DEFAULT_PLAN),
  cursor: 0,
  spellCursor: 0,
  marks: {},
  days: {},
  updated: 0
};

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function load() {
  const cached = wx.getStorageSync(KEY);
  if (cached && typeof cached === 'object') {
    Object.assign(state, cached);
  }
  // 兼容旧版本的分字段计划（newPerDay / spellPerDay）→ perRound
  const old = state.plan || {};
  state.plan = Object.assign({}, config.DEFAULT_PLAN, old);
  if (!old.perRound && (old.newPerDay || old.spellPerDay)) {
    state.plan.perRound = old.newPerDay || old.spellPerDay;
  }
  delete state.plan.newPerDay;
  delete state.plan.spellPerDay;
  state.plan.perRound = clampPlan(state.plan.perRound);
  return state;
}

function clampPlan(n) {
  const v = Math.round(Number(n));
  if (!v || isNaN(v)) return config.DEFAULT_PLAN.perRound;
  // 只保底不限顶：上限由词库总量自然封顶
  return Math.max(config.PLAN_MIN, v);
}

function save() {
  state.updated = Date.now();
  wx.setStorageSync(KEY, state);
}

function flush() { save(); }

function get() { return state; }

function day() {
  const k = today();
  if (!state.days[k]) state.days[k] = { learn: 0, spell: 0, right: 0, wrong: 0 };
  return state.days[k];
}

function mark(word, delta, ok) {
  const k = String(word).toLowerCase();
  const m = state.marks[k] || { lv: 0, r: 0, w: 0, t: 0 };
  m.lv = Math.max(0, Math.min(5, m.lv + delta));
  if (ok) m.r += 1; else m.w += 1;
  m.t = Date.now();
  state.marks[k] = m;
}

/** 记忆卡：认识 +1 级，不认识清零 */
function markStudy(word, known) {
  mark(word, known ? 1 : -5, known);
  day().learn += 1;
}

/** 拼写自测 */
function markSpell(word, right) {
  mark(word, right ? 1 : -2, right);
  const d = day();
  d.spell += 1;
  if (right) d.right += 1; else d.wrong += 1;
}

function status(word) {
  const m = state.marks[String(word).toLowerCase()];
  if (!m) return 0;
  return m.lv;
}

/** 每组单词数（用户自定义，越界会被夹到合法范围） */
function perRound() {
  const n = Number(state.plan.perRound);
  if (!n || isNaN(n)) return config.DEFAULT_PLAN.perRound;
  return Math.max(config.PLAN_MIN, Math.min(config.PLAN_MAX, Math.round(n)));
}

/** 取下一批新词 */
function nextLearnBatch(count) {
  const list = require('./word').all();
  const batch = [];
  const n = Math.min(count || perRound(), list.length);
  let guard = 0;
  while (batch.length < n && guard < list.length * 2) {
    guard += 1;
    if (state.cursor >= list.length) state.cursor = 0;
    const it = list[state.cursor];
    state.cursor += 1;
    if (!it.cn || status(it.w) >= 5) continue;
    batch.push(it);
  }
  return batch;
}

/** 取下一批拼写题：优先取已学过但未掌握的词 */
function nextSpellBatch(count) {
  const list = require('./word').all().filter(it => it.cn);
  const learned = list.filter(it => {
    const lv = status(it.w);
    return lv > 0 && lv < 5;
  });
  const n0 = count || perRound();
  const pool = learned.length >= n0 ? learned : list;
  const batch = [];
  const n = Math.min(n0, pool.length);
  while (batch.length < n) {
    if (state.spellCursor >= pool.length) state.spellCursor = 0;
    batch.push(pool[state.spellCursor]);
    state.spellCursor += 1;
  }
  return batch;
}

function stats() {
  const list = require('./word').all();
  let learned = 0, mastered = 0;
  list.forEach(it => {
    const lv = status(it.w);
    if (lv > 0) learned += 1;
    if (lv >= MASTER_LV) mastered += 1;
  });
  let right = 0, wrong = 0;
  Object.keys(state.days).forEach(k => {
    right += state.days[k].right || 0;
    wrong += state.days[k].wrong || 0;
  });
  const total = right + wrong;
  return {
    learned,
    mastered,
    total: list.length,
    percent: list.length ? Math.round(learned / list.length * 1000) / 10 : 0,
    accuracy: total ? Math.round(right / total * 100) : 0,
    streak: streak()
  };
}

function streak() {
  let n = 0;
  const d = new Date();
  for (;;) {
    const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const rec = state.days[k];
    if (!rec || (!rec.learn && !rec.spell)) break;
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

function setPlan(patch) {
  Object.assign(state.plan, patch);
  state.plan.perRound = clampPlan(state.plan.perRound);
  save();
  return state.plan;
}

function setPerRound(n) {
  return setPlan({ perRound: n });
}

function toggleExpand(on) {
  return setPlan({ showExpand: !!on });
}

/** 云端同步 */
function push() {
  save();
  return cloud.call('data', { action: 'save', payload: { state } });
}

function pull() {
  return cloud.call('data', { action: 'load' }).then(res => {
    const remote = res && res.state;
    if (remote && (remote.updated || 0) > (state.updated || 0)) {
      Object.assign(state, remote);
      wx.setStorageSync(KEY, state);
      return true;
    }
    return false;
  });
}

function reset() {
  state.marks = {};
  state.days = {};
  state.cursor = 0;
  state.spellCursor = 0;
  save();
}

module.exports = {
  load, save, flush, get, today, day, status, stats, streak,
  markStudy, markSpell, nextLearnBatch, nextSpellBatch,
  setPlan, setPerRound, toggleExpand, perRound, clampPlan,
  push, pull, reset, MASTER_LV
};
