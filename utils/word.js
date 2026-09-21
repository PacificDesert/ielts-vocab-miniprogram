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
    ph: rgbStr(ink)
  };
}

/** 相近 / 同源词 */
function similar(it) {
  if (!it || !it.sim) return [];
  return it.sim.map(i => words.list[i]).filter(Boolean);
}

/** 书中例句 */
function example(it) {
  if (!it || !it.ex || !it.ex.length) return null;
  return { en: it.ex[0], zh: it.ex[1] || '' };
}

module.exports = {
  all, get, chapterList, chapterWords, search, slice,
  themeImage, card, similar, example,
  total: words.list.length
};
