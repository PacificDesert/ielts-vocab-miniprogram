# 雅思词汇 · 微信小程序

一个 iOS 简约风格的雅思背单词小程序：词汇浏览记忆、拼写自测、单词一键复制，保留云开发后端做数据持久化，天然支持多人使用。

词库来自用户提供的《雅思词汇真经》PDF，共 **3332 词**，按原书 **22 个主题章节** 编排。

## 功能

| 模块 | 说明 |
| --- | --- |
| 学习（记忆卡） | 卡片式记忆，轻触翻面看释义，「认识 / 不认识」驱动熟练度分级 |
| 词库 | 22 章节分组浏览 + 中英文搜索，**长按单词一键复制** |
| 拼写自测 | 看中文释义拼写英文，支持逐字母提示、跳过，统计正确率 |
| 单词详情 | 大字单词、音标、释义、在线发音、**一键复制**、上一个 / 下一个 |
| 我的 | 学习统计、每组词量设置、云端上传 / 拉取、重置进度 |
| 后端 | 微信云开发云函数 `login` / `data`，按 openid 一人一条记录 |

熟练度：`0 → 5`。认识 +1，不认识清零，拼写错误 −2，`lv ≥ 3` 记为「已掌握」。

## 目录结构

```
├── app.js / app.json / app.wxss     全局逻辑与 iOS 风格设计变量
├── config.js                        云环境 ID、发音接口、默认计划
├── data/words.js                    词库（由 PDF 生成，勿手改）
├── utils/
│   ├── cloud.js                     云函数调用封装（未配置时自动降级为本地模式）
│   ├── store.js                     学习进度：本地存储 + 云端同步
│   └── word.js                      词库检索、章节、复制文本
├── pages/
│   ├── index/                       学习首页
│   ├── vocab/                       词库浏览与搜索
│   ├── detail/                      单词详情
│   ├── study/                       记忆卡
│   ├── spell/                       拼写自测
│   └── me/                          我的
├── cloudfunctions/
│   ├── login/                       获取 openid
│   └── data/                        学习数据读写
├── images/tabbar/                   tabBar 图标
└── tools/
    ├── build_words.py               PDF → data/words.js
    └── make_icons.py                生成 tabBar 图标
```

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
    { w: 'atmosphere', ph: '/ˈætməsfɪə/', cn: 'n. 大气层；空气', ch: '自然地理' },
    // ...
  ]
};
```

**替换成你自己的单词表**：保持上面这个结构即可，`ch` 需与 `chapters` 中的某一项一致。
若仍以 PDF 重建，运行：

```bash
pip install pymupdf
python tools/build_words.py "雅思词汇真经.pdf" ecdict.csv
```

`build_words.py` 的取值规则：

- **词表**以 PDF 书签目录（OCR 生成的「单词 + 音标」列表）为准，并合并正文中带音标的独立词条；索引页（书页 312 之后）自动剔除，垃圾词条用词典库做存在性校验。
- **中文释义**取正文词条首段，过滤掉 `［例］［记］［搭］` 等例句与拓展块。
- **音标**来自开源词典 [ECDICT](https://github.com/skywind3000/ECDICT)（PDF 的 OCR 音标符号不可靠，未采用）；正文释义缺失时同样用 ECDICT 的中文释义兜底。

词库版权归原书作者与出版社所有，本项目仅用于个人学习，请勿用于商业用途。

## 二次开发说明

工程架构参考 MIT 协议开源的微信小程序背单词项目 [flymysql/WeChat-applets](https://github.com/flymysql/WeChat-applets)（小鸡单词）：
同样是「原生小程序 + 云开发云函数（`login` / `data`）+ 词库随包发布 + `config.js` 集中配置」的组织方式。
本工程在此架构上重写为 iOS 简约风格界面，收敛为 6 个页面，替换词库，并加入拼写自测与一键复制。

## 开源协议

[MIT](./LICENSE)
