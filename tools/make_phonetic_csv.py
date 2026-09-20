# -*- coding: utf-8 -*-
"""
把 ipa-dict 的音标文件转换成 build_words.py 能读的 CSV（word,phonetic,translation）。

先下载音标源（约 1.6 MB）：
    https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/en_UK.txt

用法：
    python tools/make_phonetic_csv.py en_UK.txt tools/phonetic.csv
"""
import io, os, sys


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    src, dst = sys.argv[1], sys.argv[2]
    if not os.path.exists(src):
        sys.exit('找不到源文件：%s' % src)
    n = 0
    with io.open(src, 'r', encoding='utf-8') as f, io.open(dst, 'w', encoding='utf-8', newline='') as o:
        o.write('word,phonetic,translation\n')
        for line in f:
            parts = line.rstrip('\n').split('\t')
            if len(parts) < 2 or not parts[0]:
                continue
            o.write('%s,%s,\n' % (parts[0], parts[1].split(',')[0].strip()))
            n += 1
    print('wrote %d entries -> %s' % (n, dst))


if __name__ == '__main__':
    main()
