"""Draw the Hollow Pines app icons (assets/icons/). Run: python3 tools/make_icons.py"""
import os
from PIL import Image, ImageDraw, ImageFilter
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'icons')
PINE, PINE2, EMBER, GOLD, PAPER = (29, 42, 37), (42, 59, 52), (232, 131, 58), (233, 196, 106), (244, 234, 211)

def art(size, scale):
    """Night sky, a gold moon and three layered pines on a hill. scale<1 keeps the art inside the maskable safe zone."""
    S = 1024; im = Image.new('RGB', (S, S), PINE); d = ImageDraw.Draw(im)
    for y in range(S):  # sky gradient: deep pine at the top, warmer toward the horizon
        t = y / S; d.line([(0, y), (S, y)], fill=tuple(int(PINE[i] + (PINE2[i] - PINE[i]) * t + (EMBER[i] - PINE2[i]) * max(0, t - 0.55) * 0.35) for i in range(3)))
    c, k = S / 2, scale
    P = lambda x, y: (c + (x - c) * k, c + (y - c) * k)
    glow = Image.new('L', (S, S), 0); ImageDraw.Draw(glow).ellipse([*P(600, 170), *P(820, 390)], fill=120); im.paste(GOLD, (0, 0), glow.filter(ImageFilter.GaussianBlur(40)))
    d.ellipse([*P(630, 200), *P(790, 360)], fill=GOLD)
    d.ellipse([*P(-200, 760), *P(1224, 1400)], fill=(46, 82, 58))  # hill
    def pine(cx, base, h, w, cols):
        trunk = (90, 62, 40); d.rectangle([*P(cx - w * 0.07, base - h * 0.12), *P(cx + w * 0.07, base + 10)], fill=trunk)
        for i, col in enumerate(cols):  # three stacked tiers, lighter toward the top
            tb = base - h * 0.12 - i * h * 0.26; th = h * 0.42; tw = w * (1 - i * 0.22)
            d.polygon([P(cx - tw / 2, tb), P(cx + tw / 2, tb), P(cx, tb - th)], fill=col)
    pine(300, 840, 430, 300, [(38, 86, 58), (47, 107, 69), (58, 125, 79)])
    pine(740, 860, 380, 260, [(38, 86, 58), (47, 107, 69), (58, 125, 79)])
    pine(515, 900, 600, 400, [(47, 107, 69), (58, 125, 79), (75, 145, 96)])
    return im.resize((size, size), Image.LANCZOS)

os.makedirs(OUT, exist_ok=True)
art(192, 0.92).save(os.path.join(OUT, 'icon-192.png'))
art(512, 0.92).save(os.path.join(OUT, 'icon-512.png'))
art(512, 0.72).save(os.path.join(OUT, 'icon-maskable-512.png'))   # content inside the central 80% safe zone
art(180, 0.92).save(os.path.join(OUT, 'apple-touch-icon.png'))
print('icons written to', OUT)
