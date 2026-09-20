# -*- coding: utf-8 -*-
"""
用真实词库渲染出可在浏览器直接打开的界面预览。

    python tools/build_preview.py

读取 data/words.js 与 images/theme/*.jpg，注入 preview/template.html，
输出 preview/index.html（自包含，章节配图以 data URI 内联）。
"""
import base64, io, json, os, sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SRC = os.path.join(ROOT, 'data', 'words.js')
TPL = os.path.join(ROOT, 'preview', 'template.html')
DST = os.path.join(ROOT, 'preview', 'index.html')
THEME = os.path.join(ROOT, 'images', 'theme')
# 预览用的缩略图尺寸，避免内联后文件过大
THUMB = (420, 236)
QUALITY = 68


def theme_data(chapters):
    """把章节配图压成缩略图并转成 data URI。"""
    try:
        from PIL import Image
    except ImportError:
        print('未安装 Pillow，章节配图将不内联（pip install Pillow）')
        return {}
    out = {}
    for i, name in enumerate(chapters):
        n = i + 1
        p = os.path.join(THEME, '%02d.jpg' % n)
        if not os.path.exists(p):
            continue
        buf = io.BytesIO()
        Image.open(p).convert('RGB').resize(THUMB, Image.LANCZOS).save(
            buf, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
        out[name] = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')
    return out


def main():
    for p in (SRC, TPL):
        if not os.path.exists(p):
            sys.exit('缺少文件：%s' % p)

    raw = io.open(SRC, encoding='utf-8').read()
    data = json.loads(raw[raw.index('{'): raw.rindex('}') + 1])
    keep = ('w', 'ph', 'cn', 'ch', 'ex', 'dr', 'sim')
    data['list'] = [{k: it[k] for k in keep if k in it} for it in data['list']]
    data['theme'] = theme_data(data['chapters'])

    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    html = io.open(TPL, encoding='utf-8').read()
    for token in ('__WORDS__', '__THEME__'):
        if token not in html:
            sys.exit('template.html 里找不到 %s 占位符' % token)

    html = html.replace('__WORDS__', dump({'chapters': data['chapters'], 'list': data['list']}))
    html = html.replace('__THEME__', dump(data['theme']))

    with io.open(DST, 'w', encoding='utf-8') as f:
        f.write(html)

    print('preview: %d words, %d theme images -> %s (%d KB)'
          % (len(data['list']), len(data['theme']), DST, os.path.getsize(DST) // 1024))


if __name__ == '__main__':
    main()
