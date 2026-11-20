import * as THREE from 'three';
import { mat, texMat, PALETTE, brickTexture, stoneTexture, woodTexture, glassTexture, plasterTexture, roofTexture } from './textures.js?v=20261120b';
import {
  M, mesh, roundedBox, organicCyl, lathe, dome, archedWall, archFrame, column,
  eaves, hipRoof, fanWindow, windowUnit, steps, beltMolding, flag, flowerBox, signboard, vine, chimney
} from './geo.js';

const G = 1.6; // 岛面高度，与 world.js ISLAND.groundY 保持一致

/* 集中材质：统一走定稿色板，matte→satin，压低镜面（M9） */
const MAT = {
  brick: () => texMat(brickTexture, { color: 0xffffff, roughness: 0.92 }),
  plaster: () => texMat(plasterTexture, { color: 0xffffff, roughness: 0.9 }),
  stone: () => texMat(stoneTexture, { color: 0xffffff, roughness: 0.92 }),
  wood: c => texMat(woodTexture, { color: c || PALETTE.wood.main, roughness: 0.9 }),
  copper: () => M(PALETTE.copper, { metalness: 0.08, roughness: 0.72 }),
  copperDark: () => M(0x6E9C88, { metalness: 0.1, roughness: 0.7 }),
  cream: () => M(PALETTE.cream, { roughness: 0.88 }),
  timber: () => M(PALETTE.wood.dark, { roughness: 0.9 }),
  doorWood: () => M(0xA9794F, { roughness: 0.88 }),
  gold: () => M(PALETTE.gold, { metalness: 0.16, roughness: 0.62 }),
  iron: () => M(0x4A3A32, { metalness: 0.12, roughness: 0.72 }),
  roofRed: () => texMat(roofTexture, { color: 0xffffff, roughness: 0.94, side: THREE.DoubleSide }),
  roofBlue: () => M(0x6E92AE, { roughness: 0.88, side: THREE.DoubleSide }),
  leaf: () => M(PALETTE.grass.main, { roughness: 0.9 })
};

function glow(emissiveMats, color, dayI = 0.08, nightI = 1.4) {
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: dayI, roughness: 0.68, metalness: 0 });
  emissiveMats.push({ mat: m, dayI, nightI });
  return m;
}

/* 花箱柔化色板，避免高饱和荧光感 */
const FLOWERS = [0xF4C4D4, 0xF7D67A, 0xA492D4, 0xF28E7B, 0xBFE3E8, 0xFFF8EA];

/* 建筑脚下的柔和接触阴影：带色相的暖褐，不用纯黑 */
function contactShadow(radius, opacity = 0.16) {
  const s = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 40),
    new THREE.MeshBasicMaterial({ color: 0x6B5B48, transparent: true, opacity, depthWrite: false })
  );
  s.rotation.x = -Math.PI / 2;
  s.position.y = 0.012;
  s.renderOrder = -1;
  return s;
}

/* ---------- 通用细节构件（绘本化） ---------- */

/** 拱门铁艺卷草：对称卷曲细管 + 花芯，置于门拱内（xy 平面，朝 +Z） */
function ironScroll(mat, s = 1) {
  const g = new THREE.Group();
  const paths = [
    [[0, 0.02], [0, 0.22], [0.06, 0.34], [0.18, 0.36], [0.24, 0.28], [0.18, 0.22], [0.12, 0.26]],
    [[0, 0.10], [0.12, 0.18], [0.22, 0.14], [0.26, 0.06], [0.20, 0.02], [0.16, 0.08]],
    [[0, 0.30], [-0.08, 0.40], [-0.18, 0.38], [-0.22, 0.30], [-0.16, 0.26], [-0.11, 0.31]]
  ];
  for (const p of paths) {
    const curve = new THREE.CatmullRomCurve3(p.map(([x, y]) => new THREE.Vector3(x * s, y * s, 0)));
    g.add(mesh(new THREE.TubeGeometry(curve, 18, 0.012 * s, 6, false), mat, { shadow: false }));
  }
  g.add(mesh(new THREE.SphereGeometry(0.034 * s, 10, 8), mat, { x: 0, y: 0.44 * s, shadow: false }));
  for (const sx of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(0.02 * s, 8, 6), mat, { x: sx * 0.24 * s, y: 0.28 * s, shadow: false }));
  }
  return g;
}

/** 拱形木门：Shape 挖圆拱 + 木板分缝 + 铁艺 + 金把手；原点在门底部中心，面朝 +Z */
function archedWoodDoor(w, h, woodMat, frameMat, ironMat) {
  const g = new THREE.Group();
  const half = w / 2, straight = h - half;
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0); shape.lineTo(half, 0); shape.lineTo(half, straight);
  shape.absarc(0, straight, half, 0, Math.PI, false);
  shape.lineTo(-half, 0);
  const dgeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03,
    bevelSegments: 3, curveSegments: 22
  });
  dgeo.translate(0, 0, -0.05);
  g.add(mesh(dgeo, woodMat));
  // 竖向木板分缝（圆润细条，不是黑描边）
  for (let i = -1; i <= 1; i++) {
    g.add(roundedBox(0.035, straight * 0.92, 0.02, 0.12, frameMat, { x: i * w * 0.24, y: straight * 0.48, z: 0.06, shadow: false }));
  }
  g.add(roundedBox(w * 0.92, 0.06, 0.02, 0.12, frameMat, { y: straight * 0.42, z: 0.06, shadow: false }));
  // 拱框 + 铁艺
  const af = archFrame(w, h, 0.045, frameMat); af.position.z = 0.07; g.add(af);
  const scroll = ironScroll(ironMat, w * 0.95);
  scroll.position.set(0, straight - 0.02, 0.1); g.add(scroll);
  // 门把手
  g.add(mesh(new THREE.SphereGeometry(0.055, 10, 8), MAT.gold(), { x: w * 0.3, y: straight * 0.46, z: 0.13, shadow: false }));
  return g;
}

/** 立体鳞片瓦：贴合 hipRoof 前后坡面，InstancedMesh 控制 draw call（M7） */
function scaleTiles(w, d, h, over, ridge, material, { rows = 6, tile = 0.15 } = {}) {
  const g = new THREE.Group();
  const hw = w / 2 + over, hd = d / 2 + over;
  const curl = over * 0.35;
  const placements = [];
  for (const side of [-1, 1]) {
    for (let r = 0; r < rows; r++) {
      const t = (r + 0.6) / rows;                       // 0=檐口，1=屋脊
      const z = side * hd * (1 - t);
      const y = curl + (h - curl) * t + 0.02;
      const widthAtY = ridge > 0
        ? THREE.MathUtils.lerp(hw, ridge / 2, t)
        : hw * (1 - t * 0.92);
      const n = Math.max(2, Math.round(widthAtY / 0.3));
      for (let i = 0; i < n; i++) {
        const x = -widthAtY + (i + 0.5) * (widthAtY * 2 / n);
        placements.push({ x, y, z, rot: side * Math.atan2(h - curl, hd) * 0.55 });
      }
    }
  }
  const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), material, placements.length);
  const dummy = new THREE.Object3D();
  placements.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(p.rot, 0, 0);
    dummy.scale.set(tile, tile * 0.38, tile * 0.86);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  });
  inst.castShadow = false; inst.receiveShadow = false;
  g.add(inst);
  return g;
}

/** 拱廊暖色 cavity：让拱洞内侧呈暖褐而非黑洞 */
function warmCavity(width, height, color = 0xC9A57E) {
  return mesh(new THREE.PlaneGeometry(width, height), M(color, { roughness: 1, side: THREE.DoubleSide }), { shadow: false });
}

/** 窗台花盆：小花盆 + 花簇，放在窗台外侧 */
function sillPots(count, span, z, flowerColors) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const x = -span / 2 + (i + 0.5) * (span / count);
    g.add(roundedBox(0.18, 0.16, 0.16, 0.12, MAT.wood(0xA9794F), { x, y: 0.08, z }));
    const f = mesh(new THREE.SphereGeometry(0.095, 10, 8), M(flowerColors[i % flowerColors.length]), { x, y: 0.21, z, shadow: false });
    f.scale.set(1, 0.9, 1); g.add(f);
  }
  return g;
}

/* ==========================================================================
   🏠 关于我：半木结构童话小屋（歇山顶 + 鳞片瓦 + 拱形木门铁艺 + 花箱 + 藤蔓 + 招牌）
   本地高度 ≈ 4.3~4.4（老虎窗顶）
   ========================================================================== */
export function buildCottage(emissiveMats) {
  const g = new THREE.Group();
  const w = 4.0, d = 3.2, wallH = 2.4;
  g.add(contactShadow(3.2, 0.15));

  // 1. 石砌基座 + 台阶
  g.add(roundedBox(w + 0.4, 0.32, d + 0.4, 0.16, MAT.stone(), { y: 0.16 }));
  const st = steps(1.6, 3, MAT.stone(), { zDir: 1 }); st.position.set(0, 0, d / 2 + 0.15); g.add(st);

  // 2. 墙体（米白灰泥，加大圆角）
  g.add(roundedBox(w, wallH, d, 0.18, MAT.plaster(), { y: 0.32 + wallH / 2 }));

  // 3. 半木结构：圆角木梁 + 立柱 + 斜撑
  const tb = MAT.timber();
  for (const sx of [-1, 1]) {
    g.add(roundedBox(0.16, wallH, 0.16, 0.12, tb, { x: sx * (w / 2 - 0.08), y: 0.32 + wallH / 2, z: d / 2 + 0.07 }));
    g.add(roundedBox(0.16, wallH, 0.16, 0.12, tb, { x: sx * (w / 2 - 0.08), y: 0.32 + wallH / 2, z: -d / 2 - 0.07 }));
  }
  g.add(roundedBox(w, 0.16, 0.16, 0.12, tb, { y: 0.32 + wallH, z: d / 2 + 0.07 }));
  g.add(roundedBox(w, 0.16, 0.16, 0.12, tb, { y: 0.32 + wallH, z: -d / 2 - 0.07 }));
  for (const px of [-1.25, 1.25]) {
    g.add(roundedBox(0.12, 1.0, 0.12, 0.12, tb, { x: px, y: 1.1, z: d / 2 + 0.09, rz: 0.6 }));
    g.add(roundedBox(0.12, 1.0, 0.12, 0.12, tb, { x: px, y: 1.1, z: d / 2 + 0.09, rz: -0.6 }));
  }

  // 4. 歇山顶 + 圆润翘角挑檐 + 立体鳞片瓦
  const roofY = 0.32 + wallH;
  g.add(eaves(w, d, roofY + 0.02, MAT.cream(), { over: 0.42, layers: 3, bracketMat: tb, tipMat: MAT.gold() }));
  const roof = hipRoof(w, d, 1.35, MAT.roofRed(), { ridge: w * 0.32, over: 0.5, tipMat: MAT.gold() });
  roof.position.y = roofY + 0.08; g.add(roof);
  const scales = scaleTiles(w, d, 1.35, 0.5, w * 0.32, MAT.roofRed(), { rows: 6, tile: 0.16 });
  scales.position.y = roofY + 0.08; g.add(scales);

  // 5. 老虎窗（屋顶小天窗 + 花箱）
  const dormer = new THREE.Group();
  dormer.add(roundedBox(0.9, 0.8, 0.55, 0.14, MAT.plaster(), { y: 0.4 }));
  const dg = glow(emissiveMats, 0xffe6a0, 0.1, 1.5);
  dormer.add(roundedBox(0.6, 0.55, 0.1, 0.12, dg, { y: 0.45, z: 0.32, shadow: false }));
  const droof = hipRoof(1.0, 0.7, 0.42, MAT.roofRed(), { over: 0.08 }); droof.position.y = 0.86; dormer.add(droof);
  dormer.position.set(0, roofY + 0.3, d / 2 - 0.3); g.add(dormer);

  // 6. 正面窗户 + 窗台花箱 + 窗台花盆
  const glass = glow(emissiveMats, 0xffe3a8, 0.12, 1.5);
  for (const px of [-1.2, 1.2]) {
    const win = windowUnit(0.8, 0.95, glass, MAT.cream());
    win.position.set(px, 1.65, d / 2 + 0.1); g.add(win);
    const fb = flowerBox(1.0, M(0x5a4330), MAT.wood(0x9a6b42), FLOWERS);
    fb.position.set(px, 1.0, d / 2 + 0.26); g.add(fb);
    // sillPots 内部已带绝对 z，这里只给 x/y；叠加 z 会让花盆悬在门前半空
    const pots = sillPots(3, 0.9, d / 2 + 0.24, FLOWERS);
    pots.position.set(px, 1.12, 0); g.add(pots);
  }

  // 7. 门廊（圆角柱 + 拱形木门铁艺）
  const porch = roundedBox(1.9, 0.16, 1.1, 0.14, MAT.stone(), { y: 0.4, z: d / 2 + 0.5 }); g.add(porch);
  for (const px of [-0.8, 0.8]) {
    const col = column(2.0, 0.11, MAT.cream(), MAT.cream(), false);
    col.position.set(px, 0.32, d / 2 + 0.9); g.add(col);
  }
  g.add(roundedBox(2.1, 0.16, 1.3, 0.14, MAT.roofRed(), { y: 2.4, z: d / 2 + 0.82 }));
  const door = archedWoodDoor(0.95, 1.65, MAT.doorWood(), MAT.cream(), MAT.iron());
  door.position.set(0, 0.42, d / 2 + 0.12); g.add(door);

  // 8. 砖烟囱 + 藤蔓 + 门前花坛
  const ch = chimney(1.2, MAT.brick(), MAT.cream());
  ch.position.set(w / 2 - 0.7, roofY + 0.95, -0.5); g.add(ch);
  const v = vine(1.9, MAT.leaf(), { width: 0.7, leaves: 9 });
  v.position.set(-w / 2 + 0.15, 0.35, d / 2 + 0.12); g.add(v);
  const v2 = vine(1.5, MAT.leaf(), { width: 0.5, leaves: 7 });
  v2.position.set(w / 2 - 0.2, 0.35, d / 2 + 0.12); g.add(v2);
  for (const sx of [-1, 1]) {
    g.add(roundedBox(0.5, 0.28, 0.42, 0.14, MAT.stone(), { x: sx * 1.35, y: 0.46, z: d / 2 + 0.55 }));
    g.add(mesh(new THREE.SphereGeometry(0.22, 12, 9), MAT.leaf(), { x: sx * 1.35, y: 0.68, z: d / 2 + 0.55 }));
  }

  // 9. 趣味招牌：原先贴在屋檐里被挑檐/门廊顶挡住，改为前挑木架悬挂，正面清晰可见
  for (const sx of [-1, 1]) {
    g.add(roundedBox(0.1, 1.16, 0.1, 0.05, tb, { x: sx * 0.62, y: 3.06, z: d / 2 + 0.9 }));
    g.add(roundedBox(0.1, 0.1, 0.85, 0.05, tb, { x: sx * 0.62, y: 3.62, z: d / 2 + 1.25 }));
  }
  g.add(roundedBox(1.5, 0.12, 0.12, 0.05, tb, { y: 3.62, z: d / 2 + 1.55 }));
  const sign = signboard('关于我', 'ABOUT ME', { w: 1.8, h: 0.66 });
  sign.position.set(0, 3.02, d / 2 + 1.55); g.add(sign);

  g.userData.winMat = glass;
  return g;
}

/* ==========================================================================
   💎 技能：水晶魔法塔（八角基座 + 有机塔身 + 环廊 + 扇形窗 + 蓝紫水晶尖顶 + 悬浮水晶）
   本地高度 ≈ 6.6
   ========================================================================== */
export function buildCrystalTower(emissiveMats) {
  const g = new THREE.Group();
  g.add(contactShadow(3.0, 0.15));

  // 1. 八角基座（圆角台阶）
  g.add(mesh(new THREE.CylinderGeometry(2.1, 2.25, 0.45, 8), MAT.stone(), { y: 0.22, ry: Math.PI / 8 }));
  g.add(mesh(new THREE.CylinderGeometry(1.85, 1.95, 0.24, 8), MAT.cream(), { y: 0.55, ry: Math.PI / 8 }));
  const st = steps(1.6, 3, MAT.stone(), { zDir: 1 }); st.position.set(0, 0, 2.2); g.add(st);

  // 2. 有机收分塔身
  const shaft = lathe([
    [1.4, 0], [1.35, 0.25], [1.2, 0.5], [1.08, 1.0], [1.02, 1.6],
    [1.08, 2.2], [1.18, 2.6], [1.22, 2.85], [1.1, 3.0]
  ], MAT.cream(), 24);
  shaft.position.y = 0.65; g.add(shaft);

  // 3. 塔身环带（蓝紫魔法色调）
  for (const yy of [1.3, 2.2, 2.85]) g.add(mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.1, 24), M(0x8a7ac0, { roughness: 0.8 }), { y: yy + 0.65 }));

  // 4. 发光环（旋转动画钩子保留）
  const ringMat = M(0x9fe0ff, { emissive: 0x4aa8e0, emissiveIntensity: 0.4, metalness: 0.1, roughness: 0.65 });
  emissiveMats.push({ mat: ringMat, dayI: 0.3, nightI: 1.5 });
  const ring = mesh(new THREE.TorusGeometry(1.16, 0.07, 8, 36), ringMat, { rx: Math.PI / 2, y: 0.65 + 2.82 });
  g.add(ring); g.userData.ring = ring;

  // 5. 环廊细柱（蓝紫柱头）
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const col = column(2.1, 0.1, MAT.cream(), M(0x8a7ac0, { roughness: 0.85 }), true);
    col.position.set(Math.cos(a) * 1.28, 0.65 + 0.3, Math.sin(a) * 1.28); g.add(col);
  }

  // 6. 扇形格窗
  const glass = glow(emissiveMats, 0xd8c8ff, 0.15, 1.5);
  const fan = fanWindow(1.08, 0.8, 12, glass, M(0x8a7ac0, { roughness: 0.85 }));
  fan.position.y = 0.65 + 2.15; g.add(fan);

  // 7. 蓝紫魔法水晶尖顶
  const domeY = 0.65 + 3.0;
  g.add(mesh(new THREE.CylinderGeometry(1.35, 1.2, 0.28, 8), M(0x7a6aa8, { roughness: 0.8 }), { y: domeY + 0.14, ry: Math.PI / 8 }));
  const spireMat = M(0x9E90DC, { metalness: 0.1, roughness: 0.68, emissive: 0x5A48A0, emissiveIntensity: 0.2 });
  const spire = mesh(new THREE.ConeGeometry(1.15, 2.2, 12), spireMat, { y: domeY + 0.28 + 1.1, ry: Math.PI / 8 });
  g.add(spire);
  // 环绕小水晶柱
  const spikeColors = [0x7ec8e3, 0xb388e3, 0x8be0a5];
  // 环绕小水晶：圆润的多面晶体，替代原来的圆锥尖刺
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const hh = 0.8 + (i % 3) * 0.35;
    const bud = mesh(new THREE.IcosahedronGeometry(0.2, 1),
      M(spikeColors[i % 3], { emissive: spikeColors[i % 3], emissiveIntensity: 0.28, roughness: 0.6 }),
      { x: Math.cos(a) * 1.05, y: domeY + 0.28 + hh / 2, z: Math.sin(a) * 1.05, shadow: true });
    bud.scale.set(0.85, hh / 0.4, 0.85);
    g.add(bud);
  }
  g.add(mesh(new THREE.IcosahedronGeometry(0.28, 1), MAT.gold(), { y: domeY + 2.65 }));

  // 8. 悬浮水晶（旋转动画钩子保留）
  const colors = [0x7ec8e3, 0xb388e3, 0xe88ab0, 0x8be0a5, 0xffd166];
  g.userData.crystals = [];
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26 + (i % 2) * 0.1, 1),
      M(colors[i % 5], { emissive: colors[i % 5], emissiveIntensity: 0.34, metalness: 0.08, roughness: 0.55 }));
    const a = (i / 6) * Math.PI * 2;
    c.position.set(Math.cos(a) * 1.25, domeY + 1.1 + (i % 3) * 0.5, Math.sin(a) * 1.25);
    c.castShadow = true; g.add(c); g.userData.crystals.push(c);
  }
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1),
    M(0xFFF0C0, { emissive: 0xE8C06A, emissiveIntensity: 0.6, metalness: 0.08, roughness: 0.6 }));
  core.position.y = domeY + 1.95; core.scale.y = 1.6; g.add(core); g.userData.core = core;

  // 9. 塔身藤蔓 + 花 + 招牌
  const cv = vine(1.6, MAT.leaf(), { width: 0.5, leaves: 8 });
  cv.position.set(0, 0.75, 1.12); g.add(cv);
  const cv2 = vine(1.2, MAT.leaf(), { width: 0.4, leaves: 6 });
  cv2.position.set(1.05, 0.8, 0.4); cv2.rotation.y = Math.PI / 2; g.add(cv2);
  const pots = sillPots(3, 1.2, 1.55, FLOWERS);
  pots.position.set(0, 0.62, 0); g.add(pots);
  const sign = signboard('技能树', 'SKILLS', { w: 1.7, h: 0.62, bg: '#E4F2F5', ink: '#4A6A80', accent: '#7FBFA6' });
  sign.position.set(0, 1.65, 1.95); g.add(sign);

  return g;
}

/* ==========================================================================
   📚 工作经历：红砖拱廊学院楼（5 真拱券 + 暖色 cavity + 鳞片瓦 + 钟楼 + 藤蔓 + 招牌）
   本地高度 ≈ 9.4
   ========================================================================== */
export function buildBrickHall(emissiveMats) {
  const g = new THREE.Group();
  const w = 7.2, d = 4.4;
  const brick = MAT.brick(), stone = MAT.stone();
  g.add(contactShadow(4.8, 0.14));

  // 1. 基座
  g.add(roundedBox(w + 0.4, 0.32, d + 0.4, 0.16, stone, { y: 0.16 }));
  const st = steps(2.2, 3, stone, { zDir: 1 }); st.position.set(0, 0, d / 2 + 0.28); g.add(st);

  // 2. 一层拱廊（5 个真拱券 + 暖色 cavity + 圆角列柱）
  const arcCount = 5, span = w / arcCount, arcH = 2.1;
  // 实体墙芯：补齐拱廊后方与两侧，避免从背面看整层是空心穿帮
  // 前沿收在 z≈1.30，留出约 0.7 深的拱廊进深，暖色 cavity 仍在前面可见
  g.add(roundedBox(w - 0.12, arcH, d - 0.9, 0.16, brick, { y: 0.32 + arcH / 2, z: -0.45 }));
  for (let i = 0; i < arcCount; i++) {
    const px = -w / 2 + span * (i + 0.5);
    const cav = warmCavity(span * 0.66, arcH * 0.9, 0xC9A57E);
    cav.position.set(px, 0.32 + arcH * 0.48, d / 2 - 0.18); g.add(cav);
    const wall = archedWall(span, arcH, 0.42, span * 0.66, span * 0.66, 0, brick);
    wall.position.set(px, 0.32 + arcH / 2, d / 2); g.add(wall);
    const af = archFrame(span * 0.66, span * 0.66, 0.09, stone);
    af.position.set(px, 0.32, d / 2 + 0.24); g.add(af);
    const doorGlass = glow(emissiveMats, 0x8ec6d8, 0.05, 1.1);
    g.add(roundedBox(span * 0.58, arcH * 0.72, 0.08, 0.12, doorGlass, { x: px, y: 0.32 + arcH * 0.38, z: d / 2 - 0.1, shadow: false }));
  }
  for (let i = 0; i <= arcCount; i++) {
    const px = -w / 2 + span * i;
    const col = column(2.2, 0.14, stone, MAT.cream(), true);
    col.position.set(px, 0.32, d / 2 + 0.3); g.add(col);
  }
  g.add(beltMolding(w, d, 0.32 + arcH + 0.05, MAT.cream(), { thickness: 0.18, out: 0.16 }));

  // 3. 二层墙体 + 拱顶窗 + 窗台花
  const upperH = 1.9, upperY = 0.32 + arcH + 0.2;
  g.add(roundedBox(w - 0.15, upperH, d - 0.15, 0.16, brick, { y: upperY + upperH / 2 }));
  const glass = glow(emissiveMats, 0xbfe0ee, 0.05, 1.25);
  for (let i = 0; i < 4; i++) {
    const px = -w / 2 + span * (i + 0.8);
    const win = windowUnit(0.78, 1.15, glass, stone, { arch: true });
    win.position.set(px, upperY + upperH / 2 - 0.05, d / 2 + 0.02); g.add(win);
    const fb = flowerBox(0.85, M(0x5a4330), MAT.wood(0x9a6b42), FLOWERS);
    fb.position.set(px, upperY + 0.2, d / 2 + 0.22); g.add(fb);
    const pots = sillPots(2, 0.7, d / 2 + 0.14, FLOWERS);
    pots.position.set(px, upperY + upperH / 2 - 0.55, 0); g.add(pots);
  }

  // 4. 二层檐口 + 瓦顶 + 立体鳞片瓦
  g.add(eaves(w - 0.15, d - 0.15, upperY + upperH + 0.02, MAT.cream(), { over: 0.35, layers: 2, tipMat: MAT.gold() }));
  const roof = hipRoof(w - 0.15, d - 0.15, 1.0, MAT.roofRed(), { ridge: w * 0.28, over: 0.38, tipMat: MAT.gold() });
  roof.position.y = upperY + upperH + 0.08; g.add(roof);
  const scales = scaleTiles(w - 0.15, d - 0.15, 1.0, 0.38, w * 0.28, MAT.roofRed(), { rows: 5, tile: 0.14 });
  scales.position.y = upperY + upperH + 0.08; g.add(scales);

  // 5. 削矮钟楼（userData.spire 动画钩子保留）
  const towerW = 1.7, towerH = 2.0, towerY = upperY + upperH + 0.75;
  g.add(roundedBox(towerW, towerH, towerW, 0.16, brick, { y: towerY + towerH / 2 }));
  for (let side = 0; side < 4; side++) {
    const rot = side * Math.PI / 2;
    const face = new THREE.Group();
    face.add(archedWall(towerW, towerH * 0.62, 0.08, 0.85, 0.9, 0.3, brick));
    const bell = lathe([[0.05, 0], [0.26, 0.12], [0.3, 0.42], [0.1, 0.6], [0.09, 0.72]], MAT.gold(), 14);
    bell.position.set(0, 0.4, 0.02); face.add(bell);
    const af = archFrame(0.85, 0.9, 0.07, stone); af.position.y = 0.3; face.add(af);
    face.position.set(Math.sin(rot) * (towerW / 2 + 0.01), towerY + 0.15, Math.cos(rot) * (towerW / 2 + 0.01));
    face.rotation.y = rot; g.add(face);
    // 钟面
    g.add(mesh(new THREE.CircleGeometry(0.34, 22), M(0xfff6e0, { emissive: 0xfff0c0, emissiveIntensity: 0.1, roughness: 0.8 }), {
      x: Math.sin(rot) * (towerW / 2 + 0.06), y: towerY + towerH - 0.42, z: Math.cos(rot) * (towerW / 2 + 0.06), ry: rot, shadow: false }));
    g.add(mesh(new THREE.TorusGeometry(0.34, 0.06, 8, 22), MAT.gold(), {
      x: Math.sin(rot) * (towerW / 2 + 0.08), y: towerY + towerH - 0.42, z: Math.cos(rot) * (towerW / 2 + 0.08), ry: rot, shadow: false }));
  }
  const spireY = towerY + towerH;
  g.add(eaves(towerW, towerW, spireY, MAT.cream(), { over: 0.26, layers: 2, tipMat: MAT.gold() }));
  const spire = hipRoof(towerW, towerW, 1.3, MAT.copper(), { over: 0.28 });
  spire.position.y = spireY; g.add(spire);
  g.add(lathe([[0.16, 0], [0.09, 0.4], [0, 0.8]], MAT.gold(), 12).translateY(spireY + 1.3));

  // 6. 藤蔓 + 花箱 + 招牌
  const v = vine(2.0, MAT.leaf(), { width: 0.6, leaves: 10 });
  v.position.set(-w / 2 + 0.25, 0.32, d / 2 + 0.12); g.add(v);
  const v2 = vine(1.8, MAT.leaf(), { width: 0.5, leaves: 8 });
  v2.position.set(w / 2 - 0.25, 0.32, d / 2 + 0.12); g.add(v2);
  const fb2 = flowerBox(1.6, M(0x5a4330), MAT.wood(0x9a6b42), FLOWERS);
  // 落在石基座顶面（y=0.32），不再悬在半空
  fb2.position.set(0, 0.48, d / 2 + 0.18); g.add(fb2);
  const sign = signboard('工作经历', 'EXPERIENCE', { w: 2.0, h: 0.68, bg: '#F6E3D4', ink: '#8A4A32', accent: '#C9803A' });
  sign.position.set(0, upperY + upperH + 0.1, d / 2 + 0.30); g.add(sign);

  g.userData.spire = spire;
  return g;
}

/* ==========================================================================
   🏆 项目：现代玻璃幕墙楼（白色框架 + 压低反射 + 屋顶花园 + 弧形玻璃 + 招牌）
   本地高度 ≈ 4.9
   ========================================================================== */
export function buildGlassTower(emissiveMats) {
  const g = new THREE.Group();
  const w = 5.6, d = 4.0, floors = 3, floorH = 1.25;
  g.add(contactShadow(4.2, 0.15));

  g.add(roundedBox(w + 0.4, 0.3, d + 0.4, 0.16, MAT.stone(), { y: 0.15 }));
  const st = steps(2.0, 2, MAT.stone(), { zDir: 1 }); st.position.set(0, 0, d / 2 + 0.28); g.add(st);

  // 1. 玻璃压低镜面（M9）：metalness 0.04 / roughness 0.62
  const glass = texMat(glassTexture, { metalness: 0.04, roughness: 0.62, emissive: 0xffd98a, emissiveIntensity: 0 });
  emissiveMats.push({ mat: glass, dayI: 0, nightI: 0.6 });
  // 2. 白色框架分格
  const frame = M(0xF5F0E4, { metalness: 0.08, roughness: 0.75 });
  const frameShade = M(0xD9D2C0, { roughness: 0.82 });

  for (let f = 0; f < floors; f++) {
    const yy = 0.3 + floorH * (f + 0.5);
    g.add(roundedBox(w, floorH * 0.92, d, 0.16, glass, { y: yy }));
    g.add(roundedBox(w + 0.24, 0.14, d + 0.24, 0.12, frame, { y: 0.3 + floorH * f }));
  }
  // 竖向幕墙框
  for (let i = 0; i <= 5; i++) {
    const px = -w / 2 + (w / 5) * i;
    g.add(roundedBox(0.11, floorH * floors, 0.11, 0.12, frame, { x: px, y: 0.3 + floorH * floors / 2, z: d / 2 + 0.05 }));
    g.add(roundedBox(0.11, floorH * floors, 0.11, 0.12, frame, { x: px, y: 0.3 + floorH * floors / 2, z: -d / 2 - 0.05 }));
  }
  // 横向白色腰线
  for (let f = 1; f < floors; f++) {
    g.add(roundedBox(w + 0.3, 0.09, d + 0.3, 0.12, frameShade, { y: 0.3 + floorH * f + 0.08 }));
  }

  // 3. 屋顶空中花园（加强：灌木 + 小树 + 花 + 藤架）
  const topY = 0.3 + floorH * floors;
  g.add(roundedBox(w + 0.3, 0.3, d + 0.3, 0.14, frame, { y: topY + 0.15 }));
  g.add(roundedBox(w - 0.4, 0.1, d - 0.4, 0.12, M(0x6fae5a, { roughness: 0.9 }), { y: topY + 0.33 }));
  for (let i = 0; i < 11; i++) {
    const px = -w / 2 + 0.6 + (i % 5) * 1.15, pz = (i < 6 ? -1 : 1) * 1.0;
    const bush = mesh(new THREE.SphereGeometry(0.3 + (i % 3) * 0.04, 14, 10), M(i % 2 ? 0x8FB967 : PALETTE.grass.main, { roughness: 0.9 }), { x: px, y: topY + 0.52, z: pz });
    g.add(bush);
    if (i % 2 === 0) {
      g.add(mesh(new THREE.SphereGeometry(0.09, 6, 5), M(FLOWERS[i % FLOWERS.length]), { x: px + 0.15, y: topY + 0.68, z: pz, shadow: false }));
    }
  }
  // 屋顶小树（压低以保持总高 ≈4.9）
  for (const px of [-2.0, 2.1]) {
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.34, 8), MAT.timber(), { x: px, y: topY + 0.5, z: 0.5 }));
    g.add(mesh(new THREE.SphereGeometry(0.22, 14, 10), MAT.leaf(), { x: px, y: topY + 0.66, z: 0.5 }));
  }

  // 4. 入口雨棚 + 发光中庭
  const canopy = roundedBox(3.0, 0.14, 1.6, 0.14, frame, { y: 1.75, z: d / 2 + 0.6 }); g.add(canopy);
  for (const sx of [-1.3, 1.3]) {
    const col = column(1.5, 0.09, frame, frame, false);
    col.position.set(sx, 0.3, d / 2 + 1.2); g.add(col);
  }
  const lobby = glow(emissiveMats, 0xbfe8f5, 0.15, 1.7);
  g.add(roundedBox(2.7, 1.35, 0.1, 0.12, lobby, { y: 1.05, z: d / 2 + 0.06, shadow: false }));
  for (const px of [-0.9, 0, 0.9]) g.add(roundedBox(0.08, 1.35, 0.14, 0.12, frame, { x: px, y: 1.05, z: d / 2 + 0.12, shadow: false }));

  // 5. 立面花箱 + 藤蔓 + 招牌
  const gf = flowerBox(2.0, M(0x5A4330), MAT.wood(PALETTE.wood.dark), FLOWERS);
  gf.position.set(0, 0.42, d / 2 + 0.2); g.add(gf);
  for (const sx of [-1, 1]) {
    const gv = vine(1.5, MAT.leaf(), { width: 0.5, leaves: 8 });
    gv.position.set(sx * 2.4, 0.35, d / 2 + 0.1); g.add(gv);
  }
  const sign = signboard('项目经历', 'PROJECTS', { w: 2.0, h: 0.66, bg: '#E4F2EA', ink: '#3F6A58', accent: '#7FBFA6' });
  sign.position.set(0, 1.95, d / 2 + 0.72); g.add(sign);

  return g;
}

/* ==========================================================================
   📮 联系方式：铜绿圆顶邮局（拱廊 + 扇形窗鼓座 + 洋葱穹顶 + 铁艺拱门 + 风向标 + 邮筒）
   本地高度 ≈ 8.2
   ========================================================================== */
export function buildPostTower(emissiveMats) {
  const g = new THREE.Group();
  const R = 2.0;
  g.add(contactShadow(3.2, 0.15));

  // 1. 圆形石台 + 台阶
  g.add(mesh(new THREE.CylinderGeometry(R + 0.35, R + 0.5, 0.4, 24), MAT.stone(), { y: 0.2 }));
  g.add(mesh(new THREE.CylinderGeometry(R + 0.08, R + 0.16, 0.18, 24), MAT.cream(), { y: 0.45 }));
  const st = steps(1.7, 3, MAT.stone(), { zDir: 1 }); st.position.set(0, 0, R + 0.3); g.add(st);

  // 2. 环形拱廊（8 柱 + 圆润拱）
  const colH = 2.0, colY = 0.52;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const col = column(colH, 0.12, MAT.cream(), MAT.copperDark(), true);
    col.position.set(Math.cos(a) * (R - 0.12), colY, Math.sin(a) * (R - 0.12)); g.add(col);
  }
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    g.add(mesh(new THREE.TorusGeometry(0.62, 0.09, 8, 16, Math.PI), MAT.cream(), {
      x: Math.cos(a) * (R - 0.12), y: colY + colH - 0.08, z: Math.sin(a) * (R - 0.12), ry: -a + Math.PI / 2 }));
  }
  g.add(mesh(new THREE.CylinderGeometry(R + 0.2, R + 0.12, 0.24, 24), MAT.cream(), { y: colY + colH + 0.08 }));
  g.add(mesh(new THREE.TorusGeometry(R + 0.2, 0.08, 6, 28), MAT.gold(), { rx: Math.PI / 2, y: colY + colH + 0.2 }));

  // 3. 鼓座：扇形格窗 + 拱形花窗 + 暖色 cavity
  const drumR = R - 0.4, drumH = 1.15, drumY = colY + colH + 0.24;
  const glass = glow(emissiveMats, 0xbfe8e0, 0.15, 1.3);
  g.add(fanWindow(drumR, drumH, 14, glass, MAT.copperDark()).translateY(drumY));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const af = archFrame(0.42, 0.34, 0.05, MAT.cream());
    af.position.set(Math.cos(a) * (drumR + 0.02), drumY + drumH * 0.5, Math.sin(a) * (drumR + 0.02));
    af.rotation.y = -a + Math.PI / 2; g.add(af);
  }

  // 4. 分瓣铜绿洋葱穹顶
  const domeY = drumY + drumH;
  const d = dome(drumR + 0.18, MAT.copper(), MAT.copperDark(), { ribs: 14, squash: 1.3, ribThickness: 0.055, bulge: 0.12 });
  d.position.y = domeY; g.add(d);
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.36, 14), MAT.cream(), { y: domeY + (drumR + 0.18) * 1.3 * 0.84 }));
  const topY = domeY + (drumR + 0.18) * 1.3;
  g.add(lathe([[0.16, 0], [0.24, 0.18], [0.1, 0.45], [0, 0.8]], MAT.gold(), 14).translateY(topY));
  const fl = flag(1.1, 0.75, 0.42, MAT.gold(), M(0xe8644f, { side: THREE.DoubleSide, roughness: 0.88 }));
  fl.position.y = topY + 0.72; g.add(fl); g.userData.flag = fl.userData.cloth;

  // 5. 拱形木门 + 铁艺 + 邮筒
  const doorMat = glow(emissiveMats, 0xa9743f, 0.05, 0.8);
  g.add(archedWall(1.4, 2.1, 0.26, 0.95, 1.0, 0, MAT.stone()));
  const door = archedWoodDoor(0.9, 1.6, MAT.doorWood(), MAT.cream(), MAT.iron());
  door.position.set(0, 0.05, R - 0.05); g.add(door);
  // 邮筒（有机旋转成型）
  const mb = lathe([[0.28, 0], [0.32, 0.08], [0.32, 0.62], [0.26, 0.75], [0.18, 0.84], [0.2, 0.94]], M(PALETTE.coral, { metalness: 0.08, roughness: 0.72 }), 20);
  mb.position.set(R - 0.15, 0, 1.4); g.add(mb);
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.07, 0.05), M(0x3a2a22), { x: R - 0.15, y: 0.68, z: 1.68, shadow: false }));
  g.add(mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.08, 16), MAT.gold(), { x: R - 0.15, y: 0.95, z: 1.4 }));

  // 6. 时钟（鼓座正面）
  const clock = mesh(new THREE.CircleGeometry(0.42, 22), M(0xfff6e0, { emissive: 0xfff0c0, emissiveIntensity: 0.12, roughness: 0.8 }), {
    y: drumY + drumH * 0.5, z: drumR + 0.06, shadow: false });
  g.add(clock);
  g.add(mesh(new THREE.TorusGeometry(0.42, 0.07, 8, 22), MAT.gold(), { y: drumY + drumH * 0.5, z: drumR + 0.08, shadow: false }));
  g.add(roundedBox(0.045, 0.26, 0.02, 0.12, MAT.iron(), { y: drumY + drumH * 0.5 + 0.11, z: drumR + 0.09, shadow: false }));
  g.add(roundedBox(0.2, 0.045, 0.02, 0.12, MAT.iron(), { y: drumY + drumH * 0.5 - 0.04, z: drumR + 0.09, shadow: false }));

  // 7. 柱间花箱 + 招牌
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const pf = flowerBox(0.95, M(0x5A4330), MAT.wood(PALETTE.wood.dark), FLOWERS);
    pf.position.set(Math.cos(a) * (R - 0.1), 0.62, Math.sin(a) * (R - 0.1));
    pf.rotation.y = -a + Math.PI / 2; g.add(pf);
  }
  const sign = signboard('联系方式', 'CONTACT', { w: 1.8, h: 0.64, bg: '#F6E8D6', ink: '#8A4A32', accent: '#C9803A' });
  sign.position.set(0, colY + colH + 0.55, R + 0.06); g.add(sign);

  return g;
}

/* ==========================================================================
   🎠 旋转木马凉亭（可选，后端可摆在岛上圆形广场）
   本地高度 ≈ 5.3；userData.carousel 可绕 y 轴旋转
   ========================================================================== */
export function buildCarouselPavilion(emissiveMats) {
  const g = new THREE.Group();
  g.add(contactShadow(2.6, 0.14));

  // 圆台基座
  g.add(mesh(new THREE.CylinderGeometry(2.3, 2.45, 0.3, 32), MAT.stone(), { y: 0.15 }));
  g.add(mesh(new THREE.CylinderGeometry(2.12, 2.12, 0.12, 32), MAT.cream(), { y: 0.34 }));

  // 8 根圆润立柱
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const col = column(2.4, 0.1, MAT.cream(), MAT.gold(), false);
    col.position.set(Math.cos(a) * 1.9, 0.4, Math.sin(a) * 1.9); g.add(col);
  }
  // 檐部 + 金边
  g.add(mesh(new THREE.CylinderGeometry(2.25, 2.15, 0.22, 32), MAT.cream(), { y: 2.85 }));
  g.add(mesh(new THREE.TorusGeometry(2.25, 0.08, 8, 32), MAT.gold(), { rx: Math.PI / 2, y: 2.98 }));

  // 分瓣穹顶
  const roofY = 3.0;
  const d = dome(2.1, MAT.roofRed(), MAT.gold(), { ribs: 12, squash: 0.75, ribThickness: 0.04, bulge: 0.08 });
  d.position.y = roofY; g.add(d);
  g.add(lathe([[0.12, 0], [0.2, 0.15], [0.08, 0.5], [0, 0.75]], MAT.gold(), 12).translateY(roofY + 2.1 * 0.75));

  // 内部旋转木马转盘
  const carousel = new THREE.Group();
  carousel.add(mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.12, 24), MAT.gold(), { y: 0.5 }));
  const horseColors = [0xF4C4D4, 0xFFF8EA, 0xBFE3E8, 0xF7D67A];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const x = Math.cos(a) * 0.85, z = Math.sin(a) * 0.85;
    carousel.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 8), MAT.gold(), { x, y: 1.3, z }));
    const horse = mesh(new THREE.SphereGeometry(0.28, 14, 10), M(horseColors[i % 4], { roughness: 0.85 }), { x, y: 1.55, z });
    horse.scale.set(1.2, 0.8, 0.7); carousel.add(horse);
  }
  g.add(carousel); g.userData.carousel = carousel;

  // 檐下暖光小灯
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const lm = glow(emissiveMats, 0xffe6a0, 0.12, 1.4);
    g.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), lm, { x: Math.cos(a) * 1.9, y: 2.68, z: Math.sin(a) * 1.9, shadow: false }));
  }
  return g;
}
