/* 预览页冒烟测试：用最小 DOM 桩执行 preview/index.html 里的内联脚本，
   断言「选释义」新功能的渲染结果与翻面 / 翻页动画行为。
   跑法：node tools/_smoke.js   （检查完可删） */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'preview', 'index.html'), 'utf8');
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];

let pass = 0;
const fails = [];
function ok(name, cond, extra) {
  if (cond) { pass += 1; console.log('  ok   ' + name); }
  else { fails.push(name); console.log('  FAIL ' + name + (extra ? '  -> ' + extra : '')); }
}

/* 每个元素都记下 innerHTML，同时提供 classList / querySelector 等最小能力 */
function makeEl(tag) {
  const el = {
    tagName: tag || 'div',
    _html: '',
    style: {},
    dataset: {},
    children: [],
    textContent: '',
    scrollTop: 0,
    parentNode: null,
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); },
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    prepend(c) { c.parentNode = this; this.children.unshift(c); return c; },
    remove() { if (this.parentNode) { const i = this.parentNode.children.indexOf(this); if (i >= 0) this.parentNode.children.splice(i, 1); } },
    replaceChild(n, o) { const i = this.children.indexOf(o); if (i >= 0) this.children[i] = n; n.parentNode = this; return o; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    classListToggle() {},
    setAttribute() {},
    addEventListener() {}
  };
  el.classList.toggle = (c, on) => { if (on === undefined) { if (el.classList.contains(c)) el.classList.remove(c); else el.classList.add(c); } else if (on) el.classList.add(c); else el.classList.remove(c); };
  return el;
}

const screenEl = makeEl('div');
const navEl = makeEl('div');
const navTitle = makeEl('div');
const tabsEl = makeEl('div');
const wordsEl = makeEl('script');
const themeEl = makeEl('script');

/* 词库与章节配图从页面里的 <script id="words"> picker / <script id="theme"> 里读 */
const dataBlock = html.match(/<script id="words"[^>]*>([\s\S]*?)<\/script>/);
const themeBlock = html.match(/<script id="theme"[^>]*>([\s\S]*?)<\/script>/);
wordsEl.textContent = dataBlock ? dataBlock[1] : '{"chapters":[],"list":[]}';
themeEl.textContent = themeBlock ? themeBlock[1] : '{}';

const byId = {
  screen: screenEl, nav: navEl, navTitle: navTitle, tabs: tabsEl,
  tabbar: tabsEl, words: wordsEl, theme: themeEl,
  toast: makeEl('div'), phone: makeEl('div')
};
const document = {
  getElementById: id => byId[id] || null,
  createElement: makeEl,
  querySelector: () => null,
  querySelectorAll: () => [],
  body: makeEl('body'),
  documentElement: makeEl('html'),
  addEventListener() {}
};

const timers = [];
const sandbox = {
  document,
  console,
  window: { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {} },
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
  clearTimeout() {},
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { href: '', hash: '' },
  navigator: { userAgent: 'node' },
  Audio: function () { this.play = () => {}; this.pause = () => {}; this.addEventListener = () => {}; },
  alert() {}
};
sandbox.window.document = document;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
try {
  vm.runInContext(src, sandbox, { filename: 'preview-inline.js' });
} catch (e) {
  console.log('执行内联脚本失败：' + e.message);
  process.exit(1);
}

/* 让所有排队的 setTimeout 立即执行（模拟动画结束） */
function flushTimers() {
  let guard = 0;
  while (timers.length && guard < 50) {
    const t = timers.shift();
    t.fn();
    guard += 1;
  }
}

console.log('\n[1] 新功能所需的函数与样式');
ok('optionsFor 已定义', typeof sandbox.optionsFor === 'function');
ok('cnText 已定义', typeof sandbox.cnText === 'function');
ok('editDistance 已定义', typeof sandbox.editDistance === 'function');
ok('renderActions 已定义', typeof sandbox.renderActions === 'function');
ok('vStudy 已定义', typeof sandbox.vStudy === 'function');
ok('CSS .opts 存在', /\.opts\s*\{/.test(html));
ok('CSS .opt.ok 存在', /\.opt\.ok/.test(html));
ok('CSS .opt.bad 存在', /\.opt\.bad/.test(html));
ok('CSS .stage-ex-line 存在', /\.stage-ex-line\s*\{/.test(html));
ok('CSS 正面单词加黑', /\.flip-face \.stage-word\{font-weight:800\}/.test(html));
ok('旧的「轻触卡片查看释义」已移除', !/轻触卡片查看释义/.test(html));

console.log('\n[2] 选项生成：正确项唯一、共 4 个、互不重复');
/* WORDS / study 是脚本作用域里的 const，不在 sandbox 上；从 DATA 与 vStudy 的产物间接取 */
const words = JSON.parse(wordsEl.textContent).list;
const optionsFor = sandbox.optionsFor;
let bad = 0, dup = 0, noAns = 0, posNo = 0;
for (const it of words) {
  const o = optionsFor(it, 4);
  if (o.length !== 4 || o.filter(x => x.ok).length !== 1 || !o[0].ok) bad += 1;
  if (new Set(o.map(x => x.cn)).size !== 4) dup += 1;
  if (!/^(n|adj|adv|v|vt|vi|prep|conj|pron|num|int|art|aux|abbr)\.\s/.test(o[0].cn)) posNo += 1;
}
ok('全部 ' + words.length + ' 词结构正确', bad === 0, bad + ' 个异常');
ok('选项无重复', dup === 0, dup + ' 个重复');
const tagged = words.length - posNo;
ok('正确项带词性词数 >= 2000', tagged >= 2000, tagged + ' 个带词性');

console.log('\n[3] 记忆卡正面渲染');
const act = sandbox.act;
/* study / turn 是脚本作用域里的 let，不在 sandbox 上，用同 context 求值拿引用 */
const peek = expr => vm.runInContext('(' + expr + ')', sandbox);
const st = () => peek('study');
const getTurn = () => peek('turn');
const render2 = () => sandbox.render();
act('learn');
const shown = screenEl.innerHTML;
ok('渲染出四个选项卡', (shown.match(/class="opt /g) || []).length === 4,
  '实际 ' + (shown.match(/class="opt /g) || []).length + ' 个');
ok('正面含例句行', /class="stage-ex-line"/.test(shown) || !st().list[0].ex);
ok('例句有发音按钮', /class="ex-speak"/.test(shown) || !st().list[0].ex);
ok('未选答案时不给熟练度按钮', !/data-act="known"/.test(shown));
ok('未选答案时显示提示', /actions-hint/.test(shown));
ok('卡片不再整卡可点翻面', !/data-act="flip"/.test(shown));
ok('左上角第一个词无标记', !/class="stage-prev"/.test(shown) || st().idx > 0);
ok('选项卡描边不是 undefined', !/border-color:undefined/.test(shown));
ok('选项卡描边为合法颜色', /class="opt[^"]*"[^>]*border-color:rgba\(/.test(shown));

console.log('\n[4] 选对 → 翻到背面 → 放出按钮');
const opts = st().opts;
const rightIdx = opts.findIndex(o => o.ok);
/* 造一个假的元素，让就地改 class 有落点 */
const fakeOpt = makeEl('div');
screenEl.querySelector = sel => (sel.indexOf('.opt[data-i') === 0 ? fakeOpt : null);
const fakeBox = makeEl('div');
const origQS = screenEl.querySelector;
screenEl.querySelector = sel => (sel === '.flip-box' ? fakeBox : origQS(sel));
act('pick', { dataset: { i: String(rightIdx) } });
ok('正确项被标为 ok', st().opts[rightIdx].st === 'ok');
ok('study.picked 置为 true', st().picked === true);
ok('绿框已就地写入', fakeOpt.classList.contains('ok') && fakeOpt.style.borderColor === '#34C759');
ok('翻面立刻发生（0.4s 后）', timers.length > 0);
flushTimers();
ok('0.4s 后 flip-on 已加上', fakeBox.classList.contains('flip-on'));
ok('0.4s 后 study.show = true', st().show === true);

console.log('\n[5] 选错 → 标红且不翻面');
act('again');
const wrongIdx = st().opts.findIndex(o => !o.ok);
st().picked = false;
const fakeBad = makeEl('div');
screenEl.querySelector = sel => (sel.indexOf('.opt[data-i') === 0 ? fakeBad : null);
act('pick', { dataset: { i: String(wrongIdx) } });
ok('错误项被标为 bad', st().opts[wrongIdx].st === 'bad');
ok('红框已就地写入', fakeBad.classList.contains('bad') && fakeBad.style.borderColor === '#FF3B30');
ok('选错后 study.picked 仍为 false', st().picked === false);
ok('选错不触发翻面', timers.length === 0);
/* 选错后仍可继续选正确的 */
const rightIdx2 = st().opts.findIndex(o => o.ok);
const fakeOk2 = makeEl('div');
screenEl.querySelector = sel => (sel.indexOf('.opt[data-i') === 0 ? fakeOk2 : null);
act('pick', { dataset: { i: String(rightIdx2) } });
ok('选错后仍能选对', st().picked === true && st().opts[rightIdx2].st === 'ok');

console.log('\n[6] 认识 → 翻页并进入下一词，选项卡重置');
/* 关闭「认识后进拓展页」开关，才能停在记忆卡上观察换词行为 */
vm.runInContext('S.showExpand = false;', sandbox);
const before = st().idx;
const beforeWord = st().list[before].w;
const beforeOptsWord = st().optsWord;
act('known', {});
flushTimers();
ok('idx 前进一位', st().idx === before + 1 || st().done, 'idx=' + st().idx);
ok('已离开记忆卡前被清空旧选项', st().optsWord === '' || st().optsWord !== beforeOptsWord);
if (!st().done) {
  /* 停在记忆卡上时，下一次渲染会为新词重建选项卡 */
  render2();
  ok('新词的选项卡已重建', st().optsWord === st().list[st().idx].w,
    'optsWord=' + st().optsWord + ' 期望 ' + st().list[st().idx].w);
  ok('选项卡数量为 4', st().opts.length === 4, '实际 ' + st().opts.length);
  ok('新词 picked 已重置', st().picked === false);
  ok('新词选题不再是上一个词', st().optsWord !== beforeWord || st().list.length === 1);
}

console.log('\n[6b] 认识 + 开启拓展页 → 跳到拓展页（既有行为不回退）');
vm.runInContext('S.showExpand = true;', sandbox);
act('again');
flushTimers();
const idxB = st().idx;
act('known', {});
flushTimers();
ok('跳转到拓展页', peek('cur').screen === 'expand', 'screen=' + peek('cur').screen);
ok('idx 已推进', st().idx === idxB + 1);
ok('拓展页来源标记为 study', peek('cur').expandFrom === 'study');

console.log('\n[7] 拼写页与匹配页未被破坏');
ok('vSpell 仍可调用', typeof sandbox.vSpell === 'function');
ok('vMatch 仍可调用', typeof sandbox.vMatch === 'function');
ok('拼写页慢速翻页仍在', /out: *420, *in: *700/.test(html.replace(/\s+/g, ' ')) || /out:420,in:700/.test(html));

console.log('\n' + (fails.length ? fails.length + ' 项失败，' + pass + ' 项通过' : '全部 ' + pass + ' 项通过'));
process.exit(fails.length ? 1 : 0);
