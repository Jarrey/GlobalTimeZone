// Generate PNG icons using pure Node.js (no dependencies)
// Creates minimal valid PNG files with the globe+clock design

const fs = require('fs');
const path = require('path');

// Try to use shared module, otherwise inline duplicate
let drawIcon, ICON_SIZES;
try {
  const iconModule = require('./icon_drawing.js');
  drawIcon = iconModule.drawIcon;
  ICON_SIZES = iconModule.ICON_SIZES;
} catch(e) {
  // Inline fallback if module not found
  const ICON_COLORS = { bg: '#1e1e2e', ring: '#89b4fa', clock: '#a6e3a1', ringAlpha: 'rgba(137,180,250,0.35)' };
  ICON_SIZES = [16, 32, 48, 128];
  drawIcon = function(ctx, size) {
    const s = size, r = s / 2, lw = Math.max(1, s / 16);
    ctx.beginPath(); ctx.arc(r, r, r, 0, Math.PI * 2); ctx.fillStyle = ICON_COLORS.bg; ctx.fill();
    ctx.beginPath(); ctx.arc(r, r, r - lw * 0.6, 0, Math.PI * 2); ctx.strokeStyle = ICON_COLORS.ring; ctx.lineWidth = lw; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lw, r); ctx.lineTo(s - lw, r); ctx.strokeStyle = ICON_COLORS.ringAlpha; ctx.lineWidth = lw * 0.8; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r, lw); ctx.lineTo(r, s - lw); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(r, r, r * 0.45, r - lw, 0, 0, Math.PI * 2); ctx.strokeStyle = ICON_COLORS.ring; ctx.lineWidth = lw * 0.8; ctx.stroke();
    const hourAngle = (10 / 12) * Math.PI * 2 - Math.PI / 2, minAngle = (10 / 60) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(r, r); ctx.lineTo(r + Math.cos(hourAngle) * r * 0.38, r + Math.sin(hourAngle) * r * 0.38); ctx.strokeStyle = ICON_COLORS.clock; ctx.lineWidth = lw * 1.4; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r, r); ctx.lineTo(r + Math.cos(minAngle) * r * 0.55, r + Math.sin(minAngle) * r * 0.55); ctx.strokeStyle = ICON_COLORS.clock; ctx.lineWidth = lw * 0.9; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(r, r, lw * 1.2, 0, Math.PI * 2); ctx.fillStyle = ICON_COLORS.clock; ctx.fill();
  };
}

const { createCanvas } = (() => { try { return require('canvas'); } catch(e) { return null; } })() || {};

if (!createCanvas) {
  // Fallback: generate PNG programmatically without canvas
  generatePNGs();
} else {
  generateWithCanvas();
}

function generateWithCanvas() {
  const dir = path.join(__dirname, 'icons');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  ICON_SIZES.forEach(size => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    drawIcon(ctx, size);
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(dir, `icon${size}.png`), buf);
    console.log(`Generated icon${size}.png`);
  });
}

}

// ---- Fallback: pure JS PNG generation ----
function generatePNGs() {
  const dir = path.join(__dirname, 'icons');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  ICON_SIZES.forEach(size => {
    const pixels = renderIcon(size);
    const buf = encodePNG(size, size, pixels);
    fs.writeFileSync(path.join(dir, `icon${size}.png`), buf);
    console.log(`Generated icon${size}.png (fallback)`);
  });
}

function renderIcon(size) {
  // pixels: Uint8Array of RGBA
  const pixels = new Uint8Array(size * size * 4);

  const cx = size / 2, cy = size / 2, r = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5, dy = y - cy + 0.5;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const idx = (y * size + x) * 4;

      let R = 0, G = 0, B = 0, A = 0;

      if (dist <= r) {
        // Background: #1e1e2e
        R = 0x1e; G = 0x1e; B = 0x2e; A = 255;

        const ringW = Math.max(1, size / 16);

        // Outer ring: #89b4fa within [r-ringW*1.2, r]
        if (dist >= r - ringW * 1.2) {
          R = 0x89; G = 0xb4; B = 0xfa; A = 255;
        }

        // Globe lines (horizontal + vertical + left ellipse)
        // Horizontal line
        if (Math.abs(dy) < ringW * 0.5 && dist < r - ringW) {
          R = 0x89; G = 0xb4; B = 0xfa; A = 180;
        }
        // Vertical line
        if (Math.abs(dx) < ringW * 0.5 && dist < r - ringW) {
          R = 0x89; G = 0xb4; B = 0xfa; A = 180;
        }

        // Left ellipse approximation
        // ellipse: (x/a)^2 + (y/b)^2 = 1, a=r*0.45, b=r-ringW
        const ea = r * 0.45, eb = r - ringW;
        const ellV = (dx*dx)/(ea*ea) + (dy*dy)/(eb*eb);
        const ellW = ringW * 0.8;
        const ellVdelta = 2 * ellW / (ea * eb);
        if (Math.abs(ellV - 1) < ellVdelta * 0.8 && dist < r - ringW) {
          R = 0x89; G = 0xb4; B = 0xfa; A = 255;
        }

        // Clock hands (10:10)
        // Hour hand angle
        const hourAngle = (10 / 12) * Math.PI * 2 - Math.PI / 2;
        const minAngle  = (10 / 60) * Math.PI * 2 - Math.PI / 2;

        const hLen = r * 0.38, mLen = r * 0.55;
        const hw = Math.max(1, ringW * 0.7);

        // Hour hand: line from center in direction hourAngle
        const proj_h = dx * Math.cos(hourAngle) + dy * Math.sin(hourAngle);
        const perp_h = Math.abs(-dx * Math.sin(hourAngle) + dy * Math.cos(hourAngle));
        if (proj_h >= 0 && proj_h <= hLen && perp_h < hw) {
          R = 0xa6; G = 0xe3; B = 0xa1; A = 255;
        }

        // Minute hand
        const proj_m = dx * Math.cos(minAngle) + dy * Math.sin(minAngle);
        const perp_m = Math.abs(-dx * Math.sin(minAngle) + dy * Math.cos(minAngle));
        if (proj_m >= 0 && proj_m <= mLen && perp_m < hw * 0.7) {
          R = 0xa6; G = 0xe3; B = 0xa1; A = 255;
        }

        // Center dot
        if (dist < ringW * 1.2) {
          R = 0xa6; G = 0xe3; B = 0xa1; A = 255;
        }
      }

      pixels[idx]   = R;
      pixels[idx+1] = G;
      pixels[idx+2] = B;
      pixels[idx+3] = A;
    }
  }
  return pixels;
}

// Minimal PNG encoder
function encodePNG(width, height, pixels) {
  const zlib = require('zlib');

  // Build raw image data with filter bytes
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (width * 4 + 1) + 1 + x * 4;
      raw[di]   = pixels[si];
      raw[di+1] = pixels[si+1];
      raw[di+2] = pixels[si+2];
      raw[di+3] = pixels[si+3];
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  function crc32(buf) {
    const table = makeCRCTable();
    let crc = 0xFFFFFFFF;
    for (const b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xFF];
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  let _crcTable;
  function makeCRCTable() {
    if (_crcTable) return _crcTable;
    _crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      _crcTable[n] = c;
    }
    return _crcTable;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([typeBytes, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([lenBuf, body, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}
