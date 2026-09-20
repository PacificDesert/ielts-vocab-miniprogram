# -*- coding: utf-8 -*-
"""
从《雅思词汇真经》PDF 生成小程序词库 data/words.js。

用法：
    python tools/build_words.py <PDF路径> [ECDICT.csv路径]

词表以 PDF 书签（OCR 生成的「单词 + 音标」目录）为准，
中文释义取正文，音标与缺失释义回落到 ECDICT。
"""
import io, json, os, re, sys, collections

try:
    import pymupdf
except ImportError:
    sys.exit('请先安装 pymupdf:  pip install pymupdf')

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
BOOK_TO_PDF = 11               # 书内页码 -> PDF 页序号（0 基）的偏移
INDEX_BOOK_PAGE = 312          # 索引起始书页

CHAPTERS = [(1, "自然地理", 1), (2, "植物研究", 21), (3, "动物保护", 31), (4, "太空探索", 45),
            (5, "学校教育", 53), (6, "科技发明", 85), (7, "文化历史", 95), (8, "语言演化", 103),
            (9, "娱乐运动", 109), (10, "物品材料", 123), (11, "时尚潮流", 135), (12, "饮食健康", 145),
            (13, "建筑场所", 159), (14, "交通旅行", 171), (15, "国家政府", 183), (16, "社会经济", 197),
            (17, "法律法规", 213), (18, "沙场争锋", 223), (19, "社会角色", 241), (20, "行为动作", 253),
            (21, "身心健康", 275), (22, "时间日期", 307)]

STOP = re.compile(r"^[\[［(（【]?\s*(例|记|搭|词源|字根|辨|反|同|派|真题|考点|助记|拓)")
POS = re.compile(r"^(vt|vi|adj|adv|abbr|interj|aux|prep|conj|pron|num|art|ar|ai|aj|at|a«|ad|n|m|v|a)(?![A-Za-z])[.．，,]?\s*", re.I)
# OCR 把 adj/adv/n 认成的样子
MANGLED = {'at': 'adj', 'ai': 'adj', 'aj': 'adj', 'a«': 'adj', 'ar': 'adj', 'a': 'adj', 'ad': 'adv', 'm': 'n'}


def pos_fix(m):
    g = m.group(1).lower()
    return MANGLED.get(g, g) + '. '
HEAD = re.compile(r"^([A-Za-z][A-Za-z\-'. ]{1,28}?)\s*/\s*[^/]{1,45}/\s*(.*)$")
JUNK = re.compile(r"\b(sth|sb)\b|\(|=|^the |^an |^a ")


def load_ecdict(path):
    """读取 ECDICT csv（标准 CSV 引号，需用 csv 模块解析）。"""
    data = {}
    if not path or not os.path.exists(path):
        return data
    import csv
    with io.open(path, 'r', encoding='utf-8', errors='ignore', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            w = (row.get('word') or '').strip().lower()
            if not w or w in data:
                continue
            data[w] = {
                'ph': (row.get('phonetic') or '').strip(),
                'tr': (row.get('translation') or '').strip()
            }
    return data


def ascii_ratio(s):
    return sum(1 for c in s if ord(c) < 128 and c.isalpha()) / max(len(s), 1)


def has_cjk(s):
    return any('\u4e00' <= c <= '\u9fff' for c in s)


RESIDUE = re.compile(r"^[A-Za-z0-9^/\\|}{\[\]()\-–—.,;:' ]{1,30}(?=[\u4e00-\u9fff（(])")
MID_POS = re.compile(r"(?<=[\u4e00-\u9fff）)])\s*(vt|vi|adj|adv|abbr|n|v|ad)(?![A-Za-z])[.．，,]?\s*(?=[\u4e00-\u9fff])", re.I)
LATIN_RUN = re.compile(r"[A-Za-z]{2,}\s+[A-Za-z]{2,}")


def clean_cn(s):
    """去掉 OCR 残留的音标碎片与 (=xxx) 标注，补全夹在中文里的词性标记。"""
    s = re.sub(r"\s+", " ", s).strip(" 　|｜")
    s = re.sub(r"^[（(]\s*=\s*[^)）]*[)）]\s*", "", s)
    m = RESIDUE.match(s)
    if m and not POS.match(s) and ('/' in m.group(0) or '^' in m.group(0)):
        s = s[m.end():]
    s = MID_POS.sub(lambda m: ' ' + pos_fix(m).strip() + ' ', s)
    s = POS.sub(pos_fix, s)
    return s.strip()


def looks_broken(cn):
    """正文抽取失败的典型特征：掺入例句、超长、或以非词性 ASCII 开头。"""
    if not cn:
        return True
    if len(cn) > 42 or '。' in cn or LATIN_RUN.search(cn):
        return True
    if re.match(r"^[A-Za-z]", cn) and not POS.match(cn):
        return True
    return False


def trim_broken(cn):
    """截掉混入的例句，保留前半段释义。"""
    m = LATIN_RUN.search(cn) or re.search(r'。', cn)
    if m:
        cn = cn[:m.start()]
    if len(cn) > 42:
        cn = cn[:42]
    return cn.strip(' 　；;，,、')


def norm_cn(s):
    return clean_cn(s)


# ---------- 音标规范化 ----------
VOWELS = set('aeiouɑɒæʌəɜɐɛɪʊɔœøɘɵɤɯɨʉɞɶy')
STOP_CHARS = set('/ˈˌ.-ːˑ')


def _move_stress(s):
    """把标在元音上的重音符号左移到音节首（ipa-dict 的标注习惯）。"""
    res = ''
    i = 0
    while i < len(s):
        c = s[i]
        if c in 'ˈˌ' and i + 1 < len(s) and s[i + 1] in VOWELS:
            j = len(res)
            while j > 0 and res[j - 1] not in VOWELS and res[j - 1] not in STOP_CHARS:
                j -= 1
            res = res[:j] + c + res[j:]
            i += 1
        else:
            res += c
            i += 1
    return res


def _nuclei(s):
    body = ''.join(c for c in s if c not in '/ˈˌ.')
    n, prev = 0, False
    for c in body:
        v = c in VOWELS
        if v and not prev:
            n += 1
        prev = v
    return n


def _fix_nucleus_stress(s):
    """修正「元音 + 重音符号 + 长音符号」的错位（如 tɔˈːn -> ˈtɔːn）。"""
    out = []
    i = 0
    while i < len(s):
        c = s[i]
        if c in VOWELS and i + 1 < len(s) and s[i + 1] in 'ˈˌ':
            mark = s[i + 1]
            j = i + 2
            length = ''
            if j < len(s) and s[j] == 'ː':
                length = 'ː'
                j += 1
            out.append(mark)
            out.append(c)
            out.append(length)
            i = j
        else:
            out.append(c)
            i += 1
    return ''.join(out)


def tidy_phonetic(p):
    if not p:
        return ''
    s = p.strip().strip('/')
    s = (s.replace('ɹ', 'r').replace('ɡ', 'g')
          .replace('ɐ', 'ə').replace('ɛ', 'e').replace('ᵻ', 'ɪ'))
    s = _fix_nucleus_stress(s)
    s = _move_stress(s)
    if _nuclei(s) <= 1:
        s = s.replace('ˈ', '').replace('ˌ', '')
    return '/' + s + '/'


def clean_head(s):
    return re.sub(r"\s+", " ", s.strip().strip(".,;:·"))


def find_head(lines, key):
    for j, ln in enumerate(lines):
        s = ln.strip()
        if not s or not s.lower().startswith(key):
            continue
        nxt = s[len(key):len(key) + 1]
        if nxt and nxt not in " /":
            continue
        return j, s
    return None, None


# ---------- 例句 / 派生词 ----------
EX_MARK = re.compile(r"^[\[［(（【〔|Il!]{0,2}\s*[例仔侧俐]\s*[\]］)）】〕]{0,3}[.，,：:]?\s*")
SIDE_STOP = re.compile(r"^[\[［(（【]?\s*(搭|辨|反|同|派|真题|考点|助记|拓|词源|字根)")
REC_MARK = re.compile(r"^[\[［(（【]?\s*(记|派|拓)\s*[\]］)）】.，,]?\s*")
PHRASE = re.compile(r"([A-Za-z][A-Za-z\-']{2,})\s*((?:n|v|adj|adv|vt|vi|prep|conj|pron|num)\.?\s*[^A-Za-z]{0,3}[\u4e00-\u9fff][^A-Za-z]{0,20})")


def _stem(w):
    w = w.lower()
    for suf in ('ing', 'ed', 'es', 's', 'ly', 'est', 'er'):
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            return w[:-len(suf)]
    return w


def _contains(en, word):
    low = en.lower()
    st = _stem(word)
    if st and st in low:
        return True
    return len(word) >= 5 and word.lower()[:5] in low


def split_example(text):
    """拆成 (英文原句, 中文翻译)；截断混进来的搭配 / 词形拓展 / 页码。"""
    text = re.sub(r"\s+", " ", text).strip()
    m = re.search(r"[\u4e00-\u9fff]", text)
    if not m:
        return None
    en = text[:m.start()].strip()
    zh = text[m.start():]
    cut = re.search(r"[。！？]", zh)
    if cut:
        zh = zh[:cut.end()]
    ends = [p for p in (en.rfind('.'), en.rfind('!'), en.rfind('?')) if p >= 0]
    if ends:
        en = en[:max(ends) + 1]
    en = re.sub(r"^[^A-Za-z]+", "", en)
    en = re.sub(r"^[a-z]{1,2}\s+(?=[A-Z])", "", en)      # 去掉 OCR 留下的孤立小写字母
    en = re.sub(r"\s+([,.!?;:])", r"\1", en)
    zh = re.sub(r"^[^\u4e00-\u9fff]+", "", zh)
    return en.strip(), zh.strip()


def scan_entry(lines, idx):
    """从词条行往后扫，返回 (例句文本, 派生词文本)。"""
    ex_parts, rec_parts = [], []
    ex_started = rec_started = False
    for s in lines[idx + 1: idx + 22]:
        s = s.strip()
        if not s:
            continue
        if HEAD.match(s):
            break
        if REC_MARK.match(s):
            rec_started, rec_parts = True, rec_parts + [REC_MARK.sub('', s)]
            continue
        m = EX_MARK.match(s)
        if m:
            ex_started = True
            ex_parts.append(s[m.end():].strip())
            continue
        if ex_started:
            if SIDE_STOP.match(s) or (not re.search(r"[A-Za-z]{2,}", s) and not re.search(r"[\u4e00-\u9fff]", s)):
                break
            ex_parts.append(s)
            if len(ex_parts) >= 3:
                break
            continue
        if rec_started:
            rec_parts.append(s)
            continue
        if SIDE_STOP.match(s):
            break
        # 直接以英文句开头的例句（书里并非都带［例］）
        if re.match(r"^[A-Z][A-Za-z' ,\-]{6,}", s) and len(re.findall(r"[A-Za-z]+", s)) >= 4:
            ex_started = True
            ex_parts.append(s)
    return ' '.join(ex_parts), ' '.join(rec_parts)


def parse_records(text, word):
    """从［记］块里挑出与词头同源的派生词。"""
    out, seen = [], set()
    wt = _stem(word)
    for m in PHRASE.finditer(text):
        w = m.group(1)
        lw = w.lower()
        if lw in seen or lw == word.lower() or len(lw) < 4:
            continue
        if lcp(wt, lw) < 3 and wt[:4] not in lw:
            continue
        body = re.sub(r"\s+", " ", m.group(2)).strip()
        body = POS.sub(pos_fix, body)
        if not has_cjk(body):
            continue
        seen.add(lw)
        out.append([w, body[:26]])
        if len(out) >= 4:
            break
    return out


def lcp(a, b):
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n


def compute_similar(entries):
    """形近 / 同源词：同一首字母分桶，按最长公共前缀打分，不足则用同章节补齐。"""
    buckets = {}
    for i, it in enumerate(entries):
        buckets.setdefault(it['w'][:1].lower(), []).append(i)
    by_chapter = {}
    for i, it in enumerate(entries):
        by_chapter.setdefault(it['ch'], []).append(i)

    sim = []
    for i, it in enumerate(entries):
        w = it['w'].lower()
        pool = buckets.get(w[:1], [])
        scored = []
        for j in pool:
            if j == i:
                continue
            o = entries[j]['w'].lower()
            if abs(len(o) - len(w)) > 5:
                continue
            n = lcp(w, o)
            if n < 3:
                continue
            scored.append((n, -abs(len(o) - len(w)), j))
        scored.sort(reverse=True)
        picks = [j for _, _, j in scored[:5]]
        if len(picks) < 3:
            same = by_chapter.get(it['ch'], [])
            for j in same:
                if j == i or j in picks:
                    continue
                picks.append(j)
                if len(picks) >= 5:
                    break
        sim.append(picks)
    return sim


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    pdf_path = sys.argv[1]
    ecdict = load_ecdict(sys.argv[2] if len(sys.argv) > 2 else None)
    print('ECDICT entries:', len(ecdict))

    doc = pymupdf.open(pdf_path)
    pages = [doc[i].get_text() for i in range(doc.page_count)]
    body_end = BOOK_TO_PDF + INDEX_BOOK_PAGE

    bounds = [(BOOK_TO_PDF + bp, name) for _, name, bp in CHAPTERS] + [(body_end, '索引')]

    def chapter_of(p):
        name = ''
        for bp, bn in bounds:
            if bp <= p:
                name = bn
            else:
                break
        return name

    def known(word):
        lw = word.lower()
        if len(lw) < 2 or JUNK.search(word):
            return False
        if not ecdict:
            return True
        if lw in ecdict:
            return True
        toks = [t for t in re.split(r"[\s\-']+", lw) if t]
        return len(toks) > 1 and all(t in ecdict for t in toks)

    # 1) 正文扫描：word /音标/
    cand, order = {}, []
    for pi, text in enumerate(pages):
        if pi >= body_end:
            break
        for li, line in enumerate(text.split('\n')):
            m = HEAD.match(line.strip())
            if not m:
                continue
            w = clean_head(m.group(1))
            if not known(w):
                continue
            k = w.lower()
            if k not in cand:
                cand[k] = {'w': w, 'page': pi, 'cn': ''}
                order.append((pi, li, k))

    # 2) 补上书签里出现但正文没抓到的词
    for lv, title, page in doc.get_toc():
        t = re.sub(r"\s+", " ", title).strip()
        m = re.match(r"^([A-Za-z][A-Za-z\-'. ]{0,28}?)\s*(?:/.*)?$", t)
        if not m:
            continue
        w = clean_head(m.group(1))
        p0 = page - 1
        if p0 >= body_end or not known(w):
            continue
        k = w.lower()
        if k not in cand:
            cand[k] = {'w': w, 'page': p0, 'cn': ''}
            order.append((p0, 999, k))

    # 3) 释义 + 例句 + 派生词抽取
    for pi, li, k in order:
        e = cand[k]
        lines = [l.rstrip() for l in pages[pi].split('\n')]
        idx, hline = find_head(lines, k)
        if idx is None:
            continue
        rest = re.sub(r"^\s*/[^/]*/?\s*", "", hline[len(k):])
        rest = re.sub(r"^\s*/[^/]{0,45}$", "", rest)
        body = []
        for nx in lines[idx + 1: idx + 6]:
            s = nx.strip()
            if not s or STOP.match(s) or HEAD.match(s) or ascii_ratio(s) > 0.55:
                break
            body.append(s)
            if len(body) >= 2:
                break
        cn = norm_cn(rest.strip() + " " + " ".join(body))
        if has_cjk(cn) or not cn:
            e['cn'] = cn

        ex_raw, rec_raw = scan_entry(lines, idx)
        pair = split_example(ex_raw) if ex_raw else None
        if pair and len(pair[0]) >= 12 and _contains(pair[0], k):
            e['ex'] = [pair[0], pair[1]]
        if rec_raw:
            dr = parse_records(rec_raw, k)
            if dr:
                e['dr'] = dr

    # 4) 组装 + 人工校订补丁
    patch_path = os.path.join(ROOT, 'tools', 'manual_fix.json')
    patch = json.load(io.open(patch_path, encoding='utf-8')) if os.path.exists(patch_path) else {}
    fix_cn = {k.lower(): v for k, v in patch.get('cn', {}).items()}
    fix_ph = {k.lower(): v for k, v in patch.get('ph', {}).items()}
    fix_ex = {k.lower(): v for k, v in patch.get('ex', {}).items()}
    dropped = {k.lower() for k in patch.get('drop', [])}

    seen, out = set(), []
    for pi, li, k in sorted(order):
        e = cand[k]
        if k in seen or k in dropped:
            continue
        seen.add(k)
        ec = ecdict.get(k, {})
        cn = fix_cn.get(k)
        patched = cn is not None
        if not patched:
            cn = e['cn']
            if looks_broken(cn):
                fb = re.sub(r"\s+", " ", (ec.get('tr') or '').split('\n')[0]).strip()[:48]
                if has_cjk(fb):
                    cn = fb
                else:
                    cn = trim_broken(cn)
        item = {
            'w': e['w'],
            'ph': fix_ph.get(k) or tidy_phonetic(ec.get('ph', '')),
            'cn': cn,
            'ch': chapter_of(pi)
        }
        if fix_ex.get(k):
            item['ex'] = fix_ex[k]
        elif e.get('ex'):
            item['ex'] = e['ex']
        if e.get('dr'):
            item['dr'] = e['dr']
        out.append(item)

    # 5) 相近词（形近 / 同源）
    similar = compute_similar(out)
    for it, picks in zip(out, similar):
        if picks:
            it['sim'] = picks

    chapters = [name for _, name, _ in CHAPTERS]
    payload = 'module.exports = ' + json.dumps(
        {'chapters': chapters, 'list': out}, ensure_ascii=False, separators=(',', ':')) + ';\n'
    dst = os.path.join(ROOT, 'data', 'words.js')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with io.open(dst, 'w', encoding='utf-8') as f:
        f.write(payload)

    stat = collections.Counter('no_cn' if not it['cn'] else 'ok' for it in out)
    print('words:', len(out), dict(stat))
    print('有例句: %d (%.0f%%)' % (sum(1 for it in out if it.get('ex')), sum(1 for it in out if it.get('ex')) * 100.0 / len(out)))
    print('有派生词: %d (%.0f%%)' % (sum(1 for it in out if it.get('dr')), sum(1 for it in out if it.get('dr')) * 100.0 / len(out)))
    print('有相近词: %d' % sum(1 for it in out if it.get('sim')))
    print('written:', dst, round(len(payload.encode('utf-8')) / 1024), 'KB')


if __name__ == '__main__':
    main()
