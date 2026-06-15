const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const ffmpegStatic = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegStatic);

GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'arial.ttf'), 'AppSans');
GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'arialbd.ttf'), 'AppSansBold');

const W = 480;
const H = 800;
const FPS = 12;
const FRAMES = 24; // 2-секундный бесшовный цикл

const ANIMATED_DIR = path.join(__dirname, 'assets', 'Animated');
const STAGES = [1, 23, 34, 45, 57, 75, 87, 100];

function formatMoney(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n));
}

function stageFile(percent) {
  let best = STAGES[0];
  for (const s of STAGES) {
    if (Math.abs(s - percent) < Math.abs(best - percent)) best = s;
  }
  return path.join(ANIMATED_DIR, `Cake ${best}%.png`);
}

function drawBackground(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#4A8DC4');
  grad.addColorStop(1, '#1B3A5C');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let x = 0; x < W; x += 48) {
    ctx.fillRect(x, 0, 24, H);
  }
}

function drawGlow(ctx, t) {
  const cx = W / 2;
  const cy = H * 0.46;
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
  const r = 230 + 20 * pulse;
  const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, r);
  glow.addColorStop(0, `rgba(255,221,87,${0.45 + 0.15 * pulse})`);
  glow.addColorStop(1, 'rgba(255,221,87,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

function drawTitleBar(ctx, title) {
  const barW = W * 0.86;
  const barH = 54;
  const x = (W - barW) / 2;
  const y = 36;

  ctx.beginPath();
  ctx.roundRect(x, y, barW, barH, 16);
  ctx.fillStyle = 'rgba(10,30,55,0.55)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 24px AppSansBold';
  ctx.fillText(title || 'Сбор на юбилей', W / 2, y + barH / 2);
}

function drawStats(ctx, current, goal) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 38px AppSansBold';
  ctx.fillText(`${formatMoney(current)} ₽`, W / 2, 150);

  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '400 20px AppSans';
  ctx.fillText(`Цель: ${formatMoney(goal)} ₽`, W / 2, 184);
}

function drawCake(ctx, image, t, ratio) {
  const cx = W / 2;
  const cy = H * 0.46;
  const scale = 0.95 + 0.18 * ratio;
  const size = 300 * scale;
  const angle = t * Math.PI * 2; // один полный оборот за цикл

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.drawImage(image, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function drawProgressBar(ctx, ratio, percent) {
  const barW = W * 0.78;
  const barH = 16;
  const x = (W - barW) / 2;
  const y = H * 0.82;

  ctx.beginPath();
  ctx.roundRect(x, y, barW, barH, barH / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fill();

  if (ratio > 0) {
    const fillW = Math.max(barH, barW * ratio);
    ctx.beginPath();
    ctx.roundRect(x, y, fillW, barH, barH / 2);
    const grad = ctx.createLinearGradient(x, 0, x + barW, 0);
    grad.addColorStop(0, '#FFD957');
    grad.addColorStop(1, '#FF8A3D');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 28px AppSansBold';
  ctx.fillText(`${percent}%`, W / 2, y - 24);
}

function heartPath(ctx, cx, cy, size) {
  const top = size * 0.3;
  ctx.beginPath();
  ctx.moveTo(cx, cy + top);
  ctx.bezierCurveTo(cx, cy, cx - size / 2, cy, cx - size / 2, cy + top);
  ctx.bezierCurveTo(cx - size / 2, cy + (size + top) / 1.5, cx, cy + (size + top) / 1.2, cx, cy + size);
  ctx.bezierCurveTo(cx, cy + (size + top) / 1.2, cx + size / 2, cy + (size + top) / 1.5, cx + size / 2, cy + top);
  ctx.bezierCurveTo(cx + size / 2, cy, cx, cy, cx, cy + top);
  ctx.closePath();
}

function drawHearts(ctx, t) {
  const period = H + 120;
  const hearts = [
    { x: 0.18, size: 26, phase: 0.00, color: '#FF5C7A' },
    { x: 0.32, size: 18, phase: 0.18, color: '#FF8FA3' },
    { x: 0.50, size: 30, phase: 0.40, color: '#FF3D63' },
    { x: 0.65, size: 20, phase: 0.62, color: '#FFB3C1' },
    { x: 0.78, size: 24, phase: 0.80, color: '#FF5C7A' },
    { x: 0.42, size: 16, phase: 0.30, color: '#FFB3C1' },
    { x: 0.85, size: 18, phase: 0.55, color: '#FF3D63' },
    { x: 0.25, size: 22, phase: 0.70, color: '#FF8FA3' },
  ];

  hearts.forEach((h) => {
    const localT = (t + h.phase) % 1;
    const y = -60 + localT * period;
    const x = W * h.x + Math.sin((t + h.phase) * Math.PI * 4) * 14;
    const alpha = Math.min(1, Math.min(localT * 4, (1 - localT) * 4));

    ctx.globalAlpha = alpha;
    heartPath(ctx, x, y, h.size);
    ctx.fillStyle = h.color;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

async function renderFrames({ title, current, goal }, withHearts) {
  const ratio = goal > 0 ? Math.min(current / goal, 1) : 0;
  const percent = Math.round(ratio * 100);
  const image = await loadImage(stageFile(percent));

  const tmpDir = path.join(os.tmpdir(), `cakebot-${crypto.randomBytes(6).toString('hex')}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    for (let i = 0; i < FRAMES; i++) {
      const t = i / FRAMES;
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext('2d');

      drawBackground(ctx);
      drawGlow(ctx, t);
      drawCake(ctx, image, t, ratio);
      if (withHearts) drawHearts(ctx, t);
      drawTitleBar(ctx, title);
      drawStats(ctx, current, goal);
      drawProgressBar(ctx, ratio, percent);

      fs.writeFileSync(path.join(tmpDir, `frame_${String(i).padStart(3, '0')}.png`), canvas.toBuffer('image/png'));
    }

    const outFile = path.join(tmpDir, 'out.mp4');
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(path.join(tmpDir, 'frame_%03d.png'))
        .inputFPS(FPS)
        .outputOptions(['-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an'])
        .videoCodec('libx264')
        .output(outFile)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    return fs.readFileSync(outFile);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function renderCakeAnimation(data) {
  return renderFrames(data, false);
}

async function renderHeartsAnimation(data) {
  return renderFrames(data, true);
}

module.exports = { renderCakeAnimation, renderHeartsAnimation, formatMoney };
