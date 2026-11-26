// The World in One Day — Wednesday 25 November 2026.
// A one-page newspaper front page, drawn pixel by pixel with Node stdlib only.
// Deterministic: the same bytes on every run. No network, no input files.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER = [247, 242, 230];
const WHITE = [255, 255, 255];
const INK = [20, 20, 20];
const NAVY = [16, 39, 63];
const NAVY2 = [28, 62, 96];
const RED = [168, 35, 28];
const GOLD = [193, 154, 46];
const SKY = [178, 214, 235];
const SKY2 = [214, 234, 245];
const SEA = [24, 78, 110];
const SEA2 = [16, 58, 86];
const ORANGE = [232, 116, 24];
const YELLOW = [245, 196, 66];
const SMOKE = [120, 120, 118];
const GREY = [90, 90, 88];
const LIGHT = [232, 226, 210];
const GREEN = [24, 110, 70];

// ---------------------------------------------------------------- framebuffer
const img = new Uint8Array(W * H * 3);
function px(x: number, y: number, c: number[]): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: number[]): void {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) px(xx, yy, c);
}
function hline(x: number, y: number, w: number, c: number[], t = 1): void {
  rect(x, y, w, t, c);
}
function vline(x: number, y: number, h: number, c: number[], t = 1): void {
  rect(x, y, t, h, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: number[], t = 1): void {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (;;) {
    rect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
function circle(cx: number, cy: number, r: number, c: number[]): void {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) px(cx + x, cy + y, c);
}
function ellipse(cx: number, cy: number, rx: number, ry: number, c: number[]): void {
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++)
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) px(cx + x, cy + y, c);
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: number[]): void {
  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
      const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
      const cc = 1 - a - b;
      if (a >= 0 && b >= 0 && cc >= 0) px(x, y, c);
    }
  }
}
function frame(x: number, y: number, w: number, h: number, c: number[], t = 2): void {
  rect(x, y, w, t, c); rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c); rect(x + w - t, y, t, h, c);
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows of 5 bits, "1" = ink.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
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
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "%": ["10001", "10010", "00010", "00100", "01000", "10010", "10001"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
};

function textWidth(s: string, scale: number): number {
  let w = 0;
  for (const ch of s.toUpperCase()) w += 5 * scale + scale;
  return w - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: number[]): void {
  let cx = x;
  for (const raw of s.toUpperCase()) {
    const g = FONT[raw] || FONT["?"];
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++)
        if (g[r][col] === "1") rect(cx + col * scale, y + r * scale, scale, scale, c);
    cx += 6 * scale;
  }
}
function drawTextCentered(cx: number, y: number, s: string, scale: number, c: number[]): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}
// Wrap plain text to lines that fit maxW at the given scale.
function wrap(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, scale) <= maxW || !cur) cur = trial;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawPara(x: number, y: number, s: string, maxW: number, scale: number, c: number[], lh: number): number {
  const lines = wrap(s, maxW, scale);
  lines.forEach((ln, i) => drawText(x, y + i * lh, ln, scale, c));
  return y + lines.length * lh;
}

// ---------------------------------------------------------------- PNG writer
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function writePng(file: string): void {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(img.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png, { mode: 0o644 });
  fs.chmodSync(file, 0o644); // umask must not leave the output unreadable
}

// ---------------------------------------------------------------- scenes
function drawTankers(x: number, y: number, w: number, h: number): void {
  frame(x, y, w, h, INK, 2);
  rect(x + 2, y + 2, w - 4, Math.floor(h * 0.52), SKY2);
  // sun
  circle(x + w - 62, y + 44, 22, YELLOW);
  // distant smoke
  circle(x + 120, y + 66, 16, SMOKE);
  circle(x + 142, y + 54, 20, SMOKE);
  circle(x + 168, y + 68, 14, SMOKE);
  // sea
  const seaY = y + Math.floor(h * 0.52);
  rect(x + 2, seaY, w - 4, h - Math.floor(h * 0.52) - 2, SEA);
  rect(x + 2, seaY, w - 4, 6, SEA2);
  // tanker 1 (left, burning)
  const t1x = x + 28, t1y = seaY - 8;
  rect(t1x, t1y - 26, 190, 26, [150, 40, 30]); // hull
  rect(t1x, t1y - 26, 190, 6, [90, 24, 18]);
  rect(t1x + 130, t1y - 52, 34, 26, WHITE); // bridge
  rect(t1x + 138, t1y - 62, 18, 10, NAVY2); // funnel
  // flames on tanker 1
  tri(t1x + 30, t1y - 26, t1x + 52, t1y - 78, t1x + 74, t1y - 26, ORANGE);
  tri(t1x + 56, t1y - 26, t1x + 76, t1y - 64, t1x + 96, t1y - 26, YELLOW);
  circle(t1x + 52, y + 40, 12, SMOKE);
  circle(t1x + 66, y + 24, 15, SMOKE);
  // tanker 2 (right, burning)
  const t2x = x + w - 220, t2y = seaY - 2;
  rect(t2x, t2y - 24, 180, 24, [150, 40, 30]);
  rect(t2x, t2y - 24, 180, 5, [90, 24, 18]);
  rect(t2x + 16, t2y - 48, 32, 24, WHITE);
  rect(t2x + 24, t2y - 58, 16, 10, NAVY2);
  tri(t2x + 90, t2y - 24, t2x + 112, t2y - 72, t2x + 134, t2y - 24, ORANGE);
  tri(t2x + 116, t2y - 24, t2x + 134, t2y - 60, t2x + 152, t2y - 24, YELLOW);
  circle(t2x + 112, y + 46, 13, SMOKE);
  // waves
  for (let i = 0; i < 5; i++) {
    const wx = x + 20 + i * 96;
    hline(wx, seaY + 34 + (i % 2) * 22, 52, SEA2, 3);
  }
  // caption
  rect(x + 2, y + h - 30, w - 4, 28, NAVY);
  drawText(x + 12, y + h - 23, "TWO TANKERS ABLAZE IN HORMUZ", 2, WHITE);
}

function drawRefinery(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, LIGHT);
  // towers
  rect(x + 18, y + 26, 16, h - 26, GREY);
  rect(x + 44, y + 14, 16, h - 14, GREY);
  rect(x + 70, y + 32, 16, h - 32, GREY);
  rect(x + 96, y + 8, 20, h - 8, NAVY2);
  // flame on tallest tower (kept inside the 48 px pictogram box)
  tri(x + 100, y + 8, x + 106, y + 1, x + 112, y + 8, ORANGE);
  tri(x + 103, y + 8, x + 106, y + 4, x + 109, y + 8, YELLOW);
  // pipes
  hline(x + 8, y + h - 14, w - 16, INK, 3);
  hline(x + 130, y + 30, w - 140, RED, 4);
  circle(x + w - 30, y + 30, 8, RED);
}

function drawChart(x: number, y: number, w: number, h: number): void {
  // Compact falling-market chart, drawn inside the 48 px pictogram box.
  rect(x, y, w, h, LIGHT);
  // axes
  vline(x + 14, y + 6, h - 14, INK, 2);
  hline(x + 14, y + h - 8, w - 24, INK, 2);
  // falling line
  line(x + 22, y + 8, x + 70, y + 16, RED, 4);
  line(x + 70, y + 16, x + 118, y + 14, RED, 4);
  line(x + 118, y + 14, x + 166, y + 28, RED, 4);
  line(x + 166, y + 28, x + 214, y + 26, RED, 4);
  line(x + 214, y + 26, x + 258, y + 38, RED, 4);
  // arrow head
  tri(x + 258, y + 38, x + 244, y + 30, x + 248, y + 44, RED);
  // bars
  rect(x + 30, y + 28, 16, 12, NAVY2);
  rect(x + 56, y + 32, 16, 8, NAVY2);
  rect(x + 82, y + 36, 16, 4, NAVY2);
}

function drawGavel(x: number, y: number, w: number, h: number): void {
  // Compact gavel, drawn inside the 48 px pictogram box.
  rect(x, y, w, h, LIGHT);
  // gavel head, tilted
  line(x + 28, y + 12, x + 104, y + 32, INK, 14);
  line(x + 28, y + 12, x + 104, y + 32, [120, 84, 40], 8);
  // handle
  line(x + 66, y + 22, x + 148, y + 42, INK, 5);
  // sound block
  rect(x + 150, y + 36, 90, 8, NAVY2);
  rect(x + 158, y + 30, 74, 6, NAVY2);
  // starburst of the verdict
  circle(x + 252, y + 16, 4, RED);
  line(x + 252, y + 4, x + 252, y + 28, RED, 2);
  line(x + 240, y + 16, x + 264, y + 16, RED, 2);
}

function drawRocket(x: number, y: number): void {
  // Compact rocket, 84 px tall: nose at y, flame ends at y + 84.
  // (No orbit ring: it crossed the headline text in the first render.)
  // flame
  tri(x + 52, y + 64, x + 62, y + 84, x + 72, y + 64, ORANGE);
  tri(x + 56, y + 64, x + 62, y + 78, x + 68, y + 64, YELLOW);
  // body
  ellipse(x + 62, y + 38, 14, 26, WHITE);
  frame(x + 48, y + 12, 28, 52, INK, 2);
  // nose
  tri(x + 48, y + 12, x + 76, y + 12, x + 62, y, RED);
  // fins
  tri(x + 48, y + 54, x + 34, y + 72, x + 48, y + 66, RED);
  tri(x + 76, y + 54, x + 90, y + 72, x + 76, y + 66, RED);
  // window
  circle(x + 62, y + 32, 6, NAVY2);
  circle(x + 62, y + 32, 3, SKY);
}

// ---------------------------------------------------------------- page
function draw(): void {
  rect(0, 0, W, H, PAPER);
  // outer border
  frame(0, 0, W, H, NAVY, 6);

  // ---- masthead
  rect(6, 6, W - 12, 132, NAVY);
  drawTextCentered(512, 22, "THE WORLD IN ONE DAY", 6, WHITE);
  hline(112, 96, W - 224, GOLD, 3);
  drawTextCentered(512, 106, "WEDNESDAY 25 NOVEMBER 2026", 3, GOLD);

  // ---- lead story
  drawText(16, 150, "MIDDLE EAST", 2, RED);
  drawText(16, 170, "TANKERS ABLAZE", 5, RED);
  drawText(16, 212, "IN THE STRAIT OF HORMUZ", 3, INK);
  hline(16, 240, 992, INK, 2);
  const body1 =
    "IRAN'S REVOLUTIONARY GUARD SAID TWO OIL TANKERS STRUCK NAVAL MINES, EXPLODED AND CAUGHT FIRE WHILE CROSSING THE STRAIT OF HORMUZ.";
  const body2 =
    "THE BLAZES RAISED FEARS FOR SHIPPING AND OIL SUPPLIES THROUGH ONE OF THE WORLD'S BUSIEST WATERWAYS.";
  drawPara(16, 252, body1, 480, 2, INK, 20);
  drawPara(16, 346, body2, 480, 2, INK, 20);
  drawTankers(520, 252, 488, 176);

  // ---- three cards
  const cards = [
    {
      x: 16, kicker: "EUROPE", kick: RED,
      head: "UKRAINE HITS TWO REFINERIES",
      pic: drawRefinery,
      body: "UKRAINE STRUCK THE SYZRAN AND KUIBYSHEV ROSNEFT REFINERIES IN SAMARA OVERNIGHT. ONE PERSON WAS KILLED. POLAND PLANS A NO-FLY ZONE AND ASKED NATO TO WEIGH DOWNING MISSILES.",
    },
    {
      x: 352, kicker: "MARKETS", kick: NAVY2,
      head: "ASIAN MARKETS TUMBLE",
      pic: drawChart,
      body: "SOUTH KOREA'S KOSPI FELL 6.16%. JAPAN'S NIKKEI FELL 2.78%. IN NEW YORK THE DOW CLOSED ABOVE 50,000 FOR THE FIRST TIME, AT 50,018.70, WHILE THE NASDAQ FELL 1.5%.",
    },
    {
      x: 688, kicker: "TECH", kick: NAVY2,
      head: "HUAWEI CONVICTED IN U.S.",
      pic: drawGavel,
      body: "A BROOKLYN JURY CONVICTED HUAWEI ON 10 OF 12 CRIMINAL COUNTS, INCLUDING BANK FRAUD, WIRE FRAUD, SANCTIONS VIOLATIONS AND CONSPIRACY TO STEAL TRADE SECRETS.",
    },
  ];
  for (const c of cards) {
    rect(c.x, 440, 320, 290, WHITE);
    frame(c.x, 440, 320, 290, INK, 2);
    drawText(c.x + 12, 452, c.kicker, 2, c.kick);
    const headLines = wrap(c.head, 296, 3);
    headLines.forEach((ln, i) => drawText(c.x + 12, 478 + i * 26, ln, 3, INK));
    const picY = 478 + headLines.length * 26 + 8;
    c.pic(c.x + 12, picY, 296, 48);
    drawPara(c.x + 12, picY + 48 + 8, c.body, 296, 2, INK, 15);
  }

  // ---- space band
  rect(16, 742, 992, 90, NAVY);
  drawRocket(28, 748);
  drawText(150, 754, "PAKISTAN'S FIRST ASTRONAUT REACHES ORBIT", 3, WHITE);
  drawPara(
    150, 788,
    "CHINA'S SHENZHOU-24 DOCKED WITH THE TIANGONG SPACE STATION, CARRYING PAKISTAN'S FIRST ASTRONAUT INTO ORBIT.",
    840, 2, GOLD, 18,
  );

  // ---- also today
  drawText(16, 856, "ALSO TODAY", 3, RED);
  hline(190, 868, 818, RED, 2);
  const briefs = [
    "AUSTRALIA AND SOLOMON ISLANDS SIGN TREATY BARRING A FOREIGN MILITARY BASE.",
    "SUDAN: RSF DRONE STRIKES KILLED 19 CIVILIANS, RIGHTS LAWYERS SAID.",
    "COLOMBIA: TROOPS FREED ALL HOSTAGES IN CARTAGENA SUPERMARKET; ONE CAPTOR KILLED.",
    "RIYADH: A HOUTHI DRONE HIT A TOWER, INJURING 11 PEOPLE.",
  ];
  briefs.forEach((b, i) => {
    const y = 884 + i * 20;
    rect(16, y + 4, 10, 10, RED);
    drawText(36, y, b, 2, INK);
  });

  // ---- footer
  hline(16, 984, 992, INK, 2);
  drawTextCentered(512, 994, "ALL EVENTS REPORTED ON WEDNESDAY 25 NOVEMBER 2026", 2, INK);
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  fs.mkdirSync(outDir, { recursive: true });
  draw();
  writePng(path.join(outDir, "entry.png"));
}

main();
