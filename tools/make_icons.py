# -*- coding: utf-8 -*-
"""生成 tabBar 图标（81x81 PNG）。纯标准库实现，4 倍超采样抗锯齿。"""
import os, math, zlib, struct

SIZE = 81
SS = 4
N = SIZE * SS
GRAY = (142, 142, 147, 255)
BLUE = (0, 122, 255, 255)
CLEAR = (0, 0, 0, 0)


class Canvas:
    def __init__(self):
        self.px = [[(0, 0, 0, 0)] * N for _ in range(N)]
        self.erase = False

    def _blend(self, dst, src):
        a = src[3] / 255.0
        b = dst[3] / 255.0
        out_a = a + b * (1 - a)
        if out_a <= 0:
            return (0, 0, 0, 0)
        return tuple(int(round((src[i] * a + dst[i] * b * (1 - a)) / out_a)) for i in range(3)) + (int(round(out_a * 255)),)

    def put(self, x, y, c):
        if not (0 <= x < N and 0 <= y < N):
            return
        self.px[y][x] = (0, 0, 0, 0) if self.erase else self._blend(self.px[y][x], c)

    def circle(self, cx, cy, r, c):
        cx, cy, r = cx * SS, cy * SS, r * SS
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    self.put(x, y, c)

    def rrect(self, x0, y0, x1, y1, r, c):
        x0, y0, x1, y1, r = x0 * SS, y0 * SS, x1 * SS, y1 * SS, r * SS
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                dx = max(x0 + r - x, x - (x1 - r), 0)
                dy = max(y0 + r - y, y - (y1 - r), 0)
                if dx * dx + dy * dy <= r * r:
                    self.put(x, y, c)

    def seg(self, x0, y0, x1, y1, w, c):
        x0, y0, x1, y1, w = x0 * SS, y0 * SS, x1 * SS, y1 * SS, w * SS / 2
        vx, vy = x1 - x0, y1 - y0
        L2 = vx * vx + vy * vy
        for y in range(int(min(y0, y1) - w) - 1, int(max(y0, y1) + w) + 2):
            for x in range(int(min(x0, x1) - w) - 1, int(max(x0, x1) + w) + 2):
                t = 0 if L2 == 0 else max(0, min(1, ((x - x0) * vx + (y - y0) * vy) / L2))
                dx, dy = x - (x0 + t * vx), y - (y0 + t * vy)
                if dx * dx + dy * dy <= w * w:
                    self.put(x, y, c)

    def ring(self, cx, cy, r, w, c, a0, a1):
        cx, cy, r, w = cx * SS, cy * SS, r * SS, w * SS
        for y in range(int(cy - r - w), int(cy + r + w) + 2):
            for x in range(int(cx - r - w), int(cx + r + w) + 2):
                d = math.hypot(x - cx, y - cy)
                if r - w <= d <= r:
                    ang = math.degrees(math.atan2(x - cx, cy - y)) % 360
                    if (a0 <= ang < a1) if a0 < a1 else (ang >= a0 or ang < a1):
                        self.put(x, y, c)


def icon_study(cv, c):
    """记忆卡片 + 对勾"""
    cv.rrect(15, 21, 66, 60, 11, c)
    cv.erase = True
    cv.seg(29, 41, 37, 48, 7, c)
    cv.seg(37, 48, 53, 31, 7, c)
    cv.erase = False


def icon_book(cv, c):
    """词库笔记本"""
    cv.rrect(15, 18, 66, 63, 9, c)
    cv.erase = True
    cv.rrect(25, 22, 29, 59, 1.5, c)
    cv.rrect(36, 29, 57, 33, 2, c)
    cv.rrect(36, 39, 51, 43, 2, c)
    cv.rrect(36, 49, 57, 53, 2, c)
    cv.erase = False


def icon_keyboard(cv, c):
    cv.rrect(11, 24, 70, 57, 10, c)
    cv.erase = True
    for y in (33, 41):
        for i in range(4):
            cv.rrect(19 + i * 12, y, 26 + i * 12, y + 5, 1.5, c)
    cv.rrect(29, 49, 52, 53, 1.5, c)
    cv.erase = False


def icon_me(cv, c):
    cv.circle(40.5, 29, 12, c)
    cv.ring(40.5, 63, 23, 11, c, 270, 90)


ICONS = {
    'study': icon_study,
    'book': icon_book,
    'keyboard': icon_keyboard,
    'me': icon_me
}


def downsample(cv):
    rows = []
    for y in range(SIZE):
        row = []
        for x in range(SIZE):
            sa = sr = sg = sb = 0
            for dy in range(SS):
                for dx in range(SS):
                    p = cv.px[y * SS + dy][x * SS + dx]
                    a = p[3]
                    sa += a
                    sr += p[0] * a
                    sg += p[1] * a
                    sb += p[2] * a
            if sa == 0:
                row.append((0, 0, 0, 0))
            else:
                row.append((int(round(sr / sa)), int(round(sg / sa)), int(round(sb / sa)), int(round(sa / (SS * SS)))))
        rows.append(row)
    return rows


def write_png(path, rows):
    raw = bytearray()
    for row in rows:
        raw.append(0)
        for px in row:
            raw.extend(px)

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', SIZE, SIZE, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    open(path, 'wb').write(png)


def main():
    out = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'images', 'tabbar'))
    os.makedirs(out, exist_ok=True)
    for name, fn in ICONS.items():
        for suffix, color in (('', GRAY), ('_on', BLUE)):
            cv = Canvas()
            fn(cv, color)
            write_png(os.path.join(out, name + suffix + '.png'), downsample(cv))
    print('icons written to', out)


if __name__ == '__main__':
    main()
