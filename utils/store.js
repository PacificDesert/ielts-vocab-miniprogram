const config = require('../config');
const cloud = require('./cloud');

const KEY = 'ielts_vocab_state';
const SYNC_KEY = 'ielts_vocab_lastsync';
const MASTER_LV = 3;
const PUSH_DELAY = 2000;   // 进度变化后延迟多久推送，避免连续操作打云函数

const state = {
  v: 1,
  plan: Object.assign({}, config.DEFAULT_PLAN),
  cursor: 0,
  spellCursor: 0,
  marks: {},
  days: {},
  profile: { avatar: '', nickname: '' },
  updated: 0
};

let syncTimer = null;
let syncPending = false;
let syncing = false;

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
  // 老版本没有 profile 字段，补上默认值，避免页面取到 undefined
  state.profile = Object.assign({ avatar: '', nickname: '' }, state.profile || {});
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
  const m = state.marks[k] || { lv: 0, t: 0 };
  m.lv = Math.max(0, Math.min(5, m.lv + delta));
  m.t = Date.now();
  state.marks[k] = m;
  scheduleSync();
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

/** 每组单词数（用户手动输入，只保底不限顶） */
function perRound() {
  const n = Number(state.plan.perRound);
  if (!n || isNaN(n)) return config.DEFAULT_PLAN.perRound;
  return clampPlan(n);
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

/**
 * 从指定下标开始取一批新词（拓展页跳「下一个单词」时用）。
 * 只按起点往后取，不推进全局游标，避免打断正常的顺序学习。
 */
function batchFrom(start, count) {
  const list = require('./word').all();
  if (!list.length) return [];
  const batch = [];
  const n = Math.min(count || perRound(), list.length);
  const begin = Math.max(0, Math.min(Number(start) || 0, list.length - 1));
  let i = begin;
  let guard = 0;
  while (batch.length < n && guard < list.length * 2) {
    guard += 1;
    if (i >= list.length) i = 0;
    const it = list[i];
    i += 1;
    if (!it.cn || status(it.w) >= 5) continue;
    batch.push(it);
  }
  return batch.length ? batch : [list[begin]];
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
  scheduleSync();
  return state.plan;
}

function setPerRound(n) {
  return setPlan({ perRound: n });
}

function toggleExpand(on) {
  return setPlan({ showExpand: !!on });
}

function toggleAutoSync(on) {
  return setPlan({ autoSync: !!on });
}

/** 有声模式 / 静音模式：true = 进入单词卡与翻背时自动发音 */
function toggleSound(on) {
  return setPlan({ sound: !!on });
}

/** 当前是否为有声模式（读不到就按默认值，默认开） */
function soundOn() {
  const v = state.plan.sound;
  return v === undefined ? !!config.DEFAULT_PLAN.sound : !!v;
}

/* ---------------- 头像昵称 ---------------- */

/** 头像与昵称。微信只允许用户主动点击按钮授权，所以这里只负责存取，不做获取。 */
function profile() {
  return state.profile || { avatar: '', nickname: '' };
}

/** 只更新传入的字段；头像换了要连带刷新 updated，云端才知道该用谁的 */
function setProfile(patch) {
  const next = Object.assign({}, profile(), patch || {});
  // 昵称限长，避免用户粘贴一整段进来撑破卡片
  next.nickname = String(next.nickname || '').slice(0, 20);
  state.profile = next;
  save();
  scheduleSync();
  return next;
}

/* ---------------- 多设备同步 ---------------- */

function lastSync() {
  return wx.getStorageSync(SYNC_KEY) || 0;
}

function markSynced() {
  const t = Date.now();
  wx.setStorageSync(SYNC_KEY, t);
  return t;
}

/**
 * 合并云端状态：按单词逐条取「修改时间较新」的一方，day 计数取最大值，
 * 学习游标取较大值，计划设置跟随整体更新时间较新的一方。
 * 这样两台设备各自背了一半的单词，合并后不会互相覆盖。
 */
function mergeRemote(remote) {
  if (!remote || typeof remote !== 'object') return false;
  let changed = false;

  const remoteMarks = remote.marks || {};
  Object.keys(remoteMarks).forEach(k => {
    const r = remoteMarks[k];
    const l = state.marks[k];
    if (!l || (r.t || 0) > (l.t || 0)) {
      state.marks[k] = { lv: r.lv || 0, t: r.t || 0 };
      changed = true;
    }
  });

  const remoteDays = remote.days || {};
  Object.keys(remoteDays).forEach(k => {
    const r = remoteDays[k] || {};
    const l = state.days[k];
    if (!l) {
      state.days[k] = { learn: r.learn || 0, spell: r.spell || 0, right: r.right || 0, wrong: r.wrong || 0 };
      changed = true;
      return;
    }
    ['learn', 'spell', 'right', 'wrong'].forEach(f => {
      if ((r[f] || 0) > (l[f] || 0)) {
        l[f] = r[f] || 0;
        changed = true;
      }
    });
  });

  if ((remote.cursor || 0) > (state.cursor || 0)) {
    state.cursor = remote.cursor;
    changed = true;
  }
  if ((remote.spellCursor || 0) > (state.spellCursor || 0)) {
    state.spellCursor = remote.spellCursor;
    changed = true;
  }
  if ((remote.updated || 0) > (state.updated || 0) && remote.plan) {
    state.plan = Object.assign({}, config.DEFAULT_PLAN, remote.plan, { autoSync: state.plan.autoSync });
    state.plan.perRound = clampPlan(state.plan.perRound);
    changed = true;
  }
  // 头像昵称跟随整体更新时间较新的一方，但空值不覆盖已有值
  const rp = remote.profile || {};
  if (rp.avatar && rp.avatar !== state.profile.avatar && (remote.updated || 0) > (state.updated || 0)) {
    state.profile.avatar = rp.avatar;
    changed = true;
  }
  if (rp.nickname && rp.nickname !== state.profile.nickname && (remote.updated || 0) > (state.updated || 0)) {
    state.profile.nickname = rp.nickname;
    changed = true;
  }
  return changed;
}

/** 双向同步：先拉取合并，再把合并结果推回云端 */
function sync() {
  if (!cloud.isReady()) return Promise.reject(new Error('cloud not ready'));
  if (syncing) {
    syncPending = true;
    return Promise.resolve(false);
  }
  syncing = true;
  return cloud.call('data', { action: 'load' })
    .then(res => {
      const changed = mergeRemote(res && res.state);
      state.updated = Date.now();
      wx.setStorageSync(KEY, state);
      return cloud.call('data', { action: 'save', payload: { state } }).then(() => changed);
    })
    .then(changed => {
      markSynced();
      syncing = false;
      if (syncPending) {
        syncPending = false;
        scheduleSync(0);
      }
      return changed;
    })
    .catch(err => {
      syncing = false;
      throw err;
    });
}

/** 进度变化后延迟推送，避免连点触发多次云函数调用 */
function scheduleSync(delay) {
  if (!cloud.isReady() || !state.plan.autoSync) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    sync().catch(() => {});
  }, typeof delay === 'number' ? delay : PUSH_DELAY);
}

/** 手动触发一次立即同步（忽略 autoSync 开关） */
function push() {
  save();
  if (!cloud.isReady()) return Promise.reject(new Error('cloud not ready'));
  return sync();
}

function pull() {
  return sync();
}

function reset() {
  state.marks = {};
  state.days = {};
  state.cursor = 0;
  state.spellCursor = 0;
  save();
  scheduleSync(0);
}

module.exports = {
  load, save, flush, get, today, day, status, stats, streak,
  markStudy, markSpell, nextLearnBatch, batchFrom, nextSpellBatch,
  setPlan, setPerRound, toggleExpand, toggleAutoSync, toggleSound, soundOn,
  perRound, clampPlan,
  profile, setProfile,
  sync, scheduleSync, lastSync,
  push, pull, reset, MASTER_LV
};
