// Shared icon drawing functions for generate_icons.html and generate_icons.js
// Both files can import this module for the core drawIcon logic

const ICON_COLORS = {
  bg: '#1e1e2e',
  ring: '#89b4fa',
  clock: '#a6e3a1',
  ringAlpha: 'rgba(137,180,250,0.35)',
};

const ICON_SIZES = [16, 32, 48, 128];

function drawIcon(ctx, size, options = {}) {
  const { hour = 10, minute = 10 } = options;
  const s = size;
  const r = s / 2;
  const lw = Math.max(1, s / 16);

  // Background circle - dark
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fillStyle = ICON_COLORS.bg;
  ctx.fill();

  // Outer ring
  ctx.beginPath();
  ctx.arc(r, r, r - lw * 0.6, 0, Math.PI * 2);
  ctx.strokeStyle = ICON_COLORS.ring;
  ctx.lineWidth = lw;
  ctx.stroke();

  // Globe horizontal line
  ctx.beginPath();
  ctx.moveTo(lw, r);
  ctx.lineTo(s - lw, r);
  ctx.strokeStyle = ICON_COLORS.ringAlpha;
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();

  // Globe vertical line
  ctx.beginPath();
  ctx.moveTo(r, lw);
  ctx.lineTo(r, s - lw);
  ctx.stroke();

  // Left ellipse (longitude)
  ctx.beginPath();
  ctx.ellipse(r, r, r * 0.45, r - lw, 0, 0, Math.PI * 2);
  ctx.strokeStyle = ICON_COLORS.ring;
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();

  // Clock hands
  const hourAngle = (hour / 12) * Math.PI * 2 - Math.PI / 2;
  const minAngle = (minute / 60) * Math.PI * 2 - Math.PI / 2;

  // Hour hand
  ctx.beginPath();
  ctx.moveTo(r, r);
  ctx.lineTo(r + Math.cos(hourAngle) * r * 0.38, r + Math.sin(hourAngle) * r * 0.38);
  ctx.strokeStyle = ICON_COLORS.clock;
  ctx.lineWidth = lw * 1.4;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Minute hand
  ctx.beginPath();
  ctx.moveTo(r, r);
  ctx.lineTo(r + Math.cos(minAngle) * r * 0.55, r + Math.sin(minAngle) * r * 0.55);
  ctx.strokeStyle = ICON_COLORS.clock;
  ctx.lineWidth = lw * 0.9;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(r, r, lw * 1.2, 0, Math.PI * 2);
  ctx.fillStyle = ICON_COLORS.clock;
  ctx.fill();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { drawIcon, ICON_COLORS, ICON_SIZES };
}