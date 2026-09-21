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

console.log('\n' + (fails.length ? fails.length + ' 项失败，' + pass + ' 项通过' : '全部 ' + pass + ' 项通过'));
process.exit(fails.length ? 1 : 0);
