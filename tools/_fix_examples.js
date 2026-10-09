/**
 * 修词库例句里的 OCR 遗留问题（一次性脚本）。
 *
 * 两类问题：
 *  A. 中文翻译里汉字之间夹了空格 —— 原书 OCR 换行留下的，1301 条。
 *     中文本来就不用空格分词，直接删掉即可。
 *  B. 英文例句里的字母误认与粘连 —— 10 条，逐条人工确认后替换。
 *
 * 用法：
 *   node tools/_fix_examples.js            # 预览（不写盘）
 *   node tools/_fix_examples.js --write    # 实际写回 data/words.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'words.js');
const WRITE = process.argv.includes('--write');

const text = fs.readFileSync(SRC, 'utf8');
const data = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));

/* B. 英文例句的定点修正：OCR 把字母认错、或词间丢了空格 */
const EN_FIX = {
  emerge: ['The sun emerged from behind the clouds.', '太阳从云层后面露了出来。'],
  track: ["The hunter followed the animal's tracks.", '猎人沿着动物的足迹前进。'],
  dynasty: ['The Tang Dynasty is a period remarkable for its liberality.', '唐朝是一个以开明著称的时期。'],
  commentary: ["The conclusion of the commentary really hit the bull's-eye.", '评论的结论真是一针见血。'],
  utensil: ['He took a camping utensil that can serve as a knife, fork and spoon to school.', '他带了一套可当刀、叉、勺用的野营餐具去学校。'],
  cherry: ['We have different pies, such as apple, cherry and peach pies.', '我们有不同口味的派，比如苹果派、樱桃派和水蜜桃派。'],
  gorge: ['We live near the Three Gorges.', '我们住在三峡附近。'],
  lovely: ["The girl's rosy cheeks made her look very lovely.", '女孩红润的双颊让她看起来非常可爱。'],
  parallel: ['There are few parallels between American football and soccer.', '美式橄榄球和英式足球之间几乎没有相似之处。'],
  uniform: ["Do you have to wear a uniform if you work at McDonald's?", '在麦当劳工作必须穿制服吗？']
};

let zhFixed = 0;
const zhSamples = [];
let enFixed = 0;

data.list.forEach(it => {
  if (!it.ex) return;

  /* A. 中文：删掉「汉字 + 空格 + 汉字」里的空格。
     用 lookahead 保证连续多个空格都能处理（普通 g 匹配会吃掉后一个汉字）。 */
  const zh = it.ex[1];
  if (zh) {
    const fixed = zh.replace(/([\u4e00-\u9fa5])[ \t]+(?=[\u4e00-\u9fa5])/g, '$1');
    if (fixed !== zh) {
      zhFixed += 1;
      if (zhSamples.length < 5) zhSamples.push(it.w + '：' + zh + '  →  ' + fixed);
      it.ex[1] = fixed;
    }
  }

  /* B. 英文：定点替换 */
  const fix = EN_FIX[it.w];
  if (fix) {
    it.ex = [fix[0], fix[1]];
    enFixed += 1;
  }
});

console.log('中文空格修正：%d 条', zhFixed);
zhSamples.forEach(s => console.log('   ' + s));
console.log('英文定点修正：%d 条', enFixed);
Object.keys(EN_FIX).forEach(w => console.log('   ' + w + ' → ' + EN_FIX[w][0]));

if (WRITE) {
  const js = 'module.exports = ' + JSON.stringify(data) + ';\n';
  fs.writeFileSync(SRC, js);
  console.log('\n已写回 ' + SRC);
} else {
  console.log('\n（预览模式，未写盘。加 --write 实际写入）');
}
