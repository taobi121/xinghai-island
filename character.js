import * as THREE from 'three';

/* ==========================================================================
   Q 版玩家角色：戴珊瑚红耳机的雾蓝毛衣少年（参考 new4 + ref3 大眼娃娃）
   契约：createPlayer(emissiveMats) -> { group, armL, armR, legL, legR }
        group 原点在脚底 y=0，正面朝 +Z，总高约 2.25~2.3
        头身比 ≈ 1:2.5（头半径 0.46，头高 0.92）
        armL/armR 枢轴 (±0.4, 1.25, 0)，legL/legR 枢轴 (±0.16, 0.58, 0)
        走动动画由后端控制四条肢体的 rotation.x
   ========================================================================== */

const C = {
  skin: 0xF6D9C0,
  hair: 0x3E302A,
  hairLight: 0x58443B,
  eye: 0x2E201C,
  brow: 0x4A342C,
  mouth: 0x8A5A4A,
  blush: 0xF4B8B0,
  sweater: 0x5A7A9A,
  sweaterDark: 0x4C6A88,
  cream: 0xF5F0E6,
  pants: 0x3E4A5A,
  shoe: 0xF5F2EA,
  sole: 0x3E4A5A,
  bag: 0xC89A6A,
  bagDark: 0x8B6544,
  coral: 0xE8685A,
  metal: 0x9AA6AE,
  cupInner: 0x4A4A52
};

function mk(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...opts });
}
function add(parent, geo, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  parent.add(m);
  return m;
}

export function createPlayer(emissiveMats) {
  const group = new THREE.Group();
  group.name = 'player';
  const em = Array.isArray(emissiveMats) ? emissiveMats : [];

  /* ---------- 躯干：宽松圆领毛衣，全部圆润几何 ---------- */
  const sweaterMat = mk(C.sweater);
  const sweaterDarkMat = mk(C.sweaterDark);
  const torso = add(group, new THREE.SphereGeometry(0.44, 28, 20), sweaterMat, 0, 1.0, 0);
  torso.scale.set(0.98, 0.94, 0.78);
  const hem = add(group, new THREE.SphereGeometry(0.4, 24, 16), sweaterDarkMat, 0, 0.75, 0);
  hem.scale.set(1.0, 0.28, 0.78);
  const collar = add(group, new THREE.TorusGeometry(0.19, 0.045, 10, 24), mk(C.cream), 0, 1.35, 0.02);
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1, 0.85, 1);
  const hood = add(group, new THREE.SphereGeometry(0.32, 20, 14), sweaterDarkMat, 0, 1.34, -0.18);
  hood.scale.set(1.05, 0.7, 0.62);

  /* ---------- 头：半径 0.46，中心 y=1.74（大头 Q 版） ---------- */
  const head = add(group, new THREE.SphereGeometry(0.46, 36, 26), mk(C.skin, { roughness: 0.88 }), 0, 1.74, 0);
  head.scale.set(1, 0.98, 0.95);

  /* ---------- 发型：深棕近黑，12 个层叠发束（5~15 契约内） ---------- */
  const hairMat = mk(C.hair, { roughness: 0.86 });
  const hairLightMat = mk(C.hairLight, { roughness: 0.86 });
  // 头顶发帽
  const cap = add(group, new THREE.SphereGeometry(0.475, 30, 22), hairMat, 0, 1.88, -0.015);
  cap.scale.set(1.0, 0.72, 1.0);
  // [x, y, z, sx, sy, sz, 倾斜z, 是否亮色]
  const clumps = [
    // 前额刘海 5 片：圆润发梢，层叠错落
    [-0.28, 2.02, 0.30, 0.135, 0.15, 0.15, -0.34, true],
    [-0.14, 2.09, 0.34, 0.13, 0.14, 0.14, -0.16, false],
    [0.0, 2.11, 0.355, 0.135, 0.14, 0.14, 0, true],
    [0.15, 2.08, 0.34, 0.13, 0.14, 0.14, 0.17, false],
    [0.29, 2.01, 0.30, 0.135, 0.15, 0.15, 0.35, true],
    // 两侧发束 4 片
    [-0.40, 1.90, 0.10, 0.10, 0.22, 0.15, -0.18, false],
    [-0.41, 1.72, 0.06, 0.09, 0.19, 0.14, -0.12, true],
    [0.40, 1.90, 0.10, 0.10, 0.22, 0.15, 0.18, false],
    [0.41, 1.72, 0.06, 0.09, 0.19, 0.14, 0.12, true],
    // 后脑 2 片
    [-0.22, 1.96, -0.30, 0.16, 0.17, 0.14, -0.12, false],
    [0.22, 1.96, -0.30, 0.16, 0.17, 0.14, 0.12, true],
    // 一颗小呆毛
    [0.06, 2.20, -0.04, 0.045, 0.065, 0.045, -0.5, false]
  ];
  clumps.forEach(([x, y, z, sx, sy, sz, rot, light]) => {
    const lock = add(group, new THREE.SphereGeometry(1, 16, 12), light ? hairLightMat : hairMat, x, y, z);
    lock.scale.set(sx, sy, sz);
    lock.rotation.z = rot;
  });

  /* ---------- 耳机：珊瑚红 Q 版耳罩，全身唯一高饱和点缀 ---------- */
  const coralMat = mk(C.coral, { roughness: 0.7 });
  const whiteMat = mk(C.cream, { roughness: 0.75 });
  const metalMat = mk(C.metal, { metalness: 0.3, roughness: 0.55 });
  const innerMat = mk(C.cupInner, { roughness: 0.8 });
  const glowMat = mk(C.coral, { emissive: C.coral, emissiveIntensity: 0.06, roughness: 0.7 });
  em.push({ mat: glowMat, dayI: 0.06, nightI: 0.5 });

  // 头梁半环 + 内侧细环
  add(group, new THREE.TorusGeometry(0.465, 0.032, 10, 40, Math.PI), whiteMat, 0, 1.74, -0.02);
  add(group, new THREE.TorusGeometry(0.442, 0.014, 8, 40, Math.PI), coralMat, 0, 1.74, 0.005, false);
  for (const sx of [-1, 1]) {
    // 金属滑杆
    add(group, new THREE.CapsuleGeometry(0.032, 0.09, 4, 8), metalMat, sx * 0.465, 1.86, -0.02);
    // 耳罩：扁圆柱，轴向 X
    const cup = add(group, new THREE.CylinderGeometry(0.21, 0.21, 0.15, 24), coralMat, sx * 0.45, 1.74, 0);
    cup.rotation.z = Math.PI / 2;
    // 暖白外环
    const ring = add(group, new THREE.TorusGeometry(0.176, 0.022, 8, 28), whiteMat, sx * 0.535, 1.74, 0, false);
    ring.rotation.y = Math.PI / 2;
    // 深灰内圈
    const inner = add(group, new THREE.CylinderGeometry(0.138, 0.138, 0.015, 24), innerMat, sx * 0.54, 1.74, 0, false);
    inner.rotation.z = Math.PI / 2;
    // 极弱发光小点（夜间轻微亮起）
    add(group, new THREE.SphereGeometry(0.032, 10, 8), glowMat, sx * 0.552, 1.74, 0, false);
  }

  /* ---------- 五官：超大眼 + 每眼 2 个白色高光点（M5 / ref3） ---------- */
  const eyeMat = mk(C.eye, { roughness: 0.55 });
  const browMat = mk(C.brow);
  const hiliteMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
  const blushMat = new THREE.MeshBasicMaterial({ color: C.blush, transparent: true, opacity: 0.5, depthWrite: false });
  for (const sx of [-1, 1]) {
    // 眼半径 0.09，略扁、竖向拉长
    const eye = add(group, new THREE.SphereGeometry(0.09, 20, 16), eyeMat, sx * 0.175, 1.75, 0.425, false);
    eye.scale.set(0.9, 1.15, 0.55);
    // 高光点 1（左上大点）+ 高光点 2（右下小点）
    add(group, new THREE.SphereGeometry(0.03, 10, 8), hiliteMat, sx * 0.175 - 0.032, 1.792, 0.478, false);
    add(group, new THREE.SphereGeometry(0.014, 8, 6), hiliteMat, sx * 0.175 + 0.03, 1.712, 0.478, false);
    // 眉毛
    const brow = add(group, new THREE.SphereGeometry(1, 12, 8), browMat, sx * 0.175, 1.90, 0.40, false);
    brow.scale.set(0.095, 0.02, 0.02);
    brow.rotation.z = sx * 0.12;
    // 腮红
    const blush = add(group, new THREE.CircleGeometry(0.085, 18), blushMat, sx * 0.32, 1.65, 0.34, false);
    blush.scale.set(1.25, 0.7, 1);
  }
  const mouth = add(group, new THREE.TorusGeometry(0.055, 0.011, 8, 18, Math.PI), mk(C.mouth), 0, 1.60, 0.44, false);
  mouth.rotation.z = Math.PI;

  /* ---------- 小斜挎包 ---------- */
  const bag = add(group, new THREE.SphereGeometry(0.26, 18, 14), mk(C.bag), 0.3, 0.98, 0.24);
  bag.scale.set(1.0, 0.86, 0.62);
  const flap = add(group, new THREE.SphereGeometry(0.24, 16, 12), mk(C.bagDark), 0.3, 1.09, 0.31);
  flap.scale.set(1.0, 0.42, 0.45);
  const strap = add(group, new THREE.CapsuleGeometry(0.028, 0.88, 6, 10), mk(C.bagDark), 0.02, 1.12, 0.28, false);
  strap.rotation.z = 0.98;

  /* ---------- 手臂（枢轴在肩 y=1.25, x=±0.4，保持不变） ---------- */
  function makeArm(sx) {
    const p = new THREE.Group();
    p.position.set(sx * 0.4, 1.25, 0);
    const sleeve = add(p, new THREE.CapsuleGeometry(0.125, 0.28, 6, 12), sweaterMat, 0, -0.22, 0);
    sleeve.scale.set(1, 1, 0.95);
    add(p, new THREE.CylinderGeometry(0.11, 0.12, 0.08, 14), whiteMat, 0, -0.4, 0);
    const hand = add(p, new THREE.SphereGeometry(0.095, 14, 10), mk(C.skin), 0, -0.485, 0);
    hand.scale.set(0.95, 1.1, 0.85);
    group.add(p);
    return p;
  }
  const armL = makeArm(-1), armR = makeArm(1);

  /* ---------- 腿（枢轴在髋 y=0.58, x=±0.16，保持不变） ---------- */
  const pantsMat = mk(C.pants);
  const shoeMat = mk(C.shoe);
  const soleMat = mk(C.sole);
  function makeLeg(sx) {
    const p = new THREE.Group();
    p.position.set(sx * 0.16, 0.58, 0);
    const trouser = add(p, new THREE.CapsuleGeometry(0.12, 0.3, 6, 12), pantsMat, 0, -0.24, 0);
    trouser.scale.set(1, 1, 0.92);
    const sole = add(p, new THREE.SphereGeometry(1, 14, 10), soleMat, 0, -0.535, 0.05);
    sole.scale.set(0.128, 0.045, 0.195);
    const shoe = add(p, new THREE.SphereGeometry(1, 16, 12), shoeMat, 0, -0.485, 0.06);
    shoe.scale.set(0.125, 0.085, 0.19);
    group.add(p);
    return p;
  }
  const legL = makeLeg(-1), legR = makeLeg(1);

  function setOutfit(outfit = {}) {
    if (Number.isFinite(outfit.sweater)) sweaterMat.color.setHex(outfit.sweater);
    if (Number.isFinite(outfit.sweaterDark)) sweaterDarkMat.color.setHex(outfit.sweaterDark);
    if (Number.isFinite(outfit.pants)) pantsMat.color.setHex(outfit.pants);
    if (Number.isFinite(outfit.shoe)) shoeMat.color.setHex(outfit.shoe);
    if (Number.isFinite(outfit.sole)) soleMat.color.setHex(outfit.sole);
  }

  return { group, armL, armR, legL, legR, setOutfit };
}
