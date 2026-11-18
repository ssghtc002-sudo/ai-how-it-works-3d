/**
 * Holographic AI Chamber & Telemetry Props (/home/antigravity/ai-how-it-works-3d/src/scene/holoChamber.js)
 * Builds the calibrated dark-slate stage pedestal, twin counter-rotating Attention Gyroscope Rings,
 * Training Loss Target Ring + Error Shockwave Halo, Beat 5–6 Softmax Probability Chamber (with procedural
 * percentage badges & additive top-match crown sprite), and slow-drifting atmospheric motes.
 *
 * Budget discipline: <= 15 visible draw calls, <= 9,500 triangles, <= 10 unique materials.
 * Works cleanly in both headless Chrome (CanvasTexture) and pure Node.js preflight (typeof document === 'undefined').
 */
import * as THREE from 'three';
import {
  MaterialRegistry,
  createGlowSprite,
  getRadialGlowTexture,
  paintVertexColor,
  safeMerge,
} from '../engine/aiUtils.js';

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(e0, e1, x) {
  const u = clamp01((x - e0) / (e1 - e0));
  return u * u * (3 - 2 * u);
}

function createStageCalibrationTexture() {
  if (typeof document === 'undefined') return null;

  const size = 1024;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const cx = size * 0.5;
  const cy = size * 0.5;

  // Deep dark slate radial gradient base
  const bg = ctx.createRadialGradient(cx, cy, 40, cx, cy, 512);
  bg.addColorStop(0.0, '#0c1d34');
  bg.addColorStop(0.55, '#081426');
  bg.addColorStop(1.0, '#040914');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Subtle radial grid spokes
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 115, cy + Math.sin(a) * 115);
    ctx.lineTo(cx + Math.cos(a) * 488, cy + Math.sin(a) * 488);
    ctx.stroke();
  }
  ctx.restore();

  // Concentric calibrated cyan telemetry rings
  const rings = [
    { r: 492, color: 'rgba(56, 189, 248, 0.92)', width: 4.5, dash: null },
    { r: 462, color: 'rgba(14, 165, 233, 0.60)', width: 2.5, dash: [28, 16] },
    { r: 392, color: 'rgba(56, 189, 248, 0.42)', width: 2.0, dash: null },
    { r: 326, color: 'rgba(103, 232, 249, 0.54)', width: 2.8, dash: [14, 10] },
    { r: 235, color: 'rgba(56, 189, 248, 0.30)', width: 1.8, dash: null },
    { r: 132, color: 'rgba(125, 211, 252, 0.48)', width: 2.2, dash: null },
  ];
  for (const ring of rings) {
    ctx.save();
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = ring.width;
    if (ring.dash) ctx.setLineDash(ring.dash);
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 72 perimeter degree tick marks
  ctx.save();
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const isMajor = i % 6 === 0;
    const r0 = isMajor ? 464 : 476;
    const r1 = 488;
    ctx.strokeStyle = isMajor ? 'rgba(125, 211, 252, 0.85)' : 'rgba(56, 189, 248, 0.38)';
    ctx.lineWidth = isMajor ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();

  // Subtle center origin reticle
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 56, cy);
  ctx.lineTo(cx - 16, cy);
  ctx.moveTo(cx + 16, cy);
  ctx.lineTo(cx + 56, cy);
  ctx.moveTo(cx, cy - 56);
  ctx.lineTo(cx, cy - 16);
  ctx.moveTo(cx, cy + 16);
  ctx.lineTo(cx, cy + 56);
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createShockwaveRingTexture() {
  if (typeof document === 'undefined') return null;

  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const cx = size * 0.5;
  const cy = size * 0.5;

  const grad = ctx.createRadialGradient(cx, cy, 42, cx, cy, 128);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
  grad.addColorStop(0.32, 'rgba(255, 255, 255, 0.14)');
  grad.addColorStop(0.58, 'rgba(255, 255, 255, 0.42)');
  grad.addColorStop(0.78, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.90, 'rgba(255, 255, 255, 0.36)');
  grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function createSoftmaxBadgeAtlas(labels) {
  if (typeof document === 'undefined') return null;

  const slotSize = 256;
  const count = labels.length;
  const c = document.createElement('canvas');
  c.width = slotSize * count;
  c.height = slotSize;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);

  for (let i = 0; i < count; i++) {
    const label = labels[i];
    const isWinner = i === 2; // Center 92% column
    const x0 = i * slotSize;
    const px = x0 + 18;
    const py = 64;
    const pw = slotSize - 36;
    const ph = 128;

    ctx.save();
    drawRoundedRect(ctx, px, py, pw, ph, 30);

    if (isWinner) {
      const fill = ctx.createLinearGradient(px, py, px, py + ph);
      fill.addColorStop(0.0, 'rgba(12, 42, 74, 0.96)');
      fill.addColorStop(1.0, 'rgba(6, 20, 42, 0.96)');
      ctx.fillStyle = fill;
      ctx.fill();

      const stroke = ctx.createLinearGradient(px, py, px + pw, py + ph);
      stroke.addColorStop(0.0, '#FDE047');
      stroke.addColorStop(0.5, '#67E8F9');
      stroke.addColorStop(1.0, '#FBBF24');
      ctx.lineWidth = 7;
      ctx.strokeStyle = stroke;
      ctx.stroke();

      ctx.shadowColor = 'rgba(253, 224, 71, 0.55)';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 78px "DejaVu Sans", sans-serif';
    } else {
      ctx.fillStyle = 'rgba(7, 19, 36, 0.88)';
      ctx.fill();
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.78)';
      ctx.stroke();

      ctx.shadowColor = 'rgba(56, 189, 248, 0.35)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#E2E8F0';
      ctx.font = label.length >= 4 ? '800 62px "DejaVu Sans", sans-serif' : '800 72px "DejaVu Sans", sans-serif';
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x0 + slotSize * 0.5, py + ph * 0.52);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildHoloChamber(scene, registry, timeline) {
  const matReg = registry instanceof MaterialRegistry ? registry : new MaterialRegistry();
  const wc = timeline?.worldContract || {};

  const stageFloorY = Number.isFinite(wc.stageFloorY) ? wc.stageFloorY : -2.35;
  const attentionHaloY = Number.isFinite(wc.attentionHaloY) ? wc.attentionHaloY : 0.32;
  const attentionHaloRadius = Number.isFinite(wc.attentionHaloRadius) ? wc.attentionHaloRadius : 1.28;
  const lossGaugeY = Number.isFinite(wc.lossGaugeY) ? wc.lossGaugeY : 1.48;
  const softmaxDeckY = Number.isFinite(wc.softmaxDeckY) ? wc.softmaxDeckY : 1.66;
  const softmaxTopY = Number.isFinite(wc.softmaxTopY) ? wc.softmaxTopY : 2.48;

  const chamberGroup = new THREE.Group();
  chamberGroup.name = 'holoChamberGroup';
  scene.add(chamberGroup);

  // =========================================================================
  // 1. DARK SLATE RADIAL FLOOR PEDESTAL (y = stageFloorY = -2.35)
  // =========================================================================
  const slateMat = matReg.getStandard('holoChamberSlate', {
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.45,
    metalness: 0.56,
  });

  const rimParts = [];
  const profile = [
    new THREE.Vector2(0.0, -0.14),
    new THREE.Vector2(1.64, -0.14),
    new THREE.Vector2(1.64, -0.075),
    new THREE.Vector2(1.54, -0.024),
    new THREE.Vector2(1.44, -0.004),
    new THREE.Vector2(1.42, -0.015),
    new THREE.Vector2(0.0, -0.015),
  ];
  const plinthGeo = new THREE.LatheGeometry(profile, 48);
  paintVertexColor(plinthGeo, '#0c182c');
  rimParts.push(plinthGeo);

  // 8 subtle beveled perimeter stabilizer lugs
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const lug = new THREE.BoxGeometry(0.11, 0.042, 0.16);
    lug.translate(0, -0.032, 1.53);
    lug.rotateY(a);
    paintVertexColor(lug, i % 2 === 0 ? '#1b3858' : '#132842');
    rimParts.push(lug);
  }
  const mergedRimGeo = safeMerge(rimParts);
  rimParts.forEach((g) => g.dispose());

  const stagePedestalRim = new THREE.Mesh(mergedRimGeo, slateMat);
  stagePedestalRim.name = 'stagePedestalRim';
  stagePedestalRim.position.y = stageFloorY;
  stagePedestalRim.receiveShadow = true;
  chamberGroup.add(stagePedestalRim);

  const stageTex = createStageCalibrationTexture();
  const stagePlateMat = matReg.getStandard('holoStagePlate', {
    color: stageTex ? 0xffffff : 0x09172b,
    map: stageTex,
    emissive: stageTex ? 0x7dd3fc : 0x0c3c5e,
    emissiveMap: stageTex,
    emissiveIntensity: stageTex ? 0.72 : 0.48,
    roughness: 0.36,
    metalness: 0.48,
  });

  const plateGeo = new THREE.CircleGeometry(1.425, 48);
  plateGeo.rotateX(-Math.PI * 0.5);
  const stageCalibrationPlate = new THREE.Mesh(plateGeo, stagePlateMat);
  stageCalibrationPlate.name = 'stageCalibrationPlate';
  stageCalibrationPlate.position.y = stageFloorY;
  stageCalibrationPlate.receiveShadow = true;
  chamberGroup.add(stageCalibrationPlate);

  // =========================================================================
  // 2. TWIN COUNTER-ROTATING ATTENTION GYROSCOPE HALO RINGS (y = 0.32)
  // =========================================================================
  const attentionOuterMat = matReg.getStandard('attentionOuterMat', {
    color: 0xffffff,
    vertexColors: true,
    emissive: new THREE.Color('#0ea5e9'),
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.65,
  });

  const outerParts = [];
  const outerMain = new THREE.TorusGeometry(attentionHaloRadius, 0.019, 8, 64);
  outerMain.rotateX(Math.PI * 0.5);
  paintVertexColor(outerMain, '#7dd3fc');
  outerParts.push(outerMain);

  const outerHairline = new THREE.TorusGeometry(attentionHaloRadius + 0.055, 0.006, 6, 64);
  outerHairline.rotateX(Math.PI * 0.5);
  paintVertexColor(outerHairline, '#e0f2fe');
  outerParts.push(outerHairline);

  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const tick = new THREE.BoxGeometry(0.014, 0.012, 0.044);
    tick.translate(0, 0, attentionHaloRadius);
    tick.rotateY(a);
    paintVertexColor(tick, i % 6 === 0 ? '#fef08a' : '#bae6fd');
    outerParts.push(tick);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const clasp = new THREE.BoxGeometry(0.095, 0.038, 0.068);
    clasp.translate(0, 0, attentionHaloRadius);
    clasp.rotateY(a);
    paintVertexColor(clasp, '#fde047');
    outerParts.push(clasp);
  }
  const mergedOuterGeo = safeMerge(outerParts);
  outerParts.forEach((g) => g.dispose());

  const attentionOuterRing = new THREE.Mesh(mergedOuterGeo, attentionOuterMat);
  attentionOuterRing.name = 'attentionOuterRing';
  attentionOuterRing.position.set(0, attentionHaloY, 0);
  chamberGroup.add(attentionOuterRing);

  const attentionInnerMat = matReg.getStandard('attentionInnerMat', {
    color: 0xffffff,
    vertexColors: true,
    emissive: new THREE.Color('#38bdf8'),
    emissiveIntensity: 0.42,
    roughness: 0.24,
    metalness: 0.65,
  });

  const innerR = attentionHaloRadius - 0.105; // 1.175m -> >= 0.235m clear of Layer 1/2
  const innerParts = [];
  const innerMain = new THREE.TorusGeometry(innerR, 0.016, 8, 64);
  innerMain.rotateX(Math.PI * 0.5);
  paintVertexColor(innerMain, '#38bdf8');
  innerParts.push(innerMain);

  const innerHairline = new THREE.TorusGeometry(innerR - 0.048, 0.0055, 6, 64);
  innerHairline.rotateX(Math.PI * 0.5);
  paintVertexColor(innerHairline, '#e0f2fe');
  innerParts.push(innerHairline);

  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const tooth = new THREE.BoxGeometry(0.012, 0.01, 0.036);
    tooth.translate(0, 0, innerR);
    tooth.rotateY(a);
    paintVertexColor(tooth, '#e0f2fe');
    innerParts.push(tooth);
  }
  for (let i = 0; i < 4; i++) {
    const a = ((i + 0.5) / 4) * Math.PI * 2;
    const clasp = new THREE.BoxGeometry(0.078, 0.032, 0.056);
    clasp.translate(0, 0, innerR);
    clasp.rotateY(a);
    paintVertexColor(clasp, '#67e8f9');
    innerParts.push(clasp);
  }
  const mergedInnerGeo = safeMerge(innerParts);
  innerParts.forEach((g) => g.dispose());

  const attentionInnerRing = new THREE.Mesh(mergedInnerGeo, attentionInnerMat);
  attentionInnerRing.name = 'attentionInnerRing';
  attentionInnerRing.position.set(0, attentionHaloY, 0);
  chamberGroup.add(attentionInnerRing);

  // =========================================================================
  // 3. TRAINING LOSS TARGET RING & ERROR SHOCKWAVE HALO (y = lossGaugeY = 1.48)
  // =========================================================================
  const lossRingMat = matReg.getStandard('lossRingMat', {
    color: 0xffffff,
    vertexColors: true,
    emissive: new THREE.Color('#38bdf8'),
    emissiveIntensity: 0.3,
    roughness: 0.25,
    metalness: 0.58,
  });

  const lossParts = [];
  const lossMain = new THREE.TorusGeometry(0.79, 0.018, 8, 56);
  lossMain.rotateX(Math.PI * 0.5);
  paintVertexColor(lossMain, '#ffffff');
  lossParts.push(lossMain);

  const lossInner = new THREE.TorusGeometry(0.69, 0.007, 6, 56);
  lossInner.rotateX(Math.PI * 0.5);
  paintVertexColor(lossInner, '#e2e8f0');
  lossParts.push(lossInner);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const notch = new THREE.BoxGeometry(0.022, 0.016, 0.088);
    notch.translate(0, 0, 0.74);
    notch.rotateY(a);
    paintVertexColor(notch, '#ffffff');
    lossParts.push(notch);
  }
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    const pip = new THREE.BoxGeometry(0.018, 0.014, 0.028);
    pip.translate(0, 0, 0.822);
    pip.rotateY(a);
    paintVertexColor(pip, '#f1f5f9');
    lossParts.push(pip);
  }
  const mergedLossGeo = safeMerge(lossParts);
  lossParts.forEach((g) => g.dispose());

  const lossTargetRing = new THREE.Mesh(mergedLossGeo, lossRingMat);
  lossTargetRing.name = 'lossTargetRing';
  lossTargetRing.position.set(0, lossGaugeY, 0);
  chamberGroup.add(lossTargetRing);

  const shockTex = createShockwaveRingTexture();
  const lossShockwaveMat = matReg.getBasic('lossShockwaveMat', {
    color: new THREE.Color('#fb7185'),
    map: shockTex,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const shockGeo = new THREE.RingGeometry(0.42, 0.96, 48);
  shockGeo.rotateX(-Math.PI * 0.5);
  const lossShockwaveMesh = new THREE.Mesh(shockGeo, lossShockwaveMat);
  lossShockwaveMesh.name = 'lossShockwaveMesh';
  lossShockwaveMesh.position.set(0, lossGaugeY, 0);
  lossShockwaveMesh.visible = false;
  chamberGroup.add(lossShockwaveMesh);

  // =========================================================================
  // 4. BEAT 5 & 6 SOFTMAX PROBABILITY CHAMBER (y = 1.66 .. 2.48)
  // =========================================================================
  const softmaxGroup = new THREE.Group();
  softmaxGroup.name = 'softmaxChamberGroup';
  softmaxGroup.visible = false; // Strictly hidden for t < 20.15s
  chamberGroup.add(softmaxGroup);

  const softmaxCrystalMat = matReg.getStandard('softmaxCrystalMat', {
    color: 0xffffff,
    vertexColors: true,
    emissive: new THREE.Color('#0c4a6e'),
    emissiveIntensity: 0.28,
    roughness: 0.14,
    metalness: 0.18,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });

  const BAR_X = [-0.68, -0.34, 0.0, 0.34, 0.68];
  const BAR_LABELS = ['2%', '5%', '92%', '0.8%', '0.2%'];
  const TARGET_HEIGHTS = [0.11, 0.16, 0.78, 0.085, 0.065]; // Center 92% reaches 1.66 + 0.78 = 2.44!

  // Floating translucent base readout ring + bridge + 5 plinth seats (pivot centered at y=0, placed at softmaxDeckY)
  const deckParts = [];
  const deckOuter = new THREE.TorusGeometry(0.86, 0.017, 8, 56);
  deckOuter.rotateX(Math.PI * 0.5);
  paintVertexColor(deckOuter, '#38bdf8');
  deckParts.push(deckOuter);

  const deckInner = new THREE.TorusGeometry(0.77, 0.007, 6, 56);
  deckInner.rotateX(Math.PI * 0.5);
  paintVertexColor(deckInner, '#7dd3fc');
  deckParts.push(deckInner);

  const deckBridge = new THREE.BoxGeometry(1.56, 0.018, 0.23);
  deckBridge.translate(0, -0.01, 0);
  paintVertexColor(deckBridge, '#0c4a6e');
  deckParts.push(deckBridge);

  for (let i = 0; i < 5; i++) {
    const pad = new THREE.CylinderGeometry(0.112, 0.124, 0.02, 8);
    pad.translate(BAR_X[i], -0.005, 0);
    paintVertexColor(pad, i === 2 ? '#67e8f9' : '#1e5b88');
    deckParts.push(pad);
  }
  const mergedDeckGeo = safeMerge(deckParts);
  deckParts.forEach((g) => g.dispose());

  const softmaxDeckMesh = new THREE.Mesh(mergedDeckGeo, softmaxCrystalMat);
  softmaxDeckMesh.name = 'softmaxDeckMesh';
  softmaxDeckMesh.position.set(0, softmaxDeckY, 0);
  softmaxGroup.add(softmaxDeckMesh);

  // Unit-height faceted octagonal crystal column (base locked at y=0, tip at y=1)
  const barParts = [];
  const shaft = new THREE.CylinderGeometry(0.088, 0.096, 0.94, 8);
  shaft.translate(0, 0.47, 0);
  paintVertexColor(shaft, '#ffffff');
  barParts.push(shaft);
  const cap = new THREE.CylinderGeometry(0.06, 0.088, 0.06, 8);
  cap.translate(0, 0.97, 0);
  paintVertexColor(cap, '#ffffff');
  barParts.push(cap);
  const unitBarGeo = safeMerge(barParts);
  barParts.forEach((g) => g.dispose());

  // 6 instances: 0..4 are the 5 crystal columns, instance 5 is the luminous inner core inside X=0.0
  const softmaxBarsInstanced = new THREE.InstancedMesh(unitBarGeo, softmaxCrystalMat, 6);
  softmaxBarsInstanced.name = 'softmaxBarsInstanced';
  softmaxBarsInstanced.frustumCulled = false;
  softmaxGroup.add(softmaxBarsInstanced);

  const colColors = [
    new THREE.Color('#38bdf8'), // 2%
    new THREE.Color('#7dd3fc'), // 5%
    new THREE.Color('#67e8f9'), // 92% outer crystal
    new THREE.Color('#0ea5e9'), // 0.8%
    new THREE.Color('#0284c7'), // 0.2%
    new THREE.Color('#fde047'), // 92% inner gold core
  ];
  for (let i = 0; i < 6; i++) {
    softmaxBarsInstanced.setColorAt(i, colColors[i]);
  }
  if (softmaxBarsInstanced.instanceColor) softmaxBarsInstanced.instanceColor.needsUpdate = true;

  // 5 Front Percentage Label Badges sharing 1 CanvasTexture atlas + 1 material
  const badgeAtlasTex = createSoftmaxBadgeAtlas(BAR_LABELS);
  const softmaxBadgeMat = matReg.getBasic('softmaxBadgeMat', {
    color: badgeAtlasTex ? 0xffffff : 0x38bdf8,
    map: badgeAtlasTex,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });

  const softmaxBadges = [];
  const epsU = 0.002;
  for (let i = 0; i < 5; i++) {
    const isWinner = i === 2;
    const badgeSize = isWinner ? 0.30 : 0.23;
    const bgGeo = new THREE.PlaneGeometry(badgeSize, badgeSize);
    const uvAttr = bgGeo.attributes.uv;
    const u0 = i / 5 + epsU;
    const u1 = (i + 1) / 5 - epsU;
    for (let v = 0; v < uvAttr.count; v++) {
      const origU = uvAttr.getX(v);
      uvAttr.setX(v, lerp(u0, u1, origU));
    }
    uvAttr.needsUpdate = true;

    const badgeMesh = new THREE.Mesh(bgGeo, softmaxBadgeMat);
    badgeMesh.name = `softmaxBadge_${i}`;
    badgeMesh.position.set(BAR_X[i], softmaxDeckY + 0.14, isWinner ? 0.125 : 0.04);
    badgeMesh.visible = false;
    softmaxGroup.add(badgeMesh);
    softmaxBadges.push(badgeMesh);
  }

  // Top-match additive crown glow sprite above locked 92% column
  const topMatchCrownSprite = createGlowSprite('#fde047', 0.62, 0.0);
  topMatchCrownSprite.name = 'topMatchCrownSprite';
  topMatchCrownSprite.position.set(0, softmaxDeckY + TARGET_HEIGHTS[2] + 0.025, 0);
  softmaxGroup.add(topMatchCrownSprite);

  // =========================================================================
  // 5. SLOW-DRIFTING BACKGROUND ATMOSPHERIC MOTES (Points, 72 points)
  // =========================================================================
  const DUST_COUNT = 72;
  const dustPos = new Float32Array(DUST_COUNT * 3);
  const dustCol = new Float32Array(DUST_COUNT * 3);
  const dustPalette = [
    new THREE.Color('#38bdf8'),
    new THREE.Color('#7dd3fc'),
    new THREE.Color('#bae6fd'),
    new THREE.Color('#fde68a'),
  ];
  for (let i = 0; i < DUST_COUNT; i++) {
    // Deterministic Fibonacci-like distribution safely outside neural core (r >= 1.62)
    const u1 = ((i * 0.61803398875) % 1 + 1) % 1;
    const u2 = ((i * 0.38196601125 + 0.17) % 1 + 1) % 1;
    const u3 = ((i * 0.75487766625 + 0.43) % 1 + 1) % 1;
    const angle = u1 * Math.PI * 2;
    const radius = 1.62 + u2 * 1.85;
    const y = -2.15 + u3 * 5.05;

    dustPos[i * 3] = Math.cos(angle) * radius;
    dustPos[i * 3 + 1] = y;
    dustPos[i * 3 + 2] = Math.sin(angle) * radius;

    const c = dustPalette[i % 8 === 0 ? 3 : i % 3];
    dustCol[i * 3] = c.r;
    dustCol[i * 3 + 1] = c.g;
    dustCol[i * 3 + 2] = c.b;
  }

  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));

  const dustMat = new THREE.PointsMaterial({
    size: 0.048,
    map: getRadialGlowTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const dustPoints = new THREE.Points(dustGeo, dustMat);
  dustPoints.name = 'atmosphericDustPoints';
  chamberGroup.add(dustPoints);

  // =========================================================================
  // PRE-ALLOCATED UPDATE SCRATCH OBJECTS & ANCHORS
  // =========================================================================
  const tmpMatrix = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const tmpColorA = new THREE.Color();
  const tmpColorB = new THREE.Color();

  const COL_CYAN_COOL = new THREE.Color('#0ea5e9');
  const COL_CYAN_BRIGHT = new THREE.Color('#38bdf8');
  const COL_GOLD_BRIGHT = new THREE.Color('#f59e0b');
  const COL_CORAL = new THREE.Color('#f43f5e');
  const COL_ORANGE_HOT = new THREE.Color('#f97316');
  const COL_EMERALD = new THREE.Color('#10b981');
  const COL_GOLD_SOFT = new THREE.Color('#fbbf24');
  const COL_CRYSTAL_LOCK = new THREE.Color('#bae6fd');
  const COL_BAR_DIM = new THREE.Color('#1e3a5f');
  const COL_WHITE = new THREE.Color('#ffffff');

  const liveHeights = [0.11, 0.16, 0.78, 0.085, 0.065];
  const anchors = {
    stageBase: new THREE.Vector3(0, stageFloorY, 0),
    attentionHalo: new THREE.Vector3(0, attentionHaloY, 0),
    lossGauge: new THREE.Vector3(0, lossGaugeY, 0),
    softmaxDeck: new THREE.Vector3(0, softmaxDeckY, 0),
    topMatchBar: new THREE.Vector3(0, softmaxDeckY + TARGET_HEIGHTS[2] * 0.55, 0),
    topMatchCrown: new THREE.Vector3(0, softmaxDeckY + TARGET_HEIGHTS[2] + 0.025, 0),
  };

  function update(t = 0, state = {}) {
    const safeT = Number.isFinite(t) ? t : 0;
    const st = state || {};

    // 1. Subtle Stage Pedestal Rotation & Telemetry Pulse
    stageCalibrationPlate.rotation.y = safeT * 0.045;
    if (stageTex) {
      stagePlateMat.emissiveIntensity = 0.68 + 0.08 * Math.sin(safeT * 1.9);
    }

    // 2. Twin Counter-Rotating Attention Gyroscope Rings (flares gold-cyan in Beat 3: 10.2..15.4s)
    const attIn = smoothstep(9.95, 10.55, safeT);
    const attOut = 1.0 - smoothstep(15.1, 15.75, safeT);
    const rawAttFlare = clamp01(attIn * attOut);
    const attFlare = Number.isFinite(st.attentionEnergy)
      ? clamp01(Math.max(rawAttFlare, st.attentionEnergy))
      : rawAttFlare;

    // Sharp shimmer spikes at sfx_05 (10.25s) and sfx_06 (12.80s)
    const dt05 = safeT - 10.25;
    const dt06 = safeT - 12.8;
    const attPing =
      (dt05 >= 0 && dt05 < 1.2 ? Math.exp(-dt05 * 4.5) : 0) +
      (dt06 >= 0 && dt06 < 1.2 ? Math.exp(-dt06 * 4.5) : 0);

    const spinRate = 0.24 + attFlare * 0.62;
    attentionOuterRing.rotation.y = safeT * spinRate;
    attentionOuterRing.rotation.x = (0.14 + attFlare * 0.14) * Math.sin(safeT * 0.85);
    attentionOuterRing.rotation.z = (0.11 + attFlare * 0.12) * Math.cos(safeT * 0.72);

    attentionInnerRing.rotation.y = -safeT * (spinRate * 1.32);
    attentionInnerRing.rotation.x = -(0.16 + attFlare * 0.15) * Math.cos(safeT * 0.92);
    attentionInnerRing.rotation.z = (0.13 + attFlare * 0.13) * Math.sin(safeT * 0.78);

    const ringScale = 1.0 + attFlare * 0.028 + attPing * 0.022;
    attentionOuterRing.scale.setScalar(ringScale);
    attentionInnerRing.scale.setScalar(1.0 + attFlare * 0.022);

    attentionOuterMat.color.lerpColors(COL_WHITE, COL_GOLD_SOFT, attFlare * 0.85);
    attentionOuterMat.emissive.lerpColors(COL_CYAN_COOL, COL_GOLD_BRIGHT, attFlare);
    attentionOuterMat.emissiveIntensity = 0.34 + attFlare * 0.72 + attPing * 0.30;

    attentionInnerMat.color.lerpColors(COL_WHITE, COL_CYAN_BRIGHT, attFlare * 0.7);
    attentionInnerMat.emissive.lerpColors(COL_CYAN_COOL, COL_CYAN_BRIGHT, attFlare);
    attentionInnerMat.emissiveIntensity = 0.34 + attFlare * 0.75 + attPing * 0.28;

    // 3. Training Loss Target Ring + Radial Error Shockwave Halo (y = 1.48)
    // Standby (<15.4s) -> Anticipation (15.4..16.5s) -> Coral Error Pulse (16.5..17.6s) -> Emerald Backprop (17.6..20.5s)
    const warmUp = smoothstep(15.35, 16.45, safeT);
    const backpropU = smoothstep(17.58, 18.75, safeT);
    const postBeat4 = 1.0 - smoothstep(20.5, 21.5, safeT) * 0.35;

    if (safeT < 16.45) {
      lossRingMat.color.lerpColors(COL_WHITE, COL_ORANGE_HOT, warmUp * 0.45);
      lossRingMat.emissive.lerpColors(COL_CYAN_COOL, COL_ORANGE_HOT, warmUp * 0.75);
      lossRingMat.emissiveIntensity = 0.28 + warmUp * 0.42;
      lossTargetRing.scale.setScalar(1.0);
    } else if (safeT < 17.6) {
      const dtErr = Math.max(0, safeT - 16.5);
      const errThrob = 0.5 + 0.5 * Math.sin(dtErr * 16.0);
      lossRingMat.color.lerpColors(COL_CORAL, COL_ORANGE_HOT, errThrob * 0.45);
      lossRingMat.emissive.lerpColors(COL_CORAL, COL_ORANGE_HOT, errThrob * 0.45);
      lossRingMat.emissiveIntensity = 0.78 + 0.35 * Math.exp(-dtErr * 1.6) * errThrob;
      const pulseScale = 1.0 + 0.065 * Math.exp(-dtErr * 2.8) * (0.4 + 0.6 * Math.abs(Math.sin(dtErr * 11.0)));
      lossTargetRing.scale.setScalar(pulseScale);
    } else {
      lossRingMat.color.lerpColors(COL_CORAL, COL_EMERALD, backpropU);
      lossRingMat.emissive.lerpColors(COL_CORAL, COL_EMERALD, backpropU);
      const settlePulse = 0.25 * Math.exp(-Math.max(0, safeT - 17.65) * 2.2);
      lossRingMat.emissiveIntensity = lerp(0.85, 0.64, backpropU) * postBeat4 + settlePulse;
      lossTargetRing.scale.setScalar(lerp(1.03, 1.0, backpropU));
    }
    lossTargetRing.rotation.y = safeT * 0.32;

    // Expanding radial shockwave halo
    if (safeT >= 16.48 && safeT <= 17.65) {
      const u = clamp01((safeT - 16.48) / 1.12);
      const easeU = 1.0 - Math.pow(1.0 - u, 2.4);
      lossShockwaveMesh.visible = true;
      lossShockwaveMesh.scale.setScalar(lerp(0.78, 1.88, easeU));
      lossShockwaveMat.color.lerpColors(COL_ORANGE_HOT, COL_CORAL, u);
      lossShockwaveMat.opacity = clamp01(Math.sin(Math.min(1, u * 3.5) * Math.PI * 0.5) * Math.pow(1.0 - u, 1.35) * 0.95);
    } else if (safeT > 17.65 && safeT <= 19.15) {
      const u = clamp01((safeT - 17.65) / 1.45);
      const easeU = 1.0 - Math.pow(1.0 - u, 2.0);
      lossShockwaveMesh.visible = true;
      lossShockwaveMesh.scale.setScalar(lerp(0.84, 1.52, easeU));
      lossShockwaveMat.color.copy(COL_EMERALD);
      lossShockwaveMat.opacity = clamp01(Math.sin(u * Math.PI) * 0.55);
    } else {
      lossShockwaveMesh.visible = false;
      lossShockwaveMat.opacity = 0.0;
    }

    // 4. Beat 5 & 6 Softmax Probability Chamber (visible strictly when t >= 20.15s)
    if (safeT < 20.15) {
      softmaxGroup.visible = false;
      anchors.topMatchBar.set(0, softmaxDeckY + TARGET_HEIGHTS[2] * 0.55, 0);
      anchors.topMatchCrown.set(0, softmaxDeckY + TARGET_HEIGHTS[2] + 0.025, 0);
    } else {
      softmaxGroup.visible = true;

      const deckIn = smoothstep(20.15, 20.75, safeT);
      const barRise = smoothstep(20.6, 21.65, safeT);
      const lockU = smoothstep(23.05, 23.45, safeT);
      const competeWeight = (1.0 - lockU) * smoothstep(21.1, 21.65, safeT);

      softmaxDeckMesh.scale.set(
        lerp(0.55, 1.0, deckIn),
        lerp(0.55, 1.0, deckIn),
        lerp(0.55, 1.0, deckIn)
      );
      softmaxDeckMesh.rotation.y = Math.sin(safeT * 0.45) * 0.06;
      softmaxCrystalMat.opacity = lerp(0.05, 0.78, deckIn);
      softmaxCrystalMat.emissiveIntensity = 0.48 + lockU * 0.24 + (safeT >= 23.15 ? 0.22 * Math.exp(-(safeT - 23.15) * 4.5) : 0);

      // Compute live heights for all 5 probability columns
      for (let i = 0; i < 5; i++) {
        const osc = Math.sin(safeT * (4.2 + i * 1.1) + i * 1.7);
        const competitiveOffset =
          i === 2
            ? -0.22 * (1.0 - lockU) + 0.08 * osc * competeWeight
            : (0.14 + 0.06 * (i % 2)) * (0.5 + 0.5 * osc) * competeWeight;
        const rawH = (TARGET_HEIGHTS[i] + competitiveOffset) * barRise;
        liveHeights[i] = Math.max(0.012, rawH);

        tmpPos.set(BAR_X[i], softmaxDeckY, 0);
        tmpQuat.identity();
        const lockPop = i === 2 && safeT >= 23.15 ? 1.0 + 0.035 * Math.exp(-(safeT - 23.15) * 6.0) : 1.0;
        const barW = lerp(0.4, 1.0, deckIn) * lockPop;
        tmpScale.set(barW, liveHeights[i], barW);
        tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
        softmaxBarsInstanced.setMatrixAt(i, tmpMatrix);

        // Dim non-winners subtly as 92% locks
        if (i === 2) {
          tmpColorA.lerpColors(COL_CYAN_BRIGHT, COL_CRYSTAL_LOCK, lockU * 0.55);
        } else {
          tmpColorA.copy(colColors[i]).lerp(COL_BAR_DIM, lockU * 0.45);
        }
        softmaxBarsInstanced.setColorAt(i, tmpColorA);
      }

      // Instance 5: inner glowing gold-cyan energy spine inside the winning X=0.0 column
      const winnerH = liveHeights[2];
      const coreLockScale = 0.35 + lockU * 0.12;
      tmpPos.set(0, softmaxDeckY + 0.01, 0);
      tmpQuat.identity();
      tmpScale.set(coreLockScale, Math.max(0.01, winnerH * 0.94), coreLockScale);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      softmaxBarsInstanced.setMatrixAt(5, tmpMatrix);

      tmpColorB.lerpColors(COL_CYAN_BRIGHT, COL_GOLD_SOFT, lockU);
      softmaxBarsInstanced.setColorAt(5, tmpColorB);

      softmaxBarsInstanced.instanceMatrix.needsUpdate = true;
      if (softmaxBarsInstanced.instanceColor) softmaxBarsInstanced.instanceColor.needsUpdate = true;

      // Percentage badges fade in cleanly as bars stabilize
      const badgeAlpha = smoothstep(21.75, 22.95, safeT);
      softmaxBadgeMat.opacity = badgeAlpha;
      for (let i = 0; i < 5; i++) {
        const bm = softmaxBadges[i];
        bm.visible = badgeAlpha > 0.02;
        if (bm.visible) {
          const isWinner = i === 2;
          const by = isWinner
            ? softmaxDeckY + Math.max(0.16, winnerH - 0.15)
            : softmaxDeckY + liveHeights[i] + 0.078;
          bm.position.set(BAR_X[i], by, isWinner ? 0.125 : 0.04);
          const pop = isWinner && safeT >= 23.15 ? 1.0 + 0.08 * Math.exp(-(safeT - 23.15) * 6.5) : 1.0;
          bm.scale.setScalar((0.78 + 0.22 * badgeAlpha) * pop);
        }
      }

      // Top match crown glow sprite
      const crownY = softmaxDeckY + winnerH + 0.025;
      topMatchCrownSprite.position.set(0, crownY, 0);
      const lockBurst = safeT >= 23.15 ? Math.exp(-(safeT - 23.15) * 4.2) : 0;
      const crownAlpha = lockU * (0.82 + 0.12 * Math.sin(safeT * 3.8)) + lockBurst * 0.25;
      topMatchCrownSprite.visible = crownAlpha > 0.02;
      topMatchCrownSprite.material.opacity = clamp01(crownAlpha);
      topMatchCrownSprite.scale.setScalar(0.56 + 0.06 * Math.sin(safeT * 3.2) + lockBurst * 0.26);

      // Update live Softmax anchors
      anchors.topMatchBar.set(0, softmaxDeckY + winnerH * 0.58, 0);
      anchors.topMatchCrown.set(0, crownY, 0);
    }

    // 5. Slow-Drifting Background Atmospheric Dust Motes
    dustPoints.rotation.y = safeT * 0.036;
    dustPoints.position.y = Math.sin(safeT * 0.28) * 0.06;
    dustMat.opacity = 0.42 + 0.12 * smoothstep(25.8, 27.0, safeT);
  }

  function getAnchors() {
    return {
      stageBase: anchors.stageBase.clone(),
      attentionHalo: anchors.attentionHalo.clone(),
      lossGauge: anchors.lossGauge.clone(),
      softmaxDeck: anchors.softmaxDeck.clone(),
      topMatchBar: anchors.topMatchBar.clone(),
      topMatchCrown: anchors.topMatchCrown.clone(),
    };
  }

  // Initialize cleanly at t = 0
  update(0, {});

  return {
    chamberGroup,
    update,
    getAnchors,
  };
}
