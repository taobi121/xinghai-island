import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RESUME } from './resume.js';
import { ISLAND, createOcean, createIsland, createPaths, createDock, createVegetation, createProps } from './world.js';
import { buildCottage, buildCrystalTower, buildBrickHall, buildGlassTower, buildPostTower } from './buildings.js';
import { PALETTE } from './textures.js';
import { createPlayer } from './character.js';

const G = ISLAND.groundY, R = ISLAND.radius;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
// PALETTE 是 '#RRGGBB' 字符串；THREE.Color.setHex / Fog 需要数值
const palHex = s => parseInt(String(s).slice(1), 16);
// 面板取景：dist / 相机高度 / 目标抬高量（高楼自适应，避免钟楼被裁）
const FOCUS = {
  about: [12, 15, 3.2], skills: [12, 16, 4.0],
  experience: [17, 20, 6.6], projects: [13, 15, 3.0], contact: [13, 17, 4.5]
};
const OUTFITS = [
  {
    id: 'mist', name: '雾蓝航海', icon: '🌊',
    note: '柔和雾蓝针织衫，清爽又适合岛上散步。',
    sweater: 0x5A7A9A, sweaterDark: 0x4C6A88, pants: 0x3E4A5A, shoe: 0xF5F2EA, sole: 0x3E4A5A,
    swatches: ['#5A7A9A', '#3E4A5A', '#F5F2EA']
  },
  {
    id: 'coral', name: '珊瑚晚风', icon: '🌅',
    note: '珊瑚橙搭配暖棕长裤，像黄昏海面一样明亮。',
    sweater: 0xE47A63, sweaterDark: 0xB95C50, pants: 0x514134, shoe: 0xFFF3DF, sole: 0x5D3C32,
    swatches: ['#E47A63', '#514134', '#FFF3DF']
  },
  {
    id: 'forest', name: '林间漫游', icon: '🌿',
    note: '低饱和森林绿，适合乘凉、看喷泉和慢慢闲逛。',
    sweater: 0x5E8F72, sweaterDark: 0x3F6D57, pants: 0x3A4A42, shoe: 0xEEF1E0, sole: 0x2F3D37,
    swatches: ['#5E8F72', '#3A4A42', '#EEF1E0']
  },
  {
    id: 'butter', name: '奶油晴日', icon: '☀️',
    note: '奶油黄和暖白鞋，元气感更足的一套。',
    sweater: 0xE0B65B, sweaterDark: 0xB58634, pants: 0x5B4A39, shoe: 0xFFF8E8, sole: 0x654E36,
    swatches: ['#E0B65B', '#5B4A39', '#FFF8E8']
  }
];
let currentOutfit = 'mist';
try {
  const savedOutfit = localStorage.getItem('xinghai-outfit');
  if (OUTFITS.some(o => o.id === savedOutfit)) currentOutfit = savedOutfit;
} catch (_) {}
const container = document.getElementById('scene-container');

/* ==========================================================================
   渲染器 / 场景 / 相机
   ========================================================================== */
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xE6F4F5, 90, 260);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 22, 40);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
// 绘本低对比：本版本 three 无 NeutralToneMapping，沿用 ACES 但以更柔的光比压对比
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.28;
container.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
Object.assign(labelRenderer.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
container.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(0, 2, 0);
controls.minDistance = 6;
controls.maxDistance = 60;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minPolarAngle = Math.PI * 0.08;
controls.enablePan = false;

/* ==========================================================================
   天空穹顶
   ========================================================================== */
const skyUniforms = {
  topColor: { value: new THREE.Color(0x8FC8E8) },
  bottomColor: { value: new THREE.Color(0xE6F4F5) },
  offset: { value: 20 },
  exponent: { value: 0.75 }
};
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyUniforms,
  vertexShader: `varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vW; void main(){ float h=normalize(vW+vec3(0.0,offset,0.0)).y; gl_FragColor=vec4(mix(bottomColor,topColor,max(pow(max(h,0.0),exponent),0.0)),1.0); }`,
  side: THREE.BackSide, depthWrite: false, fog: false
}));
scene.add(sky);

/* ==========================================================================
   灯光
   ========================================================================== */
const hemiLight = new THREE.HemisphereLight(0xFFF3DE, 0xE8D6B0, 1.35); scene.add(hemiLight);
// 暖阳主光：色温偏暖、强度略降，配柔和接触阴影
const sunLight = new THREE.DirectionalLight(0xFFEBCC, 1.45);
sunLight.position.set(18, 30, 16);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
Object.assign(sunLight.shadow.camera, { left: -44, right: 44, top: 44, bottom: -44, near: 1, far: 140 });
sunLight.shadow.camera.updateProjectionMatrix();
sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.03;
sunLight.shadow.radius = 5; // 配合 PCFSoftShadowMap 得到柔和接触阴影
scene.add(sunLight); scene.add(sunLight.target);
// 暖调补光 + 低强度暖色轮廓光（背向相机的一侧）
const fillLight = new THREE.DirectionalLight(0xFFE5C8, 0.34); fillLight.position.set(-16, 10, -12); scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0xFFD3A0, 0.32); rimLight.position.set(-10, 8, -20); scene.add(rimLight);

// 太阳/月亮圆盘
const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(3.5, 20, 16), new THREE.MeshBasicMaterial({ color: 0xfff3c0, fog: false }));
const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(2.8, 20, 16), new THREE.MeshBasicMaterial({ color: 0xf0f4ff, fog: false }));
scene.add(sunDisc, moonDisc);

// 星空
const starGeo = new THREE.BufferGeometry();
const starN = 700, starPos = new Float32Array(starN * 3);
for (let i = 0; i < starN; i++) {
  const v = new THREE.Vector3().setFromSphericalCoords(350, Math.acos(Math.random() * 0.9 + 0.05), Math.random() * Math.PI * 2);
  starPos[i * 3] = v.x; starPos[i * 3 + 1] = Math.abs(v.y); starPos[i * 3 + 2] = v.z;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, transparent: true, opacity: 0, depthWrite: false, fog: false });
scene.add(new THREE.Points(starGeo, starMat));

/* ==========================================================================
   构建世界
   ========================================================================== */
const oceanUniforms = {};
createOcean(scene, oceanUniforms);
const islandGroup = new THREE.Group();
createIsland(scene, islandGroup);
createPaths(islandGroup);
const emissiveMats = [];
const lampLights = [];
const dockMesh = createDock(islandGroup, emissiveMats);
createVegetation(islandGroup);
const props = createProps(islandGroup, emissiveMats, lampLights);

/* ==========================================================================
   建筑 + 标签 + 碰撞
   ========================================================================== */
const buildings = [];
const COLLIDERS = [];
function register(group, key, label, labelHeight, x, z, rot, collideR) {
  group.position.set(x, G, z);
  if (rot) group.rotation.y = rot;
  const div = document.createElement('div');
  div.className = 'scene-label';
  div.innerHTML = `<span class="dot"></span>${label}`;
  const lo = new CSS2DObject(div); lo.position.set(0, labelHeight, 0); group.add(lo);
  group.userData.panelKey = key; group.userData.hoverT = 0; group.userData.labelEl = div; group.userData.labelName = label;
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.7, 40), new THREE.MeshBasicMaterial({ color: 0xffd76e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; group.add(ring); group.userData.ring = ring;
  islandGroup.add(group);
  buildings.push(group);
  COLLIDERS.push({ x, z, r: collideR || 2 });
  return group;
}
const bCottage = register(buildCottage(emissiveMats), 'about', '关于我', 4.9, -11.9, -7.7, 0.2, 3.0);
const bCrystal = register(buildCrystalTower(emissiveMats), 'skills', '技能树', 6.9, 11.9, -7.7, 0, 2.8);
const bHall = register(buildBrickHall(emissiveMats), 'experience', '工作经历', 10.0, -12.4, 7.2, 0.15, 4.2);
const bGlass = register(buildGlassTower(emissiveMats), 'projects', '项目经历', 5.4, 12.4, 7.2, -0.15, 3.4);
const bPost = register(buildPostTower(emissiveMats), 'contact', '联系方式', 8.6, 0, -13.5, 0, 2.8);
// 喷泉底座半径 3.5，单独注册碰撞（index 5）；建筑映射仍按 0~4 走 COLLIDERS 前五项
COLLIDERS.push({ x: 0, z: 0, r: 3.6 });

/* ==========================================================================
   玩家角色：由 character.js 工厂创建（正面 +Z，原点在脚底）
   ========================================================================== */
const { group: player, armL, armR, legL, legR, setOutfit } = createPlayer(emissiveMats);
function applyOutfit(id, announce = false) {
  const outfit = OUTFITS.find(o => o.id === id);
  if (!outfit) return;
  currentOutfit = outfit.id;
  setOutfit(outfit);
  try { localStorage.setItem('xinghai-outfit', outfit.id); } catch (_) {}
  document.querySelectorAll('[data-outfit]').forEach(btn => btn.classList.toggle('active', btn.dataset.outfit === outfit.id));
  if (announce) say(`换好啦：${outfit.name}`, 2200);
}
applyOutfit(currentOutfit);
// 脚下阴影
const pShadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
pShadow.rotation.x = -Math.PI / 2; islandGroup.add(pShadow);
// 起始位置：码头栈桥上（面朝小岛，-Z 方向）
const SPAWN = { x: 0, z: 19.3 };
player.position.set(SPAWN.x, G, SPAWN.z);
player.rotation.y = Math.PI; // 面朝小岛
islandGroup.add(player);

// 全局绘本柔化：压低不透明材质的镜面反射，抬高粗糙度（半透明水面/玻璃保持原样）
scene.traverse(o => {
  if (!o.isMesh || !o.material) return;
  const ms = Array.isArray(o.material) ? o.material : [o.material];
  for (const m of ms) {
    if (!m.isMeshStandardMaterial || m.transparent) continue;
    m.metalness = Math.min(m.metalness ?? 0, 0.14);
    m.roughness = Math.max(m.roughness ?? 0.8, 0.72);
  }
});

/* ==========================================================================
   粒子：樱花花瓣 + 萤火虫
   ========================================================================== */
// 粉色花瓣贴图：把默认方点换成柔和花瓣剪影
function makePetalTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.translate(32, 32);
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.bezierCurveTo(17, -19, 21, -2, 0, 26);
  ctx.bezierCurveTo(-21, -2, -17, -19, 0, -26);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -26, 0, 26);
  g.addColorStop(0, '#FFF7FA'); g.addColorStop(1, PALETTE.sakura);
  ctx.fillStyle = g; ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// 花瓣围绕 6 棵樱花树分布，形成"树下飘落"感（数量维持 260，移动端友好）
const SAKURA_SPOTS = [[-15.5,-2],[-15,3],[-8,-13.5],[15.5,-2],[15,3],[8,-13.5]];
const PETAL_N = 260, petalArr = new Float32Array(PETAL_N * 3), petalSeeds = [];
for (let i = 0; i < PETAL_N; i++) {
  const spot = SAKURA_SPOTS[i % SAKURA_SPOTS.length];
  const a = Math.random() * Math.PI * 2, r = Math.random() * 3.6;
  petalArr[i*3] = spot[0] + Math.cos(a) * r;
  petalArr[i*3+1] = G + 1.5 + Math.random() * 5;
  petalArr[i*3+2] = spot[1] + Math.sin(a) * r;
  petalSeeds.push({ sx: spot[0], sz: spot[1], fall: 0.45 + Math.random() * 0.6, phase: Math.random() * 6.28 });
}
const petalGeo = new THREE.BufferGeometry();
petalGeo.setAttribute('position', new THREE.BufferAttribute(petalArr, 3));
const petalMat = new THREE.PointsMaterial({ map: makePetalTexture(), color: 0xffffff, size: 0.32, transparent: true, opacity: 0.92, alphaTest: 0.05, depthWrite: false });
scene.add(new THREE.Points(petalGeo, petalMat));

const FIRE_N = 110, fireArr = new Float32Array(FIRE_N * 3), fireBase = [];
for (let i = 0; i < FIRE_N; i++) {
  const a = Math.random()*Math.PI*2, r = Math.random()*16;
  fireArr[i*3] = Math.cos(a)*r; fireArr[i*3+1] = G + 0.5 + Math.random()*3; fireArr[i*3+2] = Math.sin(a)*r;
  fireBase.push([fireArr[i*3], fireArr[i*3+1], fireArr[i*3+2]]);
}
const fireGeo = new THREE.BufferGeometry();
fireGeo.setAttribute('position', new THREE.BufferAttribute(fireArr, 3));
const fireMat = new THREE.PointsMaterial({ color: 0xffe680, size: 0.26, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
const fireflies = new THREE.Points(fireGeo, fireMat); islandGroup.add(fireflies);

/* ==========================================================================
   昼夜系统
   ========================================================================== */
const timeState = { hour: 12, auto: true, speed: 0.3 };
const skyStops = [
  { h: 0,  top: 0x0a1838, bot: 0x1a2b50, deep: 0x0d3a52, shallow: 0x1a5a6a },
  { h: 5,  top: 0x2a3a6a, bot: 0x8a6a8a, deep: 0x1a5a7a, shallow: 0x4a8a98 },
  { h: 6.5,top: 0x9FBCD4, bot: 0xFFC9AC, deep: 0x4AA9C0, shallow: 0x8ACBCC },
  { h: 9,  top: 0x8FC6E6, bot: 0xDFF0F4, deep: 0x3FA6C4, shallow: 0x7FC4C8 },
  { h: 12, top: 0x8FC8E8, bot: 0xE6F4F5, deep: 0x3FA6C4, shallow: 0x7FC4C8 },
  { h: 16, top: 0x8BC3E4, bot: 0xE4F1F2, deep: 0x3FA6C4, shallow: 0x7FC4C8 },
  { h: 18, top: 0xA38CB4, bot: 0xFFB083, deep: 0x3B8FA8, shallow: 0x78B9BE },
  { h: 19.5,top: 0x3a3a70, bot: 0x9a4a6a, deep: 0x183a58, shallow: 0x3a6a7a },
  { h: 21, top: 0x14244a, bot: 0x2a3a60, deep: 0x0d3048, shallow: 0x1a4a5a },
  { h: 24, top: 0x0a1838, bot: 0x1a2b50, deep: 0x0d3a52, shallow: 0x1a5a6a }
];
const cA = new THREE.Color(), cB = new THREE.Color();
function stopColor(hour, key) {
  let i = 0; while (i < skyStops.length - 2 && hour > skyStops[i+1].h) i++;
  const s1 = skyStops[i], s2 = skyStops[i+1];
  const t = clamp((hour - s1.h)/(s2.h - s1.h), 0, 1);
  return cA.setHex(s1[key]).clone().lerp(cB.setHex(s2[key]), t);
}
function daylight(hour) {
  if (hour < 5 || hour > 19.5) return 0.05;
  return Math.max(0.05, Math.sin((hour - 5)/14.5 * Math.PI));
}
function applyTime(hour) {
  const day = daylight(hour);
  skyUniforms.topColor.value.copy(stopColor(hour, 'top'));
  skyUniforms.bottomColor.value.copy(stopColor(hour, 'bot'));
  scene.fog.color.copy(stopColor(hour, 'bot'));
  if (oceanUniforms.ocean) {
    oceanUniforms.ocean.uColorDeep.value.copy(stopColor(hour, 'deep'));
    oceanUniforms.ocean.uColorShallow.value.copy(stopColor(hour, 'shallow'));
    oceanUniforms.ocean.uSun.value.copy(sunLight.color);
    oceanUniforms.ocean.uDay.value = day;
  }
  hemiLight.intensity = lerp(0.45, 1.35, day);
  sunLight.intensity = lerp(0.08, 1.45, day);
  fillLight.intensity = lerp(0.22, 0.34, day);
  const warm = (hour > 16 && hour < 20) ? (hour-16)/4 : (hour > 5 && hour < 8 ? (8-hour)/3 : 0);
  rimLight.intensity = lerp(0.08, 0.32, day) + warm * 0.16;
  sunLight.color.set(0xFFEBCC).lerp(new THREE.Color(0xFFA868), warm*0.7);
  const sa = (hour - 6)/24 * Math.PI * 2;
  sunDisc.position.set(Math.cos(sa)*200, Math.sin(sa)*150, -120);
  sunDisc.visible = day > 0.12;
  sunLight.position.set(Math.cos(sa)*32, Math.max(3, Math.sin(sa)*45), 20);
  const ma = sa + Math.PI;
  moonDisc.position.set(Math.cos(ma)*200, Math.abs(Math.sin(ma))*150, -120);
  moonDisc.visible = day < 0.5;
  starMat.opacity = clamp(1 - day*4, 0, 0.95);
  const night = 1 - day;
  emissiveMats.forEach(e => { e.mat.emissiveIntensity = lerp(e.dayI, e.nightI, night); });
  lampLights.forEach(l => { l.intensity = night * 2.4; });
  petalMat.opacity = lerp(0.92, 0.18, night);
  fireMat.opacity = clamp(night*1.7 - 0.35, 0, 0.9);
  updateTimeUI(hour, day);
}

/* ==========================================================================
   UI 元素引用
   ========================================================================== */
const $ = id => document.getElementById(id);
const timeSlider = $('timeSlider'), timeIcon = $('timeIcon'), timeLabel = $('timeLabel'), timeToggle = $('timeToggle');
const areaTitle = $('areaTitle'), areaName = $('areaName');
const speech = $('speech'), speechText = $('speechText');
const nearBtn = $('nearBtn'), nearName = $('nearName');
const panel = $('panel'), panelContent = $('panelContent');

function updateTimeUI(hour, day) {
  if (document.activeElement !== timeSlider) timeSlider.value = hour;
  const hh = Math.floor(hour) % 24, mm = Math.floor((hour - Math.floor(hour)) * 60);
  timeIcon.textContent = day > 0.35 ? '☀️' : '🌙';
  const period = hour < 6 ? '深夜' : hour < 9 ? '清晨' : hour < 12 ? '上午' : hour < 14 ? '正午' : hour < 17 ? '下午' : hour < 19 ? '黄昏' : hour < 22 ? '夜晚' : '深夜';
  timeLabel.textContent = `${period} ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
}
timeSlider.addEventListener('input', e => { timeState.hour = parseFloat(e.target.value); applyTime(timeState.hour); });
timeToggle.addEventListener('click', () => { timeState.auto = !timeState.auto; timeToggle.textContent = timeState.auto ? '⏸' : '▶'; });
document.querySelectorAll('.time-presets button').forEach(b => b.addEventListener('click', () => { timeState.hour = parseFloat(b.dataset.hour); applyTime(timeState.hour); }));

// 时间控件弹层
$('btnTime').addEventListener('click', () => { $('timeWidget').classList.toggle('hidden'); });
// 帮助弹层
$('btnHelp').addEventListener('click', () => { $('helpModal').classList.remove('hidden'); });
$('helpClose').addEventListener('click', () => { $('helpModal').classList.add('hidden'); });
// 个人信息按钮
$('btnProfile').addEventListener('click', () => openPanel('about'));

// 对话气泡
let speechTimer = null;
function say(text, ms = 3600) {
  speechText.textContent = text;
  speech.classList.remove('hidden');
  clearTimeout(speechTimer);
  speechTimer = setTimeout(() => speech.classList.add('hidden'), ms);
}

/* ==========================================================================
   面板内容
   ========================================================================== */
function buildPanelHTML(key) {
  const r = RESUME;
  const head = (eyebrow, title, sub) => `<div class="panel-eyebrow">${eyebrow}</div><h2 class="panel-title">${title}</h2><p class="panel-sub">${sub}</p><div class="divider"></div>`;
  switch (key) {
    case 'about':
      return head('ABOUT ME', '关于我', r.tagline) + r.about.lines.map(t => `<p class="about-text">${t}</p>`).join('') +
        `<div class="fact-grid">` + r.about.facts.map(f => `<div class="fact"><b>${f[1]}</b><span>${f[0]}</span></div>`).join('') + `</div>`;
    case 'skills':
      return head('SKILLS', '技能树', '我擅长的技术与工具。') +
        r.skills.map(s => `<div class="skill"><div class="skill-head"><span>${s.icon}</span><span>${s.name}</span><span class="bar-track"><span class="bar-fill" data-w="${s.level}"></span></span><span class="pct">${s.level}%</span></div><div class="chips">${s.items.map(i => `<span class="chip">${i}</span>`).join('')}</div></div>`).join('');
    case 'experience':
      return head('EXPERIENCE', '工作经历', '一路走来的足迹。') +
        `<div class="timeline">` + r.experience.map(e => `<div class="tl-item"><div class="tl-role">${e.role}</div><div class="tl-meta">${e.company} · ${e.period}</div><div class="tl-desc">${e.desc}</div></div>`).join('') + `</div>`;
    case 'projects':
      return head('PROJECTS', '项目经历', '一些让我骄傲的作品。') +
        r.projects.map(p => `<div class="proj"><h4>${p.icon} ${p.name}</h4><p>${p.desc}</p><div class="chips">${p.tags.map(t => `<span class="chip">${t}</span>`).join('')}</div></div>`).join('');
    case 'contact':
      return head('CONTACT', '联系方式', '欢迎交流，期待与你相遇！') +
        r.contact.map(c => `<div class="contact-item"><span class="ci-ico">${c.icon}</span><span>${c.label}：<a href="${c.href}" target="_blank" rel="noopener">${c.value}</a></span></div>`).join('');
    case 'outfits':
      return head('WARDROBE', '换装', '点一套衣服，岛上的角色会立即换装。') +
        `<div class="outfit-grid">` + OUTFITS.map(o => `
          <button class="outfit-card${o.id === currentOutfit ? ' active' : ''}" data-outfit="${o.id}">
            <span class="outfit-icon">${o.icon}</span>
            <span class="outfit-copy"><b>${o.name}</b><small>${o.note}</small></span>
            <span class="outfit-swatches">${o.swatches.map(color => `<i style="background:${color}"></i>`).join('')}</span>
          </button>`).join('') + `</div>
          <p class="outfit-tip">✦ 选择会保存在当前浏览器，下次登岛继续穿这一套。</p>`;
    default: return '';
  }
}
let panelOpen = false;
function openPanel(key) {
  if (!['about','skills','experience','projects','contact','outfits'].includes(key)) return;
  if (rideState) endRide();
  if (key === 'outfits') {
    panelOpen = true;
    cameraMode = 'panel';
    panelContent.innerHTML = buildPanelHTML(key);
    panel.classList.add('open');
    document.querySelectorAll('.dock-btn').forEach(x => x.classList.toggle('active', x.dataset.key === key));
    areaName.textContent = '旅行衣橱';
    areaTitle.classList.remove('hidden');
    setHover(hovered, false); hovered = null;
    if (entered) {
      say('挑一套喜欢的岛上穿搭吧～');
      flyTo(
        [player.position.x + 7.5, G + 4.6, player.position.z + 8.5],
        [player.position.x, G + 1.15, player.position.z],
        850
      );
    }
    return;
  }
  const idx = ['about','skills','experience','projects','contact'].indexOf(key);
  const b = buildings[idx];
  panelOpen = true;
  cameraMode = 'panel';
  panelContent.innerHTML = buildPanelHTML(key);
  panel.classList.add('open');
  document.querySelectorAll('.dock-btn').forEach(x => x.classList.toggle('active', x.dataset.key === key));
  requestAnimationFrame(() => panelContent.querySelectorAll('.bar-fill').forEach(el => el.style.width = el.dataset.w + '%'));
  // 区域标题
  areaName.textContent = b.userData.labelName;
  areaTitle.classList.remove('hidden');
  setHover(hovered, false); hovered = null;
  const greetings = { about:'嗨！很高兴认识你～', skills:'这些是我的拿手好戏！', experience:'一路走来的足迹 ✦', projects:'看看我做过的好玩东西！', contact:'随时欢迎联系我！' };
  if (entered) say(greetings[key] || '欢迎参观！');
  // 镜头飞向建筑（俯瞰全岛的角度）
  const c = COLLIDERS[idx];
  const F = FOCUS[key];
  const dx = player.position.x - c.x, dz = player.position.z - c.z;
  const d = Math.hypot(dx, dz) || 1;
  flyTo([c.x + dx/d*F[0], F[1], c.z + dz/d*F[0] + 4], [c.x, G + F[2], c.z], 1000);
}
function closePanel() {
  panelOpen = false;
  panel.classList.remove('open');
  document.querySelectorAll('.dock-btn').forEach(b => b.classList.remove('active'));
  areaTitle.classList.add('hidden');
  if (entered) cameraMode = 'follow';
}
$('panelClose').addEventListener('click', closePanel);
panelContent.addEventListener('click', e => {
  const button = e.target.closest('[data-outfit]');
  if (button) applyOutfit(button.dataset.outfit, true);
});
const NAV = [['about','🏠','关于我'],['skills','💎','技能'],['experience','📚','经历'],['projects','🏆','项目'],['contact','📮','联系'],['outfits','👗','换装']];
const dock = $('dock');
dock.innerHTML = NAV.map(([k,i,t]) => `<button class="dock-btn" data-key="${k}"><span class="ico">${i}</span>${t}</button>`).join('');
dock.addEventListener('click', e => { const b = e.target.closest('.dock-btn'); if (b) openPanel(b.dataset.key); });

/* ==========================================================================
   小地图（Canvas 2D 俯视图）
   ========================================================================== */
const mmCanvas = $('minimapCanvas'), mmCtx = mmCanvas.getContext('2d');
const MM = { cx: 110, cy: 110, scale: 4.6 };
const mmDots = buildings.map((b, i) => ({ x: COLLIDERS[i].x, z: COLLIDERS[i].z, key: b.userData.panelKey, color: ['#d9534f','#8a6fd4','#4a78ad','#4aa8b8','#d4a94a'][i] }));
function drawMinimap() {
  const c = mmCtx, S = MM.scale;
  c.clearRect(0, 0, 220, 220);
  // 海
  c.fillStyle = '#a8dce8'; c.fillRect(0, 0, 220, 220);
  // 岛（椭圆）
  c.save(); c.translate(MM.cx, MM.cy);
  c.fillStyle = '#e8d9a8'; c.beginPath(); c.ellipse(0, 0, R*S, R*0.92*S, 0, 0, 7); c.fill();
  c.fillStyle = '#8fc96a'; c.beginPath(); c.ellipse(0, 0, R*0.9*S, R*0.83*S, 0, 0, 7); c.fill();
  // 码头
  c.fillStyle = '#b98d5a'; c.fillRect(-1.6*S, 14*S, 3.2*S, 9*S);
  // 中心广场
  c.fillStyle = '#d8cfb8'; c.beginPath(); c.arc(0, 0, 2.6*S, 0, 7); c.fill();
  // 建筑点
  mmDots.forEach(d => {
    c.fillStyle = d.color; c.beginPath(); c.arc(d.x*S, d.z*S, 5, 0, 7); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
  });
  // 玩家（箭头，随朝向旋转）
  c.save(); c.translate(player.position.x*S, player.position.z*S); c.rotate(Math.PI - player.rotation.y);
  c.fillStyle = '#e8553f'; c.beginPath(); c.moveTo(0,-7); c.lineTo(5,6); c.lineTo(0,3); c.lineTo(-5,6); c.closePath(); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke(); c.restore();
  c.restore();
}

/* ==========================================================================
   背景音乐（Web Audio 生成柔和环境琶音）
   ========================================================================== */
let audioCtx = null, musicPlaying = false, musicTimer = null, progress = 0, noteIdx = 0;
const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 293.66, 349.23];
let masterGain = null;
function playNote(freq, when) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
  osc.type = 'sine'; osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(0.12, when + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 1.6);
  osc.connect(gain); gain.connect(masterGain);
  osc.start(when); osc.stop(when + 1.7);
}
// 统一的音乐状态刷新：顶部按钮 + 播放器按钮 + 音量图标全部同步
function syncMusicUI() {
  $('btnMusic').textContent = musicPlaying ? '🎵' : '🔇';
  $('btnMusic').classList.toggle('muted', !musicPlaying);
  $('musicPlay').textContent = musicPlaying ? '⏸' : '▶';
  $('musicPlayer').classList.toggle('playing', musicPlaying);
  const vol = $('musicVol'); if (vol) vol.textContent = musicPlaying ? '🔊' : '🔇';
}
function startMusic() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain(); masterGain.gain.value = 1;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  masterGain.gain.setTargetAtTime(1, audioCtx.currentTime, 0.05);
  musicPlaying = true;
  clearInterval(musicTimer);
  musicTimer = setInterval(() => {
    playNote(notes[noteIdx % notes.length], audioCtx.currentTime);
    playNote(notes[(noteIdx + 2) % notes.length] / 2, audioCtx.currentTime);
    noteIdx++;
  }, 900);
  syncMusicUI();
}
function stopMusic() {
  musicPlaying = false;
  clearInterval(musicTimer);
  if (masterGain && audioCtx) masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
  syncMusicUI();
}
// 单击切换静音 ⇄ 有音乐
function toggleMusic() { musicPlaying ? stopMusic() : startMusic(); }
$('musicPlay').addEventListener('click', toggleMusic);
$('btnMusic').addEventListener('click', toggleMusic);
syncMusicUI();

/* ==========================================================================
   移动控制
   ========================================================================== */
const keys = {};
const joy = { active: false, x: 0, y: 0 };
let camYaw = 0, camPitch = 0.55, camDist = 12;
const vel = new THREE.Vector3();
let onGround = true, jumpVel = 0, walkPhase = 0;
let cameraMode = 'follow'; // focus(开场航拍) | follow | panel
let introOrbit = 0;
let entered = false;

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space' && onGround && cameraMode === 'follow') { jumpVel = 7; onGround = false; }
  if (e.code === 'KeyE' && (nearB || nearRide || rideState) && cameraMode === 'follow' && !panelOpen) { openNearby(); }
  const p = { Digit1: 6.5, Digit2: 12, Digit3: 18.5, Digit4: 22 }[e.code];
  if (p) { timeState.hour = p; applyTime(p); }
  if (e.code === 'Escape') { if (rideState) endRide(); closePanel(); }
});
addEventListener('keyup', e => { keys[e.code] = false; });

// 摇杆
const joystick = $('joystick'), joyKnob = $('joyKnob');
function joyMove(e) {
  const r = joystick.getBoundingClientRect(), cx = r.left + r.width/2, cy = r.top + r.height/2;
  let dx = e.clientX - cx, dy = e.clientY - cy, max = r.width*0.36;
  const len = Math.hypot(dx, dy);
  if (len > max) { dx = dx/len*max; dy = dy/len*max; }
  joyKnob.style.transform = `translate(${dx}px,${dy}px)`;
  joy.x = dx/max; joy.y = dy/max;
}
joystick.addEventListener('pointerdown', e => { joy.active = true; joystick.setPointerCapture(e.pointerId); joyMove(e); });
joystick.addEventListener('pointermove', e => { if (joy.active) joyMove(e); });
const joyEnd = () => { joy.active = false; joy.x = 0; joy.y = 0; joyKnob.style.transform = ''; };
joystick.addEventListener('pointerup', joyEnd); joystick.addEventListener('pointercancel', joyEnd);
$('jumpBtn').addEventListener('pointerdown', () => { if (onGround && cameraMode === 'follow') { jumpVel = 7; onGround = false; } });

// 拖拽旋转视角（鼠标 + 触摸）+ 点击检测 + 双指缩放
const activePointers = new Map();
let lastX = 0, lastY = 0, downX = 0, downY = 0, dragMoved = 0;
let pinchDist = 0;
renderer.domElement.style.touchAction = 'none'; // 关键：允许触摸拖拽，阻止页面滚动/缩放接管
function twoFingerDist() {
  const p = [...activePointers.values()];
  return p.length >= 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
}
renderer.domElement.addEventListener('pointerdown', e => {
  if (panelOpen) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) {}
  if (activePointers.size === 1) {
    lastX = downX = e.clientX; lastY = downY = e.clientY; dragMoved = 0;
  } else if (activePointers.size === 2) {
    pinchDist = twoFingerDist();
  }
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!activePointers.has(e.pointerId)) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activePointers.size >= 2) {
    const d = twoFingerDist();
    if (pinchDist > 0 && cameraMode === 'follow') camDist = clamp(camDist - (d - pinchDist) * 0.03, 6, 30);
    pinchDist = d;
    return;
  }
  if (cameraMode !== 'follow') return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  camYaw -= dx * 0.006;
  camPitch = clamp(camPitch + dy * 0.005, 0.12, 1.2);
  lastX = e.clientX; lastY = e.clientY;
});
function endPointer(e) {
  const wasSingle = activePointers.size === 1;
  activePointers.delete(e.pointerId);
  try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (_) {}
  pinchDist = activePointers.size >= 2 ? twoFingerDist() : 0;
  // 轻点（未明显拖动）视为点击建筑
  if (wasSingle && dragMoved < 10 && !panelOpen && entered && cameraMode === 'follow') handleClick(e);
}
renderer.domElement.addEventListener('pointerup', endPointer);
renderer.domElement.addEventListener('pointercancel', e => { activePointers.delete(e.pointerId); pinchDist = 0; });
renderer.domElement.addEventListener('wheel', e => { if (cameraMode === 'follow') camDist = clamp(camDist + e.deltaY*0.01, 6, 30); }, { passive: true });

// 点击检测
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(e) {
  ndc.x = e.clientX/innerWidth*2-1; ndc.y = -(e.clientY/innerHeight)*2+1;
  raycaster.setFromCamera(ndc, camera);
  const meshes = []; buildings.forEach(b => b.traverse(o => { if (o.isMesh) meshes.push(o); }));
  const hit = raycaster.intersectObjects(meshes, false)[0];
  if (!hit) return null;
  let o = hit.object; while (o && !o.userData.panelKey) o = o.parent; return o;
}
function setHover(b, on) { if (!b) return; b.userData.hoverT = on?1:0; b.userData.labelEl.classList.toggle('hover', on); }
let hovered = null;
renderer.domElement.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch' || panelOpen || cameraMode !== 'follow') return;
  const b = pick(e);
  if (b !== hovered) { setHover(hovered, false); hovered = b; setHover(hovered, true); renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab'; }
});
function handleClick(e) { const b = pick(e); if (b) focusBuilding(b); }

// 走近/点击建筑 -> 聚焦镜头 + 打开面板 + 区域标题
function focusBuilding(b) { openPanel(b.userData.panelKey); }

function updatePlayer(dt) {
  if (rideState) { updateRide(dt); return; }
  if (cameraMode !== 'follow' || panelOpen) {
    armL.rotation.x *= 0.9; armR.rotation.x *= 0.9; legL.rotation.x *= 0.9; legR.rotation.x *= 0.9;
    return;
  }
  let ix = 0, iz = 0;
  if (keys['KeyW']||keys['ArrowUp']) iz -= 1;
  if (keys['KeyS']||keys['ArrowDown']) iz += 1;
  if (keys['KeyA']||keys['ArrowLeft']) ix -= 1;
  if (keys['KeyD']||keys['ArrowRight']) ix += 1;
  ix += joy.x; iz += joy.y;
  const len = Math.hypot(ix, iz);
  if (len > 1) { ix/=len; iz/=len; }
  const moving = len > 0.01;
  if (moving) {
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    const mx = fx*(-iz) + rx*ix, mz = fz*(-iz) + rz*ix;
    const speed = 5.5;
    vel.set(mx*speed, 0, mz*speed);
    const target = Math.atan2(mx, mz);
    let diff = target - player.rotation.y;
    while (diff > Math.PI) diff -= Math.PI*2;
    while (diff < -Math.PI) diff += Math.PI*2;
    player.rotation.y += diff * Math.min(1, dt*12);
    walkPhase += dt*13;
    const sw = Math.sin(walkPhase)*0.6;
    legL.rotation.x = sw; legR.rotation.x = -sw;
    armL.rotation.x = -sw*0.7; armR.rotation.x = sw*0.7;
  } else {
    vel.multiplyScalar(Math.max(0, 1 - dt*10));
    legL.rotation.x *= 0.85; legR.rotation.x *= 0.85;
    armL.rotation.x *= 0.85; armR.rotation.x *= 0.85;
  }
  let nx = player.position.x + vel.x*dt, nz = player.position.z + vel.z*dt;
  // 边界：码头走廊（|x|<1.4 且 z 在 13.5~22.6）可走，否则限制在岛内圆形范围
  const onDockLane = Math.abs(nx) < 1.35 && nz > 13.5 && nz < 22.6;
  if (!onDockLane) {
    const r = Math.hypot(nx, nz);
    const limit = R * 0.94;
    if (r > limit) { nx = nx/r*limit; nz = nz/r*limit; }
  }
  // 码头两侧栏杆：限制 x
  if (nz > 13.5 && Math.abs(nx) > 1.35 && nz > R * 0.94) {
    nx = Math.sign(nx) * 1.35;
  }
  for (const c of COLLIDERS) {
    const d = Math.hypot(nx-c.x, nz-c.z);
    if (d < c.r && d > 0.001) { nx = c.x + (nx-c.x)/d*c.r; nz = c.z + (nz-c.z)/d*c.r; }
  }
  player.position.x = nx; player.position.z = nz;
  if (!onGround) {
    jumpVel -= 20*dt; player.position.y += jumpVel*dt;
    if (player.position.y <= G) { player.position.y = G; onGround = true; jumpVel = 0; }
  } else {
    player.position.y = G + Math.abs(Math.sin(walkPhase))*0.03;
  }
  pShadow.position.set(player.position.x, G + 0.03, player.position.z);
  const h = player.position.y - G;
  pShadow.scale.setScalar(1 - Math.min(h*0.07, 0.5));
  pShadow.material.opacity = 0.22 - Math.min(h*0.02, 0.16);
}

// 跟随镜头
const camFocus = new THREE.Vector3();
function updateFollowCamera(dt) {
  if (cameraMode !== 'follow') return;
  camFocus.set(player.position.x, player.position.y + 1.4, player.position.z);
  const desired = new THREE.Vector3(
    camFocus.x + Math.sin(camYaw)*Math.cos(camPitch)*camDist,
    camFocus.y + Math.sin(camPitch)*camDist,
    camFocus.z + Math.cos(camYaw)*Math.cos(camPitch)*camDist
  );
  camera.position.lerp(desired, Math.min(1, dt*6));
  controls.target.lerp(camFocus, Math.min(1, dt*7));
}

// 镜头飞行
let camAnim = null;
const ease = t => (t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2);
function flyTo(pos, target, dur=1000) {
  camAnim = { fp: camera.position.clone(), tp: new THREE.Vector3(...pos), ft: controls.target.clone(), tt: new THREE.Vector3(...target), t0: performance.now(), dur };
}

/* ==========================================================================
   可交互设施：旋转木马 / 自行车
   走近后按 E 或点按钮上座，再按一次下来；自行车可用 WASD / 摇杆绕岛骑行
   ========================================================================== */
const RIDES = [
  { id: 'carousel', name: '旋转木马', icon: '🎠', x: 8.6, z: -1.4, r: 3.9 },
  { id: 'bike', name: '自行车', icon: '🚲', x: 8.5, z: 4.5, r: 2.2 }
];
const SEATS = props.benches.map((bench, index) => {
  const seat = bench.userData.seat;
  const fx = Math.sin(seat.rot), fz = Math.cos(seat.rot);
  return {
    id: `seat-${index}`,
    kind: 'seat',
    name: '长椅',
    icon: '🪑',
    x: seat.x,
    z: seat.z,
    r: 1.9,
    rot: seat.rot,
    sitX: seat.x + fx * 0.04,
    sitZ: seat.z + fz * 0.04,
    exitX: seat.x + fx * 1.15,
    exitZ: seat.z + fz * 1.15,
    model: bench
  };
});
const INTERACTABLES = [...RIDES, ...SEATS];
let rideState = null;
const nbIcon = nearBtn.querySelector('.nb-icon');
const nbHint = nearBtn.querySelector('.nb-text small');
function setNearButton(icon, name, hint) {
  nbIcon.textContent = icon; nearName.textContent = name; nbHint.textContent = hint;
}
// 设施上方的提示标签，让「可以坐上去玩」一眼可见
for (const r of INTERACTABLES) {
  const div = document.createElement('div');
  div.className = 'scene-label';
  div.innerHTML = `<span class="dot"></span>${r.icon} ${r.name} · E ${r.kind === 'seat' ? '坐下' : '游玩'}`;
  const lo = new CSS2DObject(div);
  if (r.id === 'bike' && props.bicycle) {
    lo.position.set(0, 2.35, 0); props.bicycle.add(lo);  // 车会移动，标签跟着车走
  } else if (r.kind === 'seat') {
    lo.position.set(0, 1.75, 0); r.model.add(lo);
  } else {
    lo.position.set(r.x, G + 5.0, r.z); islandGroup.add(lo);
  }
}
function startRide(r) {
  if (rideState || !r || !entered || panelOpen) return;
  rideState = { id: r.id, kind: r.kind || 'ride', name: r.name, icon: r.icon, t: 0 };
  vel.set(0, 0, 0); onGround = true;
  if (r.id === 'bike' && props.bicycle) {
    // 人走到车旁上座，车留在原处，避免整辆车瞬移到玩家脚下
    player.position.x = props.bicycle.position.x;
    player.position.z = props.bicycle.position.z;
    player.rotation.y = props.bicycle.rotation.y;
  } else if (r.kind === 'seat') {
    player.position.set(r.sitX, G + 0.04, r.sitZ);
    player.rotation.y = r.rot;
    legL.rotation.x = legR.rotation.x = -1.22;
    armL.rotation.x = armR.rotation.x = 0.08;
  }
  const message = r.kind === 'seat'
    ? '坐下歇一会儿吧～按 E 或点按钮起身。'
    : r.id === 'carousel'
      ? '坐稳咯～旋转木马转起来啦！再按 E 或点按钮下来。'
      : '骑上小车啦！用 WASD / 摇杆绕岛兜风，按 E 下车。';
  say(message, 4200);
}
function endRide() {
  if (!rideState) return;
  const wasBike = rideState.id === 'bike';
  const wasSeat = rideState.kind === 'seat';
  player.position.y = G;
  if (wasBike && props.bicycle) {
    // 停在车旁边，不把人传送回上车点
    player.position.x = props.bicycle.position.x + Math.sin(player.rotation.y) * 1.2;
    player.position.z = props.bicycle.position.z + Math.cos(player.rotation.y) * 1.2;
  } else if (wasSeat) {
    const seat = SEATS.find(s => s.id === rideState.id);
    if (seat) {
      player.position.x = seat.exitX;
      player.position.z = seat.exitZ;
      player.rotation.y = seat.rot;
    }
  }
  legL.rotation.x = legR.rotation.x = armL.rotation.x = armR.rotation.x = 0;
  rideState = null;
  say('玩得开心，随时可以再来～', 2400);
}
function updateRide(dt) {
  const st = rideState;
  st.t += dt;
  if (st.kind === 'seat') {
    const seat = SEATS.find(s => s.id === st.id);
    if (seat) player.position.set(seat.sitX, G + 0.04, seat.sitZ);
    legL.rotation.x = -1.22; legR.rotation.x = -1.12;
    armL.rotation.x = armR.rotation.x = 0.08;
  } else if (st.id === 'carousel') {
    const c = props.carousel;
    if (!c || !c.userData.carousel) return;
    const a = c.userData.carousel.rotation.y;
    // 转盘上第 0 匹马的座位，经凉亭自身旋转换算到岛上坐标
    const lx = 0.85 * Math.cos(a), lz = -0.85 * Math.sin(a);
    const ca = Math.cos(c.rotation.y), sa = Math.sin(c.rotation.y);
    player.position.set(c.position.x + lx * ca + lz * sa, G + 0.5, c.position.z - lx * sa + lz * ca);
    player.rotation.y = Math.atan2(-Math.sin(a), -Math.cos(a));
    legL.rotation.x = legR.rotation.x = -1.0;   // 屈腿骑坐
    armL.rotation.x = armR.rotation.x = -0.95;  // 双手扶杆
  } else {
    const bike = props.bicycle;
    if (!bike) return;
    let ix = 0, iz = 0;
    if (keys['KeyW']||keys['ArrowUp']) iz -= 1;
    if (keys['KeyS']||keys['ArrowDown']) iz += 1;
    if (keys['KeyA']||keys['ArrowLeft']) ix -= 1;
    if (keys['KeyD']||keys['ArrowRight']) ix += 1;
    ix += joy.x; iz += joy.y;
    const len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; }
    const moving = len > 0.01;
    if (moving) {
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      const mx = fx*(-iz) + rx*ix, mz = fz*(-iz) + rz*ix;
      const speed = 7.2;
      let nx = bike.position.x + mx*speed*dt, nz = bike.position.z + mz*speed*dt;
      const rr = Math.hypot(nx, nz), limit = R * 0.9;
      if (rr > limit) { nx = nx/rr*limit; nz = nz/rr*limit; }
      for (const c of COLLIDERS) {
        const d = Math.hypot(nx-c.x, nz-c.z);
        if (d < c.r && d > 0.001) { nx = c.x + (nx-c.x)/d*c.r; nz = c.z + (nz-c.z)/d*c.r; }
      }
      bike.position.set(nx, G, nz);
      const target = Math.atan2(mx, mz);
      let diff = target - bike.rotation.y;
      while (diff > Math.PI) diff -= Math.PI*2;
      while (diff < -Math.PI) diff += Math.PI*2;
      bike.rotation.y += diff * Math.min(1, dt*8);
      bike.userData.wheels.forEach(w => { w.rotation.z -= speed*dt/0.42; });
    }
    player.position.set(bike.position.x, G + 0.4, bike.position.z);
    player.rotation.y = bike.rotation.y;
    const pedal = moving ? Math.sin(st.t*11)*0.55 : 0;
    legL.rotation.x = pedal; legR.rotation.x = -pedal;
    armL.rotation.x = armR.rotation.x = -0.95;
  }
  pShadow.position.set(player.position.x, G + 0.03, player.position.z);
  pShadow.material.opacity = 0.22;
}

// 走近建筑 / 设施检测：显示可点击按钮
let nearB = null, nearRide = null;
function updateNearby() {
  if (!entered || cameraMode !== 'follow' || panelOpen) {
    if (nearB) { setHover(nearB, false); nearB = null; }
    nearRide = null;
    nearBtn.classList.remove('show');
    return;
  }
  if (rideState) {
    if (nearB) { setHover(nearB, false); nearB = null; }
    nearRide = null;
    const activeHint = rideState.kind === 'seat'
      ? '点击 / E 起身'
      : rideState.id === 'bike'
        ? '点击 / E 下车'
        : '点击 / E 结束游玩';
    const activeName = rideState.kind === 'seat' ? '正在休息 · 长椅' : '正在玩 · ' + rideState.name;
    setNearButton(rideState.icon, activeName, activeHint);
    nearBtn.classList.add('show');
    return;
  }
  let near = null, minD = 4.4;
  for (let i = 0; i < buildings.length; i++) {
    const c = COLLIDERS[i];
    const d = Math.hypot(player.position.x-c.x, player.position.z-c.z);
    if (d < minD && d > c.r*0.85) { minD = d; near = buildings[i]; }
  }
  let ride = null, rideD = Infinity;
  for (const r of INTERACTABLES) {
    // 自行车骑走后热点跟着车，不然会出现「车在这、按钮在那」
    const rx = r.id === 'bike' && props.bicycle ? props.bicycle.position.x : r.x;
    const rz = r.id === 'bike' && props.bicycle ? props.bicycle.position.z : r.z;
    const d = Math.hypot(player.position.x-rx, player.position.z-rz);
    if (d < r.r && d < rideD) { rideD = d; ride = r; }
  }
  // 设施更近时优先提示游玩，避免和建筑提示抢同一个按钮
  if (ride && (!near || rideD < minD)) {
    if (near) { setHover(near, false); near = null; }
    nearRide = ride;
  } else {
    nearRide = null;
  }
  if (near !== nearB) {
    setHover(nearB, false); nearB = near;
    if (near) setHover(near, true);
  }
  if (nearRide) { setNearButton(nearRide.icon, nearRide.name, '点击 / E 坐上去玩'); nearBtn.classList.add('show'); }
  else if (nearB) { setNearButton('👆', nearB.userData.labelName, '点击查看详情'); nearBtn.classList.add('show'); }
  else nearBtn.classList.remove('show');
}
function openNearby() {
  if (rideState) { endRide(); return; }
  if (nearRide) { startRide(nearRide); nearBtn.classList.remove('show'); return; }
  if (nearB) { openPanel(nearB.userData.panelKey); nearBtn.classList.remove('show'); }
}
nearBtn.addEventListener('click', openNearby);

/* ==========================================================================
   开场 & URL 直达
   ========================================================================== */
const intro = $('intro');
function startExplore() {
  entered = true;
  intro.classList.add('hidden');
  setTimeout(() => intro.style.display = 'none', 850);
  say('欢迎登岛！用 WASD 或摇杆四处逛逛吧～', 4200);
  introOrbit = performance.now() + 3200;
}
$('enterBtn').addEventListener('click', startExplore);

// 填充资料
$('introName').textContent = RESUME.islandName;
$('introTagline').textContent = `一个藏在海上的个人简历小岛 · by ${RESUME.name}`;
$('brandName').textContent = RESUME.islandName;
$('hudName'); // noop
document.title = `${RESUME.name} · ${RESUME.islandName}`;

applyTime(timeState.hour);

const urlParams = new URLSearchParams(location.search);
const hourParam = urlParams.get('hour');
if (hourParam) { timeState.hour = parseFloat(hourParam); applyTime(timeState.hour); }
const directPanel = urlParams.get('panel');
if (directPanel) {
  intro.style.display = 'none'; entered = true; introOrbit = 0;
  const idx = ['about','skills','experience','projects','contact'].indexOf(directPanel);
  if (idx >= 0) { openPanel(directPanel); cameraMode = 'panel'; areaName.textContent = buildings[idx].userData.labelName; areaTitle.classList.remove('hidden'); }
} else if (urlParams.get('skipintro') === '1') {
  intro.style.display = 'none'; entered = true; introOrbit = performance.now() + 2000;
}

/* ==========================================================================
   动画循环
   ========================================================================== */
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.getElapsedTime();

  if (oceanUniforms.ocean) oceanUniforms.ocean.uTime.value = t;

  if (timeState.auto && !panelOpen) { timeState.hour = (timeState.hour + dt*timeState.speed) % 24; applyTime(timeState.hour); }

  if (introOrbit && !panelOpen) {
    const a = t*0.25;
    camera.position.set(Math.sin(a)*46, 22 + Math.sin(t*0.4)*3, Math.cos(a)*46);
    controls.target.set(0, 2, 0);
    if (performance.now() >= introOrbit) { introOrbit = 0; cameraMode = 'follow'; }
  } else if (camAnim) {
    const k = Math.min((performance.now()-camAnim.t0)/camAnim.dur, 1), e = ease(k);
    camera.position.lerpVectors(camAnim.fp, camAnim.tp, e);
    controls.target.lerpVectors(camAnim.ft, camAnim.tt, e);
    if (k >= 1) camAnim = null;
  } else {
    updatePlayer(dt); updateFollowCamera(dt);
  }

  // 建筑动画
  bCrystal.userData.crystals.forEach((c,i) => { c.rotation.y += dt*(0.5+i*0.15); c.position.y += Math.sin(t*1.5+i)*0.001; });
  bCrystal.userData.core.rotation.y += dt*0.8;
  bCrystal.userData.ring.rotation.z += dt*0.3;
  if (props.fountain) {
    const u = props.fountain.userData;
    u.jet.scale.y = 0.9 + Math.sin(t*3)*0.12;
    // 水花粒子：三层小喷泉循环起落
    const sp = u.splash.geometry.attributes.position.array;
    for (let i = 0; i < u.splashBase.length; i++) {
      const b = u.splashBase[i], k = (b[3] + t * b[4]) % 1;
      sp[i*3] = Math.cos(b[1] + t*0.22) * b[0] * (1 + k*0.1);
      sp[i*3+1] = b[2] + k*0.55;
      sp[i*3+2] = Math.sin(b[1] + t*0.22) * b[0] * (1 + k*0.1);
    }
    u.splash.geometry.attributes.position.needsUpdate = true;
  }
  if (props.carousel && props.carousel.userData.carousel) {
    props.carousel.userData.carousel.rotation.y += dt * 0.25;
  }
  if (dockMesh.userData.flag) dockMesh.userData.flag.rotation.y = 0.2 + Math.sin(t*1.5)*0.15;
  buildings.forEach(b => { const cur = b.scale.x, tgt = 1+(b.userData.hoverT||0)*0.04; b.scale.setScalar(cur+(tgt-cur)*0.15); });

  // 粒子
  const pa = petalGeo.attributes.position.array;
  for (let i = 0; i < PETAL_N; i++) {
    const sd = petalSeeds[i];
    pa[i*3+1] -= dt * sd.fall;
    if (pa[i*3+1] < G + 0.1) {
      const a = Math.random()*Math.PI*2, r = Math.random()*3.6;
      pa[i*3] = sd.sx + Math.cos(a)*r;
      pa[i*3+2] = sd.sz + Math.sin(a)*r;
      pa[i*3+1] = G + 5.5 + Math.random()*2;
    }
    pa[i*3] += Math.sin(t*0.9+sd.phase)*dt*0.35;
    pa[i*3+2] += Math.cos(t*0.7+sd.phase)*dt*0.28;
  }
  petalGeo.attributes.position.needsUpdate = true;
  if (fireMat.opacity > 0.01) {
    const fa = fireGeo.attributes.position.array;
    for (let i = 0; i < FIRE_N; i++) {
      fa[i*3] = fireBase[i][0]+Math.sin(t*0.8+i)*0.5;
      fa[i*3+1] = fireBase[i][1]+Math.sin(t*1.3+i*1.7)*0.35;
      fa[i*3+2] = fireBase[i][2]+Math.cos(t*0.9+i)*0.5;
    }
    fireGeo.attributes.position.needsUpdate = true;
  }

  // 音乐进度
  if (musicPlaying) { progress = (progress + dt*2) % 100; $('musicProgress').style.width = progress + '%'; }

  drawMinimap();
  updateNearby();
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
animate();

requestAnimationFrame(() => { const l = $('loading'); l.style.opacity = '0'; setTimeout(() => l.remove(), 700); });
// 调试/自动化钩子（只读查询 + 定位，供测试与分享链接使用，不影响正常玩法）
window.__islandDebug = {
  getPlayer: () => ({ x: player.position.x, z: player.position.z }),
  getSpawn: () => ({ ...SPAWN }),
  getNear: () => nearB ? nearB.userData.panelKey : null,
  teleport: (x, z) => { player.position.x = x; player.position.z = z; },
  buildingPos: () => COLLIDERS.map(c => ({ x: c.x, z: c.z, r: c.r }))
};
addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight);
});
