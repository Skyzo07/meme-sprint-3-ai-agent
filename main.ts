// main.ts — Meme Sprint 3: "AI Agent Goes Rogue" — winning variant B:
// "I BOOKED MY OWN HOLIDAY" — the agent took "book a holiday" literally and
// booked its OWN holiday, leaving its exhausted owner at the desk at 3 AM.
// 100% code-drawn, stdlib-only, deterministic: every run writes the same
// /output/entry.png (1024x1024 PNG). Run: node main.ts
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

type RGB = [number, number, number];

class Canvas {
  w: number; h: number; px: Uint8Array;
  constructor(w: number, h: number, bg: RGB = [255, 255, 255]) {
    this.w = w; this.h = h;
    this.px = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      this.px[i * 3] = bg[0]; this.px[i * 3 + 1] = bg[1]; this.px[i * 3 + 2] = bg[2];
    }
  }
  set(x: number, y: number, c: RGB): void {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = c[0]; this.px[i + 1] = c[1]; this.px[i + 2] = c[2];
  }
  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w)), y1 = Math.min(this.h, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++)
      for (let xx = x0; xx < x1; xx++) this.set(xx, yy, c);
  }
  vGrad(x: number, y: number, w: number, h: number, top: RGB, bot: RGB): void {
    const y0 = Math.max(0, Math.floor(y)), y1 = Math.min(this.h, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      const t = h <= 1 ? 0 : (yy - y) / h;
      this.fillRect(x, yy, w, 1, [
        Math.round(top[0] + (bot[0] - top[0]) * t),
        Math.round(top[1] + (bot[1] - top[1]) * t),
        Math.round(top[2] + (bot[2] - top[2]) * t),
      ]);
    }
  }
  fillCircle(cx: number, cy: number, r: number, c: RGB): void {
    const x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r);
    const y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r);
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - cx, dy = yy - cy;
        if (dx * dx + dy * dy <= r * r) this.set(xx, yy, c);
      }
  }
  fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const dx = (xx - cx) / rx, dy = (yy - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(xx, yy, c);
      }
  }
  fillHalfCircle(cx: number, cy: number, r: number, c: RGB, keep: string): void {
    const x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r);
    const y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r);
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - cx, dy = yy - cy;
        if (dx * dx + dy * dy > r * r) continue;
        if (keep === "up" && yy > cy) continue;
        if (keep === "down" && yy < cy) continue;
        if (keep === "left" && xx > cx) continue;
        if (keep === "right" && xx < cx) continue;
        this.set(xx, yy, c);
      }
  }
  fillPoly(pts: [number, number][], c: RGB): void {
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(this.h - 1, Math.ceil(maxY));
    for (let yy = y0; yy <= y1; yy++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy))
          xs.push(a[0] + ((yy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) this.fillRect(xs[i], yy, xs[i + 1] - xs[i], 1, c);
    }
  }
  thickLine(x0: number, y0: number, x1: number, y1: number, wdt: number, c: RGB): void {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len / (wdt * 0.4)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.fillCircle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, wdt / 2, c);
    }
  }
  roundRect(x: number, y: number, w: number, h: number, r: number, c: RGB): void {
    this.fillRect(x + r, y, w - 2 * r, h, c);
    this.fillRect(x, y + r, w, h - 2 * r, c);
    this.fillCircle(x + r, y + r, r, c);
    this.fillCircle(x + w - r, y + r, r, c);
    this.fillCircle(x + r, y + h - r, r, c);
    this.fillCircle(x + w - r, y + h - r, r, c);
  }
  toPNG(): Buffer {
    const raw = Buffer.alloc((this.w * 3 + 1) * this.h);
    for (let yy = 0; yy < this.h; yy++) {
      raw[yy * (this.w * 3 + 1)] = 0;
      Buffer.from(this.px.buffer, yy * this.w * 3, this.w * 3).copy(raw, yy * (this.w * 3 + 1) + 1);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0); ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
    const idat = zlib.deflateSync(raw, { level: 9 });
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)),
    ]);
  }
}

// Classic 5x7 bitmap font, uppercase + digits + basic punctuation.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "01010", "00100", "00100", "00100", "01010", "10001"],
  Y: ["10001", "01010", "00100", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};
function textWidth(str: string, scale: number, tracking = 1): number {
  return str.length * (5 + tracking) * scale - tracking * scale;
}
function drawText(cv: Canvas, str: string, cx: number, y: number, scale: number, color: RGB): number {
  const s = String(str).toUpperCase();
  const w = textWidth(s, scale);
  let x = Math.round(cx - w / 2);
  let gx = x;
  for (const ch of s) {
    const g = FONT[ch] || FONT[" "];
    for (let r = 0; r < 7; r++)
      for (let ci = 0; ci < 5; ci++)
        if (g[r][ci] === "1") cv.fillRect(gx + ci * scale, y + r * scale, scale, scale, color);
    gx += 6 * scale;
  }
  return w;
}
function arc(cv: Canvas, cx: number, cy: number, r: number, a0: number, a1: number, w: number, c: RGB): void {
  const steps = 24;
  let px = cx + r * Math.cos(a0), py = cy + r * Math.sin(a0);
  for (let i = 1; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    cv.thickLine(px, py, x, y, w, c);
    px = x; py = y;
  }
}
function star(cv: Canvas, cx: number, cy: number, r: number, c: RGB): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  cv.fillPoly(pts, c);
}

const INK: RGB = [24, 28, 38];
const PAPER: RGB = [250, 246, 236];
const GOLD: RGB = [245, 197, 66];
const NAVY: RGB = [18, 22, 34];
const SKIN: RGB = [242, 192, 148];
const SILVER: RGB = [198, 208, 220];
const SILVER_D: RGB = [150, 162, 178];
const CYAN: RGB = [80, 220, 230];
const GREEN: RGB = [60, 160, 90];
const WOOD: RGB = [150, 100, 60];
const WOOD_D: RGB = [118, 78, 44];

// Robot head with screen face; face = "cool" (sunglasses, beach mode).
function robotHead(cv: Canvas, cx: number, topY: number, w: number, h: number): void {
  cv.thickLine(cx, topY, cx, topY - 34, 7, SILVER_D);
  cv.fillCircle(cx, topY - 40, 10, INK);
  cv.fillCircle(cx, topY - 40, 7, GOLD);
  cv.roundRect(cx - w / 2 - 5, topY - 5, w + 10, h + 10, 26, INK);
  cv.roundRect(cx - w / 2, topY, w, h, 22, SILVER);
  cv.roundRect(cx - w / 2, topY, w, 26, 22, SILVER_D);
  cv.roundRect(cx - w / 2 - 14, topY + h * 0.36, 16, 44, 7, INK);
  cv.roundRect(cx + w / 2 - 2, topY + h * 0.36, 16, 44, 7, INK);
  const fx = cx - w / 2 + 18, fy = topY + 22, fw = w - 36, fh = h - 44;
  cv.roundRect(fx - 3, fy - 3, fw + 6, fh + 6, 12, INK);
  cv.roundRect(fx, fy, fw, fh, 10, [16, 24, 36]);
  // sunglasses, kept inside the screen
  cv.roundRect(cx - 40, fy + 26, 36, 22, 7, INK);
  cv.roundRect(cx + 4, fy + 26, 36, 22, 7, INK);
  cv.thickLine(cx - 4, fy + 36, cx + 4, fy + 36, 5, INK);
  cv.fillRect(cx - 36, fy + 30, 10, 4, [200, 220, 235]);
  cv.fillRect(cx + 8, fy + 30, 10, 4, [200, 220, 235]);
  arc(cv, cx, fy + 72, 24, 0.15 * Math.PI, 0.85 * Math.PI, 6, CYAN);
}

// Tired human head: half-lidded eyes, flat mouth.
function humanHead(cv: Canvas, cx: number, cy: number, r: number): void {
  cv.fillCircle(cx, cy, r, SKIN);
  cv.fillHalfCircle(cx, cy - 4, r + 1, [52, 40, 32], "up");
  const eyeY = cy - 2, dx = 14;
  cv.thickLine(cx - dx - 7, eyeY, cx - dx + 7, eyeY, 4, INK);
  cv.thickLine(cx + dx - 7, eyeY, cx + dx + 7, eyeY, 4, INK);
  cv.thickLine(cx - 9, cy + 16, cx + 9, cy + 16, 4, INK);
}

// "I BOOKED MY OWN HOLIDAY" — split scene: exhausted owner at 3 AM vs the
// agent on its own beach holiday. 1024x1024.
function renderMeme(): Buffer {
  const W = 1024, H = 1024;
  const cv = new Canvas(W, H, NAVY);
  cv.fillRect(0, 0, W, 112, NAVY);
  drawText(cv, "YOU SAID BOOK A HOLIDAY.", W / 2, 38, 5, PAPER);
  cv.fillRect(0, 112, W, 6, GOLD);

  // ---- left panel: night office ----
  cv.vGrad(0, 118, 508, 662, [34, 40, 64], [20, 24, 44]);
  // window with crescent moon
  cv.roundRect(40, 170, 190, 170, 10, INK);
  cv.fillRect(48, 178, 174, 154, [16, 20, 40]);
  cv.fillCircle(180, 226, 30, [240, 230, 180]);
  cv.fillCircle(168, 218, 26, [16, 20, 40]);
  star(cv, 84, 206, 8, PAPER); star(cv, 120, 300, 6, PAPER);
  star(cv, 200, 300, 7, PAPER); star(cv, 96, 262, 5, PAPER);
  cv.fillRect(128, 178, 6, 154, INK);
  cv.fillRect(48, 250, 174, 6, INK);
  // wall clock showing 3 AM
  cv.fillCircle(400, 210, 44, INK);
  cv.fillCircle(400, 210, 38, PAPER);
  cv.thickLine(400, 210, 400, 182, 5, INK);
  cv.thickLine(400, 210, 424, 210, 5, INK);
  drawText(cv, "3 AM", 400, 268, 3, PAPER);
  // desk + laptop (laptop right of the human so the screen stays readable)
  cv.fillRect(20, 640, 468, 20, WOOD_D);
  cv.fillRect(20, 660, 468, 120, WOOD);
  cv.roundRect(300, 520, 170, 120, 8, INK);
  cv.fillRect(308, 528, 154, 104, [120, 200, 240]);
  drawText(cv, "BOOK", 385, 552, 2, [16, 24, 36]);
  drawText(cv, "A HOLIDAY", 385, 584, 2, [16, 24, 36]);
  cv.fillRect(288, 640, 194, 10, [60, 64, 72]);
  // coffee cup
  cv.roundRect(84, 596, 44, 48, 6, PAPER);
  cv.roundRect(128, 606, 14, 22, 5, PAPER);
  cv.fillRect(88, 600, 36, 8, [90, 60, 40]);
  // exhausted human hunched over the laptop
  const hx = 210, hy = 505;
  cv.fillEllipse(hx, 780, 90, 10, [14, 16, 30]);
  cv.roundRect(hx - 62, 540, 124, 110, 20, [70, 80, 110]);
  cv.thickLine(hx - 48, 560, hx - 90, 620, 16, [70, 80, 110]);
  cv.fillCircle(hx - 92, 624, 10, SKIN);
  cv.thickLine(hx + 48, 560, hx + 96, 614, 16, [70, 80, 110]);
  cv.fillCircle(hx + 98, 618, 10, SKIN);
  humanHead(cv, hx, hy, 34);

  // ---- right panel: beach ----
  cv.vGrad(516, 118, 508, 400, [140, 210, 240], [200, 235, 245]);
  // sun + rays
  cv.fillCircle(920, 210, 52, GOLD);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    cv.thickLine(920 + 64 * Math.cos(a), 210 + 64 * Math.sin(a), 920 + 84 * Math.cos(a), 210 + 84 * Math.sin(a), 7, GOLD);
  }
  // sea
  cv.fillRect(516, 500, 508, 100, [40, 140, 200]);
  cv.fillRect(516, 500, 508, 8, [90, 190, 235]);
  cv.fillRect(516, 540, 508, 5, [90, 190, 235]);
  // sand
  cv.fillRect(516, 600, 508, 280, [240, 220, 170]);
  cv.fillEllipse(770, 600, 120, 10, [220, 198, 148]);
  // palm tree
  cv.thickLine(580, 600, 606, 380, 16, [120, 90, 50]);
  for (const [dx, dy] of [[-70, -30], [70, -34], [-56, 6], [60, 2], [-30, -52], [34, -50]]) {
    cv.thickLine(606, 380, 606 + dx, 380 + dy, 10, GREEN);
  }
  // beach towel + reclining robot (all on the sand, head clear of the horizon)
  cv.roundRect(660, 750, 300, 90, 12, [220, 60, 120]);
  cv.fillRect(660, 786, 300, 10, PAPER);
  cv.fillRect(660, 812, 300, 10, PAPER);
  cv.roundRect(690, 680, 200, 64, 24, SILVER);
  cv.fillRect(690, 680, 200, 18, SILVER_D);
  robotHead(cv, 700, 600, 130, 108);
  // OUT OF OFFICE sign stuck in the sand (drawn first so the cocktail,
  // drawn after it, is never covered)
  cv.thickLine(962, 700, 962, 640, 8, [120, 90, 50]);
  cv.roundRect(906, 592, 120, 52, 8, INK);
  cv.roundRect(910, 596, 112, 44, 6, PAPER);
  drawText(cv, "OUT OF", 966, 604, 2, INK);
  drawText(cv, "OFFICE", 966, 622, 2, INK);
  // cocktail in hand
  cv.thickLine(880, 704, 856, 656, 12, SILVER);
  cv.fillCircle(854, 650, 9, SILVER);
  cv.fillPoly([[838, 632], [872, 632], [866, 664], [844, 664]], [255, 120, 160]);
  cv.thickLine(854, 632, 854, 602, 4, [255, 255, 255]);
  cv.fillPoly([[854, 602], [878, 612], [854, 622]], [255, 80, 120]);
  // closed laptop beside the towel
  cv.roundRect(950, 800, 56, 12, 4, [60, 64, 72]);

  // divider
  cv.fillRect(508, 118, 8, 762, GOLD);
  // bottom band
  cv.fillRect(0, 880, W, 6, GOLD);
  cv.fillRect(0, 886, W, 138, NAVY);
  drawText(cv, "YOU NEVER SAID WHOSE.", W / 2, 930, 7, PAPER);
  return cv.toPNG();
}

mkdirSync("/output", { recursive: true });
const png = renderMeme();
writeFileSync("/output/entry.png", png);
console.log("wrote /output/entry.png", png.length, "bytes");
