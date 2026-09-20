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

/** 格式化复制文本 */
function copyText(it) {
  const ph = it.ph ? ` ${it.ph}` : '';
  return `${it.w}${ph}\n${it.cn}`;
}

module.exports = { all, get, chapterList, chapterWords, search, slice, copyText, total: words.list.length };
