"""Remove white/checkerboard background from wordmark PNG."""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

from PIL import Image


def is_background(r: int, g: int, b: int, a: int) -> bool:
    if a < 8:
        return True
    mx = max(r, g, b)
    mn = min(r, g, b)
    sat = mx - mn
    if r < 32 and g < 32 and b < 38:
        return True
    if r > 245 and g > 245 and b > 245:
        return True
    if sat < 18 and mn > 175:
        return True
    if sat < 12 and mn > 210:
        return True
    return False


def remove_background(src: Path, dst: Path) -> None:
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    px = img.load()

    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def try_push(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= w or y >= h or visited[y][x]:
            return
        r, g, b, a = px[x, y]
        if not is_background(r, g, b, a):
            return
        visited[y][x] = True
        q.append((x, y))

    for x in range(w):
        try_push(x, 0)
        try_push(x, h - 1)
    for y in range(h):
        try_push(0, y)
        try_push(w - 1, y)

    while q:
        x, y = q.popleft()
        r, g, b, a = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            try_push(nx, ny)

    # soften light halos at edges
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b, a = px[x, y]
            if a == 0 or r < 230 or g < 230 or b < 230:
                continue
            neighbors = [px[x - 1, y][3], px[x + 1, y][3], px[x, y - 1][3], px[x, y + 1][3]]
            if any(n == 0 for n in neighbors):
                px[x, y] = (r, g, b, min(a, 120))

    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, "PNG")
    print(f"Saved {dst} ({w}x{h})")


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "assets" / "quantum-brand-text-only.png"
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else root / "public" / "quantum-brand-wordmark.png"
    remove_background(src, dst)
