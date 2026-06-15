// Generate a 1024x1024 PNG icon for FView (a stylized "FV" mark on rounded card)
import { writeFileSync } from "fs";
import { deflateSync } from "zlib";

const SIZE = 1024;

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, c]);
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type RGB
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const ACCENT = [99, 102, 241]; // indigo
const BG_LIGHT = [245, 245, 247];

const r2 = 200;
const rows = [];
for (let y = 0; y < SIZE; y++) {
  const row = Buffer.alloc(SIZE * 3 + 1);
  row[0] = 0;
  for (let x = 0; x < SIZE; x++) {
    const i = 1 + x * 3;
    // Rounded card background
    const inside = !(
      (x < r2 && y < r2 && (r2 - x) ** 2 + (r2 - y) ** 2 > r2 ** 2) ||
      (x > SIZE - r2 && y < r2 && (x - (SIZE - r2)) ** 2 + (r2 - y) ** 2 > r2 ** 2) ||
      (x < r2 && y > SIZE - r2 && (r2 - x) ** 2 + (y - (SIZE - r2)) ** 2 > r2 ** 2) ||
      (x > SIZE - r2 && y > SIZE - r2 && (x - (SIZE - r2)) ** 2 + (y - (SIZE - r2)) ** 2 > r2 ** 2)
    );

    let r, g, b;
    if (!inside) {
      r = 0; g = 0; b = 0;
    } else {
      r = BG_LIGHT[0]; g = BG_LIGHT[1]; b = BG_LIGHT[2];
    }

    // Draw "F" on the left
    // F: vertical bar (left) + top horizontal + middle horizontal (shorter)
    const fX = 220;
    const fY = 280;
    const fW = 380;  // total width of F area
    const fH = 464;  // total height
    const stroke = 96;
    const fVertX = fX;
    const fVertW = stroke;
    const fVertH = fH;
    const fTopX = fX;
    const fTopW = fW;
    const fTopH = stroke;
    const fMidX = fX;
    const fMidY = fY + (fH / 2) - (stroke / 2);
    const fMidW = fW * 0.72;
    const fMidH = stroke;

    // Draw "V" on the right
    // V: two diagonals approximated as 4 rotated rects → use simpler approximation
    // We'll draw V as a series of stepped horizontal slices, each ~stroke wide
    const vCenterX = fX + fW + 90 + (fW / 2);  // gap + center
    const vWidth = fW;
    const vTopY = fY;
    const vBottomY = fY + fH;
    const vHalfWidth = vWidth / 2;

    const inRect = (rx, ry, rw, rh) =>
      x >= rx && x < rx + rw && y >= ry && y < ry + rh;

    if (inside) {
      // F
      if (inRect(fVertX, fY, fVertW, fVertH)
        || inRect(fTopX, fY, fTopW, fTopH)
        || inRect(fMidX, fMidY, fMidW, fMidH)) {
        r = ACCENT[0]; g = ACCENT[1]; b = ACCENT[2];
      }
      // V: stepped approximation, each row shifts the gap inward
      else if (y >= vTopY && y < vBottomY) {
        const progress = (y - vTopY) / (vBottomY - vTopY);
        const offset = (progress - 0.5) * (vHalfWidth - stroke);
        const innerLeft = vCenterX - vHalfWidth + Math.abs(offset);
        const innerRight = vCenterX + vHalfWidth - Math.abs(offset);
        if (x >= innerLeft && x < innerLeft + stroke) {
          r = ACCENT[0]; g = ACCENT[1]; b = ACCENT[2];
        } else if (x >= innerRight - stroke && x < innerRight) {
          r = ACCENT[0]; g = ACCENT[1]; b = ACCENT[2];
        }
      }
    }

    row[i] = r;
    row[i + 1] = g;
    row[i + 2] = b;
  }
  rows.push(row);
}
const raw = Buffer.concat(rows);
const idat = deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  sig,
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync("src-tauri/icons/source.png", png);
console.log("Created src-tauri/icons/source.png", png.length, "bytes");
