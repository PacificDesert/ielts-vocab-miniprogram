# 雅思词汇 · 微信小程序

一个 iOS 简约风格的雅思背单词小程序：词汇浏览记忆、拼写自测、单词一键复制，保留云开发后端做数据持久化，天然支持多人使用。

词库来自用户提供的《雅思词汇真经》PDF，共 **3328 词**，按原书 **22 个主题章节** 编排，收录 **3000 余条书中例句**。

## 功能

| 模块 | 说明 |
| --- | --- |
| 学习（记忆卡） | 卡片式记忆，轻触翻面看释义与例句，「认识 / 不认识」驱动熟练度分级 |
| 单词拓展 | 标记「认识」后进入：章节配图 + 书中例句 + 词形拓展 + 相近单词，相近词可无限联想 |
| 词库 | 22 章节分组浏览 + 中英文搜索，**长按单词一键复制** |
| 拼写自测 | 看中文释义拼写英文，支持逐字母提示、跳过，统计正确率 |
| 单词详情 | 大字单词、音标、释义、**书中例句**、词形拓展、在线发音、一键复制 |
| 我的 | 学习统计、**每组词量可自定义（下限 1，不设上限）**、拓展页开关、云端上传 / 拉取、重置进度 |
| 后端 | 微信云开发云函数 `login` / `data`，按 openid 一人一条记录 |

熟练度：`0 → 5`。认识 +1，不认识清零，拼写错误 −2，`lv ≥ 3` 记为「已掌握」。

## 目录结构

```
├── app.js / app.json / app.wxss     全局逻辑与 iOS 风格设计变量
├── config.js                        云环境 ID、发音接口、计划默认值与上下限
├── data/words.js                    词库（由 PDF 生成，勿手改）
├── utils/
│   ├── cloud.js                     云函数调用封装（未配置时自动降级为本地模式）
│   ├── store.js                     学习进度：本地存储 + 云端同步
│   └── word.js                      词库检索、章节、配图、相近词、复制文本
├── pages/
│   ├── index/                       学习首页
│   ├── vocab/                       词库浏览与搜索
│   ├── detail/                      单词详情
│   ├── expand/                      单词拓展（例句 / 派生词 / 相近词 / 配图）
│   ├── study/                       记忆卡
│   ├── spell/                       拼写自测
│   └── me/                          我的
├── cloudfunctions/
│   ├── login/                       获取 openid
│   └── data/                        学习数据读写
├── images/
│   ├── tabbar/                      tabBar 图标
│   └── theme/                       22 张章节主题配图（720×405 JPEG）
├── preview/
│   ├── template.html                预览页模板
│   └── index.html                   浏览器可打开的界面预览（生成物）
└── tools/
    ├── build_words.py               PDF → data/words.js
    ├── make_phonetic_csv.py         音标源文件 → 可读 CSV
    ├── build_preview.py             词库 → preview/index.html
    ├── manual_fix.json              OCR 取不到的词条人工校订
    └── make_icons.py                生成 tabBar 图标
```

## 界面预览（无需开发者工具）

不想装微信开发者工具、或者只想先看长相，可以直接双击 `preview/index.html` 用浏览器打开。
它用真实词库渲染，搜索、翻卡、拼写作答、复制单词都能实际操作，进度存在浏览器本地。

```bash
python tools/build_preview.py     # 词库变动后重新生成
```

预览只是界面还原，真机运行仍需用微信开发者工具导入本工程。

## 快速开始

1. **导入项目**：微信开发者工具 → 导入项目 → 选择本目录。`project.config.json` 里的 `appid` 是占位值 `touristappid`，请替换成你自己的小程序 AppID（正式使用必须替换）。
2. **开通云开发**（可选，但推荐）：工具栏「云开发」→ 新建环境 → 复制环境 ID。
3. **填写环境 ID**：把环境 ID 写入 `config.js` 的 `CLOUD_ENV`。
   *留空则运行在本地模式：功能全部可用，进度只存本机，不做云端同步与多人数据隔离。*
4. **创建数据库集合**：云开发控制台 → 数据库 → 新建集合 `user_data`，权限选「仅创建者可读写」。
5. **部署云函数**：在 `cloudfunctions/login`、`cloudfunctions/data` 上分别右键 → 上传并部署（云端安装依赖）。
6. **发音域名**：若要用单词发音，把小程序的 downloadFile 合法域名加入 `https://dict.youdao.com`；本地调试也可在开发者工具中勾选「不校验合法域名」。
7. 编译运行。

## 词库

词库数据在 `data/words.js`，结构如下：

```js
module.exports = {
  chapters: ['自然地理', '植物研究', /* ... 共 22 章 */ ],
  list: [
    {
      w: 'volcano',                        // 单词
      ph: '/vɒˈlkeɪnəʊ/',                  // 音标
      cn: '火山',                           // 释义
      ch: '自然地理',                       // 所属章节
      ex: ['The volcano erupted ...', '这次火山爆发…'],  // 书中例句 [英文, 中文]
      dr: [['volcanic', 'adj. 火山的']],    // 词形拓展（来自书中［记］块，可能没有）
      sim: [3236, 701, 1261, 1282, 780]    // 相近词，值是 list 中的下标
    }
    // ...
  ]
};
```

`ex` 覆盖 3002 词（90%），`sim` 覆盖全部词条，`dr` 只在书中给出派生词时才有（238 词）。
数组整体长度做了控制，主包体积约 **1.0 MB**（微信小程序主包上限 2 MB）。
`preview/`、`tools/`、`cloudfunctions/` 已在 `project.config.json` 的 `packOptions.ignore` 里排除，不占包体积。

**替换成你自己的单词表**：保持上面这个结构即可，`ch` 需与 `chapters` 中的某一项一致。
若仍以 PDF 重建，运行：

```bash
pip install pymupdf

# 1) 下载音标源（约 1.6 MB），转成脚本可读的 CSV
curl -LO https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/en_UK.txt
python tools/make_phonetic_csv.py en_UK.txt phonetic.csv

# 2) 生成词库（第二个参数可省略，省则音标留空）
python tools/build_words.py "雅思词汇真经.pdf" phonetic.csv
```

`build_words.py` 的取值规则：

- **词表**以 PDF 书签目录（OCR 生成的「单词 + 音标」列表）为准，并合并正文中带音标的独立词条；
  书页 312 之后的索引页自动剔除，垃圾词条用音标词典做存在性校验。
- **章节**按原书目录的 22 个主题划分，书内页码 → PDF 页序号偏移固定为 `+11`（换书需改脚本顶部的 `CHAPTERS` 与 `BOOK_TO_PDF`）。
- **中文释义**取正文词条首段，过滤掉 `［例］［记］［搭］` 等例句与拓展块，并还原被 OCR 认错的词性标记（`at` / `ai` / `ar` → `adj.`，`m` → `n`）。
- **音标**来自开源项目 [ipa-dict](https://github.com/open-dict-data/ipa-dict)（PDF 自带的 OCR 音标符号不可靠，未采用）。
  该数据源的重音符号标注习惯特殊，脚本会做两步规范化：修正「元音 + 重音符号 + 长音符号」错位，再把重音符号左移到音节首；
  单音节词去掉重音符号，`ɹ→r`、`ɐ→ə`、`ɛ→e`。
- **人工校订**：OCR 取不到释义或音标的条目写在 `tools/manual_fix.json`（`cn` / `ph` / `ex` / `drop` 四个字段），生成时自动合并，优先级最高。
- **例句**：抓正文里 `［例］` 块（OCR 会把它认成 `［仔！） ］` 等形状，脚本做了容忍），
  拆成英文原句 + 中文翻译，并截掉混进来的 `［搭］［记］` 片段与页码；
  只有「英文句中确实含该词（或其词干）」才保留，因此 90% 的词条带例句且误配极少。
- **词形拓展**：抓 `［记］［派］［拓］` 块里的派生词，只保留与词头共享 ≥4 字符前缀的（`propel → propeller`、`pronounce → pronunciation`）。
- **相近词**：按首字母分桶，用「最长公共前缀 + 词长接近度」打分取前 5（`landlord → landlady / landmark / landfill / landing / landscape`）；
  前缀匹配不足 3 个时用同章节词补齐。存的是下标，避免重复存词形。

### 单词配图

**每个单词都有一张视觉卡片**，由三层叠成，全部走本地资源、离线可用：

1. **章节配图**：`images/theme/01.jpg` ~ `22.jpg`，对应 22 个章节（AI 生成后统一裁切压缩为 720×405 JPEG q74，合计约 231 KB）。
2. **章节色罩**：`utils/word.js` 的 `CHAPTER_STYLE` 给每章一组 `ink` / `tint` 色，卡片上叠一层由浅到深的同色渐变，保证文字始终清晰。
3. **首字母水印**：单词首字母放成大号低透明度文字，作为卡片的主视觉。

调用方式：`word.card(ch, w)` 返回 `{ img, ink, tint, veil, mono }`，详情页、拓展页、记忆卡的卡片都复用同一份样式。

> 为什么不给每个词配真实照片：3328 张图即使每张压到 20 KB 也有 66 MB，远超小程序「主包 2 MB / 总包 20 MB」的硬限制，**本地打包在技术上不可行**。
> 走在线图源的话，实测免费图库（Wikimedia Commons）对雅思词汇的相关性很差——`core` 返回的是 Intel 处理器、`mantle` 返回淋巴瘤、`intonation` 返回音乐节——放进背单词场景反而误导。
> 所以采用「章节配图 + 色罩 + 首字母」这套 100% 覆盖、零体积代价的方案。真要每词一张写实图，需要 AI 逐词生成（成本与体积都不现实）+ 云存储托管。

### 章节配图

`images/theme/01.jpg` ~ `22.jpg` 按 `chapters` 数组下标一一对应。
生成时的统一约束是：扁平极简、柔和低饱和配色、大量留白、无文字、16:9 横版。
换图时保持文件名与章节顺序一致即可，`utils/word.js` 的 `themeImage()` 负责映射。

词库版权归原书作者与出版社所有，本项目仅用于个人学习，请勿用于商业用途。

## 二次开发说明

工程架构参考 MIT 协议开源的微信小程序背单词项目 [flymysql/WeChat-applets](https://github.com/flymysql/WeChat-applets)（小鸡单词）：
同样是「原生小程序 + 云开发云函数（`login` / `data`）+ 词库随包发布 + `config.js` 集中配置」的组织方式。
本工程在此架构上重写为 iOS 简约风格界面，替换词库，并加入拼写自测、一键复制与单词拓展页。

## 开源协议

[MIT](./LICENSE)
