#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path
import struct
import zlib


Color = tuple[int, int, int, int]
TRANSPARENT: Color = (0, 0, 0, 0)
BG: Color = (255, 154, 47, 255)
BLUSH: Color = (255, 79, 116, 132)
BORDER: Color = (16, 9, 20, 255)
CARTON: Color = (20, 14, 28, 255)
FRIES: Color = (246, 237, 225, 255)
FORK: Color = (130, 242, 211, 255)
SHADOW: Color = (16, 9, 20, 52)


def clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))


def blend(dst: Color, src: Color) -> Color:
    src_alpha = src[3] / 255
    dst_alpha = dst[3] / 255
    out_alpha = src_alpha + dst_alpha * (1 - src_alpha)
    if out_alpha <= 0:
        return TRANSPARENT

    out_channels = []
    for index in range(3):
        out = (src[index] * src_alpha + dst[index] * dst_alpha * (1 - src_alpha)) / out_alpha
        out_channels.append(round(out))
    out_channels.append(round(out_alpha * 255))
    return tuple(out_channels)  # type: ignore[return-value]


def put(canvas: list[list[Color]], x: int, y: int, color: Color) -> None:
    if y < 0 or y >= len(canvas) or x < 0 or x >= len(canvas[y]):
        return
    canvas[y][x] = blend(canvas[y][x], color)


def draw_rect(canvas: list[list[Color]], x0: int, y0: int, x1: int, y1: int, color: Color) -> None:
    for y in range(y0, y1):
        for x in range(x0, x1):
            put(canvas, x, y, color)


def draw_circle(canvas: list[list[Color]], cx: int, cy: int, radius: int, color: Color) -> None:
    for y in range(cy - radius, cy + radius + 1):
        for x in range(cx - radius, cx + radius + 1):
            dx = x - cx
            dy = y - cy
            if dx * dx + dy * dy <= radius * radius:
                put(canvas, x, y, color)


def draw_rounded_rect(canvas: list[list[Color]], x0: int, y0: int, x1: int, y1: int, radius: int, color: Color) -> None:
    radius = max(0, radius)
    width = x1 - x0
    height = y1 - y0
    if width <= 0 or height <= 0:
        return
    radius = min(radius, width // 2, height // 2)

    for y in range(y0, y1):
        for x in range(x0, x1):
            nearest_x = clamp(x, x0 + radius, x1 - radius - 1) if radius else x
            nearest_y = clamp(y, y0 + radius, y1 - radius - 1) if radius else y
            dx = x - nearest_x
            dy = y - nearest_y
            if dx * dx + dy * dy <= radius * radius:
                put(canvas, x, y, color)


def write_png(path: Path, canvas: list[list[Color]]) -> None:
    height = len(canvas)
    width = len(canvas[0]) if canvas else 0
    raw = b''.join(
        b'\x00' + b''.join(bytes(pixel) for pixel in row)
        for row in canvas
    )

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack('>I', len(data))
            + tag
            + data
            + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png = header + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    path.write_bytes(png)


def draw_icon(size: int) -> list[list[Color]]:
    canvas = [[TRANSPARENT for _ in range(size)] for _ in range(size)]
    inset = max(1, round(size * 0.08))
    radius = max(2, round(size * 0.2))

    draw_rounded_rect(canvas, inset, inset + 1, size - inset, size - inset + 1, radius, SHADOW)
    draw_rounded_rect(canvas, inset, inset, size - inset, size - inset, radius, BORDER)
    draw_rounded_rect(canvas, inset + 1, inset + 1, size - inset - 1, size - inset - 1, max(1, radius - 1), BG)

    draw_circle(canvas, round(size * 0.72), round(size * 0.7), round(size * 0.24), BLUSH)

    fry_width = max(1, round(size * 0.08))
    fry_bottom = round(size * 0.55)
    fry_specs = [
        (0.31, 0.18),
        (0.41, 0.14),
        (0.52, 0.19),
        (0.63, 0.16),
    ]
    for x_ratio, top_ratio in fry_specs:
        x0 = round(size * x_ratio)
        x1 = x0 + fry_width
        y0 = round(size * top_ratio)
        draw_rounded_rect(canvas, x0, y0, x1, fry_bottom, max(1, fry_width // 2), FRIES)

    carton_x0 = round(size * 0.26)
    carton_y0 = round(size * 0.46)
    carton_x1 = round(size * 0.76)
    carton_y1 = round(size * 0.82)
    draw_rounded_rect(canvas, carton_x0, carton_y0, carton_x1, carton_y1, max(2, round(size * 0.08)), CARTON)
    draw_rect(canvas, carton_x0, carton_y0, carton_x1, carton_y0 + max(1, size // 16), BLUSH)

    fork_x0 = round(size * 0.17)
    fork_x1 = fork_x0 + max(1, round(size * 0.07))
    handle_y0 = round(size * 0.32)
    handle_y1 = round(size * 0.78)
    draw_rounded_rect(canvas, fork_x0, handle_y0, fork_x1, handle_y1, max(1, size // 18), FORK)
    prong_height = max(2, round(size * 0.12))
    prong_gap = max(1, size // 32)
    prong_width = max(1, round(size * 0.04))
    for prong_index in range(3):
        prong_x0 = fork_x0 - prong_width + prong_index * (prong_width + prong_gap)
        prong_x1 = prong_x0 + prong_width
        draw_rect(canvas, prong_x0, handle_y0 - prong_height, prong_x1, handle_y0, FORK)

    return canvas


def main() -> None:
    app_root = Path(__file__).resolve().parents[1]
    public_dir = app_root / 'public'
    public_dir.mkdir(parents=True, exist_ok=True)

    for size in (16, 32, 48, 96, 128):
        write_png(public_dir / f'icon-{size}.png', draw_icon(size))


if __name__ == '__main__':
    main()
