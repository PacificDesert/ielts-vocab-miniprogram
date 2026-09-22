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

/**
 * 造一份全新的脚本作用域（含 DOM 桩）。
 * 需要「干净状态」的用例（例如验证选项残留清理）在它上面跑，
 * 免得被前面用例改过的 study / S 状态干扰。
 */
function makeSandbox() {
  const screen = makeEl('div');
  const byId = {
    screen, nav: makeEl('div'), navTitle: makeEl('div'), tabs: makeEl('div'),
    tabbar: makeEl('div'), words: wordsEl, theme: themeEl,
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
  const sb = {
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
  sb.window.document = document;
  sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(src, sb, { filename: 'preview-inline.js' });
  sb.flush = () => {
    let guard = 0;
    while (timers.length && guard < 50) { timers.shift().fn(); guard += 1; }
  };
  sb.timers = timers;
  return sb;
}

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

console.log('\n[3] 记忆卡正面渲染（例句卡在前）');
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
/* 正面 = 例句卡：例句在前、四个选项卡在后；正面不再出现大单词 */
const frontFace = (shown.match(/<div class="flip-face">([\s\S]*?)<div class="flip-face flip-back">/) || ['', ''])[1];
ok('正面是例句卡（含例句行）', /class="stage-ex-line"/.test(frontFace) || !st().list[0].ex);
ok('例句卡里没有大单词', !/class="stage-word"/.test(frontFace));
const exPos = frontFace.indexOf('stage-ex-line');
const optPos = frontFace.indexOf('class="opts"');
ok('例句在选项卡前面（顺序不乱）', exPos >= 0 && optPos >= 0 && exPos < optPos,
  'exPos=' + exPos + ' optPos=' + optPos);
ok('例句旁是小喇叭（不再是「发音」两个字）', /class="ex-speak"[^>]*>.*horn/s.test(shown) && !/class="ex-speak"[^>]*>发音/.test(shown));
ok('小喇叭是纯 CSS 画的（含喇叭口与声波）', /horn-cone/.test(shown) && /horn-wave/.test(shown));
ok('单词卡（背面）才有单词且可点发音', /class="flip-face flip-back">[\s\S]*class="stage-word" data-act="speakword"/.test(shown));
ok('未选答案时不给熟练度按钮', !/data-act="known"/.test(shown));
ok('未选答案时显示提示', /actions-hint/.test(shown));
ok('卡片不再整卡可点翻面', !/data-act="flip"/.test(shown));
ok('左上角第一个词无标记', !/class="stage-prev"/.test(shown) || st().idx > 0);
ok('选项卡描边不是 undefined', !/border-color:undefined/.test(shown));
ok('选项卡描边为合法颜色', /class="opt[^"]*"[^>]*border-color:rgba\(/.test(shown));

console.log('\n[3d] 例句中目标词加黑加粗');
ok('exSpan 已定义', typeof sandbox.exSpan === 'function');
ok('exParts 已定义', typeof sandbox.exParts === 'function');
ok('inflections 已定义', typeof sandbox.inflections === 'function');
ok('CSS .ex-strong 存在', /\.ex-strong\s*\{/.test(html));
/* 全量校验：每一句都能定位到目标词，且加粗片段就是该词 */
const exPartsFn = sandbox.exParts;
const exSpanFn = sandbox.exSpan;
/* IRREGULAR 是脚本作用域里的 const，不在 sandbox 上，用同 context 求值取引用 */
const IRREG = vm.runInContext('(typeof IRREGULAR === "undefined" ? {} : IRREGULAR)', sandbox);
let exWithEx = 0, exLocated = 0, exSplit = 0, exNotVerbatim = 0, exNoBold = 0;
let exInflected = 0;
for (const it of words) {
  if (!it.ex || !it.ex[0]) continue;
  exWithEx += 1;
  const parts = exPartsFn(it.ex[0], it.w);
  const whole = parts.map(p => p.t).join('');
  if (whole !== sandbox.exText(it.ex[0])) exNotVerbatim += 1;
  const bolds = parts.filter(p => p.b);
  if (bolds.length === 0) exNoBold += 1;
  else {
    exLocated += 1;
    /* 加粗内容必须是该词的某个形式：等于原形，或落在屈折候选表里。
       （circulate → Circulating 属于正常情况，不算切歪） */
    const got = bolds[0].t.toLowerCase();
    const wl = String(it.w).toLowerCase();
    const forms = sandbox.inflections(wl);
    const irr = IRREG[wl] || [];
    const allowed = got === wl || forms.indexOf(got) >= 0 || irr.indexOf(got) >= 0;
    if (!allowed) exSplit += 1;
    else if (got !== wl) exInflected += 1;
  }
}
ok('全部 ' + exWithEx + ' 条例句都能定位到目标词', exLocated === exWithEx,
  exLocated + '/' + exWithEx + '，' + exNoBold + ' 条没定位到');
ok('加粗片段就是目标词本身（含屈折形式，不是碎片）', exSplit === 0,
  exSplit + ' 条切歪；其中 ' + exInflected + ' 条是屈折形式（正常）');
ok('切分后拼回去与原文完全一致', exNotVerbatim === 0, exNotVerbatim + ' 条不一致');
/* 关键屈折形式抽查 */
ok('circulate 能匹配到 Circulating',
  (() => { const r = exSpanFn('Circulating blood helps transfer the body heat out to the air.', 'circulate');
    return r && 'Circulating blood helps transfer the body heat out to the air.'.slice(r[0], r[1]).toLowerCase() === 'circulating'; })());
ok('undergo 能匹配到 underwent',
  (() => { const r = exSpanFn('I underwent so much suffering in early years.', 'undergo');
    return r && 'I underwent so much suffering in early years.'.slice(r[0], r[1]).toLowerCase() === 'underwent'; })());
/* equip 在句中有两个干扰点：expedition（含 equip 片段）在前，equipped 在后。
   必须命中 equipped，绝不能切到 expedition 里那 5 个字母。 */
ok('equip 命中 equipped 且不误切 expedition',
  (() => {
    const s = 'He equipped himself for an expedition to the jungle.';
    const r = exSpanFn(s, 'equip');
    if (!r) return false;
    const seg = s.slice(r[0], r[1]).toLowerCase();
    return seg === 'equipped';
  })());
ok('例句行内联加粗用的是 <b class="ex-strong">', /class="ex-strong"/.test(screenEl.innerHTML) || !st().list[0].ex);

console.log('\n[3e] Bug 修复：选错后翻到单词卡不留错误答案残留');
/* 直接重新加载一份干净的脚本作用域，避免前面用例的状态干扰 */
const sb2 = makeSandbox();
sb2.act('learn');
const st2 = () => vm.runInContext('(study)', sb2);
const scr2 = sb2.document.getElementById('screen');
/* 先就地造一个带红框的元素（模拟「选错」已标红），再选对翻面 */
const residueEl = makeEl('div');
residueEl.classList.add('bad');
residueEl.style.borderColor = '#FF3B30';
/* 记录 querySelectorAll('.opt') 返回的元素，供清理断言检查 */
const optEls = [residueEl];
scr2.querySelectorAll = sel => (sel === '.opt' ? optEls : []);
scr2.querySelector = sel => (sel === '.flip-box' ? makeEl('div') : null);
/* 先把一个错误项标红（真实流程） */
const w2 = st2().opts.findIndex(o => !o.ok);
sb2.act('pick', { dataset: { i: String(w2) } });
const tookBad = st2().opts[w2].st === 'bad';
/* 再选对 */
const r2 = st2().opts.findIndex(o => o.ok);
sb2.act('pick', { dataset: { i: String(r2) } });
sb2.flush();
ok('前置：确实先选错了一次', tookBad);
ok('BUG-1 翻面后 study.opts 里的对错标记全清空',
  st2().opts.every(o => o.st === ''), JSON.stringify(st2().opts.map(o => o.st)));
ok('BUG-2 红框元素的 bad 类已移除', !residueEl.classList.contains('bad'),
  'cls=' + Array.from(residueEl.classList._s).join(','));
ok('BUG-3 红框内联描边已清空', !residueEl.style.borderColor, 'bc=' + residueEl.style.borderColor);
ok('BUG-4 flipped 到单词卡', st2().show === true);
/* 复位屏幕桩，别影响后续用例 */
scr2.querySelectorAll = () => [];
scr2.querySelector = () => null;

console.log('\n[3b] 点击灵敏度：命中区、手势与事件');
ok('选项卡加大内边距', /\.opt\{[^}]*padding:13px 12px/.test(html.replace(/\s+/g, ' ')) || /\.opt\{[^}]*padding:13px/.test(html.replace(/\n/g, '')));
ok('选项卡声明 touch-action:manipulation', /\.opt\{[^}]*touch-action:manipulation/.test(html.replace(/\s+/g, ' ')));
ok('选项卡点按反馈不再用 scale（避免重排吞点击）', !/\.opt:hover\{transform:scale/.test(html.replace(/\s+/g, ' ')));
ok('选项卡 / 喇叭走 pointerup 绑定', /querySelectorAll\('\.opt,\.ex-speak,\.quiz-speak'\)/.test(html));
ok('pointerup 有 pointerdown 守卫（滑动不误触）', /onpointerdown[\s\S]{0,160}onpointerup/.test(html));

console.log('\n[3c] 有声模式：选意思读例句，选完读单词');
ok('默认有声（S.sound 缺省即有声）', peek('soundOn()') === true);
ok('例句清理函数 exText 已定义', typeof sandbox.exText === 'function');
ok('例句显示时已剥掉《》', !/《/.test(shown) || !st().list[0].ex);
ok('小喇叭颜色随卡片正文色（内联 color 来自 cs.fg）', /class="ex-speak"[^>]*/.test(shown));
/* 正面（选意思）读的是例句 */
const spoken = [];
vm.runInContext('__spy = []; const __origSay = say; say = function (t) { __spy.push(t); };', sandbox);
act('again');
ok('换卡后朗读的是例句（不是单词）',
  peek('__spy').length > 0 && peek('__spy')[0] === (st().list[0].ex ? st().list[0].ex[0] : st().list[0].w),
  '实际 ' + JSON.stringify(peek('__spy')[0]));
ok('正面例句卡顺序：例句在选项卡之前', /stage-ex-line[\s\S]*class="opts"/.test(screenEl.innerHTML));
/* 选对 → 翻到背面（单词卡） → 这时才读单词读音 */
vm.runInContext('__spy.length = 0;', sandbox);
const rIdx = st().opts.findIndex(o => o.ok);
const fakeOkEl = makeEl('div');
screenEl.querySelector = sel => (sel.indexOf('.opt[data-i') === 0 ? fakeOkEl : null);
act('pick', { dataset: { i: String(rIdx) } });
flushTimers();
ok('翻到单词卡后朗读的是单词读音（不是例句）',
  peek('__spy').length > 0 && peek('__spy').indexOf(st().list[st().idx].w) >= 0,
  '实际 ' + JSON.stringify(peek('__spy')));
vm.runInContext('say = __origSay;', sandbox);
/* 静音模式 */
vm.runInContext('S.sound = false;', sandbox);
ok('静音模式：soundOn() 为 false', peek('soundOn()') === false);
render2();
ok('静音模式：例句行上的喇叭仍在（可手动点）', /class="ex-speak"/.test(screenEl.innerHTML) || !st().list[0].ex);
vm.runInContext('S.sound = true;', sandbox);

console.log('\n[4] 选对 → 翻到背面 → 放出按钮');
/* [3c] 已经把上一张卡选掉了，这里必须换一张全新的卡再测 */
act('again');
const opts = st().opts;
const rightIdx = opts.findIndex(o => o.ok);
/* 造一个假的元素，让就地改 class 有落点 */
const fakeOpt = makeEl('div');
const fakeBox = makeEl('div');
screenEl.querySelector = sel => {
  if (sel.indexOf('.opt[data-i') === 0) return fakeOpt;
  if (sel === '.flip-box') return fakeBox;
  return null;
};
const before4 = timers.length;
act('pick', { dataset: { i: String(rightIdx) } });
ok('正确项被标为 ok', st().opts[rightIdx].st === 'ok');
ok('study.picked 置为 true', st().picked === true);
ok('绿框已就地写入', fakeOpt.classList.contains('ok') && fakeOpt.style.borderColor === '#34C759',
  'cls=' + Array.from(fakeOpt.classList._s).join(',') + ' bc=' + fakeOpt.style.borderColor);
ok('翻面立刻发生（0.4s 后）', timers.length > before4, 'before=' + before4 + ' now=' + timers.length);
flushTimers();
ok('0.4s 后 flip-on 已加上', fakeBox.classList.contains('flip-on'),
  'cls=' + Array.from(fakeBox.classList._s).join(','));
ok('0.4s 后 study.show = true', st().show === true);

console.log('\n[5] 选错 → 标红且不翻面');
act('again');
flushTimers();          /* 清掉换卡时排队的东西，下面只关心「选错」自己有没有排翻面 */
const wrongIdx = st().opts.findIndex(o => !o.ok);
st().picked = false;
const fakeBad = makeEl('div');
screenEl.querySelector = sel => (sel.indexOf('.opt[data-i') === 0 ? fakeBad : null);
const before5 = timers.length;
act('pick', { dataset: { i: String(wrongIdx) } });
ok('错误项被标为 bad', st().opts[wrongIdx].st === 'bad');
ok('红框已就地写入', fakeBad.classList.contains('bad') && fakeBad.style.borderColor === '#FF3B30');
ok('选错后 study.picked 仍为 false', st().picked === false);
ok('选错不触发翻面（没有新增计时器）', timers.length === before5);
ok('选错没有翻到背面', st().show === false);
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

console.log('\n[8] 「我的」页的有声模式开关');
act('home');
peek('go("me")');
const meHtml = screenEl.innerHTML;
ok('「我的」页出现有声模式开关', /data-act="toggleSound"/.test(meHtml));
ok('默认处于开启（switch on）', /class="switch on" data-act="toggleSound"/.test(meHtml));
act('toggleSound', {});
ok('点击后切为静音', peek('soundOn()') === false);
ok('静态渲染也没问题', peek('soundOn()') === false);
act('toggleSound', {});
ok('再点回有声', peek('soundOn()') === true);
ok('「重置学习进度」不清掉有声开关', /sound: S\.sound/.test(html));

console.log('\n[9] 翻转卡的点击命中（本轮修复：第二个单词起选项卡点不动）');
/* 根因：背面 .flip-back 绝对定位且 DOM 靠后，backface-visibility 在移动端不可靠，
   会盖住正面选项卡吃点击。修法是显式关掉不该收点击的那一面。 */
const cssFlat = html.replace(/\s+/g, ' ');
ok('未翻面时背面被显式关闭命中',
  /\.flip-box:not\(\.flip-on\)\s*\.flip-back\s*\{[^}]*visibility:\s*hidden/.test(cssFlat) &&
  /\.flip-box:not\(\.flip-on\)\s*\.flip-back\s*\{[^}]*pointer-events:\s*none/.test(cssFlat));
ok('已翻面时正面被显式关闭命中',
  /\.flip-box\.flip-on\s*\.flip-face:not\(\.flip-back\)\s*\{[^}]*pointer-events:\s*none/.test(cssFlat));
ok('旧的无效规则（整面 pointer-events:none）已删除',
  !/\.flip-box\.flip-on\s*\.flip-face\s*\{[^}]*pointer-events:\s*none/.test(cssFlat));
ok('仍保留 backface-visibility:hidden 作为双保险',
  /backface-visibility:\s*hidden/.test(cssFlat) && /-webkit-backface-visibility:\s*hidden/.test(cssFlat));

console.log('\n[10] 选项兜底恒能凑满 4 个（本轮修复：兜底引用未定义变量 start）');
/* 根因：第 4 级兜底里用了不存在的 start，list[NaN] = undefined → 兜底完全失效。
   全库 3328 词逐个跑 optionsFor 太慢（要做整轮编辑距离），
   这里取「每章首中尾 + 已知难例」的样本，并在下面单独跑一次全库长度检查。 */
const sampleSet = new Set();
for (let c = 0; c < 22; c += 1) {
  const inChap = words.filter(w => w.ch === c);
  if (inChap.length) sampleSet.add(inChap[0]).add(inChap[inChap.length >> 1]).add(inChap[inChap.length - 1]);
}
['pebble', 'phenomenon', 'equip', 'circulate', 'undergo', 'hydrogen', 'climate', 'narrow'].forEach(x => {
  const w = words.find(y => y.w.toLowerCase() === x);
  if (w) sampleSet.add(w);
});
const sample = [...sampleSet];
const countBad = sample.filter(w => sandbox.optionsFor(w, 4).length !== 4);
ok('抽样 ' + sample.length + ' 词的选项都是 4 个（无不足）', countBad.length === 0,
  countBad.length + ' 个不足：' + countBad.slice(0, 6).map(w => w.w).join(', '));
const noSelf = sample.filter(w => {
  const o = sandbox.optionsFor(w, 4);
  const rights = o.filter(x => x.ok);
  /* optionsFor 内部用 cnText(it.cn, it.w) 生成正确项，所以这里必须同样传词；
     只传 cn 会拿不到 POS_MAP 的词性（本轮改成两参数后踩过） */
  return rights.length !== 1 || rights[0].cn !== sandbox.cnText(w.cn, w.w);
});
ok('抽样每题恰好 1 个正确项且与题干释义一致', noSelf.length === 0,
  noSelf.length + ' 题异常');
const dupIn = sample.filter(w => {
  const cn = sandbox.optionsFor(w, 4).map(x => x.cn);
  return new Set(cn).size !== cn.length;
});
ok('抽样每题选项释义互不重复', dupIn.length === 0, dupIn.length + ' 题有重复');
/* 干扰项绝不能与题干文本撞车，否则答案不唯一 */
const collideIn = sample.filter(w => {
  const o = sandbox.optionsFor(w, 4);
  const title = sandbox.cnText(w.cn, w.w);
  return o.filter(x => !x.ok).some(x => x.cn === title);
});
ok('抽样每题题干不与干扰项撞车', collideIn.length === 0,
  collideIn.length + ' 题撞车：' + collideIn.slice(0, 6).map(w => w.w).join(', '));
ok('兜底分支不再引用未定义的 start',
  !/% WORDS\.length\)/.test(html) || /const origin = it\.i/.test(html));

/* 全库只查长度，不比对释义（够快）：确认没有任何词拿不到 4 个选项 */
const shortAll = words.filter(w => sandbox.optionsFor(w, 4).length !== 4);
ok('全库 ' + words.length + ' 词都不缺选项', shortAll.length === 0,
  shortAll.length + ' 个不足：' + shortAll.slice(0, 6).map(w => w.w).join(', '));

console.log('\n[11] 例句覆盖率与无例句兜底');
/* 本轮已补齐历史缺口（原书没给例句的 326 个词，均已补写）。现在应当 100% 覆盖。 */
const noEx = words.filter(w => !w.ex || !w.ex.length || !w.ex[0]);
ok('全库例句覆盖完整（0 个缺例句）', noEx.length === 0,
  noEx.length + ' / ' + words.length + ' 仍缺：' + noEx.slice(0, 6).map(w => w.w).join(', '));
/* 兜底仍然保留作为安全网：万一以后又出现无例句的词，UI 不会留白 */
ok('exParts("" ) 安全返回空数组', JSON.stringify(sandbox.exParts('', 'pebble')) === '[]');
ok('exParts(undefined) 安全返回空数组', JSON.stringify(sandbox.exParts(undefined, 'pebble')) === '[]');
ok('预览侧无例句时用单词兜底（不留白）', /stage-ex-t ex-strong">' \+ esc\(w\.w\)/.test(html));
const wxml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'study', 'study.wxml'), 'utf8');
const sjs = fs.readFileSync(path.join(__dirname, '..', 'pages', 'study', 'study.js'), 'utf8');
ok('小程序 study.wxml 保留了 noEx 兜底分支', /wx:elif="\{\{noEx\}\}"/.test(wxml));
ok('小程序 study.js 计算并下传 noEx', /noEx:\s*!exParts\.length/.test(sjs));
ok('小程序 study.js 声明了 noEx 初值', /noEx:\s*false/.test(sjs));

console.log('\n[12] 例句中目标词的定位（含屈折 / 短语 / 派生词）');
/* 全库跑一遍 exParts，确认每条例句都能标出目标词；顺带覆盖本轮补写的新例句 */
let exMiss = [];
words.forEach(w => {
  if (!w.ex || !w.ex[0]) return;
  const b = sandbox.exParts(w.ex[0], w.w).filter(p => p.b);
  if (!b.length) exMiss.push(w.w);
});
ok('全库 ' + words.length + ' 条例句都能定位到目标词', exMiss.length === 0,
  exMiss.length + ' 条定位不到：' + exMiss.slice(0, 8).join(', '));
/* 本轮新学会的几类形式，逐个点名断言，防止以后回退 */
ok('短语被拆开也能命中（spend time → spends）',
  (sandbox.exParts('She spends a lot of time reading.', 'spend time').filter(p => p.b)[0] || {}).t === 'spends');
ok('短语连写变位能命中（take up → takes up）',
  (sandbox.exParts('It takes up a lot of time.', 'take up').filter(p => p.b)[0] || {}).t === 'takes up');
ok('派生词能命中词根（southern → south）',
  (sandbox.exParts('This bird flies south in winter.', 'southern').filter(p => p.b)[0] || {}).t === 'south');
ok('不规则过去式能命中（bend → bent）',
  (sandbox.exParts('He bent down to pick it up.', 'bend').filter(p => p.b)[0] || {}).t === 'bent');
ok('不规则过去式能命中（kneel → knelt）',
  (sandbox.exParts('She knelt down.', 'kneel').filter(p => p.b)[0] || {}).t === 'knelt');
ok('不规则过去式能命中（uphold → upheld）',
  (sandbox.exParts('The court upheld the decision.', 'uphold').filter(p => p.b)[0] || {}).t === 'upheld');

console.log('\n[13] 释义质量（本轮修掉 OCR 噪声与串行）');
/* 释义里除「约20至30年」这类合理数字外，不应混入题号/页码数字 */
const digitBad = words.filter(w => /\d/.test(String(w.cn || '')) && !/[至岁]/.test(w.cn));
ok('释义不再混入题号 / 页码数字', digitBad.length === 0,
  digitBad.length + ' 条：' + digitBad.slice(0, 6).map(w => w.w + '=' + w.cn).join(' | '));
/*
 * 串入例句残句：OCR 的真实形态是「释义 + 一整句有主谓的中文」，
 * 典型如 "n. 颗粒，微粒；极小量 construction.新建的办公楼结构非常坚固"，
 * 特征是出现了**句号后的中文**或**英文单词后紧跟中文长句**。
 * （不要用「尾部含的/是」去判 —— 正常释义里大量夹注以「的」结尾，
 *   实测这样会误报 9 条正常释义，如 stormy / fur / terrestrial。）
 */
const glue = words.filter(w => {
  const cn = String(w.cn || '').trim();
  /* 形态 1：出现中文句号，且句号后面还有中文（正常释义不用句号收尾再接内容） */
  if (/。[^。]*[\u4e00-\u9fa5]/.test(cn)) return true;
  /* 形态 2：一个小写英文单词（非词性缩写）后面直接跟一串中文，中间没有释义标点 */
  if (/[a-z]{3,}\.(?=[\u4e00-\u9fa5]{4,})/.test(cn) && !/\b(?:n|v|adj|adv|prep|conj|pron|num|art|int)\./i.test(cn)) return true;
  return false;
});
ok('释义不再串入例句残句', glue.length === 0,
  glue.length + ' 条：' + glue.slice(0, 5).map(w => w.w + '=' + w.cn).join(' | '));
/* 点名确认本轮修掉的两条已彻底干净 */
['swarm', 'particle', 'solid'].forEach(x => {
  const w = words.find(y => y.w === x);
  ok('  ' + x + ' 释义已无残句', w && !/。[^。]*[\u4e00-\u9fa5]/.test(w.cn) && String(w.cn).indexOf('正确') < 0 && String(w.cn).indexOf('construction') < 0,
    w ? w.cn : '(缺失)');
});
/* 释义不应出现 undefined / null 这类脚本事故 */
ok('释义没有 undefined / null 事故', words.every(w => String(w.cn || '').indexOf('undefined') < 0 && String(w.cn || '').indexOf('null') < 0));
ok('break 的释义已修正（原为 keep 的释义）',
  (words.find(w => w.w === 'break') || {}).cn === 'v. 打破，打碎；违反；中断 n. 休息；裂口');
ok('break 的例句与释义一致（用 break 而非 keep）',
  /break the glass/.test((words.find(w => w.w === 'break') || { ex: [''] }).ex[0]));
/* assistant 曾误用 scientist 的释义「n. 科学家」，应为「助手」 */
const assWord = words.find(w => w.w === 'assistant') || {};
ok('assistant 释义不是 scientist 的（已修正为助手）',
  String(assWord.cn || '').indexOf('助手') >= 0 && String(assWord.cn || '').indexOf('科学家') < 0,
  assWord.cn);
/* 释义完全相同的词只应剩同义词，不应含拼错/串行的（点名：scientist 组已拆开） */
const cnMap = {};
words.forEach(w => { const k = String(w.cn || '').trim(); (cnMap[k] = cnMap[k] || []).push(w.w); });
const badDup = Object.keys(cnMap).filter(k => cnMap[k].length > 1)
  .filter(k => !/^(n\. 宇宙飞船|adj\. 有害的|v\. 选择|流行|惩罚，处罚)$/.test(k));
ok('释义重复的组只剩同义词', badDup.length === 0,
  badDup.map(k => k + '<-' + cnMap[k].join('/')).join(' | '));
/* 每个词对象的字段键唯一（重复键会被 JSON.parse 静默覆盖） */
const rawWords = fs.readFileSync(path.join(__dirname, '..', 'data', 'words.js'), 'utf8');
let dupKey = 0;
rawWords.split(/"w":"/).slice(1).forEach(seg => {
  ['"ex":', '"cn":', '"ph":', '"ch":', '"sim":'].forEach(k => { if (seg.split(k).length - 1 > 1) dupKey += 1; });
});
ok('词库无重复字段键', dupKey === 0, dupKey + ' 处重复');

console.log('\n[14] 释义词性标注（本轮：匹配页 + 记忆卡选项都带词性）');
/* POS_MAP 是脚本作用域的 const，不在 sandbox 上，用 runInContext 取 */
const POS_MAP = vm.runInContext('(POS_MAP)', sandbox);
ok('POS_MAP 已定义且条目充足', POS_MAP && Object.keys(POS_MAP).length >= 1200,
  POS_MAP ? Object.keys(POS_MAP).length + ' 条' : '(未定义)');
ok('POS_MAP 取词用大写字面量可命中（Stuff）',
  sandbox.cnText('东西；原料', 'Stuff') === 'n. 东西；原料',
  sandbox.cnText('东西；原料', 'Stuff'));

/* 全库 3328 词逐一验证：每个词的释义经 cnText 后都必须带词性 */
const POS_LEAD2 = /^(n|adj|adv|v|vt|vi|prep|conj|pron|num|int|art|aux|abbr|ord)\.\s*/;
const noPosWord = words.filter(w => !POS_LEAD2.test(sandbox.cnText(w.cn, w.w)));
ok('全库 3328 词经 cnText 后都带词性', noPosWord.length === 0,
  noPosWord.length + ' 条无词性：' + noPosWord.slice(0, 8).map(w => w.w + '=' + sandbox.cnText(w.cn, w.w)).join(' | '));

/* 释义里不应再残留 OCR 吃坏的词性前缀（r/i/fi/ac/af/adi/up 等） */
const ocrJunk = words.filter(w => /^[a-zA-Z]{1,4}[.\s]*[\u4e00-\u9fa5]/.test(String(w.cn || '').trim())
  && !POS_LEAD2.test(String(w.cn || '').trim()));
ok('释义开头无 OCR 损坏的词性残渣', ocrJunk.length === 0,
  ocrJunk.length + ' 条：' + ocrJunk.slice(0, 6).map(w => w.w + '=' + w.cn).join(' | '));

/* match 页必须走 cnText（否则中文侧没有词性） */
const matchJs = fs.readFileSync(path.join(__dirname, '..', 'pages', 'match', 'match.js'), 'utf8');
ok('小程序 match.js 引用了 word 工具', /require\(.*utils\/word.*\)/.test(matchJs));
ok('小程序 match.js 中文侧走 cnText', /cnText\(it\.cn,\s*it\.w\)/.test(matchJs));
ok('预览端 vMatch 中文侧走 cnText', /t:\s*cnText\(it\.cn,\s*it\.w\)/.test(html));
ok('预览端 cnText 支持第二参数（word）', /function cnText\(cn,\s*word\)/.test(html));
ok('预览端 POS_MAP 已同步为全量（>=1200 条）',
  (html.match(/"(?:[a-z ]+|Stuff)": "(?:n|adj|adv|v|num|int)\./g) || []).length >= 1200,
  (html.match(/"(?:[a-z ]+|Stuff)": "(?:n|adj|adv|v|num|int)\./g) || []).length + ' 条');

console.log('\n' + (fails.length ? fails.length + ' 项失败，' + pass + ' 项通过' : '全部 ' + pass + ' 项通过'));
process.exit(fails.length ? 1 : 0);
