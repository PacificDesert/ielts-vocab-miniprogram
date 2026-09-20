# -*- coding: utf-8 -*-
"""
用真实词库渲染出可在浏览器直接打开的界面预览。

    python tools/build_preview.py

读取 data/words.js，注入 preview/template.html，输出 preview/index.html。
"""
import io, json, os, sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SRC = os.path.join(ROOT, 'data', 'words.js')
TPL = os.path.join(ROOT, 'preview', 'template.html')
DST = os.path.join(ROOT, 'preview', 'index.html')


def main():
    for p in (SRC, TPL):
        if not os.path.exists(p):
            sys.exit('缺少文件：%s' % p)

    raw = io.open(SRC, encoding='utf-8').read()
    data = json.loads(raw[raw.index('{'): raw.rindex('}') + 1])
    keep = ('w', 'ph', 'cn', 'ch', 'ex', 'dr', 'sim')
    data['list'] = [{k: it[k] for k in keep if k in it} for it in data['list']]

    payload = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    html = io.open(TPL, encoding='utf-8').read()
    if '__WORDS__' not in html:
        sys.exit('template.html 里找不到 __WORDS__ 占位符')

    with io.open(DST, 'w', encoding='utf-8') as f:
        f.write(html.replace('__WORDS__', payload))

    print('preview: %d words -> %s (%d KB)' % (len(data['list']), DST, os.path.getsize(DST) // 1024))


if __name__ == '__main__':
    main()
