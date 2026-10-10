#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用 LLM 批量生成原创例句，输出成 tools/sentences/chXX.js 分片。

生成的例句是模型原创的，不摘抄任何出版物，因此没有版权风险，
可以替代原书例句用于上架。

用法
----
  # key 走环境变量，不落盘、不进仓库
  set DEEPSEEK_API_KEY=sk-xxx          (Windows cmd)
  $env:DEEPSEEK_API_KEY="sk-xxx"       (PowerShell)
  export DEEPSEEK_API_KEY=sk-xxx       (bash)

  python tools/gen_sentences.py                  # 补齐所有缺例句的章节
  python tools/gen_sentences.py --chapters 6-22  # 只做第 6~22 章
  python tools/gen_sentences.py --chapters 6     # 只做第 6 章
  python tools/gen_sentences.py --dry-run        # 只列出会做哪些，不调 API

设计要点
--------
- **断点续做**：已有的分片文件会被跳过，中断后重跑不会重复消耗额度。
- **小批次**：每批默认 25 个词。批太大模型容易漏词或输出截断。
- **逐条校验**：例句必须真的包含目标词（允许屈折形式），不合格的会被记下来重试。
- 输出前会校验，**不合格先记录再写盘**，避免半成品分片被当成完成品跳过。
"""

import argparse
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORDS_JS = os.path.join(ROOT, 'data', 'words.ecdict.js')
SENT_DIR = os.path.join(ROOT, 'tools', 'sentences')

API_URL = 'https://api.deepseek.com/chat/completions'
MODEL = 'deepseek-chat'
# 每批词数。**别调大**：25 词时输出太长，模型会在 JSON 末尾被截断
# （报错位置集中在 column 2600~3500，正好是第 17~23 个词），
# 整批直接判废、白烧额度。12 词实测稳定。
BATCH = 12
# 显式给足输出上限，避免被默认值截断
MAX_TOKENS = 8000
MAX_RETRY = 4


def log(msg):
    sys.stdout.write(str(msg) + '\n')
    sys.stdout.flush()


def load_words():
    """读词库，返回 [(章节, [单词...]), ...]，保持原有顺序。"""
    text = io.open(WORDS_JS, encoding='utf-8').read()
    data = json.loads(text[text.index('{'): text.rindex('}') + 1])
    groups = []
    for ch in data['chapters']:
        ws = [it['w'] for it in data['list'] if it.get('ch') == ch]
        if ws:
            groups.append((ch, ws))
    return groups


def existing_words():
    """已经生成过的词（扫所有分片）。"""
    have = set()
    if not os.path.isdir(SENT_DIR):
        return have
    for f in os.listdir(SENT_DIR):
        if not re.match(r'^ch\d+[a-z]?\.js$', f):
            continue
        p = os.path.join(SENT_DIR, f)
        try:
            t = io.open(p, encoding='utf-8').read()
            have |= set(json.loads(t[t.index('{'): t.rindex('}') + 1]).keys())
        except Exception:
            log('  ! 分片解析失败，已跳过：' + f)
    return have


def build_prompt(words, chapter):
    return """为下列雅思词汇各写一条英文例句，并给出中文翻译。

要求：
1. 英文例句自然、地道，长度 10-20 词，语言难度对标雅思 6.5-7 分
2. 例句里必须出现目标词本身，允许使用它的屈折形式（复数、过去式、现在分词等）
3. 中文翻译准确、通顺，用简体中文
4. 各条例句的句式要有变化，不要都用同一种开头
5. 语境尽量贴近「%s」这一主题，但不要生硬

词汇列表：
%s

只返回 JSON，格式如下（不要有任何其他说明文字）：
{"单词": ["English sentence.", "中文翻译。"], ...}""" % (chapter, '\n'.join(words))


def call_api(words, chapter, api_key):
    body = json.dumps({
        'model': MODEL,
        'messages': [{'role': 'user', 'content': build_prompt(words, chapter)}],
        'response_format': {'type': 'json_object'},
        'temperature': 1.0,
        'max_tokens': MAX_TOKENS,
    }).encode('utf-8')

    req = urllib.request.Request(API_URL, data=body, headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + api_key,
    })
    with urllib.request.urlopen(req, timeout=240) as r:
        data = json.loads(r.read().decode('utf-8'))
    return json.loads(data['choices'][0]['message']['content'])


def looks_ok(word, pair):
    """粗校验：结构对 + 英文里含目标词（允许屈折形式）"""
    if not isinstance(pair, list) or len(pair) < 2:
        return False
    en = str(pair[0] or '')
    if not en or not str(pair[1] or '').strip():
        return False
    low = en.lower()
    w = word.lower()
    if w in low:
        return True
    # 允许屈折：去掉尾部的 e / y 再找词根，或把连字符当空格
    stem = re.sub(r'(e|y)$', '', w)
    if len(stem) >= 4 and stem in low:
        return True
    if '-' in w and w.replace('-', ' ') in low:
        return True
    if '-' in w:
        parts = [p for p in w.split('-') if len(p) >= 3]
        if parts and all(p in low for p in parts):
            return True
    return False


def gen_batch(words, chapter, api_key, label, depth=0):
    """带重试地生成一批；返回 (合格结果, 不合格词表)。

    整批重试耗尽还有剩时，**把该批拆成两半分别再试**（最多拆 3 层：12→6→3）。
    否则一个坏词会让同批十几个词一起作废 —— 实测过，损失很大。
    """
    pending = list(words)
    got = {}
    for attempt in range(1, MAX_RETRY + 1):
        if not pending:
            break
        try:
            result = call_api(pending, chapter, api_key)
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', 'ignore')[:200]
            log('    HTTP %s：%s' % (e.code, body))
            if e.code in (401, 403):
                raise SystemExit('API 密钥无效或没有权限，已中止。')
            time.sleep(3 * attempt)
            continue
        except Exception as e:
            log('    请求失败（%s），第 %d 次重试' % (e, attempt))
            time.sleep(3 * attempt)
            continue

        still = []
        for w in pending:
            pair = result.get(w)
            if looks_ok(w, pair):
                got[w] = [str(pair[0]).strip(), str(pair[1]).strip()]
            else:
                still.append(w)
        if still:
            log('    %s：本轮 %d 条合格，%d 条待补' % (label, len(got), len(still)))
        pending = still

    if pending and len(pending) > 1 and depth < 3:
        mid = len(pending) // 2
        log('    %s：整批没成，拆成 %d + %d 再试' % (label, mid, len(pending) - mid))
        leftovers = []
        for part in (pending[:mid], pending[mid:]):
            g2, p2 = gen_batch(part, chapter, api_key, label, depth + 1)
            got.update(g2)
            leftovers += p2
        pending = leftovers

    return got, pending


def main():
    ap = argparse.ArgumentParser(description='用 LLM 批量生成原创例句')
    ap.add_argument('--chapters', default='', help='如 6-22 或 6，默认全部未完成的')
    ap.add_argument('--out-prefix', default='ch', help='输出文件名前缀（默认 ch）')
    ap.add_argument('--dry-run', action='store_true', help='只列出计划，不调 API')
    ap.add_argument('--batch', type=int, default=BATCH, help='每批词数（默认 25）')
    args = ap.parse_args()

    api_key = os.environ.get('DEEPSEEK_API_KEY', '').strip()
    if not api_key and not args.dry_run:
        log('缺少 DEEPSEEK_API_KEY 环境变量。')
        log('去 platform.deepseek.com 注册后创建 key，然后设置到环境变量再跑。')
        sys.exit(1)

    groups = load_words()
    have = existing_words()
    log('词库共 %d 章；已有例句 %d 个词' % (len(groups), len(have)))

    # 解析要做的章节范围
    want = None
    if args.chapters:
        want = set()
        for part in args.chapters.split(','):
            part = part.strip()
            if '-' in part:
                a, b = part.split('-')
                want |= set(range(int(a), int(b) + 1))
            else:
                want.add(int(part))

    plans = []
    for idx, (ch, ws) in enumerate(groups, 1):
        if want and idx not in want:
            continue
        todo = [w for w in ws if w not in have]
        if todo:
            plans.append((idx, ch, todo))

    if not plans:
        log('没有需要生成的章节，全部已完成。')
        return

    log('')
    log('=== 计划 ===')
    total = 0
    for idx, ch, todo in plans:
        log('  第 %2d 章 %s：%d 词' % (idx, ch, len(todo)))
        total += len(todo)
    log('  合计 %d 词，约 %d 次 API 调用' % (total, sum((len(t) + args.batch - 1) // args.batch for _, _, t in plans)))

    if args.dry_run:
        log('\n（dry-run，未调用 API）')
        return

    log('')
    for idx, ch, todo in plans:
        name = '%s%02d.js' % (args.out_prefix, idx)
        path = os.path.join(SENT_DIR, name)

        # ⚠️ 不能因为「文件已存在」就跳过整章：
        # 上一次运行可能只写了一半（部分词失败没补上），跳过去那些词就永远补不上。
        # 正确做法是先把已有内容读出来，本次只在它上面「补齐」。
        prev = {}
        if os.path.exists(path):
            try:
                t = io.open(path, encoding='utf-8').read()
                prev = json.loads(t[t.index('{'): t.rindex('}') + 1])
            except Exception:
                log('  ! %s 解析失败，将整体重写' % name)

        log('第 %d 章 %s（待补 %d 词，已有 %d 条）' % (idx, ch, len(todo), len(prev)))
        out = dict(prev)
        failed = []
        for i in range(0, len(todo), args.batch):
            chunk = todo[i:i + args.batch]
            label = '%d/%d' % (i + len(chunk), len(todo))
            got, still = gen_batch(chunk, ch, api_key, label)
            out.update(got)
            failed += still
            log('    %s → 累计 %d 条' % (label, len(out)))
            time.sleep(0.5)

        # 有产出就写盘（保住已成功的部分）；未拿到的词下次重跑会自动补
        if not out:
            log('    本章无任何产出，跳过写盘')
            continue
        if failed:
            log('    ! 仍有 %d 词没拿到合格例句（下次重跑会自动补）：%s'
                % (len(failed), '、'.join(failed[:20])))
        js = 'module.exports = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
        io.open(path, 'w', encoding='utf-8').write(js)
        log('    → 写出 %s（%d 条）' % (name, len(out)))

    log('')
    log('完成。接着跑：python tools/merge_sentences.py data/words.ecdict.js')


if __name__ == '__main__':
    main()
