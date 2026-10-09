#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从雅思口语题库 PDF 提取题面，生成 data/speaking.js。

只取**题目**（公开信息），刻意不取该册的示范答案与翻译
（那是原作者的原创内容，用 AI 现场生成示范更干净）。

PDF 的三段排版（按页顺序）：
    <话题中文名>            <- Part 1
    <话题英文名>
    PA RT 1
    01
    <问题英文>
    英文 / <示范答案> / 中文 / <翻译>

    <话题中文名>            <- Part 2 题卡
    PA RT 2
    <题卡标题>
    You should say:
    <要点...>
    示范作答 / <答案>

    Part 3 · 讨论题Discussion   <- Part 3，归属**最近的一张开题卡**
    01
    <问题英文>
    英文 / <答案> / 中文 / <翻译>

用法：
  python tools/build_speaking.py <题库.pdf> [--out data/speaking.js]
"""
import argparse
import io
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 页眉页脚噪声。**不能**写 `|\d+` —— 题号（01、02…）会被一并过滤，Part 1 就全空。
# **也不能**把 `PA RT \d` 放进来 —— 那正是我们要找的分段标记。
NOISE = re.compile(r'^(阿猛Amon|雅思口语题库|Part 1 ·.*|Part 2|[0-9]+\s*/\s*4[0-9])\s*$')
CN = re.compile(r'[\u4e00-\u9fa5]')
QNUM = re.compile(r'^\d{2}$')
# Part 3 的段落标记（实际文本是 "Part 3 · 讨论题Discussion"）
P3_MARK = re.compile(r'^Part\s*3')
P1_MARK = re.compile(r'^PA\s*RT\s*1$')
P2_MARK = re.compile(r'^PA\s*RT\s*2$')


def load_lines(pdf_path):
    """按页返回清洗后的行，页与页之间不丢顺序。"""
    import pymupdf
    doc = pymupdf.open(pdf_path)
    pages = []
    for i in range(doc.page_count):
        lines = []
        for raw in doc[i].get_text().split('\n'):
            line = raw.strip()
            if line and not NOISE.match(line):
                lines.append(line)
        pages.append(lines)
    return pages


def is_question(line):
    """问题：纯英文、以问号结尾、不是「英文/中文」标记。"""
    return bool(line) and not CN.search(line) and line.endswith('?') \
        and line not in ('英文', '中文')


def main():
    ap = argparse.ArgumentParser(description='从口语题库 PDF 提取题面')
    ap.add_argument('pdf')
    ap.add_argument('--out', default=os.path.join(ROOT, 'data', 'speaking.js'))
    args = ap.parse_args()

    pages = load_lines(args.pdf)
    print('PDF 共 %d 页（清洗后）' % len(pages))

    part1 = []
    part2 = []
    mode = None          # 'p1' | 'p2' | 'p3'
    cur_topic = None     # Part 1 当前话题
    cur_card = None      # Part 2 当前题卡（Part 3 挂到它上面）

    for lines in pages:
        j = 0
        while j < len(lines):
            line = lines[j]

            if P1_MARK.match(line):
                mode = 'p1'
                # PA RT 1 之前两行：话题中文名、英文名
                topic_cn = lines[j - 2] if j >= 2 else ''
                topic_en = lines[j - 1] if j >= 1 else ''
                cur_topic = {
                    'id': 'p1-%02d' % (len(part1) + 1),
                    'topic': topic_cn,
                    'topicEn': topic_en,
                    'questions': []
                }
                part1.append(cur_topic)
                j += 1
                continue

            if P2_MARK.match(line):
                mode = 'p2'
                cur_topic = None                      # 离开 Part 1，避免 Part 3 混进来
                topic_cn = lines[j - 1] if j >= 1 else ''
                title = lines[j + 1] if j + 1 < len(lines) else ''
                points = []
                k = j + 2
                while k < len(lines) and lines[k] != '示范作答':
                    if lines[k] != 'You should say:':
                        points.append(lines[k])
                    k += 1
                cur_card = {
                    'id': 'p2-%02d' % (len(part2) + 1),
                    'topic': topic_cn,
                    'card': {'title': title, 'points': points},
                    'part3': []
                }
                part2.append(cur_card)
                j = k + 1
                continue

            if P3_MARK.match(line):
                mode = 'p3'
                j += 1
                continue

            if mode == 'p1' and cur_topic is not None and QNUM.match(line):
                nxt = lines[j + 1] if j + 1 < len(lines) else ''
                if is_question(nxt):
                    cur_topic['questions'].append({'en': nxt})
                    j += 2
                    continue

            if mode == 'p3' and cur_card is not None and QNUM.match(line):
                nxt = lines[j + 1] if j + 1 < len(lines) else ''
                if is_question(nxt):
                    cur_card['part3'].append({'en': nxt})
                    j += 2
                    continue

            j += 1

    part1 = [t for t in part1 if t['questions']]
    for n, t in enumerate(part1, 1):
        t['id'] = 'p1-%02d' % n

    q1 = sum(len(t['questions']) for t in part1)
    q3 = sum(len(c['part3']) for c in part2)
    print('Part 1：%d 个话题 / %d 道问题' % (len(part1), q1))
    for t in part1:
        print('   %s %s（%s）— %d 问' % (t['id'], t['topic'], t['topicEn'], len(t['questions'])))
    print('Part 2：%d 套题卡 / 附带 %d 道 Part 3 讨论题' % (len(part2), q3))

    data = {
        'source': '雅思口语题库 2026 年 9-12 月（仅提取题面，示范答案未采用）',
        'part1': part1,
        'part2': part2
    }
    js = 'module.exports = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    io.open(args.out, 'w', encoding='utf-8').write(js)
    print('\n已写出 %s（%.1f KB）' % (args.out, os.path.getsize(args.out) / 1024))


if __name__ == '__main__':
    main()
