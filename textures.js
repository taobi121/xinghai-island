import * as THREE from 'three';

/* ==========================================================================
   绘本卡通质感纹理库 —— Canvas 生成
   定稿色板：提明度、降饱和、偏暖；无黑描边，只保留极淡的暖褐轮廓
   ========================================================================== */

/** 供后端单向 import 的统一色板（字符串色值，可直接赋给 THREE.Color） */
export const PALETTE = {
  grass: { main: '#BEDB83', dark: '#9FC56D', light: '#DDF0A5' },
  sky: { top: '#78D1F5', horizon: '#FFF3D7' },
  sea: { shallow: '#8ADFE0', deep: '#2B9FC8' },
  sand: '#F6E7C4',
  plaster: '#F6EAD0',
  cream: '#FBEFD8',
  brick: { face: '#C97B62', mortar: 'rgba(150,95,75,.28)' },
  wood: { main: '#C89A6A', dark: '#8B6544' },
  roofRed: '#C6654F',
  copper: '#7FBFA6',
  sakura: '#F4C4D4',
  cobble: '#9AA7A0',
  lavender: '#A492D4',
  sunflower: '#F7D67A',
  coral: '#F28E7B',
  paper: '#FFF8EA',
  gold: '#E8C06A',
  ink: '#4A3A32'
};

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function canvasTex(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  // 统一暖罩：所有纹理最后叠一层极淡暖白，消除冷绿/脏灰感
  ctx.fillStyle = 'rgba(255,245,225,0.06)';
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** 手绘描边矩形：轻微歪斜 + 淡暖褐轮廓（不产生黑边） */
function handRect(ctx, x, y, w, h, fill, stroke, lw = 1.6, wob = 2) {
  const j = () => (Math.random() - 0.5) * wob;
  ctx.beginPath();
  ctx.moveTo(x + j(), y + j());
  ctx.lineTo(x + w + j(), y + j());
  ctx.lineTo(x + w + j(), y + h + j());
  ctx.lineTo(x + j(), y + h + j());
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}

/* ---------- 草地：4-stop 低频渐变 + 大块水彩色斑 + 细草簇 + 散点小花 ---------- */
export const grassTexture = canvasTex(384, 384, (ctx, w, h) => {
  // 低频水彩渐变：暖黄绿→柔绿→亮绿→暖绿，降饱和、去冷脏
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#B3C77F');
  grad.addColorStop(0.34, PALETTE.grass.main);
  grad.addColorStop(0.68, PALETTE.grass.light);
  grad.addColorStop(1, '#B7CC84');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  // 大块低频色斑（柔和水彩晕染）
  for (let i = 0; i < 38; i++) {
    const c = Math.random() > 0.5 ? PALETTE.grass.dark : PALETTE.grass.light;
    ctx.fillStyle = rgba(c, 0.06 + Math.random() * 0.09);
    ctx.beginPath();
    ctx.ellipse(Math.random() * w, Math.random() * h, 30 + Math.random() * 80, 22 + Math.random() * 50, Math.random() * 3, 0, 7);
    ctx.fill();
  }
  // 更细的草簇：短笔触、圆头、低对比
  for (let i = 0; i < 620; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    ctx.strokeStyle = rgba(PALETTE.grass.dark, 0.10 + Math.random() * 0.13);
    ctx.lineWidth = 0.6 + Math.random() * 0.9;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 3, y - 3, x + (Math.random() - 0.5) * 6, y - 5 - Math.random() * 4);
    ctx.stroke();
  }
  // 散点小花：纸白 / 樱粉 / 暖黄，极小
  const petals = ['#FFF8EA', '#F4C4D4', '#F7D67A', '#FFFFFF'];
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 1.3 + Math.random() * 1.7;
    ctx.globalAlpha = 0.5 + Math.random() * 0.35;
    ctx.fillStyle = petals[i % petals.length];
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    if (Math.random() > 0.5) {
      ctx.fillStyle = '#E8C06A'; ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, 7); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}, 6, 6);

/* ---------- 沙滩：暖奶油细沙 ---------- */
export const sandTexture = canvasTex(384, 384, (ctx, w, h) => {
  ctx.fillStyle = PALETTE.sand; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 66; i++) {
    ctx.fillStyle = `rgba(255,250,235,${0.12 + Math.random() * 0.16})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * w, Math.random() * h, 12 + Math.random() * 30, 8 + Math.random() * 18, Math.random() * 3, 0, 7);
    ctx.fill();
  }
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = `rgba(196,170,128,${0.06 + Math.random() * 0.08})`;
    ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 0.8 + Math.random() * 1.3, 0, 7); ctx.fill();
  }
}, 6, 6);

/* ---------- 红砖：随机范围收窄、淡缝、轻脏斑、保留顶部高光 ---------- */
export const brickTexture = canvasTex(384, 384, (ctx, w, h) => {
  ctx.fillStyle = '#EBD9BE'; ctx.fillRect(0, 0, w, h);
  const bw = 116, bh = 50;
  for (let row = 0; row < h / bh + 1; row++) {
    const offset = (row % 2) * (bw / 2);
    for (let col = -1; col < w / bw + 1; col++) {
      const x = col * bw + offset, y = row * bh;
      const r = 195 + Math.random() * 20, g = 115 + Math.random() * 20, b = 90 + Math.random() * 20;
      handRect(ctx, x + 3, y + 3, bw - 6, bh - 6, `rgb(${r | 0},${g | 0},${b | 0})`, PALETTE.brick.mortar, 1.8, 2.4);
      ctx.fillStyle = 'rgba(255,240,220,.22)';
      ctx.fillRect(x + 7, y + 7, bw - 16, 5);
      if (Math.random() > 0.62) {
        ctx.fillStyle = 'rgba(120,60,45,.08)';
        ctx.beginPath(); ctx.arc(x + 14 + Math.random() * (bw - 28), y + 16 + Math.random() * (bh - 26), 2 + Math.random() * 3, 0, 7); ctx.fill();
      }
    }
  }
}, 2, 2);

/* ---------- 米白灰泥 ---------- */
export const plasterTexture = canvasTex(384, 384, (ctx, w, h) => {
  ctx.fillStyle = PALETTE.plaster; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(255,250,235,${0.16 + Math.random() * 0.16})`;
    ctx.beginPath(); ctx.ellipse(Math.random() * w, Math.random() * h, 12 + Math.random() * 40, 9 + Math.random() * 26, Math.random() * 3, 0, 7); ctx.fill();
  }
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = `rgba(178,154,116,${0.04 + Math.random() * 0.05})`;
    ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 0.7 + Math.random(), 0, 7); ctx.fill();
  }
}, 2, 2);

/* ---------- 石材：底色提亮、描边与噪点减半 ---------- */
export const stoneTexture = canvasTex(384, 384, (ctx, w, h) => {
  ctx.fillStyle = '#E8DFC9'; ctx.fillRect(0, 0, w, h);
  const s = 104;
  for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
    const x = col * s + (row % 2) * (s / 2), y = row * s;
    const v = Math.random() * 18;
    handRect(ctx, x + 5, y + 5, s - 10, s - 10,
      `rgb(${(226 + v) | 0},${(217 + v) | 0},${(199 + v) | 0})`, 'rgba(140,130,110,.25)', 2, 4);
  }
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(170,158,136,${0.04 + Math.random() * 0.04})`;
    ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 3, 0, 7); ctx.fill();
  }
}, 2, 2);

/* ---------- 木头：底色提暖，纹线收窄变淡 ---------- */
export const woodTexture = canvasTex(256, 512, (ctx, w, h) => {
  ctx.fillStyle = PALETTE.wood.main; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * w;
    ctx.strokeStyle = rgba(PALETTE.wood.dark, 0.15 + Math.random() * 0.2);
    ctx.lineWidth = 1 + Math.random() * 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, 0);
    for (let y = 0; y < h; y += 14) ctx.lineTo(x + Math.sin(y * 0.035 + i) * 2.6, y);
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const x = 40 + Math.random() * 176, y = 60 + Math.random() * 392;
    ctx.strokeStyle = rgba(PALETTE.wood.dark, 0.22); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y, 9, 15, 0.3, 0, 7); ctx.stroke();
  }
}, 1, 1);

/* ---------- 屋顶瓦：底色 #C6654F，淡描边 ---------- */
export const roofTexture = canvasTex(384, 384, (ctx, w, h) => {
  ctx.fillStyle = PALETTE.roofRed; ctx.fillRect(0, 0, w, h);
  const cw = 36, ch = 27;   // 鳞片瓦加密（绘本小屋的密集叠瓦）
  for (let row = 0; row < h / ch + 1; row++) {
    const off = (row % 2) * (cw / 2);
    for (let col = -1; col < w / cw + 1; col++) {
      const x = col * cw + off, y = row * ch;
      const v = Math.random() * 16;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + ch - 4);
      ctx.lineTo(x + 4, y + ch * 0.5);
      ctx.quadraticCurveTo(x + cw / 2, y - 3, x + cw - 4, y + ch * 0.5);
      ctx.lineTo(x + cw - 4, y + ch - 4);
      ctx.closePath();
      ctx.fillStyle = `rgb(${(198 + v) | 0},${(101 + v * 0.5) | 0},${(79 + v * 0.5) | 0})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(122,64,50,.3)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,232,212,.18)';
      ctx.fillRect(x + 7, y + ch * 0.38, cw - 14, 3);
    }
  }
}, 4, 4);

/* ---------- 玻璃幕墙：明亮通透、柔化格框 ---------- */
export const glassTexture = canvasTex(320, 320, (ctx, w, h) => {
  ctx.fillStyle = '#A9D2DC'; ctx.fillRect(0, 0, w, h);
  const cols = 5, rows = 7, cw = w / cols, ch = h / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * cw, y = r * ch, b = 205 + Math.random() * 36;
    handRect(ctx, x + 6, y + 6, cw - 12, ch - 12,
      `rgba(${(b - 28) | 0},${(b + 4) | 0},${(b + 16) | 0},${0.5 + Math.random() * 0.24})`,
      'rgba(92,126,136,.32)', 2.4, 3);
    ctx.fillStyle = 'rgba(255,255,255,.08)';   // 压掉强高光白斑（M9）
    ctx.beginPath(); ctx.moveTo(x + 8, y + ch - 8); ctx.lineTo(x + cw - 8, y + 8); ctx.lineTo(x + cw - 8, y + ch * 0.42); ctx.closePath(); ctx.fill();
  }
}, 2, 2);

/* ---------- 奶油石板路：单块细腻石板，供后端替换 pathTextureFlat 使用 ---------- */
export const pathTexture = canvasTex(384, 384, (ctx, w, h) => {
  ctx.fillStyle = PALETTE.cream; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 54; i++) {
    ctx.fillStyle = `rgba(255,250,236,${0.12 + Math.random() * 0.18})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * w, Math.random() * h, 14 + Math.random() * 46, 10 + Math.random() * 30, Math.random() * 3, 0, 7);
    ctx.fill();
  }
  // 极淡暖褐石缝：比旧版深描边轻得多
  handRect(ctx, 10, 10, w - 20, h - 20, null, 'rgba(166,140,102,.16)', 5, 7);
  for (let i = 0; i < 360; i++) {
    ctx.fillStyle = `rgba(190,166,126,${0.04 + Math.random() * 0.05})`;
    ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 0.8 + Math.random() * 1.4, 0, 7); ctx.fill();
  }
}, 1, 1);

/* ---------- 通用材质工厂（导出名保持不变） ---------- */
export const texMat = (tex, opts = {}) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.86, ...opts });
export const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...opts });

/* ---------- 鹅卵石板路：扰动网格 Voronoi 风不规则多边形，暖灰蓝磨边细缝（M3） ----------
   512×512，RepeatWrapping；后端主路可切换：texMat(cobbleTexture)
   角点环绕共享，corner(i+cols,j)=corner(i,j)+w，因此跨边界无缝平铺。 */
export const cobbleTexture = canvasTex(384, 384, (ctx, w, h) => {
  // 细缝 cavity 底色：比石板略暗的暖灰
  ctx.fillStyle = '#7D8B87';
  ctx.fillRect(0, 0, w, h);
  const cols = 6, rows = 6;
  const cw = w / cols, ch = h / rows;

  function corner(i, j) {
    const ii = ((i % cols) + cols) % cols, jj = ((j % rows) + rows) % rows;
    const a = Math.sin(ii * 127.1 + jj * 311.7) * 43758.5453;
    const b = Math.sin(ii * 269.5 + jj * 183.3) * 24634.6345;
    const r1 = a - Math.floor(a), r2 = b - Math.floor(b);
    return [i * cw + (r1 - 0.5) * cw * 0.38, j * ch + (r2 - 0.5) * ch * 0.38];
  }
  // 圆角多边形：磨掉锐角，形成鹅卵石磨边
  function roundPoly(pts, rad) {
    ctx.beginPath();
    for (let k = 0; k < pts.length; k++) {
      const prev = pts[(k - 1 + pts.length) % pts.length], cur = pts[k], next = pts[(k + 1) % pts.length];
      const v1 = [prev[0] - cur[0], prev[1] - cur[1]], v2 = [next[0] - cur[0], next[1] - cur[1]];
      const l1 = Math.hypot(v1[0], v1[1]) || 1, l2 = Math.hypot(v2[0], v2[1]) || 1;
      const p1 = [cur[0] + v1[0] / l1 * rad, cur[1] + v1[1] / l1 * rad];
      const p2 = [cur[0] + v2[0] / l2 * rad, cur[1] + v2[1] / l2 * rad];
      if (k === 0) ctx.moveTo(p1[0], p1[1]); else ctx.lineTo(p1[0], p1[1]);
      ctx.quadraticCurveTo(cur[0], cur[1], p2[0], p2[1]);
    }
    ctx.closePath();
  }

  // 多画一圈（-1..cols）保证跨边界的板块连续
  for (let j = -1; j <= rows; j++) for (let i = -1; i <= cols; i++) {
    const quad = [corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1)];
    const cx = (quad[0][0] + quad[2][0]) / 2, cy = (quad[0][1] + quad[2][1]) / 2;
    const gap = 0.055;
    const pts = quad.map(p => [cx + (p[0] - cx) * (1 - gap), cy + (p[1] - cy) * (1 - gap)]);
    // 块间色差：暖灰 / 中性 / 蓝灰三系，±7 明度抖动
    const t = Math.random();
    const base = t < 0.34 ? [154, 167, 160] : (t < 0.67 ? [163, 171, 163] : [148, 163, 167]);
    const v = (Math.random() - 0.5) * 14;
    roundPoly(pts, Math.min(cw, ch) * 0.17);
    ctx.fillStyle = `rgb(${(base[0] + v) | 0},${(base[1] + v) | 0},${(base[2] + v) | 0})`;
    ctx.fill();
    // 磨边亮线 + 内侧 cavity 暗线
    ctx.strokeStyle = 'rgba(255,252,240,.26)'; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(94,108,106,.16)'; ctx.lineWidth = 1; ctx.stroke();
    // 板面细噪点与一处柔光
    for (let n = 0; n < 16; n++) {
      ctx.fillStyle = `rgba(112,126,122,${0.03 + Math.random() * 0.05})`;
      ctx.beginPath();
      ctx.arc(cx + (Math.random() - 0.5) * cw * 0.7, cy + (Math.random() - 0.5) * ch * 0.7, 0.7 + Math.random() * 1.6, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,252,242,.10)';
    ctx.beginPath(); ctx.ellipse(cx - cw * 0.12, cy - ch * 0.14, cw * 0.22, ch * 0.12, -0.4, 0, 7); ctx.fill();
  }
}, 1, 1);

/* ---------- 岸边白泡沫：透明底、可平铺，后端可选贴在水面沿岸 ---------- */
function _foamCanvas() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  // 透明底：不叠暖罩，避免泡沫带脏色
  for (let i = 0; i < 6; i++) {
    const y = 60 + Math.random() * 140;
    ctx.strokeStyle = `rgba(255,255,250,${0.14 + Math.random() * 0.2})`;
    ctx.lineWidth = 4 + Math.random() * 9;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-10, y);
    for (let x = 0; x <= 266; x += 14) ctx.lineTo(x, y + Math.sin(x * 0.07 + i) * 5 + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = `rgba(255,255,252,${0.2 + Math.random() * 0.45})`;
    ctx.beginPath(); ctx.arc(Math.random() * 256, Math.random() * 256, 0.7 + Math.random() * 2.3, 0, 7); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
export const waterFoamTexture = _foamCanvas();
