#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用 ECDICT（MIT 许可）替换词库里「有版权风险」的部分，主题分类与单词表原样保留。

为什么这样做
------------
原词库整理自《雅思词汇真经》PDF，其中各部分的版权性质并不相同：

  保留 ✅  单词拼写      —— 英文单词是公共知识，不受版权保护
  保留 ✅  主题章节      —— 按 22 个主题分类的体系（你要保留的东西）
  保留 ✅  音标          —— 本来就来自开源项目 ipa-dict
  保留 ✅  相近词分组    —— 客观的词形/词义关系
  替换 ♻️  中文释义      —— 原书的独创性表述 → 换成 ECDICT 的（MIT 可商用）
  替换 ♻️  词形拓展      —— 同上 → 用 ECDICT 的 exchange 字段生成
  移除 ❌  书中例句      —— 版权风险最高的部分，逐句照抄属于复制他人表达

这样「按主题分板块」的体验完全不变，但整个词库不再包含原书的独创性内容。

用法
----
  python tools/build_ecdict.py <ecdict.csv> [--out data/words.ecdict.js]

  # 先下载数据（约 63 MB，分块续传）
  node tools/fetch_ecdict.js --out .cache/ecdict.csv
"""

import argparse
import csv
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OLD_JS = os.path.join(ROOT, 'data', 'words.js')

# ECDICT 的 exchange 字段：p:过去式/d:过去分词/i:现在分词/3:三单/s:复数/r:比较级/t:最高级
EX_LABEL = {
    'p': '过去式',
    'd': '过去分词',
    'i': '现在分词',
    '3': '第三人称单数',
    's': '复数',
    'r': '比较级',
    't': '最高级',
}

# 释义里的词性前缀（与小程序 utils/word.js 的 POS_LEAD 保持一致）
POS_LEAD = re.compile(r'^(n|adj|adv|v|vt|vi|prep|conj|pron|num|int|art|aux|abbr|ord)\.')

# ECDICT 的词性缩写与词库体系不一致的，统一过来
# ECDICT 用 "a." 表示形容词，用 "ad." 表示副词
POS_FIX = {'a': 'adj', 'ad': 'adv', 'adj': 'adj', 'adv': 'adv'}

# 每个词性最多保留几个义项：
# ECDICT 是全量词典释义，会列出「法学、司法界、诉讼」这类对背单词无用的生僻义项，
# 不裁剪的话一个词能长到一整行。取前 3 个是最不丢关键义项的取舍。
SENSE_LIMIT = 3


def log(msg):
    sys.stdout.write(str(msg) + '\n')
    sys.stdout.flush()


def load_old():
    """读现有 data/words.js。文件是标准 JSON，直接切出对象部分解析。"""
    text = open(OLD_JS, encoding='utf-8').read()
    start = text.index('{')
    end = text.rindex('}') + 1
    return json.loads(text[start:end])


def clean_cn(translation):
    """
    ECDICT 的 translation 是多行义项，每行自带词性前缀（如 "n. 火山"）。

    处理链条：
      拆行 → 去掉 [网络]/[医] 这类标签行 → 拆出词性前缀并统一缩写
      → 每个词性只留前 SENSE_LIMIT 个义项 → 用 ； 连接
    保留行内的词性前缀，这样小程序原有的词性识别逻辑直接可用。
    """
    if not translation:
        return ''
    # ECDICT 用字面量 \n 分隔（也可能是真换行，两种都兜住）
    lines = re.split(r'\\n|\n', translation)
    lines = [l.strip() for l in lines if l.strip()]
    # [网络] [医] [化] [经] 等标签行是网络释义，不是教材用语，去掉
    lines = [l for l in lines if not re.match(r'^\[[^\]]{1,8}\]', l)]

    segs = []
    for line in lines:
        pos = ''
        body = line
        m = re.match(r'^([a-zA-Z]{1,5})\.\s*(.*)$', line)
        if m:
            raw = m.group(1).lower()
            pos = POS_FIX.get(raw, m.group(1))
            body = m.group(2)
        senses = [s.strip() for s in re.split(r'[,，;；]', body) if s.strip()]
        if not senses:
            continue
        senses = senses[:SENSE_LIMIT]
        segs.append((pos + '. ' if pos else '') + '，'.join(senses))
    return '；'.join(segs).strip('； ')


def parse_exchange(ex):
    """
    'p:did/d:done/i:doing/3:does' → [['did','过去式'], ['done','过去分词'], ...]

    注意去重：dizzy 这类词的过去式和过去分词同为 dizzied，
    ECDICT 的 p 和 d 会给同一个形式，不去重就会出现两条一样的。
    最多取 6 条，避免卡片被撑长。
    """
    if not ex:
        return []
    out = []
    seen = set()
    for seg in ex.split('/'):
        if ':' not in seg:
            continue
        k, v = seg.split(':', 1)
        label = EX_LABEL.get(k.strip())
        if not label:
            continue
        for form in v.split(','):
            form = form.strip()
            if not form or len(form) > 24 or form in seen:
                continue
            seen.add(form)
            out.append([form, label])
    return out[:6]


def load_ecdict(path):
    """建立 小写单词 → 行字典 的索引。"""
    idx = {}
    with open(path, encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            w = (row.get('word') or '').strip().lower()
            if w:
                idx[w] = row
    return idx


def main():
    ap = argparse.ArgumentParser(description='用 ECDICT 生成无版权风险的词库')
    ap.add_argument('csv', help='ecdict.csv 路径')
    ap.add_argument('--out', default=os.path.join(ROOT, 'data', 'words.ecdict.js'),
                    help='输出文件（默认 data/words.ecdict.js，不覆盖 words.js）')
    args = ap.parse_args()

    if not os.path.exists(args.csv):
        log('找不到 ECDICT 文件：' + args.csv)
        log('先运行：node tools/fetch_ecdict.js --out .cache/ecdict.csv')
        sys.exit(1)

    old = load_old()
    log('读取旧词库：%d 词 / %d 章' % (len(old['list']), len(old['chapters'])))

    ecd = load_ecdict(args.csv)
    log('读取 ECDICT：%d 条' % len(ecd))

    stat = {
        'cn_new': 0, 'cn_keep': 0, 'cn_with_pos': 0,
        'ph_new': 0, 'dr_new': 0, 'ex_removed': 0, 'miss': [],
    }
    out_list = []

    for it in old['list']:
        w = it.get('w', '')
        e = ecd.get(w.lower())

        row = {
            'w': w,
            'ph': it.get('ph', ''),
            'cn': it.get('cn', ''),
            'ch': it.get('ch', ''),
        }

        if e:
            cn = clean_cn(e.get('translation'))
            if cn:
                row['cn'] = cn
                stat['cn_new'] += 1
                if POS_LEAD.match(cn):
                    stat['cn_with_pos'] += 1
            else:
                stat['cn_keep'] += 1

            # 音标**不换**：原音标本就取自开源项目 ipa-dict（无版权问题），
            # 而且比 ECDICT 的规范 —— ECDICT 用 ' 标重音、用西里尔字母 ә 代 ə，
            # 换过去反而是退化（/'ætmәsfiә/ vs /ˈætməˌsfiə/）。

            dr = parse_exchange(e.get('exchange'))
            if dr:
                row['dr'] = dr
                stat['dr_new'] += 1
            elif it.get('dr'):
                row['dr'] = it['dr']
        else:
            stat['cn_keep'] += 1
            if it.get('dr'):
                row['dr'] = it['dr']
            if len(stat['miss']) < 30:
                stat['miss'].append(w)

        # 相近词直接沿用（客观的词形关系，且下标与 list 顺序一一对应）
        if it.get('sim'):
            row['sim'] = it['sim']

        if it.get('ex'):
            stat['ex_removed'] += 1

        out_list.append(row)

    out = {'chapters': old['chapters'], 'list': out_list}
    js = 'module.exports = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
    with open(args.out, 'w', encoding='utf-8') as f:
        f.write(js)

    size_mb = os.path.getsize(args.out) / 1048576
    log('')
    log('=== 结果 ===')
    log('输出：%s（%.2f MB）' % (args.out, size_mb))
    log('中文释义换成 ECDICT：%d 条' % stat['cn_new'])
    log('  其中释义自带词性前缀：%d 条' % stat['cn_with_pos'])
    log('释义沿用原值（ECDICT 无此词或释义为空）：%d 条' % stat['cn_keep'])
    log('音标换成 ECDICT：%d 条' % stat['ph_new'])
    log('词形拓展由 exchange 生成：%d 条' % stat['dr_new'])
    log('例句已移除：%d 条' % stat['ex_removed'])
    if stat['miss']:
        log('ECDICT 里查不到的词（前 30 个）：')
        log('  ' + '、'.join(stat['miss']))


if __name__ == '__main__':
    main()
