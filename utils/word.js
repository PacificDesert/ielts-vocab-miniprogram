const words = require('../data/words');

const byWord = {};
words.list.forEach((it, i) => {
  it.i = i;
  byWord[it.w.toLowerCase()] = it;
});

const chapters = words.chapters.map((name, idx) => ({
  name,
  idx,
  words: words.list.filter(it => it.ch === name)
}));

function all() {
  return words.list;
}

function get(word) {
  return byWord[String(word).toLowerCase()] || null;
}

function chapterList() {
  return chapters;
}

function chapterWords(name) {
  const c = chapters.find(it => it.name === name);
  return c ? c.words : [];
}

/** 按关键字搜索（英文前缀优先，其次中文释义） */
function search(keyword, limit) {
  const kw = String(keyword || '').trim().toLowerCase();
  if (!kw) return [];
  const out = [];
  for (const it of words.list) {
    if (it.w.toLowerCase().indexOf(kw) === 0) out.push(it);
    if (out.length >= limit) return out;
  }
  for (const it of words.list) {
    if (it.w.toLowerCase().indexOf(kw) > 0 || it.cn.indexOf(kw) >= 0) out.push(it);
    if (out.length >= limit) return out;
  }
  return out;
}

/** 取一段连续单词，用于学习 / 拼写任务 */
function slice(start, count) {
  return words.list.slice(start, start + count);
}

/** 章节主题配图 */
function themeImage(ch) {
  const i = words.chapters.indexOf(ch);
  if (i < 0) return '';
  const n = i + 1;
  return '/images/theme/' + (n < 10 ? '0' + n : '' + n) + '.jpg';
}

/** 章节配色：ink 用于文字，tint 是卡片底色（rgb 分量） */
const CHAPTER_STYLE = {
  '自然地理': { ink: '#2F5D45', tint: '231,240,234' },
  '植物研究': { ink: '#3B6234', tint: '234,243,231' },
  '动物保护': { ink: '#7A5620', tint: '247,241,229' },
  '太空探索': { ink: '#333F6B', tint: '234,237,246' },
  '学校教育': { ink: '#28527F', tint: '233,240,248' },
  '科技发明': { ink: '#33606F', tint: '233,242,245' },
  '文化历史': { ink: '#6B4E2E', tint: '246,241,233' },
  '语言演化': { ink: '#57407A', tint: '240,235,246' },
  '娱乐运动': { ink: '#8F4526', tint: '249,237,231' },
  '物品材料': { ink: '#4A4A4F', tint: '240,240,243' },
  '时尚潮流': { ink: '#833D5D', tint: '248,235,241' },
  '饮食健康': { ink: '#8A6220', tint: '249,243,230' },
  '建筑场所': { ink: '#3E4F60', tint: '236,241,245' },
  '交通旅行': { ink: '#245E82', tint: '232,242,248' },
  '国家政府': { ink: '#7E3D2C', tint: '248,236,232' },
  '社会经济': { ink: '#2F6B4E', tint: '233,244,238' },
  '法律法规': { ink: '#454565', tint: '238,238,245' },
  '沙场争锋': { ink: '#6B3229', tint: '247,234,231' },
  '社会角色': { ink: '#6B5A20', tint: '246,243,229' },
  '行为动作': { ink: '#246B5C', tint: '231,244,241' },
  '身心健康': { ink: '#8A3636', tint: '248,235,235' },
  '时间日期': { ink: '#414F60', tint: '238,242,245' }
};

function hexRgb(hex) {
  const h = String(hex).replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mixTo(rgb, target, amt) {
  return rgb.map(c => Math.round(c + (target - c) * amt));
}

function rgbaStr(rgb, a) {
  return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
}

function rgbStr(rgb) {
  return 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
}

/**
 * 词卡样式：每个单词都会拿到一张带章节底色与首字母水印的卡片。
 * dark=true 时把章节色调暗做底、把标签文字提亮，适配深色主题。
 */
function card(ch, w, dark) {
  const st = CHAPTER_STYLE[ch] || { ink: '#3E4F60', tint: '238,242,245' };
  const accent = hexRgb(st.ink);
  let tint, ink, veil;
  if (dark) {
    tint = mixTo(accent, 20, 0.86);
    // 深色下把章节色大幅提亮（接近白），保证标签文字和背景拉得开
    ink = mixTo(accent, 255, 0.68);
    veil = 'linear-gradient(180deg, ' + rgbaStr(tint, 0.34) + ' 0%, '
      + rgbaStr(tint, 0.72) + ' 46%, ' + rgbaStr(tint, 0.97) + ' 100%)';
  } else {
    tint = hexRgb(st.tint);
    ink = accent;
    veil = 'linear-gradient(180deg, ' + rgbaStr(tint, 0.12) + ' 0%, '
      + rgbaStr(tint, 0.62) + ' 46%, ' + rgbaStr(tint, 0.96) + ' 100%)';
  }
  return {
    img: themeImage(ch),
    ink: rgbStr(ink),
    tint: rgbStr(tint),
    veil,
    mono: String(w || ' ').charAt(0).toUpperCase(),
    /**
     * 卡片正文色：卡面按章节色调（深色下偏暗），直接用主题的 --text
     * 在深色卡面上会发灰、看不清，所以这里按主题给一套高对比的正文与次级色。
     * 浅色卡面偏白 → 正文用近黑、次级用 45% 灰；
     * 深色卡面接近纯黑 → 正文用纯白、次级用 78% 白（比 --text2 更亮，压在插图上也清楚）。
     */
    fg: dark ? '#FFFFFF' : '#1C1C1E',
    fg2: dark ? 'rgba(255, 255, 255, 0.80)' : 'rgba(60, 60, 67, 0.62)',
    // 音标：直接用章节强调色，深浅两套都够亮、也不依赖主题变量
    ph: rgbStr(ink),
    // 选项卡描边：卡面同色系的浅描边，深浅两套都看得见
    line: dark ? rgbaStr(ink.map(c => Math.round(c * 0.5)), 0.45) : rgbaStr(tint, 0.9)
  };
}

/** 相近 / 同源词 */
function similar(it) {
  if (!it || !it.sim) return [];
  return it.sim.map(i => words.list[i]).filter(Boolean);
}

/**
 * 词形拓展：把 dr 的 [词, 释义] 合并成一行展示文本，如 "shallow-hearted 薄情的"。
 * 没有词形拓展（或释义为空）时返回 ''。
 */
function forms(it, sep) {
  if (!it || !it.dr || !it.dr.length) return '';
  const s = sep === undefined ? ' ' : sep;
  return it.dr.map(p => {
    const w = String(p[0] || '').trim();
    const cn = String(p[1] || '').trim();
    if (w && cn) return w + s + cn;
    return w || cn;
  }).filter(Boolean).join(' / ');
}

/**
 * 上一张卡片左上角的标记，如 "thermal /ˈθɜːməl/ adj. 热量的"。
 * 只传下标（不传单词），越界或无效一律返回 '' —— 第一个单词天然是空的。
 * opts.forms = true 时额外拼上词形拓展（拼写页用）。
 */
function prevTag(list, prevIdx, opts) {
  const it = (list || [])[prevIdx];
  if (!it || !it.w) return '';
  const sep = ' ';
  let out = it.w;
  if (it.ph) out += sep + it.ph;
  if (it.cn) out += sep + it.cn;
  if (opts && opts.forms) {
    const f = forms(it, sep);
    if (f) out += sep + f;
  }
  return out;
}

/** 词性标注：词库里 2000+ 条释义自带 "n. / adj. / v." 前缀 */
const POS_LEAD = /^(n|adj|adv|v|vt|vi|prep|conj|pron|num|int|art|aux|abbr)\.\s/;

/**
 * 常见词 → 词性。只覆盖已经确认过的高频词，宁缺毋滥：
 * 猜错词性比不写词性更糟，所以表里的取不到就原样返回。
 */
const POS_MAP = {
  oxygen: 'n.', hydrogen: 'n.', oxide: 'n.', nitrogen: 'n.', dioxide: 'n.',
  spider: 'n.', elephant: 'n.', cattle: 'n.', eagle: 'n.', needle: 'n.',
  bowl: 'n.', soup: 'n.', circle: 'n.', enzyme: 'n.', carbon: 'n.',
  dispute: 'n./v.', friction: 'n.', property: 'n.', problem: 'n.',
  endanger: 'v.', disagree: 'v.', declare: 'v.', debate: 'n./v.'
};

/** 编辑距离，超过 max 就提前收手（用于找拼写相近的词） */
function editDistance(a, b, max) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;
  for (let i = 1; i <= m; i += 1) {
    cur[0] = i;
    let best = cur[0];
    for (let j = 1; j <= n; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    const t = prev; prev = cur; cur = t;
  }
  return prev[n];
}

/** 去掉释义开头的杂标点（OCR 常把「（」吃掉，留下孤零零的「，」「、」）并压掉空白 */
function tidyCn(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/^[，,、；;：:]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 释义正文：题干（正确项）永远带上词性标注。
 * 词库里有 2000+ 条释义自带 "n. / adj. / v." 前缀，剩下的大多没有 ——
 * 若不补齐，测验里会出现「只有正确项没写词性」的反常现象，一眼就能猜出答案。
 * 补不出词性时退回原释义，绝不硬编。
 */
function cnText(cn) {
  const s = tidyCn(cn);
  if (!s) return '';
  if (POS_LEAD.test(s)) return s;
  const pos = POS_MAP[String(s.split(/[；;/]/)[0]).trim()];
  return pos ? pos + ' ' + s : s;
}

/** 两个词是否高度重形（同前缀 / 包含关系）——这类干扰项太容易排除，不算「形近」 */
function tooClose(a, b) {
  if (a === b) return true;
  if (a.length >= 3 && b.indexOf(a) === 0) return true;
  if (b.length >= 3 && a.indexOf(b) === 0) return true;
  return false;
}

/**
 * 记忆卡的「选释义」四个选项：正确释义 + 3 个形近词的释义。
 * 干扰项优先取拼写相近的词（让选项真正难分辨），出处书的 sim 列表、
 * 编辑距离邻域、同章节顺延三级兜底；释义去重且保证凑满 count 个。
 * 返回 [{ cn, ok }]，ok 标记正确项，且数组第一项一定是正确项（由调用方打乱）。
 */
function options(it, n) {
  const count = n && n > 1 ? n : 4;
  if (!it || !it.cn) return [];
  const list = words.list;
  const target = String(it.w || '').toLowerCase();
  const answer = cnText(it.cn);
  // 正确释义先占位：像 spacecraft / spaceship 这类同义项释义完全一样，
  // 必须当成重复直接剔除，否则选项里会出现两个「n. 宇宙飞船」。
  const picked = [];
  const seen = {};
  seen[answer] = 1;
  const push = cand => {
    if (picked.length >= count) return;
    if (!cand || !cand.cn || cand === it) return;
    if (tooClose(target, String(cand.w || '').toLowerCase())) return;
    const cn = tidyCn(cand.cn);
    if (!cn || seen[cn]) return;
    seen[cn] = 1;
    picked.push(cn);
  };

  // 1) 编辑距离邻域：与目标词最像的一批（拼写 1~2 个字母之差）
  const near = [];
  for (let k = 0; k < list.length; k += 1) {
    const cand = list[k];
    if (!cand || !cand.w || cand === it) continue;
    const cw = String(cand.w).toLowerCase();
    const d = editDistance(target, cw, 3);
    if (d <= 2) near.push([d, cand]);
  }
  near.sort((a, b) => a[0] - b[0]);
  for (let k = 0; k < near.length && picked.length < count; k += 1) push(near[k][1]);

  // 2) 出处书里的相近词
  const sims = it.sim || [];
  for (let k = 0; k < sims.length && picked.length < count; k += 1) push(list[sims[k]]);

  // 3) 同章节顺延，语境相近，凑数也不突兀
  const chapter = chapterWords(it.ch);
  const at = chapter.indexOf(it);
  for (let k = 1; k <= chapter.length && picked.length < count; k += 1) {
    push(chapter[(at + k) % chapter.length]);
  }

  // 4) 全表轮转兜底：前面几级都被同义词屏蔽掉时，保证任何词都能凑满选项
  for (let pass = 0; pass < 2 && picked.length < count - 1; pass += 1) {
    for (let k = 0; k < list.length && picked.length < count - 1; k += 1) {
      push(list[(start + k) % list.length]);
    }
  }

  return [Object.assign({}, { cn: answer, ok: true })]
    .concat(picked.slice(0, count - 1).map(cn => ({ cn, ok: false })));
}

/** 书中例句 */
function example(it) {
  if (!it || !it.ex || !it.ex.length) return null;
  return { en: it.ex[0], zh: it.ex[1] || '' };
}

/**
 * 例句正文（可发音）：把书名号的例词标记《word》剥掉，只留纯英文句子。
 * 书中例句用《》标出该词，但 TTS / 词典接口会把书名号一起念出来，
 * 所以朗读与显示都统一走这里。
 */
function exText(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/《([^》]*)》/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  all, get, chapterList, chapterWords, search, slice,
  themeImage, card, similar, forms, prevTag, options, example, exText,
  total: words.list.length
};
