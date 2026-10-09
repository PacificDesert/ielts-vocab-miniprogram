#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 tools/sentences/ 下分批生成的例句合并进词库。

生成的例句是**原创的**（不是从任何出版物摘抄），因此不含版权风险，
可以替代原书例句上架使用。

用法
----
  python tools/merge_sentences.py <词库文件> [--out <输出文件>]

  # 例：把例句合并进 ECDICT 版词库
  python tools/merge_sentences.py data/words.ecdict.js

合并规则：
  - 例句分片 tools/sentences/ch*.js 会被全部读出并合并成一张表
  - 表里有的词 → 写入 ex: [英文, 中文]
  - 表里没有的词 → 不写 ex 字段（页面自动隐藏例句区块）
"""

import argparse
import glob
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SENT_DIR = os.path.join(ROOT, 'tools', 'sentences')


def log(msg):
    sys.stdout.write(str(msg) + '\n')
    sys.stdout.flush()


def load_sentences():
    """读所有分片。分片是 `module.exports = { ... };`，直接切出对象部分当 JSON 解析。"""
    table = {}
    files = sorted(glob.glob(os.path.join(SENT_DIR, 'ch*.js')))
    if not files:
        log('没找到任何例句分片（%s）' % SENT_DIR)
        sys.exit(1)
    dup = 0
    for p in files:
        text = io.open(p, encoding='utf-8').read()
        try:
            obj = json.loads(text[text.index('{'): text.rindex('}') + 1])
        except ValueError as e:
            log('解析失败：%s（%s）' % (os.path.basename(p), e))
            sys.exit(1)
        for k, v in obj.items():
            if k in table:
                dup += 1
            table[k] = v
        log('  %s → %d 条' % (os.path.basename(p), len(obj)))
    if dup:
        log('注意：有 %d 个词在不同分片里重复，后者覆盖前者' % dup)
    return table


def main():
    ap = argparse.ArgumentParser(description='把生成的例句合并进词库')
    ap.add_argument('src', help='词库文件（如 data/words.ecdict.js）')
    ap.add_argument('--out', default='', help='输出文件，默认覆盖 src')
    args = ap.parse_args()

    dst = args.out or args.src

    log('读取例句分片：')
    table = load_sentences()
    log('合计 %d 条例句' % len(table))

    text = io.open(args.src, encoding='utf-8').read()
    data = json.loads(text[text.index('{'): text.rindex('}') + 1])

    hit = 0
    miss = []
    for it in data['list']:
        w = it.get('w', '')
        s = table.get(w)
        if s and isinstance(s, list) and len(s) >= 2 and s[0]:
            it['ex'] = [s[0], s[1] or '']
            hit += 1
        elif it.get('ex'):
            # 分片里没有这个词，但词库带着旧例句（来自原书）→ 必须清掉
            del it['ex']
        if w not in table and len(miss) < 40:
            miss.append(w)

    # 顺带检查有没有分片里写了、但词库根本没有的词
    known = set(it.get('w', '') for it in data['list'])
    orphan = [k for k in table if k not in known]

    js = 'module.exports = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    io.open(dst, 'w', encoding='utf-8').write(js)

    log('')
    log('=== 结果 ===')
    log('写出：%s（%.2f MB）' % (dst, os.path.getsize(dst) / 1048576))
    log('已配上例句：%d / %d' % (hit, len(data['list'])))
    log('仍缺例句：%d' % (len(data['list']) - hit))
    if orphan:
        log('分片里有但词库没有的词（%d 个，前 20）：%s' % (len(orphan), '、'.join(orphan[:20])))


if __name__ == '__main__':
    main()
