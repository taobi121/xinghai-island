import * as THREE from 'three';
import { PALETTE, mat, texMat, grassTexture, sandTexture, brickTexture, stoneTexture, woodTexture, glassTexture, pathTexture, cobbleTexture, waterFoamTexture } from './textures.js?v=20261120b';
import { blossomCrown, umbrellaCanopy, organicCyl, lathe, roundedBox } from './geo.js?v=20261120g';
import { buildCarouselPavilion } from './buildings.js';

const clamp = THREE.MathUtils.clamp;
function jitter(geo, amount, vertical = 0.25) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 0.01) {
      const d = 1 + (Math.random() - 0.5) * amount;
      p.setXYZ(i, x * d, y + (Math.random() - 0.5) * amount * vertical, z * d);
    }
  }
  p.needsUpdate = true; geo.computeVertexNormals();
}

// 稳定伪随机种子：让同一棵树的层叠造型在每次刷新时保持一致
function seedAt(x, z, salt = 0) {
  return (Math.abs(Math.round(x * 137 + z * 911 + salt * 7919)) % 2147483647) + 1;
}

/* ---------- 柔和接触阴影（近 AO 近似，替代硬边投影） ---------- */
let _shadowTex = null;
function shadowTex() {
  if (_shadowTex) return _shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 3, 64, 64, 62);
  g.addColorStop(0, 'rgba(84,66,52,0.34)');
  g.addColorStop(0.5, 'rgba(84,66,52,0.15)');
  g.addColorStop(1, 'rgba(84,66,52,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  _shadowTex = new THREE.CanvasTexture(c);
  return _shadowTex;
}
function contactShadow(radius, opacity = 0.8, y = 0.02) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })
  );
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = 1;
  return m;
}

// 给旋转体的上沿加波浪起伏（喷泉石盘用）
function wavyRim(mesh, amount = 0.04, lobes = 12, yMin = 0) {
  const pos = mesh.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < yMin) continue;
    const x = pos.getX(i), z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + amount * Math.sin(lobes * a);
    pos.setXYZ(i, x * k, y, z * k);
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

// 岛的物理参数（版本 A 布局，禁止改动）
export const ISLAND = { groundY: 1.6, radius: 19.5 };

/* ==========================================================================
   海面（柔和浅青绿 + 低频涌动 + 宽软高光带，压掉密集白点）
   ========================================================================== */
export function createOcean(scene, uniformsOut) {
  const geo = new THREE.PlaneGeometry(600, 600, 1, 1);
  const uniforms = {
    uTime: { value: 0 },
    uColorDeep: { value: new THREE.Color(0x2B9FC8) },
    uColorShallow: { value: new THREE.Color(0x8ADFE0) },
    uSun: { value: new THREE.Color(0xFFE9C8) },
    uDay: { value: 1.0 }
  };
  uniformsOut.ocean = uniforms;
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vWorld;
      void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vWorld=wp.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
    `,
    fragmentShader: `
      uniform float uTime; uniform vec3 uColorDeep; uniform vec3 uColorShallow; uniform vec3 uSun; uniform float uDay;
      varying vec3 vWorld;
      void main(){
        float d = length(vWorld.xz);
        float shallow = 1.0 - smoothstep(19.0, 48.0, d);
        vec3 col = mix(uColorDeep, uColorShallow, shallow);
        // 低频大涌动：只改变明度，不产生硬边
        float w1 = sin(vWorld.x*0.30 + uTime*0.55)*sin(vWorld.z*0.26 - uTime*0.45);
        float w2 = sin(vWorld.x*0.10 - uTime*0.25 + vWorld.z*0.12);
        col += vec3(0.024,0.030,0.028)*(w1*0.6+w2*0.4+1.0)*(0.35+0.65*uDay);
        // 宽软高光带（代替原来的密集 sparkle）
        float band = smoothstep(0.35, 1.0, sin(vWorld.z*0.045 + uTime*0.18)*0.5 + 0.5);
        col += uSun * band * 0.05 * uDay;
        // 岸边柔白水线
        float foam = smoothstep(19.2, 20.0, d) * (1.0 - smoothstep(20.6, 22.2, d));
        foam *= 0.65 + 0.35*sin(uTime*0.8 + vWorld.x*0.45);
        col = mix(col, vec3(0.95,0.98,0.96), clamp(foam,0.0,1.0)*0.20);
        // 远处与天际柔和融合，去掉深蓝高对比边界
        float far = smoothstep(80.0, 260.0, d);
        col = mix(col, vec3(0.84,0.93,0.96), far*0.85);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    fog: false
  });
  const ocean = new THREE.Mesh(geo, material);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = 0;
  scene.add(ocean);
  return ocean;
}

/* ==========================================================================
   岛屿地形：草面 / 奶油岩壁 / 白泡沫线 三段式海岸
   ========================================================================== */
export function createIsland(scene, islandGroup) {
  const G = ISLAND.groundY, R = ISLAND.radius;

  // 中段：奶油色圆润岩壁（底部沉入水面，避免深色硬岩）
  const cliffGeo = new THREE.CylinderGeometry(R * 0.995, R * 0.86, 3.0, 72, 5);
  jitter(cliffGeo, 0.05, 0.55);
  const cliff = new THREE.Mesh(cliffGeo, mat(0xF1E2C2, { roughness: 1 }));
  cliff.position.y = G - 1.55; cliff.castShadow = true; cliff.receiveShadow = true;
  islandGroup.add(cliff);

  // 岩壁上沿圆角收边
  const lip = new THREE.Mesh(new THREE.TorusGeometry(R * 0.99, 0.22, 10, 96), mat(0xF7EBD0, { roughness: 1 }));
  lip.rotation.x = -Math.PI / 2; lip.position.y = G - 0.16; lip.receiveShadow = true;
  islandGroup.add(lip);

  // 薄沙滩：压在岩壁顶上，形成暖米色过渡
  const beach = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.985, 0.36, 72), texMat(sandTexture, { roughness: 1 }));
  beach.position.y = G - 0.28; beach.receiveShadow = true;
  islandGroup.add(beach);

  // 上段：草地主体（椭圆：稍微缩放，与版本 A 一致）
  const grassGeo = new THREE.CylinderGeometry(R * 0.9, R * 0.9, 0.55, 64, 1);
  jitter(grassGeo, 0.035);
  const grass = new THREE.Mesh(grassGeo, texMat(grassTexture));
  grass.position.y = G - 0.28; grass.castShadow = true; grass.receiveShadow = true;
  grass.scale.set(1.05, 1, 0.92);
  islandGroup.add(grass);

  // 下段：水面白泡沫线（双环，半透明，贴在水位）
  const foamMat = new THREE.MeshBasicMaterial({
    map: waterFoamTexture, transparent: true, opacity: 0.72,
    depthWrite: false, side: THREE.DoubleSide, color: 0xFFFFFF, fog: false
  });
  const foam1 = new THREE.Mesh(new THREE.TorusGeometry(R * 1.015, 0.36, 8, 96), foamMat);
  foam1.rotation.x = -Math.PI / 2; foam1.position.y = 0.06; foam1.renderOrder = 2;
  islandGroup.add(foam1);
  const foam2 = new THREE.Mesh(new THREE.TorusGeometry(R * 1.075, 0.24, 8, 96), foamMat.clone());
  foam2.material.opacity = 0.38;
  foam2.rotation.x = -Math.PI / 2; foam2.position.y = 0.04; foam2.renderOrder = 2;
  islandGroup.add(foam2);

  // 岸边零散柔白浪花（贴水小片）
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = R + 0.7 + Math.random() * 2.6;
    const w = 0.9 + Math.random() * 1.5;
    const fleck = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.32), foamMat.clone());
    fleck.material.opacity = 0.22 + Math.random() * 0.26;
    fleck.rotation.x = -Math.PI / 2; fleck.rotation.z = a;
    fleck.position.set(Math.cos(a) * rr, 0.035, Math.sin(a) * rr);
    fleck.renderOrder = 2;
    islandGroup.add(fleck);
  }

  // 岸边奶油色圆礁（取代灰硬礁石）
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = R + 0.4 + Math.random() * 1.4;
    const s = 0.22 + Math.random() * 0.5;
    const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat(0xEBDCBB, { roughness: 1 }));
    rk.position.set(Math.cos(a) * rr, 0.25, Math.sin(a) * rr);
    rk.scale.y = 0.65;
    rk.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    rk.castShadow = true;
    islandGroup.add(rk);
  }

  islandGroup.position.y = 0;
  scene.add(islandGroup);
}

/* ==========================================================================
   路面：鹅卵石板主环路 / 广场 + 暖米色支路（带状网格，低 draw call）
   ========================================================================== */
export function createPaths(islandGroup) {
  const G = ISLAND.groundY;

  const cobbleMat = texMat(cobbleTexture, { roughness: 0.98, metalness: 0 });
  const creamMat = texMat(pathTexture, { roughness: 1, metalness: 0 });
  const plazaTex = cobbleTexture.clone();
  plazaTex.repeat.set(2, 2); plazaTex.needsUpdate = true;
  const plazaMat = texMat(plazaTex, { roughness: 0.98, metalness: 0 });

  function ribbon(points, width, material, tile = 4.0, closed = false, y = G + 0.02) {
    const pts = points.map(p => new THREE.Vector3(p[0], y, p[1]));
    const curve = new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', 0.4);
    const len = curve.getLength();
    const N = clamp(Math.ceil(len * 2.4), 24, 180);
    const pos = [], uv = [], idx = [];
    let acc = 0, prev = curve.getPoint(0);
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = curve.getPoint(t), tan = curve.getTangent(t);
      if (i > 0) acc += p.distanceTo(prev);
      prev = p;
      const nx = -tan.z, nz = tan.x;
      const w = width * 0.5 * (0.96 + 0.08 * Math.sin(i * 1.7));
      pos.push(p.x + nx * w, p.y, p.z + nz * w, p.x - nx * w, p.y, p.z - nz * w);
      uv.push(0, acc / tile, width / tile, acc / tile);
      if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.receiveShadow = true;
    islandGroup.add(m);
    return m;
  }

  // 中央广场：鹅卵石圆盘（喷泉坐在其上）
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(4.3, 48), plazaMat);
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = G + 0.012; plaza.receiveShadow = true;
  islandGroup.add(plaza);

  // 主环路：闭合椭圆鹅卵石板
  const ring = [];
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2;
    ring.push([Math.cos(a) * 7.6, Math.sin(a) * 6.7]);
  }
  ribbon(ring, 2.15, cobbleMat, 4.2, true, G + 0.022);

  // 码头 -> 广场主轴：鹅卵石板
  ribbon([[0, 15.2], [0, 12], [0, 8.5], [0, 5], [0, 2.6]], 2.35, cobbleMat, 4.2, false, G + 0.032);

  // 5 条暖米色支路（通住 5 栋建筑，坐标与版本 A 一致）
  ribbon([[0, 0], [-5.5, -3.5], [-11.9, -7.7]], 1.55, creamMat, 3.2, false, G + 0.026);
  ribbon([[0, 0], [5.5, -3.5], [11.9, -7.7]], 1.55, creamMat, 3.2, false, G + 0.026);
  ribbon([[0, 0], [-6, 3.4], [-12.4, 7.2]], 1.55, creamMat, 3.2, false, G + 0.026);
  ribbon([[0, 0], [6, 3.4], [12.4, 7.2]], 1.55, creamMat, 3.2, false, G + 0.026);
  ribbon([[0, 0], [0, -6.5], [0, -13.5]], 1.55, creamMat, 3.2, false, G + 0.026);
}

/* ==========================================================================
   码头栈桥：绿顶方灯柱 / 圆润木栏杆 + 精雕立柱 / 清晰板缝
   桥面 z 14~23 与出生点 z19.3 保持不变
   ========================================================================== */
export function createDock(islandGroup, emissiveMats) {
  const dock = new THREE.Group();
  const wood = texMat(woodTexture, { roughness: 0.95 });
  const postMat = texMat(woodTexture, { roughness: 0.92 });
  const green = mat(0x335B49, { roughness: 0.85 });
  const greenDark = mat(0x28483A, { roughness: 0.9 });
  const brass = mat(0xDBC98C, { roughness: 0.72, metalness: 0.1 });

  // 桥面（本地中心 18.5，整体抬升后顶面 ≈ G，与岛面齐平）
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 9), wood);
  deck.position.set(0, 0.9, 18.5); deck.castShadow = true; deck.receiveShadow = true;
  dock.add(deck);
  // 侧梁
  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 9), postMat);
    beam.position.set(side * 1.58, 0.82, 18.5); beam.castShadow = true; dock.add(beam);
  }
  // 清晰栈桥板缝
  for (let i = 0; i < 18; i++) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(3.26, 0.315, 0.045), mat(0x6B4A2E, { roughness: 1 }));
    seam.position.set(0, 0.9, 14.15 + i * 0.5); dock.add(seam);
  }

  // 圆润木栏杆 + 精雕立柱（柱头球 + 线脚环）
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const z = 14.2 + i * 1.45;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.155, 1.18, 10), postMat);
      post.position.set(side * 1.5, 1.64, z); post.castShadow = true; dock.add(post);
      // 柱身线脚
      const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.028, 6, 12), brass);
      ringA.rotation.x = Math.PI / 2; ringA.position.set(side * 1.5, 1.32, z); dock.add(ringA);
      const ringB = ringA.clone(); ringB.position.y = 1.98; dock.add(ringB);
      // 柱头 + 圆润球帽
      const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.13, 10), postMat);
      capital.position.set(side * 1.5, 2.28, z); dock.add(capital);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), mat(0xC99A68, { roughness: 0.9 }));
      cap.position.set(side * 1.5, 2.42, z); dock.add(cap);
    }
    // 双横栏（圆角木条）
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 8.7), postMat);
    rail.position.set(side * 1.5, 2.02, 18.5); rail.castShadow = true; dock.add(rail);
    const rail2 = rail.clone(); rail2.position.y = 1.5; dock.add(rail2);
  }

  // 绿顶方灯柱：深绿杆 + 方灯罩 + 球顶，岛侧/海侧各一对，完全对称
  function squareLamp(x, z) {
    const gp = new THREE.Group();
    const base = roundedBox(0.36, 0.16, 0.36, 0.05, greenDark, { y: 0.08 });
    gp.add(base);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.115, 2.55, 10), green);
    shaft.position.y = 1.4; shaft.castShadow = true; gp.add(shaft);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 10), greenDark);
    collar.position.y = 2.68; gp.add(collar);
    // 发光方灯罩
    const lm = new THREE.MeshStandardMaterial({ color: 0xFFF0C8, emissive: 0xFFC860, emissiveIntensity: 0.15, roughness: 0.85 });
    emissiveMats.push({ mat: lm, dayI: 0.08, nightI: 1.9 });
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.42), lm);
    lantern.position.y = 2.98; gp.add(lantern);
    // 四角绿色边框
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.54, 0.045), greenDark);
      edge.position.set(sx * 0.21, 2.98, sz * 0.21); gp.add(edge);
    }
    const lanternTop = roundedBox(0.5, 0.09, 0.5, 0.03, greenDark, { y: 3.27 });
    gp.add(lanternTop);
    // 四坡绿顶 + 球顶
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.41, 0.3, 4), green);
    roof.position.y = 3.44; roof.rotation.y = Math.PI / 4; roof.castShadow = true; gp.add(roof);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), brass);
    finial.position.y = 3.64; gp.add(finial);
    gp.position.set(x, 1.05, z);
    dock.add(gp);
  }
  // z 取相邻栏杆立柱的中点（15.65/17.1 与 21.45/22.9 之间），避免穿模
  for (const side of [-1, 1]) {
    squareLamp(side * 1.5, 16.4);
    squareLamp(side * 1.5, 22.2);
  }

  // 旗帜：与拱门在 z 向分离，避免穿插
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 4, 8), mat(0xD8C9A8));
  flagPole.position.set(-3.0, 2, 13.0); dock.add(flagPole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshStandardMaterial({ color: 0xE8644F, side: THREE.DoubleSide, roughness: 0.9 }));
  flag.position.set(-2.2, 3.3, 13.0); flag.rotation.y = 0.2; dock.add(flag);
  dock.userData.flag = flag;

  dock.position.y = 0.55;
  islandGroup.add(dock);
  return dock;
}

/* ==========================================================================
   植被：层叠花瓣 / 层叠圆盘树冠（全部走前端生成器，无单球树冠）
   ========================================================================== */
export function createVegetation(islandGroup) {
  const G = ISLAND.groundY;

  // 樱花：3 层粉色花簇（深粉内、浅粉外）
  function sakura(x, z, s = 1) {
    const g = new THREE.Group();
    const trunkH = 2.05;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, trunkH, 7), mat(PALETTE.wood.dark));
    trunk.position.y = trunkH / 2; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 3; i++) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 1.0, 6), mat(PALETTE.wood.dark));
      br.position.set((i - 1) * 0.34, 1.85, 0); br.rotation.z = (i - 1) * 0.5; g.add(br);
    }
    const crown = blossomCrown(1.38, [PALETTE.sakura, '#FBD3E1', '#F2AFC7', '#EFA8C2'], {
      layers: 3, clusters: 10, squash: 0.46, wave: 0.14, seed: seedAt(x, z, 1)
    });
    // 按坐标约定拼接：树干顶端对齐 crown.userData.jointY
    crown.position.y = trunkH - crown.userData.jointY;
    g.add(crown);
    g.add(contactShadow(1.9, 0.72));
    g.position.set(x, G, z); g.scale.setScalar(s); islandGroup.add(g);
    return g;
  }

  // 伞树：层叠圆盘（4~5 层，边缘下垂）
  function umbrellaTree(x, z, s = 1, color = PALETTE.grass.main) {
    const g = new THREE.Group();
    const trunkH = 2.3;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.21, trunkH, 8), mat(PALETTE.wood.dark));
    trunk.position.y = trunkH / 2; trunk.castShadow = true; g.add(trunk);
    const shades = color === PALETTE.grass.light
      ? ['#D6E0A4', '#C8D896', '#E2E9B8']
      : color === PALETTE.grass.dark
        ? ['#A9C476', '#BFD08A', '#93B36B']
        : ['#BFD08A', '#D6E0A4', '#A9C476'];
    const crown = umbrellaCanopy(1.85, shades, {
      layers: 4, squash: 0.24, wave: 0.13, droop: 0.9, seed: seedAt(x, z, 2)
    });
    crown.position.y = trunkH - crown.userData.jointY;
    g.add(crown);
    g.add(contactShadow(2.2, 0.7));
    g.position.set(x, G, z); g.scale.setScalar(s); islandGroup.add(g);
    return g;
  }

  // 松树：3 组层叠针叶盘，逐级收小
  function pine(x, z, s = 1) {
    const g = new THREE.Group();
    const trunkH = 1.25;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, trunkH, 7), mat(PALETTE.wood.dark));
    trunk.position.y = trunkH / 2; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 3; i++) {
      const tier = umbrellaCanopy(1.0 - i * 0.2, ['#8FB77E', '#A9C476', '#7FA96E'], {
        layers: 2, squash: 0.3, wave: 0.16, droop: 1.05, seed: seedAt(x, z, 3 + i)
      });
      const topY = 1.05 + i * 0.72;
      tier.position.y = topY - tier.userData.jointY;
      g.add(tier);
    }
    g.add(contactShadow(1.3, 0.65));
    g.position.set(x, G, z); g.scale.setScalar(s); islandGroup.add(g);
    return g;
  }

  // 银杏：暖金色层叠花簇冠
  function ginkgo(x, z, s = 1) {
    const g = new THREE.Group();
    const trunkH = 2.15;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.23, trunkH, 8), mat(PALETTE.wood.dark));
    trunk.position.y = trunkH / 2; trunk.castShadow = true; g.add(trunk);
    const crown = blossomCrown(1.3, [PALETTE.sunflower, '#F5D978', PALETTE.gold], {
      layers: 3, clusters: 9, squash: 0.42, wave: 0.12, seed: seedAt(x, z, 4)
    });
    crown.position.y = trunkH - crown.userData.jointY;
    g.add(crown);
    g.add(contactShadow(1.8, 0.7));
    g.position.set(x, G, z); g.scale.setScalar(s); islandGroup.add(g);
    return g;
  }

  // 野花花田：细圆茎 + 圆润花头，取代满地圆锥形小尖刺
  function lavenderField(cx, cz, count) {
    const palette = [PALETTE.lavender, '#B9A8DC', '#D9C2E6', '#F2CEDA', '#F5DFA6', '#E8EDC0'];
    const stemGeo = new THREE.CylinderGeometry(0.012, 0.022, 0.32, 5);
    const headGeo = new THREE.SphereGeometry(0.1, 8, 6);
    const stems = new THREE.InstancedMesh(stemGeo, mat(0x83A96A, { roughness: 1 }), count);
    const heads = new THREE.InstancedMesh(headGeo, mat(0xFFFFFF, { roughness: 0.95 }), count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 2.6;
      const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r;
      const s = 0.72 + Math.random() * 0.55;
      const h = 0.26 + Math.random() * 0.14;

      dummy.position.set(px, G + 0.01 + h * s / 2, pz);
      dummy.rotation.set(0, Math.random() * 6, 0);
      dummy.scale.set(s, h * s / 0.32, s);
      dummy.updateMatrix(); stems.setMatrixAt(i, dummy.matrix);

      dummy.position.set(px, G + 0.01 + h * s + 0.075 * s, pz);
      dummy.rotation.set(0, Math.random() * 6, 0);
      dummy.scale.set(s * 1.05, s * 0.9, s * 1.05);
      dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
      heads.setColorAt(i, color.set(palette[Math.floor(Math.random() * palette.length)]));
    }
    stems.castShadow = false; heads.castShadow = false;
    stems.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    islandGroup.add(stems, heads);
    const patch = new THREE.Mesh(new THREE.CircleGeometry(2.7, 24), mat(PALETTE.grass.dark));
    patch.rotation.x = -Math.PI / 2; patch.position.set(cx, G + 0.005, cz);
    islandGroup.add(patch);
  }

  // 灌木花丛：小尺寸层叠花冠，避免单球观感
  function bush(x, z, s = 1) {
    const g = new THREE.Group();
    const clump = blossomCrown(0.56, ['#BFD08A', '#A9C476', '#D6E0A4'], {
      layers: 2, clusters: 7, squash: 0.5, wave: 0.09, seed: seedAt(x, z, 5)
    });
    clump.position.y = 0.34 - clump.userData.jointY;
    g.add(clump);
    const colors = [PALETTE.coral, PALETTE.sunflower, PALETTE.sakura, PALETTE.paper];
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), mat(colors[i % 4]));
      f.position.set((Math.random() - 0.5) * 0.75, 0.58 + Math.random() * 0.2, (Math.random() - 0.5) * 0.75);
      g.add(f);
    }
    g.position.set(x, G, z); g.scale.setScalar(s); islandGroup.add(g);
  }

  // 布置坐标与版本 A 完全一致（仅移除与凉亭重叠的两丛灌木）
  sakura(-15.5, -2, 1.1); sakura(-15, 3, 0.95); sakura(-8, -13.5, 1.05);
  sakura(15.5, -2, 1.05); sakura(15, 3, 0.95); sakura(8, -13.5, 1.0);
  umbrellaTree(-7.5, 14, 1.1, PALETTE.grass.main); umbrellaTree(7.5, 14, 1.0, PALETTE.grass.light);
  umbrellaTree(-16, 9, 0.9, PALETTE.grass.dark); umbrellaTree(16, 9, 0.85, PALETTE.grass.main);
  pine(-7.5, -16, 0.95); pine(7.5, -16, 0.95); pine(-16, -10, 0.9); pine(16, -10, 0.9);
  ginkgo(-5.5, 15.5, 0.95); ginkgo(5.5, 15.5, 0.9);
  lavenderField(-6, -8.5, 90); lavenderField(6, -8.5, 90);
  lavenderField(-5.5, 8.5, 80); lavenderField(5.5, 8.5, 80);
  [[-7.5, 0], [7.5, 0], [-5, -5.5], [5, -5.5], [-8.5, 4.5], [8.5, 4.5],
   [-10, -1.5], [-8, 5.5], [8.5, 5.5], [-6, 11.5], [6, 11.5]]
    .forEach(([x, z]) => bush(x, z, 0.9 + Math.random() * 0.5));
}

/* ==========================================================================
   道具：路灯 / 长椅 / 自行车 / 喷泉 / 拱门 / 旋转木马凉亭
   ========================================================================== */
function splashTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.45, 'rgba(206,242,246,0.65)');
  g.addColorStop(1, 'rgba(206,242,246,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export function createProps(islandGroup, emissiveMats, lampLights) {
  const G = ISLAND.groundY;
  const benches = [];

  // 路灯（保持绿顶方灯语言）
  function lamp(x, z) {
    const g = new THREE.Group();
    const green = mat(0x335B49, { roughness: 0.85 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3, 8), green);
    pole.position.y = 1.5; pole.castShadow = true; g.add(pole);
    const lm = new THREE.MeshStandardMaterial({ color: 0xFFF0C0, emissive: 0xFFD070, emissiveIntensity: 0.1, roughness: 0.85 });
    emissiveMats.push({ mat: lm, dayI: 0.08, nightI: 2.0 });
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.48, 0.4), lm);
    bulb.position.set(0.45, 2.72, 0); g.add(bulb);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.09, 0.09), green);
    arm.position.set(0.24, 2.98, 0); g.add(arm);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.28, 4), green);
    shade.position.set(0.45, 3.08, 0); shade.rotation.y = Math.PI / 4; g.add(shade);
    const light = new THREE.PointLight(0xFFD890, 0, 9, 2);
    light.position.set(0.45, 2.7, 0); g.add(light); lampLights.push(light);
    g.position.set(x, G, z); islandGroup.add(g);
  }

  // 长椅
  function bench(x, z, rot = 0) {
    const g = new THREE.Group();
    const wm = texMat(woodTexture);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.55), wm);
    seat.position.y = 0.55; seat.castShadow = true; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 0.1), wm);
    back.position.set(0, 0.9, -0.24); g.add(back);
    for (const sx of [-0.75, 0.75]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.5), mat(0x4A4038));
      leg.position.set(sx, 0.28, 0); g.add(leg);
    }
    g.userData.seat = { x, z, rot };
    g.position.set(x, G, z); g.rotation.y = rot; islandGroup.add(g);
    benches.push(g);
    return g;
  }

  // 自行车（返回整组，并把车轮挂到 userData，供骑行时转动）
  function bicycle(x, z, rot = 0) {
    const g = new THREE.Group();
    const model = new THREE.Group();
    // 车轮与车架按 X 轴排布；旋转模型后，外层 group 的 +Z 才是骑行方向。
    model.rotation.y = Math.PI / 2;
    g.add(model);
    g.userData.wheels = [];
    const fm = mat(0x3A4A55, { metalness: 0.3, roughness: 0.75 });
    for (const wx of [-0.75, 0.75]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 20), fm);
      wheel.position.set(wx, 0.45, 0); model.add(wheel); g.userData.wheels.push(wheel);
    }
    const frameMat = mat(0xD9534F, { metalness: 0.2, roughness: 0.75 });
    const bars = [[-0.75, 0.45, 0, 0, 0.7, 0], [0, 0.7, 0, 0.75, 0.45, 0], [-0.75, 0.45, 0, 0.75, 0.45, 0], [0, 0.7, 0, -0.2, 1.05, 0]];
    for (const [x1, y1, z1, x2, y2, z2] of bars) {
      const dir = new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, dir.length(), 6), frameMat);
      bar.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
      bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      model.add(bar);
    }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.09, 0.22), mat(0x57453A));
    seat.position.set(-0.18, 0.91, 0); model.add(seat);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.52, 8), fm);
    handle.rotation.x = Math.PI / 2; handle.position.set(0.58, 1.02, 0); model.add(handle);
    const seatPost = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 8), fm);
    seatPost.position.set(-0.18, 0.82, 0); model.add(seatPost);
    g.position.set(x, G, z); g.rotation.y = rot; g.scale.setScalar(0.9); islandGroup.add(g);
    return g;
  }

  /* ---------- 喷泉（视觉焦点）：分段石池 + 3 层波浪水盘 + 花苞雕塑 + 水花 ---------- */
  function fountain(x, z) {
    const g = new THREE.Group();
    const stoneM = texMat(stoneTexture, { roughness: 0.98, metalness: 0 });
    const paleM = mat(0xF2E6CC, { roughness: 0.96, metalness: 0 });
    const trimM = mat(PALETTE.gold, { roughness: 0.78, metalness: 0.1 });
    const waterM = new THREE.MeshStandardMaterial({ color: 0x7FC4C8, transparent: true, opacity: 0.72, roughness: 0.26, metalness: 0.04, depthWrite: false });
    const streamM = new THREE.MeshStandardMaterial({ color: 0xBFEFF2, transparent: true, opacity: 0.58, roughness: 0.3, metalness: 0, depthWrite: false });

    // 分段石砌圆池（占地半径 ≈3.5，与 main.js 碰撞 r=3.6 对应）
    // 旧版扇形圆柱带实心顶盖，把整个池面盖成石头，水面被埋在下面看不见。
    // 改成 openEnded 外壁 + 独立池底 + 只覆盖外圈的池沿，中间留出真正的水面。
    const segN = 14, arc = Math.PI * 2 / segN * 0.9;
    const basinFloor = new THREE.Mesh(new THREE.CircleGeometry(3.08, 40), stoneM);
    basinFloor.rotation.x = -Math.PI / 2; basinFloor.position.y = 0.06; g.add(basinFloor);
    const outerWall = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.46, 0.52, 48, 1, true), stoneM);
    outerWall.position.y = 0.26; outerWall.castShadow = true; g.add(outerWall);
    for (let i = 0; i < segN; i++) {
      const a0 = i / segN * Math.PI * 2;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(3.32, 3.46, 0.52, 6, 1, true, a0 + 0.02, arc), stoneM);
      seg.position.y = 0.26; seg.castShadow = true; seg.receiveShadow = true; g.add(seg);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.38, 3.38, 0.1, 8, 1, true, a0 + 0.02, arc), paleM);
      cap.position.y = 0.55; g.add(cap);
    }
    const rimTop = new THREE.Mesh(new THREE.RingGeometry(3.04, 3.38, 48), paleM);
    rimTop.rotation.x = -Math.PI / 2; rimTop.position.y = 0.60; g.add(rimTop);
    const innerWall = new THREE.Mesh(new THREE.CylinderGeometry(3.06, 3.06, 0.5, 40, 1, true), paleM);
    innerWall.material.side = THREE.DoubleSide; innerWall.position.y = 0.26; g.add(innerWall);
    waterM.opacity = 0.88; waterM.side = THREE.DoubleSide;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(3.04, 40), waterM);
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.46; g.add(pool);
    // 水面涟漪：几圈极淡的白色细环，让池水一眼可辨
    const rippleM = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
    for (const rr of [0.9, 1.7, 2.45]) {
      const ripple = new THREE.Mesh(new THREE.RingGeometry(rr, rr + 0.035, 48), rippleM);
      ripple.rotation.x = -Math.PI / 2; ripple.position.y = 0.472; ripple.renderOrder = 2; g.add(ripple);
    }
    const rimGold = new THREE.Mesh(new THREE.TorusGeometry(3.35, 0.06, 8, 56), trimM);
    rimGold.rotation.x = -Math.PI / 2; rimGold.position.y = 0.62; g.add(rimGold);

    // 中央石柱（有机轮廓 + 线脚）
    const pedestal = lathe([[0.001, 0], [0.62, 0], [0.7, 0.12], [0.5, 0.28], [0.44, 0.5], [0.5, 0.72], [0.38, 0.9], [0.001, 0.96]], stoneM, 24);
    pedestal.position.y = 0.5; pedestal.castShadow = true; g.add(pedestal);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.055, 8, 24), trimM);
    collar.rotation.x = Math.PI / 2; collar.position.y = 1.2; g.add(collar);

    // 第一层水盘（波浪边缘）
    const bowl1 = lathe([[0.001, 0], [0.45, 0], [0.72, 0.1], [1.15, 0.26], [1.5, 0.44], [1.55, 0.55], [1.42, 0.58], [1.28, 0.44], [0.8, 0.26], [0.25, 0.2], [0.001, 0.2]], paleM, 32);
    bowl1.position.y = 1.85; wavyRim(bowl1, 0.035, 12, 0.45); g.add(bowl1);
    const water1 = new THREE.Mesh(new THREE.CircleGeometry(1.3, 36), waterM.clone());
    water1.rotation.x = -Math.PI / 2; water1.position.y = 2.34; g.add(water1);

    // 第二层水盘
    const bowl2 = lathe([[0.001, 0], [0.32, 0], [0.55, 0.08], [0.82, 0.24], [0.9, 0.36], [0.84, 0.42], [0.72, 0.32], [0.4, 0.2], [0.001, 0.16]], paleM, 28);
    bowl2.position.y = 2.92; wavyRim(bowl2, 0.05, 10, 0.3); g.add(bowl2);
    const water2 = new THREE.Mesh(new THREE.CircleGeometry(0.7, 28), waterM.clone());
    water2.rotation.x = -Math.PI / 2; water2.position.y = 3.28; g.add(water2);

    // 顶部花苞雕塑剪影
    const bud = new THREE.Group();
    bud.add(lathe([[0.001, 0], [0.12, 0.12], [0.22, 0.42], [0.16, 0.75], [0.05, 1.0], [0.001, 1.1]], trimM, 16));
    const petalM = mat(0xF8D9C8, { roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), petalM);
      petal.scale.set(0.55, 1.85, 0.4);
      petal.position.set(Math.cos(a) * 0.16, 0.52, Math.sin(a) * 0.16);
      petal.rotation.z = Math.cos(a) * 0.3;
      petal.rotation.x = -Math.sin(a) * 0.3;
      petal.castShadow = true; bud.add(petal);
    }
    bud.position.y = 3.32; g.add(bud);

    // 弧形水流：上层 -> 中层 -> 池面
    const streams = [];
    function arcStream(r0, y0, r1, y1, rm, ym, count, radius) {
      for (let i = 0; i < count; i++) {
        const a = i / count * Math.PI * 2 + 0.2;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(a) * r0, y0, Math.sin(a) * r0),
          new THREE.Vector3(Math.cos(a) * rm, ym, Math.sin(a) * rm),
          new THREE.Vector3(Math.cos(a) * r1, y1, Math.sin(a) * r1)
        ]);
        const s = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, radius, 6, false), streamM);
        g.add(s); streams.push(s);
      }
    }
    arcStream(0.86, 3.22, 1.42, 2.34, 1.14, 3.02, 6, 0.032);
    arcStream(1.5, 2.34, 2.95, 0.52, 2.25, 1.85, 8, 0.038);

    // 中心水柱
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.09, 1.0, 8), streamM);
    jet.position.y = 4.55; g.add(jet);

    // 水花粒子
    const SN = 90, sArr = new Float32Array(SN * 3), sBase = [];
    for (let i = 0; i < SN; i++) {
      const tier = i % 3;
      const r = tier === 0 ? 1.35 + Math.random() * 0.22 : tier === 1 ? 0.7 + Math.random() * 0.15 : 2.78 + Math.random() * 0.32;
      const y = tier === 0 ? 2.4 : tier === 1 ? 3.32 : 0.56;
      const a = Math.random() * Math.PI * 2;
      sArr[i * 3] = Math.cos(a) * r; sArr[i * 3 + 1] = y; sArr[i * 3 + 2] = Math.sin(a) * r;
      sBase.push([r, a, y, Math.random(), 0.55 + Math.random() * 0.85]);
    }
    const splashGeo = new THREE.BufferGeometry();
    splashGeo.setAttribute('position', new THREE.BufferAttribute(sArr, 3));
    const splash = new THREE.Points(splashGeo, new THREE.PointsMaterial({
      map: splashTexture(), color: 0xFFFFFF, size: 0.17, transparent: true,
      opacity: 0.82, depthWrite: false, sizeAttenuation: true
    }));
    g.add(splash);
    g.add(contactShadow(3.9, 0.5, 0.012));

    g.userData = { jet, streams, splash, splashBase: sBase };
    g.position.set(x, G, z); islandGroup.add(g);
    return g;
  }

  // 罗马拱门
  function arch(x, z, rot = 0) {
    const g = new THREE.Group();
    const sm = texMat(stoneTexture);
    for (const px of [-1.7, 1.7]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 3.6, 12), sm);
      col.position.set(px, 1.8, 0); col.castShadow = true; g.add(col);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9), sm);
      base.position.set(px, 0.15, 0); g.add(base);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9), sm);
      cap.position.set(px, 3.65, 0); g.add(cap);
    }
    const arc = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.34, 10, 24, Math.PI), sm);
    arc.position.y = 3.6; arc.castShadow = true; g.add(arc);
    const top = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.45, 0.8), sm);
    top.position.y = 4.3; g.add(top);
    g.position.set(x, G, z); g.rotation.y = rot; islandGroup.add(g);
  }

  lamp(-4, 6); lamp(4, 6); lamp(-4, -6); lamp(4, -6);
  bench(-7, 3, 0.5); bench(7, 3, -0.5);
  const bike = bicycle(2.2, 15.8, 0.3);
  const f = fountain(0, 0);
  // 版本 A 的罗马拱门遮挡码头到喷泉的视线，参考图中不存在，B 版美术层去掉（无碰撞/布局影响）

  // 可选地标：旋转木马凉亭（避开建筑/主路，放在岛右前空地；不新增碰撞体）
  const carousel = buildCarouselPavilion(emissiveMats);
  carousel.position.set(8.6, G, -1.4);
  carousel.rotation.y = -0.3;
  islandGroup.add(carousel);

  return { fountain: f, carousel, bicycle: bike, benches };
}
