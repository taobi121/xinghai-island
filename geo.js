import * as THREE from 'three';

/* ==========================================================================
   手绘卡通建筑几何工具库
   目标：杜绝标准方块/正圆，用圆角、起伏、错落、翘角、装饰物营造绘本质感
   约定：坐标以【建筑底部中心】为原点，y 向上
   ========================================================================== */

export const M = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...opts });
export function mesh(geo, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = shadow; m.receiveShadow = shadow;
  return m;
}

/* ---------- 圆角矩形 Shape ---------- */
function roundRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w/2, y = -h/2;
  r = Math.min(r, w/2, h/2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/* ---------- 1. 圆角盒：取代硬方块，圆润活泼 ---------- */
export function roundedBox(w, h, d, r, material, opts = {}) {
  // 绘本级圆角：0.12~0.2；按最薄边收窄倒角，避免薄片被倒穿
  r = Math.min(0.2, Math.max(0.12, r));
  const bevel = Math.min(r * 0.6, d * 0.3, h * 0.3, w * 0.3, 0.18);
  const shape = roundRect(w - bevel*2, h - bevel*2, Math.max(0.03, r - bevel));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, d - bevel*2), bevelEnabled: bevel > 0.01,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8
  });
  geo.center();
  return mesh(geo, material, opts);
}

/* ---------- 2. 有机柱：轻微起伏的锥柱，取代标准圆柱 ---------- */
export function organicCyl(rTop, rBot, h, material, { seg = 12, wobble = 0.06, twist = 0 } = {}) {
  const positions = [], indices = [], normals = [];
  const rings = 6;
  for (let ri = 0; ri <= rings; ri++) {
    const t = ri / rings;
    const y = -h/2 + h*t;
    const baseR = rBot + (rTop - rBot) * t;
    for (let si = 0; si < seg; si++) {
      const a = (si / seg) * Math.PI * 2 + twist * t;
      // 用正弦叠加产生有机起伏，且角度间连续（同一公式）
      const wob = 1 + wobble * (Math.sin(a*3 + t*4) * 0.5 + Math.sin(a*5 - t*2) * 0.5);
      const r = baseR * wob;
      positions.push(Math.cos(a)*r, y, Math.sin(a)*r);
    }
  }
  for (let ri = 0; ri < rings; ri++) for (let si = 0; si < seg; si++) {
    const a = ri*seg + si, b = ri*seg + (si+1)%seg, c = (ri+1)*seg + si, d = (ri+1)*seg + (si+1)%seg;
    indices.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices); geo.computeVertexNormals();
  return mesh(geo, material);
}

/* ---------- 3. 旋转成型轮廓体（Lathe） ---------- */
export function lathe(profile, material, segments = 28) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y));
  const g = new THREE.LatheGeometry(pts, segments);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material); m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* ---------- 4. 分瓣穹顶：有机起伏的洋葱顶 ---------- */
export function dome(radius, material, ribMaterial, { ribs = 12, squash = 1, ribThickness = 0.05, bulge = 0.06 } = {}) {
  const g = new THREE.Group();
  // 用 lathe 做有机的洋葱轮廓（中部略鼓）
  const prof = [];
  const steps = 12;
  // 轮廓从「底沿宽」走向「顶尖收窄」，且 y 递增以保证 Lathe 法线朝外。
  // 旧公式 y = r*squash*(1-cos(phi)) 把尖点放在底部、宽口翻到顶部，屋顶看起来是倒装的。
  for (let i = 0; i <= steps; i++) {
    const phi = (1 - i / steps) * (Math.PI/2);
    const r = radius * Math.sin(phi) * (1 + bulge * Math.sin(phi*2));
    const y = radius * squash * Math.cos(phi);
    prof.push([r, y]);
  }
  const shell = lathe(prof, material, 48); shell.scale.y = 1; g.add(shell);
  // 经线肋条
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2;
    const curvePts = [];
    for (let s = 0; s <= 16; s++) {
      const phi = (1 - s/16) * (Math.PI/2);
      const r = radius * Math.sin(phi) * (1 + bulge * Math.sin(phi*2)) * 1.015;
      curvePts.push(new THREE.Vector3(Math.cos(a)*r, radius*squash*Math.cos(phi)*1.015, Math.sin(a)*r));
    }
    const curve = new THREE.CatmullRomCurve3(curvePts);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, ribThickness, 8, false), ribMaterial));
  }
  g.add(mesh(new THREE.TorusGeometry(radius*1.01, ribThickness*1.4, 8, 48), ribMaterial, { rx: Math.PI/2, y: 0 }));
  return g;
}

/* ---------- 5. 真拱券墙（Shape 挖洞 + Extrude） ---------- */
export function archedWall(w, h, d, aw, ah, by, material) {
  const shape = new THREE.Shape();
  shape.moveTo(-w/2, 0); shape.lineTo(w/2, 0); shape.lineTo(w/2, h); shape.lineTo(-w/2, h); shape.closePath();
  const hole = new THREE.Path();
  const half = aw/2, springY = by + (ah - half > 0 ? ah - half : 0);
  hole.moveTo(-half, by); hole.lineTo(-half, springY);
  hole.absarc(0, springY, half, Math.PI, 0, true);
  hole.lineTo(half, by); hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 24 });
  geo.translate(0, 0, -d/2);
  const m = new THREE.Mesh(geo, material); m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* ---------- 6. 拱框 ---------- */
export function archFrame(aw, ah, thickness, material) {
  const g = new THREE.Group();
  const half = aw/2, springY = ah - half;
  const arc = new THREE.Mesh(new THREE.TorusGeometry(half, thickness, 12, 32, Math.PI), material);
  arc.position.y = springY; arc.castShadow = true; g.add(arc);
  for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(thickness*2, springY, thickness*2), material, { x: sx*half, y: springY/2 }));
  return g;
}

/* ---------- 7. 手绘柱子（带柱础柱头，有机柱身） ---------- */
export function column(height, radius, material, capMaterial = material, fluted = false) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(radius*1.4, radius*1.5, height*0.07, 20), capMaterial, { y: height*0.035 }));
  const shaft = organicCyl(radius*0.9, radius, height*0.85, material, { seg: 18, wobble: fluted ? 0.04 : 0.02 });
  shaft.position.y = height*0.44; g.add(shaft);
  g.add(mesh(new THREE.CylinderGeometry(radius*1.1, radius*0.9, height*0.06, 20), capMaterial, { y: height*0.895 }));
  g.add(roundedBox(radius*3.1, height*0.06, radius*3.1, 0.12, capMaterial, { y: height*0.95 }));
  return g;
}

/* ---------- 8. 错落多层挑檐 + 翘角 ---------- */
export function eaves(w, d, y, material, { over = 0.4, layers = 3, bracketMat = null, tipMat = null } = {}) {
  const g = new THREE.Group();
  for (let l = 0; l < layers; l++) {
    const o = over * (1 - l*0.22);
    const yy = y - l*0.16;
    g.add(roundedBox(w + o*2, 0.15, d + o*2, 0.14, material, { y: yy }));
  }
  // 四角翘角：圆润上翘的弯管 + 球头，杜绝裸露锥尖（M1）
  if (tipMat) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const bx = sx*(w/2 + over*0.85), bz = sz*(d/2 + over*0.85);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(bx, y - 0.02, bz),
        new THREE.Vector3(bx + sx*0.07, y + 0.13, bz + sz*0.07),
        new THREE.Vector3(bx + sx*0.17, y + 0.26, bz + sz*0.17),
        new THREE.Vector3(bx + sx*0.23, y + 0.32, bz + sz*0.23)
      ]);
      g.add(mesh(new THREE.TubeGeometry(curve, 12, 0.075, 8, false), tipMat));
      g.add(mesh(new THREE.SphereGeometry(0.115, 12, 9), tipMat, {
        x: bx + sx*0.23, y: y + 0.32, z: bz + sz*0.23
      }));
    }
  }
  if (bracketMat) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(roundedBox(0.2, 0.34, 0.2, 0.1, bracketMat, { x: sx*(w/2-0.12), y: y-0.28, z: sz*(d/2-0.12) }));
    }
  }
  return g;
}

/* ---------- 9. 四坡攒尖屋顶（带翘角） ---------- */
export function hipRoof(w, d, h, material, { ridge = 0, over = 0.35, tipMat = null } = {}) {
  const g = new THREE.Group();
  const hw = w/2 + over, hd = d/2 + over;
  const curl = over * 0.35; // 檐角上翘高度
  const corners = [[-hw, curl, -hd], [hw, curl, -hd], [hw, curl, hd], [-hw, curl, hd]];
  if (ridge <= 0) {
    const apex = [0, h, 0];
    const midLow = [[0, 0, -hd], [hw, 0, 0], [0, 0, hd], [-hw, 0, 0]];
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i+1)%4], m = midLow[i];
      // 每个檐面拆成两三角，做出檐角上翘的曲面
      for (const [p, q] of [[a, m], [m, b]]) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute([...p, ...q, ...apex], 3));
        geo.computeVertexNormals();
        const face = new THREE.Mesh(geo, material.clone());
        face.material.side = THREE.DoubleSide; face.castShadow = true; g.add(face);
      }
    }
  } else {
    const rh = ridge/2;
    const v = [[-hw, curl, -hd], [hw, curl, -hd], [rh, h, 0], [hw, curl, hd], [-hw, curl, hd], [-rh, h, 0]];
    const faces = [[0,1,2],[1,3,2],[3,4,5],[4,0,5],[0,4,3,1]];
    faces.forEach(f => {
      const geo = new THREE.BufferGeometry(); const arr = [];
      for (const idx of f) arr.push(...v[idx]);
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      geo.setIndex(f.length===4 ? [0,1,2,0,2,3] : [0,1,2]);
      geo.computeVertexNormals();
      const face = new THREE.Mesh(geo, material.clone());
      face.material.side = THREE.DoubleSide; face.castShadow = true; g.add(face);
    });
  }
  // 檐角圆润收头：小球包住三角面尖角，杜绝裸露直棱（M1）
  const cnr = ridge <= 0 ? corners
    : [[-hw, curl, -hd], [hw, curl, -hd], [hw, curl, hd], [-hw, curl, hd]];
  for (const [cx, cy, cz] of cnr) {
    g.add(mesh(new THREE.SphereGeometry(Math.min(0.16, over*0.5), 12, 9), material, { x: cx, y: cy, z: cz }));
  }
  // 屋脊小装饰
  if (tipMat && ridge > 0) {
    for (const sx of [-1, 1]) {
      g.add(mesh(new THREE.SphereGeometry(0.13, 16, 12), tipMat, { x: sx*ridge/2, y: h }));
      g.add(mesh(new THREE.SphereGeometry(0.075, 12, 10), tipMat, { x: sx*(ridge/2 + 0.1), y: h + 0.11 }));
    }
  }
  return g;
}

/* ---------- 10. 扇形格窗 ---------- */
export function fanWindow(radius, height, segments, glassMat, frameMat) {
  const g = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments, 1, true), glassMat);
  drum.position.y = height/2; g.add(drum);
  for (let i = 0; i < segments; i++) {
    const a = (i/segments)*Math.PI*2;
    g.add(mesh(new THREE.BoxGeometry(0.07, height, 0.07), frameMat, { x: Math.cos(a)*radius, y: height/2, z: Math.sin(a)*radius, ry: -a }));
  }
  g.add(mesh(new THREE.CylinderGeometry(radius*1.03, radius*1.03, 0.13, segments), frameMat, { y: 0.03 }));
  g.add(mesh(new THREE.CylinderGeometry(radius*1.03, radius*1.03, 0.13, segments), frameMat, { y: height-0.03 }));
  return g;
}

/* ---------- 11. 手绘窗户（圆角窗框 + 十字格 + 窗台） ---------- */
export function windowUnit(w, h, glassMat, frameMat, { cross = true, arch = false } = {}) {
  const g = new THREE.Group();
  if (arch) {
    // 拱顶窗
    const shape = roundRect(w, h - w*0.5, 0.08);
    g.add(mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false, curveSegments: 10 }), frameMat, { z: -0.04 }));
    const gs = roundRect(w*0.8, (h - w*0.5)*0.86, 0.06);
    g.add(mesh(new THREE.ExtrudeGeometry(gs, { depth: 0.1, bevelEnabled: false, curveSegments: 10 }), glassMat, { z: 0.02, shadow: false }));
    g.add(mesh(new THREE.CylinderGeometry(w*0.5, w*0.5, 0.1, 24, 1, false, 0, Math.PI), frameMat, { y: h/2 - w*0.5, z: -0.04, rx: Math.PI/2, shadow: false }));
  } else {
    g.add(roundedBox(w, h, 0.1, 0.09, frameMat));
    g.add(roundedBox(w*0.82, h*0.84, 0.12, 0.06, glassMat, { z: 0.03, shadow: false }));
  }
  if (cross) {
    g.add(mesh(new THREE.BoxGeometry(w*0.86, 0.07, 0.14), frameMat, { z: 0.07, shadow: false }));
    g.add(mesh(new THREE.BoxGeometry(0.07, h*0.86, 0.14), frameMat, { z: 0.07, shadow: false }));
  }
  g.add(roundedBox(w*1.2, 0.12, 0.26, 0.05, frameMat, { y: -h/2 - 0.06, z: 0.08 }));
  return g;
}

/* ---------- 12. 窗台花盆（小花盆 + 花朵） ---------- */
export function flowerBox(width, soilMat, potMat, flowerColors) {
  const g = new THREE.Group();
  g.add(roundedBox(width, 0.32, 0.36, 0.06, potMat));
  g.add(mesh(new THREE.BoxGeometry(width*0.9, 0.05, 0.3), soilMat, { y: 0.17, shadow: false }));
  const n = Math.max(3, Math.round(width*3));
  for (let i = 0; i < n; i++) {
    const x = -width/2 + 0.15 + (i/(n-1))*(width-0.3);
    const fy = 0.32 + Math.random()*0.12;
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, fy-0.15, 8), M(0x7FAE62), { x, y: 0.15+(fy-0.15)/2, shadow: false }));
    const col = flowerColors[i % flowerColors.length];
    const flower = mesh(new THREE.SphereGeometry(0.12, 14, 10), M(col), { x, y: fy, shadow: false });
    flower.scale.set(1, 0.86, 1); g.add(flower);
    // 花心
    g.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), M(0xF7D67A), { x, y: fy+0.02, z: 0.08, shadow: false }));
  }
  return g;
}

/* ---------- 13. 趣味招牌（Canvas 手绘文字 + 木牌 + 挂绳） ---------- */
export function signboard(text, sub, { w = 2.0, h = 0.72, bg = '#f3e0b0', ink = '#7a4a2a', accent = '#c98a3a' } = {}) {
  const g = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 512; c.height = 184;
  const ctx = c.getContext('2d');
  // 手绘木牌底
  ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = accent; ctx.lineWidth = 16; ctx.strokeRect(8, 8, c.width-16, c.height-16);
  ctx.strokeStyle = 'rgba(122,74,42,.35)'; ctx.lineWidth = 3; ctx.strokeRect(24, 24, c.width-48, c.height-48);
  // 角钉
  ctx.fillStyle = accent;
  for (const [nx, ny] of [[40,40],[c.width-40,40],[40,c.height-40],[c.width-40,c.height-40]]) {
    ctx.beginPath(); ctx.arc(nx, ny, 9, 0, 7); ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = ink; ctx.font = 'bold 78px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText(text, c.width/2, sub ? 78 : c.height/2);
  if (sub) { ctx.fillStyle = accent; ctx.font = 'bold 34px "PingFang SC",sans-serif'; ctx.fillText(sub, c.width/2, 138); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide });
  const board = mesh(new THREE.PlaneGeometry(w, h), boardMat, { shadow: false });
  g.add(board);
  // 挂绳
  const rope = M(0x8a6a42);
  for (const sx of [-1, 1]) {
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 5), rope, { x: sx*w*0.32, y: h/2+0.2, shadow: false }));
  }
  return g;
}

/* ---------- 14. 藤蔓（沿墙蜿蜒 + 叶片） ---------- */
export function vine(height, leafMat, { width = 0.9, leaves = 9 } = {}) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i/8;
    pts.push(new THREE.Vector3(Math.sin(t*Math.PI*2.4)*width*0.3, t*height, 0.02 + Math.cos(t*Math.PI*2)*0.05));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  g.add(mesh(new THREE.TubeGeometry(curve, 28, 0.035, 8, false), M(0x6E9E5A), { shadow: false }));
  for (let i = 0; i < leaves; i++) {
    const p = curve.getPoint((i+0.5)/leaves);
    const leaf = mesh(new THREE.SphereGeometry(0.14, 12, 9), leafMat, { x: p.x, y: p.y, z: p.z+0.03, shadow: false });
    leaf.scale.set(1, 0.55, 0.4); leaf.rotation.z = (i%2?1:-1)*0.5; g.add(leaf);
  }
  return g;
}

/* ---------- 15. 台阶 ---------- */
export function steps(width, count, mat, { rise = 0.16, run = 0.32, zDir = 1 } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const h = rise*(count-i);
    g.add(roundedBox(width, h, run, 0.04, mat, { y: h/2, z: zDir*i*run }));
  }
  return g;
}

/* ---------- 16. 腰线 ---------- */
export function beltMolding(w, d, y, material, { thickness = 0.16, out = 0.14 } = {}) {
  return roundedBox(w + out*2, thickness, d + out*2, 0.05, material, { y });
}

/* ---------- 17. 旗帜（可动画） ---------- */
export function flag(poleH, flagW, flagH, poleMat, clothMat) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.045, 0.055, poleH, 12), poleMat, { y: poleH/2 }));
  g.add(mesh(new THREE.SphereGeometry(0.1, 14, 10), poleMat, { y: poleH+0.05 }));
  const cloth = mesh(new THREE.PlaneGeometry(flagW, flagH, 12, 3), clothMat, { x: flagW/2, y: poleH-0.35 });
  cloth.material.side = THREE.DoubleSide;
  g.add(cloth); g.userData.cloth = cloth;
  return g;
}

/* ---------- 18. 烟囱（带砖纹质感 + 圆角） ---------- */
export function chimney(h, material, capMaterial) {
  const g = new THREE.Group();
  g.add(roundedBox(0.62, h, 0.62, 0.06, material));
  g.add(roundedBox(0.82, 0.18, 0.82, 0.05, capMaterial, { y: h/2 + 0.05 }));
  g.add(roundedBox(0.82, 0.12, 0.82, 0.05, capMaterial, { y: h/2 - 0.02 }));
  return g;
}

/* ==========================================================================
   树冠生成器（供后端 world.js 直接调用，替换 sakura()/umbrellaTree() 的树冠）
   --------------------------------------------------------------------------
   坐标约定（两类完全一致）：
     · 返回 THREE.Group，原点 = 树冠几何中心（0,0,0），y 轴向上。
     · 树干顶端应对齐 group.userData.jointY（局部坐标，通常为负值）。
     · 通用拼接：crown.position.y = trunkTopY - crown.userData.jointY;
     · 冠幅半径 = group.userData.radius，水平方向以原点为中心。
   ========================================================================== */

function _colorList(input) {
  const arr = Array.isArray(input) && input.length ? input : [input ?? 0xF4C4D4];
  return arr.map(c => new THREE.Color(c));
}

/** 可复现随机数：opts.seed 为整数时用 LCG，否则 Math.random */
function _rng(opts) {
  if (typeof opts.rand === 'function') return opts.rand;
  if (Number.isFinite(opts.seed)) {
    let s = opts.seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  return Math.random;
}

/**
 * 波浪边缘扁球：wave=花瓣起伏幅度，droop=边缘下垂量（0 为花簇，>0 为伞盖）。
 */
function _wavyBlob(radius, squash, lobes, wave, phase, material, droop = 0) {
  const geo = new THREE.SphereGeometry(1, 40, 14);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    const az = Math.hypot(v.x, v.z);
    const band = Math.pow(az, 2.4);                 // 起伏集中在赤道边缘
    const w = 1 + wave * Math.sin(lobes * a + phase) * band;
    let y = v.y * squash;
    if (droop > 0) {
      const edge = Math.pow(1 - Math.abs(v.y), 3);
      y -= droop * squash * edge * (0.45 + 0.55 * (0.5 + 0.5 * Math.cos(lobes * a + phase)));
    }
    pos.setXYZ(i, v.x * radius * w, y * radius, v.z * radius * w);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/**
 * blossomCrown —— 樱花/花树冠（M2）
 * @param {number} radius 树冠水平半径（世界单位，冠幅 = 2*radius）
 * @param {Array<string|number>|string|number} colorSet 花色数组，如 ['#F4C4D4','#FBD3E1','#F2AFC7']
 * @param {object} [opts]
 *        layers=3   层数（2~3）
 *        clusters=10 花簇总数（7~12）
 *        squash=0.45 单簇压扁比（0.35~0.6）
 *        wave=0.10   花瓣波浪幅度（0~0.22）
 *        seed        整数随机种子；rand 自定义随机函数
 * @returns {THREE.Group} 原点在树冠中心；userData={jointY,radius,squash,type}
 */
export function blossomCrown(radius, colorSet, opts = {}) {
  const R = Math.max(0.2, radius);
  const S = THREE.MathUtils.clamp(opts.squash ?? 0.45, 0.35, 0.6);
  const layers = THREE.MathUtils.clamp(Math.round(opts.layers ?? 3), 2, 3);
  const clusters = THREE.MathUtils.clamp(Math.round(opts.clusters ?? 10), 7, 12);
  const wave = THREE.MathUtils.clamp(opts.wave ?? 0.10, 0, 0.22);
  const rnd = _rng(opts);
  const colors = _colorList(colorSet);
  const g = new THREE.Group();
  g.name = 'blossomCrown';

  // 花簇自下而上递减，圆周错位堆叠
  const counts = layers === 2
    ? [Math.round(clusters * 0.65), clusters - Math.round(clusters * 0.65)]
    : [Math.round(clusters * 0.5), Math.round(clusters * 0.3),
       clusters - Math.round(clusters * 0.5) - Math.round(clusters * 0.3)];
  const ringR = [0.54, 0.32, 0.13];
  const layerY = [-0.20, 0.12, 0.40];
  const blobR = [0.40, 0.38, 0.34];

  for (let l = 0; l < counts.length; l++) {
    const n = Math.max(1, counts[l]);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + l * 0.55 + (rnd() - 0.5) * 0.28;
      const rr = R * ringR[l] * (0.9 + rnd() * 0.2);
      const base = colors[Math.floor(rnd() * colors.length)];
      // 簇间 ±8% 明度色差
      const col = base.clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.16);
      const m = M(col, { roughness: 0.9, metalness: 0 });
      const b = _wavyBlob(
        R * blobR[l] * (0.92 + rnd() * 0.16),
        S * (0.9 + rnd() * 0.2),
        5 + Math.floor(rnd() * 3),
        wave * (0.8 + rnd() * 0.4),
        rnd() * Math.PI * 2, m, 0
      );
      b.position.set(Math.cos(a) * rr, R * S * (layerY[l] + (rnd() - 0.5) * 0.16), Math.sin(a) * rr);
      g.add(b);
    }
  }
  // 中心补球，遮住层间空洞
  const coreCol = colors[0].clone().offsetHSL(0, 0, 0.03);
  g.add(_wavyBlob(R * 0.34, S * 0.9, 6, wave * 0.7, 0.4,
    M(coreCol, { roughness: 0.9 }), 0));

  const jointY = -0.62 * R * S;
  g.userData = { jointY, radius: R, squash: S, type: 'blossomCrown' };
  return g;
}

/**
 * umbrellaCanopy —— 伞状/蘑菇状层叠圆盘绿树冠（M2，参考 new4）
 * @param {number} radius 树冠水平半径
 * @param {Array<string|number>|string|number} colorSet 叶色数组，如 ['#BFD08A','#A8CE7A','#D6E0A4']
 * @param {object} [opts]
 *        layers=4   圆盘层数（2~5）
 *        squash=0.24 盘体压扁比（0.16~0.34）
 *        wave=0.12   边缘波浪起伏（0~0.24）
 *        droop=0.9   边缘下垂强度（0~1.4）
 *        seed/rand   随机控制
 * @returns {THREE.Group} 原点在树冠中心；userData={jointY,radius,squash,type}
 */
export function umbrellaCanopy(radius, colorSet, opts = {}) {
  const R = Math.max(0.2, radius);
  const S = THREE.MathUtils.clamp(opts.squash ?? 0.24, 0.16, 0.34);
  const layers = THREE.MathUtils.clamp(Math.round(opts.layers ?? 4), 2, 5);
  const wave = THREE.MathUtils.clamp(opts.wave ?? 0.12, 0, 0.24);
  const droop = THREE.MathUtils.clamp(opts.droop ?? 0.9, 0, 1.4);
  const rnd = _rng(opts);
  const colors = _colorList(colorSet);
  const g = new THREE.Group();
  g.name = 'umbrellaCanopy';

  for (let l = 0; l < layers; l++) {
    const t = l / Math.max(1, layers - 1);           // 0 = 最下最大层
    const rr = R * (1 - t * 0.58);
    const base = colors[Math.floor(rnd() * colors.length)];
    const col = base.clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.1 + t * 0.03);
    const disc = _wavyBlob(
      rr, S * (0.92 + rnd() * 0.16),
      9 + Math.floor(rnd() * 4),
      wave * (0.9 + rnd() * 0.25),
      l * 0.7 + rnd() * 0.5,
      M(col, { roughness: 0.9, metalness: 0, side: THREE.DoubleSide }), droop
    );
    disc.position.y = R * (0.03 + t * 0.34);
    g.add(disc);
  }
  // 顶部圆帽，收住层叠中心
  const topCol = colors[0].clone().offsetHSL(0, 0, 0.05);
  const cap = _wavyBlob(R * 0.26, S * 1.1, 7, wave * 0.8, 1.2,
    M(topCol, { roughness: 0.9, side: THREE.DoubleSide }), droop * 0.5);
  cap.position.y = R * 0.4;
  g.add(cap);

  const jointY = -0.30 * R;
  g.userData = { jointY, radius: R, squash: S, type: 'umbrellaCanopy' };
  return g;
}
