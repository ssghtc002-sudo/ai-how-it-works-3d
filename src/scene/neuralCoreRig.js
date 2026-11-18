/**
 * 3D Neural Core & Tokenization Rig (/home/antigravity/ai-how-it-works-3d/src/scene/neuralCoreRig.js)
 *
 * Exports:
 *   buildNeuralCoreRig(scene, registry, timeline)
 *     -> { neuralGroup, update(t), getState(), getAnchors() }
 *
 * Architecture & Budgets:
 *   - Aligned with timeline.worldContract:
 *       rawInputCenterY = -1.85, tokenPrismY = -1.28,
 *       layer0Y = -0.78, layer1Y = -0.05, layer2Y = 0.68, layer3Y = 1.38,
 *       layerRadii = [0.84, 0.94, 0.92, 0.72], layerCounts = [8, 10, 10, 6] (34 neurons)
 *   - Draw calls: <= 12 meshes/sprites (well under <= 16 rig budget)
 *   - Triangles:  ~16,500 tris max (well under <= 20,000 rig budget)
 *   - Safe in pure headless Node.js (verify_scene.mjs) and headless Chrome WebGL.
 */
import * as THREE from 'three';
import {
  MaterialRegistry,
  safeMerge,
  createGlowSprite,
} from '../engine/aiUtils.js';

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(e0, e1, x) {
  if (Math.abs(e1 - e0) < 1e-6) return x >= e1 ? 1 : 0;
  const u = clamp01((x - e0) / (e1 - e0));
  return u * u * (3 - 2 * u);
}

function fract(x) {
  return x - Math.floor(x);
}

function hash01(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function initInstancedMesh(mesh, count, defaultColorHex = 0xffffff) {
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  const c = new THREE.Color(defaultColorHex);
  for (let i = 0; i < count; i++) {
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

export function buildNeuralCoreRig(scene, registry, timeline) {
  const reg = registry || new MaterialRegistry();
  const wc = timeline?.worldContract || {};

  const tokenPrismY = wc.tokenPrismY ?? -1.28;
  const layerYs = [
    wc.layer0Y ?? -0.78,
    wc.layer1Y ?? -0.05,
    wc.layer2Y ?? 0.68,
    wc.layer3Y ?? 1.38,
  ];
  const layerRadii =
    Array.isArray(wc.layerRadii) && wc.layerRadii.length === 4
      ? wc.layerRadii
      : [0.84, 0.94, 0.92, 0.72];
  const layerCounts =
    Array.isArray(wc.layerCounts) && wc.layerCounts.length === 4
      ? wc.layerCounts
      : [8, 10, 10, 6];
  const coreCenterArr = Array.isArray(wc.neuralCoreCenter)
    ? wc.neuralCoreCenter
    : [0.0, 0.30, 0.0];

  const neuralGroup = new THREE.Group();
  neuralGroup.name = 'NeuralCoreRig';
  if (scene) scene.add(neuralGroup);

  // ---------------------------------------------------------------------------
  // 1. Shared Materials (9 total across entire rig)
  // ---------------------------------------------------------------------------
  const matRawPacket = reg.getStandard('neural_raw_packet', {
    color: '#ffffff',
    roughness: 0.24,
    metalness: 0.14,
    emissive: '#0F172A',
    emissiveIntensity: 0.38,
  });

  const matLuminousInst = reg.getBasic('neural_luminous_inst', {
    color: '#ffffff',
  });

  const matPrismGlass = reg.getStandard('neural_prism_glass', {
    color: '#38BDF8',
    emissive: '#0EA5E9',
    emissiveIntensity: 1.15,
    roughness: 0.14,
    metalness: 0.24,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
  });

  const matPrismField = reg.getBasic('neural_prism_field', {
    color: '#22D3EE',
    transparent: true,
    opacity: 0.20,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const matPrismFrame = reg.getStandard('neural_prism_frame', {
    color: '#1E293B',
    emissive: '#0F172A',
    emissiveIntensity: 0.28,
    roughness: 0.28,
    metalness: 0.80,
  });

  const matShellInst = reg.getStandard('neural_shell_inst', {
    color: '#ffffff',
    emissive: '#0369A1',
    emissiveIntensity: 0.34,
    roughness: 0.15,
    metalness: 0.14,
    transparent: true,
    opacity: 0.30,
    depthWrite: false,
  });

  const matSynapseInst = reg.getBasic('neural_synapse_inst', {
    color: '#ffffff',
    transparent: true,
    opacity: 0.64,
    depthWrite: false,
  });

  const matAttentionRibbon = reg.getBasic('neural_attention_ribbon', {
    vertexColors: true,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // ---------------------------------------------------------------------------
  // 2. Beat 1 & 6: Tokenization Prism Ring (Y = -1.28)
  //    Anchor tokenPrism = [0.42, -1.28, 0.30] -> radial distance ~ 0.516m
  // ---------------------------------------------------------------------------
  const prismGroup = new THREE.Group();
  prismGroup.name = 'TokenizationPrism';
  prismGroup.position.set(0, tokenPrismY, 0);
  neuralGroup.add(prismGroup);

  // Inner + outer faceted crystalline prism ring + 12 radial optical prism teeth
  const prismRimParts = [];
  const innerTorus = new THREE.TorusGeometry(0.53, 0.052, 6, 24);
  innerTorus.rotateX(Math.PI * 0.5);
  prismRimParts.push(innerTorus);

  const outerTorus = new THREE.TorusGeometry(0.74, 0.036, 6, 24);
  outerTorus.rotateX(Math.PI * 0.5);
  prismRimParts.push(outerTorus);

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tooth = new THREE.CylinderGeometry(0.032, 0.054, 0.11, 3);
    tooth.rotateZ(Math.PI * 0.5);
    tooth.rotateY(-a);
    tooth.translate(Math.cos(a) * 0.635, 0, Math.sin(a) * 0.635);
    prismRimParts.push(tooth);
  }
  const prismRimGeo = safeMerge(prismRimParts);
  const prismRimMesh = new THREE.Mesh(prismRimGeo, matPrismGlass);
  prismRimMesh.name = 'TokenPrismCrystalRim';
  prismGroup.add(prismRimMesh);

  // Translucent laser scan lens inside prism ring
  const prismFieldGeo = new THREE.CylinderGeometry(0.71, 0.71, 0.014, 24);
  const prismFieldMesh = new THREE.Mesh(prismFieldGeo, matPrismField);
  prismFieldMesh.name = 'TokenPrismScanField';
  prismGroup.add(prismFieldMesh);

  // Dark slate gimbal mounting brackets around the prism
  const frameParts = [];
  for (let b = 0; b < 4; b++) {
    const baseA = (b / 4) * Math.PI * 2 + Math.PI * 0.25;
    const arc = new THREE.TorusGeometry(0.81, 0.024, 5, 10, Math.PI * 0.28);
    arc.rotateX(Math.PI * 0.5);
    arc.rotateY(baseA);
    frameParts.push(arc);

    const lug = new THREE.BoxGeometry(0.06, 0.095, 0.075);
    const lugA = baseA + Math.PI * 0.14;
    lug.rotateY(-lugA);
    lug.translate(Math.cos(lugA) * 0.81, 0, Math.sin(lugA) * 0.81);
    frameParts.push(lug);
  }
  const prismFrameGeo = safeMerge(frameParts);
  const prismFrameMesh = new THREE.Mesh(prismFrameGeo, matPrismFrame);
  prismFrameMesh.name = 'TokenPrismFrame';
  prismGroup.add(prismFrameMesh);

  // ---------------------------------------------------------------------------
  // 3. Raw Chaos Data Packets (28 InstancedMesh voxels, Y = -2.05 .. -1.35)
  //    & Aligned Vector Crystal Tokens (24 InstancedMesh prisms, Y = -1.26 .. -0.78)
  // ---------------------------------------------------------------------------
  const RAW_COUNT = 28;
  const rawGeo = new THREE.BoxGeometry(0.092, 0.092, 0.092);
  const rawPacketInst = initInstancedMesh(
    new THREE.InstancedMesh(rawGeo, matRawPacket, RAW_COUNT),
    RAW_COUNT,
    0xffffff
  );
  rawPacketInst.name = 'RawDataPackets';
  neuralGroup.add(rawPacketInst);

  const RAW_PALETTE = [
    new THREE.Color('#FB7185'), // coral
    new THREE.Color('#FBBF24'), // amber
    new THREE.Color('#A78BFA'), // violet
    new THREE.Color('#F472B6'), // magenta
    new THREE.Color('#34D399'), // mint
    new THREE.Color('#FB923C'), // orange
    new THREE.Color('#60A5FA'), // cobalt sky
  ];

  const rawConfigs = [];
  for (let i = 0; i < RAW_COUNT; i++) {
    // Anchor rawInput = [-0.52, -1.78, 0.25] -> bias first 4 packets near front-left intake
    const isHeroCluster = i < 5;
    const baseAngle = isHeroCluster
      ? 2.68 + (i - 2) * 0.22 // centered around atan2(0.25, -0.52) = 2.69 rad
      : (i / RAW_COUNT) * Math.PI * 2 + hash01(i * 3.1) * 0.45;
    const baseRadius = isHeroCluster
      ? 0.48 + hash01(i * 5.3) * 0.16
      : 0.26 + hash01(i * 7.7) * 0.46;

    rawConfigs.push({
      phase: isHeroCluster ? i * 0.17 : fract(i / RAW_COUNT + hash01(i * 11.3) * 0.3),
      speed: 0.34 + hash01(i * 13.7) * 0.12,
      baseAngle,
      baseRadius,
      spinRateX: (hash01(i * 17.1) - 0.5) * 4.4,
      spinRateY: (hash01(i * 19.9) - 0.5) * 4.8,
      spinRateZ: (hash01(i * 23.3) - 0.5) * 4.0,
      sx: 0.72 + hash01(i * 29.1) * 0.85,
      sy: 0.58 + hash01(i * 31.7) * 0.72,
      sz: 0.68 + hash01(i * 37.3) * 0.75,
      color: RAW_PALETTE[i % RAW_PALETTE.length],
    });
  }

  const TOKEN_COUNT = 24;
  const tokenGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.145, 6);
  const tokenCrystalInst = initInstancedMesh(
    new THREE.InstancedMesh(tokenGeo, matLuminousInst, TOKEN_COUNT),
    TOKEN_COUNT,
    0x38bdf8
  );
  tokenCrystalInst.name = 'AlignedVectorTokens';
  neuralGroup.add(tokenCrystalInst);

  const TOKEN_PALETTE = [
    new THREE.Color('#38BDF8'),
    new THREE.Color('#7DD3FC'),
    new THREE.Color('#22D3EE'),
    new THREE.Color('#BAE6FD'),
  ];

  // ---------------------------------------------------------------------------
  // 4. 4-Layer Neural Lattice (34 Neurons: [8, 10, 10, 6])
  // ---------------------------------------------------------------------------
  const neurons = [];
  const layerNeurons = [[], [], [], []];
  const layerAngleOffsets = [0.38, 0.08, 0.26, 0.48];

  for (let L = 0; L < 4; L++) {
    const count = layerCounts[L];
    const R = layerRadii[L];
    const y = layerYs[L];
    const offset = layerAngleOffsets[L];

    for (let j = 0; j < count; j++) {
      const theta = (j / count) * Math.PI * 2 + offset;
      const pos = new THREE.Vector3(Math.cos(theta) * R, y, Math.sin(theta) * R);
      const id = neurons.length;
      const node = {
        id,
        layer: L,
        slot: j,
        theta,
        radius: R,
        pos,
        isErrorNode: (L === 3 && (j === 1 || j === 2 || j === 4)) || (L === 2 && j % 3 === 1),
        isAttentionHub: (L <= 2 && j % 2 === 0),
        phase: hash01(id * 17.3) * Math.PI * 2,
      };
      neurons.push(node);
      layerNeurons[L].push(node);
    }
  }

  const NEURON_COUNT = neurons.length; // 34
  const coreGeo = new THREE.IcosahedronGeometry(0.064, 1);
  const neuronCoreInst = initInstancedMesh(
    new THREE.InstancedMesh(coreGeo, matLuminousInst, NEURON_COUNT),
    NEURON_COUNT,
    0x38bdf8
  );
  neuronCoreInst.name = 'NeuronCores';
  neuralGroup.add(neuronCoreInst);

  const shellGeo = new THREE.SphereGeometry(0.114, 10, 8);
  const neuronShellInst = initInstancedMesh(
    new THREE.InstancedMesh(shellGeo, matShellInst, NEURON_COUNT),
    NEURON_COUNT,
    0xbae6fd
  );
  neuronShellInst.name = 'NeuronIrisShells';
  neuralGroup.add(neuronShellInst);

  // Subtle architectural orbital layer guide rings through L0..L3
  const guideParts = [];
  for (let L = 0; L < 4; L++) {
    const ring = new THREE.TorusGeometry(layerRadii[L], 0.007, 5, 28);
    ring.rotateX(Math.PI * 0.5);
    ring.translate(0, layerYs[L], 0);
    guideParts.push(ring);
  }
  const layerGuideMesh = new THREE.Mesh(safeMerge(guideParts), matPrismGlass);
  layerGuideMesh.name = 'NeuralLayerGuides';
  neuralGroup.add(layerGuideMesh);

  // ---------------------------------------------------------------------------
  // 5. Weighted Synaptic Axons (~116) & Traveling Pulses (~116)
  // ---------------------------------------------------------------------------
  const synapses = [];
  const edgeKeys = new Set();

  function addSynapse(src, dst) {
    const key = `${src.id}->${dst.id}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);

    const idx = synapses.length;
    const midY = 0.5 * (src.pos.y + dst.pos.y);
    const dir = new THREE.Vector3().subVectors(dst.pos, src.pos);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(src.pos, dst.pos).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize()
    );

    // Classify pathway role for clear visual Backprop transformation in Beat 4
    const roleSeed = hash01(idx * 23.7 + src.id * 5.1 + dst.id * 11.9);
    let role = 'support';
    let initialWeight = 0.42 + roleSeed * 0.28;
    let targetWeight = 0.46 + hash01(idx * 41.3) * 0.22;

    if (roleSeed < 0.40) {
      // Optimal pathways: modest before training -> brighten & thicken strongly during Backprop
      role = 'optimal';
      initialWeight = 0.30 + hash01(idx * 7.1) * 0.25;
      targetWeight = 0.80 + hash01(idx * 13.9) * 0.20;
    } else if (roleSeed > 0.64) {
      // Wrong/noisy pathways: misleadingly thick & trigger coral error -> shrink during Backprop
      role = 'wrong';
      initialWeight = 0.58 + hash01(idx * 19.3) * 0.30;
      targetWeight = 0.14 + hash01(idx * 29.7) * 0.14;
    }

    synapses.push({
      id: idx,
      src,
      dst,
      mid,
      midY,
      len,
      quat,
      role,
      initialWeight,
      targetWeight,
      pulsePhase: hash01(idx * 47.3),
      pulseSpeed: 0.62 + hash01(idx * 53.1) * 0.32,
    });
  }

  function angularDiff(a, b) {
    let d = Math.abs(a - b) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    return d;
  }

  // L0 (8) -> L1 (10): 5 synapses per L0 node = 40 synapses
  for (const s of layerNeurons[0]) {
    const sorted = [...layerNeurons[1]].sort(
      (a, b) => angularDiff(s.theta, a.theta) - angularDiff(s.theta, b.theta)
    );
    // Pick 3 nearest + 2 deeper cross-chords for volumetric density
    const picks = [sorted[0], sorted[1], sorted[2], sorted[4], sorted[6]];
    for (const d of picks) addSynapse(s, d);
  }

  // L1 (10) -> L2 (10): 4 synapses per L1 node = 40 synapses
  for (const s of layerNeurons[1]) {
    const sorted = [...layerNeurons[2]].sort(
      (a, b) => angularDiff(s.theta, a.theta) - angularDiff(s.theta, b.theta)
    );
    const picks = [sorted[0], sorted[1], sorted[3], sorted[5]];
    for (const d of picks) addSynapse(s, d);
  }

  // L2 (10) -> L3 (6): 6 sources per L3 node = 36 synapses
  for (const d of layerNeurons[3]) {
    const sorted = [...layerNeurons[2]].sort(
      (a, b) => angularDiff(a.theta, d.theta) - angularDiff(b.theta, d.theta)
    );
    const picks = [sorted[0], sorted[1], sorted[2], sorted[3], sorted[5], sorted[7]];
    for (const s of picks) addSynapse(s, d);
  }

  const SYNAPSE_COUNT = synapses.length; // 116
  const synapseGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  const synapseInst = initInstancedMesh(
    new THREE.InstancedMesh(synapseGeo, matSynapseInst, SYNAPSE_COUNT),
    SYNAPSE_COUNT,
    0x38bdf8
  );
  synapseInst.name = 'WeightedSynapses';
  neuralGroup.add(synapseInst);

  const pulseGeo = new THREE.IcosahedronGeometry(0.035, 0);
  const pulseInst = initInstancedMesh(
    new THREE.InstancedMesh(pulseGeo, matLuminousInst, SYNAPSE_COUNT),
    SYNAPSE_COUNT,
    0x38bdf8
  );
  pulseInst.name = 'SynapticPulses';
  neuralGroup.add(pulseInst);

  // Pick a front-visible optimal synapse for weightedSynapses anchor
  let bestFrontSynapse = synapses[0];
  let bestFrontSynScore = -Infinity;
  for (const syn of synapses) {
    if (syn.src.layer === 1 && syn.role === 'optimal') {
      const score = syn.mid.z - Math.abs(syn.mid.x) * 0.25;
      if (score > bestFrontSynScore) {
        bestFrontSynScore = score;
        bestFrontSynapse = syn;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Beat 3 & 6: 16 Curved Golden-Cyan Attention Beams + 32 Tracing Beads
  // ---------------------------------------------------------------------------
  const attentionCurves = [];
  const ribbonGeos = [];
  const cGold = new THREE.Color('#FBBF24');
  const cPeak = new THREE.Color('#FEF08A');
  const cCyan = new THREE.Color('#38BDF8');
  const cMix = new THREE.Color();

  function buildAttentionArc(nodeA, nodeB, idx) {
    const p0 = nodeA.pos;
    const p2 = nodeB.pos;
    const mid = new THREE.Vector3().addVectors(p0, p2).multiplyScalar(0.5);
    const radialDir = new THREE.Vector3(mid.x, 0, mid.z);
    if (radialDir.lengthSq() < 1e-4) {
      radialDir.set(Math.cos(idx * 0.7), 0, Math.sin(idx * 0.7));
    }
    radialDir.normalize();

    // Alternate outer sweeping arcs (staying cleanly inside attentionHaloRadius 1.28)
    // and interior catenary cross-lattice arches
    const sweepOut = idx % 2 === 0;
    const p1 = sweepOut
      ? radialDir.clone().multiplyScalar(1.08).setY(mid.y + 0.14)
      : mid.clone().multiplyScalar(0.32).setY(mid.y + 0.24);

    const curve = new THREE.QuadraticBezierCurve3(p0.clone(), p1, p2.clone());
    attentionCurves.push({ curve, phase: hash01(idx * 31.7) });

    const tube = new THREE.TubeGeometry(curve, 12, 0.013, 5, false);
    const posAttr = tube.attributes.position;
    const count = posAttr.count;
    const colors = new Float32Array(count * 3);
    const flip = idx % 2 === 1;

    // TubeGeometry creates (tubularSegments + 1) rings of (radialSegments + 1) vertices
    const ringVerts = 6; // radialSegments(5) + 1
    const rings = 13;    // tubularSegments(12) + 1
    for (let v = 0; v < count; v++) {
      const ringIdx = Math.min(rings - 1, Math.floor(v / ringVerts));
      const u = ringIdx / (rings - 1);
      const tGrad = flip ? 1 - u : u;
      if (tGrad < 0.5) {
        cMix.lerpColors(cGold, cPeak, tGrad * 2.0);
      } else {
        cMix.lerpColors(cPeak, cCyan, (tGrad - 0.5) * 2.0);
      }
      colors[v * 3] = cMix.r;
      colors[v * 3 + 1] = cMix.g;
      colors[v * 3 + 2] = cMix.b;
    }
    tube.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    ribbonGeos.push(tube);
  }

  // 8 symmetric L0 <-> L2 distant attention arcs + 8 symmetric L1 <-> L1/L2 arcs = 16 arcs
  for (let i = 0; i < 8; i++) {
    const a = layerNeurons[0][i];
    const bIdx = Math.floor(((i + 3) % 8) * (10 / 8)) % 10;
    const b = layerNeurons[2][bIdx];
    buildAttentionArc(a, b, i);
  }
  for (let i = 0; i < 8; i++) {
    const aIdx = (i * 1) % 10;
    const bIdx = (i + 4) % 10;
    const a = layerNeurons[1][aIdx];
    const b = i % 2 === 0 ? layerNeurons[2][bIdx] : layerNeurons[1][(i + 5) % 10];
    buildAttentionArc(a, b, 8 + i);
  }

  const attentionRibbonGeo = safeMerge(ribbonGeos);
  const attentionRibbonMesh = new THREE.Mesh(attentionRibbonGeo, matAttentionRibbon);
  attentionRibbonMesh.name = 'AttentionArcRibbons';
  attentionRibbonMesh.visible = false;
  neuralGroup.add(attentionRibbonMesh);

  // Pick a prominent front-facing mid-height attention curve midpoint for attentionLinks anchor
  let bestFrontCurve = attentionCurves[0].curve;
  let bestCurveScore = -Infinity;
  const probeVec = new THREE.Vector3();
  for (const ac of attentionCurves) {
    ac.curve.getPoint(0.5, probeVec);
    const score = probeVec.z - Math.abs(probeVec.y - 0.32) * 0.45;
    if (score > bestCurveScore) {
      bestCurveScore = score;
      bestFrontCurve = ac.curve;
    }
  }
  const frontAttentionMid = bestFrontCurve.getPoint(0.5, new THREE.Vector3());

  const ATT_BEAD_COUNT = attentionCurves.length * 2; // 32
  const attBeadGeo = new THREE.OctahedronGeometry(0.032, 0);
  const attentionBeadInst = initInstancedMesh(
    new THREE.InstancedMesh(attBeadGeo, matLuminousInst, ATT_BEAD_COUNT),
    ATT_BEAD_COUNT,
    0xfbbf24
  );
  attentionBeadInst.name = 'AttentionTracingBeads';
  attentionBeadInst.visible = false;
  neuralGroup.add(attentionBeadInst);

  // ---------------------------------------------------------------------------
  // 7. Optical Core Glow Sprite (1 sprite = 1 material, shifts color with beat)
  // ---------------------------------------------------------------------------
  const coreGlowSprite = createGlowSprite('#38BDF8', 2.55, 0.42);
  coreGlowSprite.name = 'NeuralCoreGlow';
  coreGlowSprite.position.set(coreCenterArr[0], coreCenterArr[1], coreCenterArr[2]);
  neuralGroup.add(coreGlowSprite);

  // ---------------------------------------------------------------------------
  // 8. Anchors & State Objects + Pre-allocated Scratch Vars
  // ---------------------------------------------------------------------------
  // Find front-visible L0 neuron & front-visible L1/L2 hidden neuron for anchors
  let frontL0 = layerNeurons[0][0];
  let frontL1 = layerNeurons[1][0];
  let bestZ0 = -Infinity;
  let bestZ1 = -Infinity;
  for (const n of layerNeurons[0]) {
    const score = n.pos.z - Math.abs(n.pos.x) * 0.25;
    if (score > bestZ0) { bestZ0 = score; frontL0 = n; }
  }
  for (const n of layerNeurons[2]) {
    const score = n.pos.z - Math.abs(n.pos.x) * 0.25;
    if (score > bestZ1) { bestZ1 = score; frontL1 = n; }
  }

  const anchors = {
    rawInput: new THREE.Vector3(-0.52, -1.78, 0.25),
    tokenPrism: new THREE.Vector3(0.42, tokenPrismY, 0.30),
    tokenVectors: new THREE.Vector3(-0.55, layerYs[0], 0.20),
    layerInput: frontL0.pos.clone(),
    weightedSynapses: bestFrontSynapse.mid.clone(),
    hiddenLayers: frontL1.pos.clone(),
    attentionLinks: frontAttentionMid.clone(),
    backpropWave: new THREE.Vector3(0.56, layerYs[2], 0.64),
    neuralCoreCenter: new THREE.Vector3(coreCenterArr[0], coreCenterArr[1], coreCenterArr[2]),
  };

  const state = {
    t: 0,
    beatId: 'beat_1_data_tokens',
    tokenFlowActive: true,
    tokensAlignedCount: 0,
    prismEnergy: 0,
    forwardPulseIntensity: 0,
    attentionActive: 0,
    errorPulse: 0,
    backpropProgress: 0,
    backpropWaveY: layerYs[3],
    learningConverged: 0,
    coreCoherence: 0,
    neuronCount: NEURON_COUNT,
    synapseCount: SYNAPSE_COUNT,
    attentionArcCount: attentionCurves.length,
  };

  // Scratch objects (zero per-frame allocations)
  const tmpPos = new THREE.Vector3();
  const tmpScale = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpEuler = new THREE.Euler();
  const tmpMat = new THREE.Matrix4();
  const tmpColor = new THREE.Color();
  const tmpColor2 = new THREE.Color();

  const colSkyCyan = new THREE.Color('#38BDF8');
  const colBrightCyan = new THREE.Color('#7DD3FC');
  const colWhiteCyan = new THREE.Color('#E0F2FE');
  const colDeepSlate = new THREE.Color('#1E3A5F');
  const colShellIce = new THREE.Color('#BAE6FD');
  const colCoral = new THREE.Color('#FB7185');
  const colAmber = new THREE.Color('#F59E0B');
  const colEmerald = new THREE.Color('#10B981');
  const colMint = new THREE.Color('#34D399');
  const colMintGlow = new THREE.Color('#A7F3D0');
  const colGold = new THREE.Color('#FBBF24');
  const colTeal = new THREE.Color('#2DD4BF');

  function findBeatId(t) {
    const beats = timeline?.beats;
    if (Array.isArray(beats)) {
      for (let i = 0; i < beats.length; i++) {
        if (t >= beats[i].start && (t < beats[i].end || i === beats.length - 1)) {
          return beats[i].id;
        }
      }
    }
    if (t < 5.0) return 'beat_1_data_tokens';
    if (t < 10.2) return 'beat_2_neural_layers';
    if (t < 15.4) return 'beat_3_attention_context';
    if (t < 20.6) return 'beat_4_training_backprop';
    if (t < 25.8) return 'beat_5_probability_output';
    return 'beat_6_intelligence_recap';
  }

  // ---------------------------------------------------------------------------
  // 9. Per-Frame Deterministic Update(t)
  // ---------------------------------------------------------------------------
  function update(t = 0) {
    const time = Number.isFinite(t) ? t : 0;
    state.t = time;
    state.beatId = findBeatId(time);

    // Beat envelopes
    const beat1Vis = 1.0 - smoothstep(4.95, 5.65, time);
    const beat6Vis = smoothstep(25.40, 26.20, time);
    const intakeWeight = Math.max(beat1Vis, beat6Vis, 0.25); // keep subtle ambient flow mid-video
    const prismSplitBurst = Math.exp(-Math.pow((time - 2.20) / 0.65, 2));

    const forwardLatticeEnv = smoothstep(4.6, 5.4, time);
    const attentionBeat3 =
      smoothstep(10.10, 10.65, time) * (1.0 - smoothstep(15.05, 15.60, time));
    const attentionBeat6 = smoothstep(25.60, 26.50, time) * 0.55;
    const attentionEnv = Math.max(attentionBeat3, attentionBeat6);

    // Beat 4 phases:
    //   15.4..16.7s -> coral forward guess surge
    //   16.5..17.6s -> top error ring/L3 coral peak
    //   17.6..20.5s -> radiant emerald backpropagation sweeping downward L3 -> L0
    const coralForwardEnv =
      smoothstep(15.35, 15.70, time) * (1.0 - smoothstep(17.35, 17.85, time));
    const errorPeakEnv =
      smoothstep(16.25, 16.65, time) * (1.0 - smoothstep(17.55, 18.10, time));
    const backpropActiveEnv =
      smoothstep(17.50, 17.80, time) * (1.0 - smoothstep(20.30, 20.75, time));

    // Wave descends from y = 1.50 (above L3) down to y = -0.92 (below L0) across 17.6..20.5s
    const bpU = clamp01((time - 17.60) / (20.50 - 17.60));
    const backpropWaveY =
      time < 17.60
        ? layerYs[3] + 0.14
        : time > 20.50
        ? layerYs[0] - 0.16
        : lerp(layerYs[3] + 0.14, layerYs[0] - 0.16, bpU);
    const convergedGlobal = smoothstep(17.60, 20.50, time);
    const coherenceEnv = smoothstep(20.50, 21.40, time);

    // -------------------------------------------------------------------------
    // A. Tokenization Prism Animation (Y = -1.28)
    // -------------------------------------------------------------------------
    prismRimMesh.rotation.y = time * 0.72;
    prismFrameMesh.rotation.y = -time * 0.28;
    prismGroup.position.y = tokenPrismY + Math.sin(time * 2.2) * 0.008;

    const prismEnergy = clamp01(
      0.42 + 0.48 * intakeWeight + 0.45 * prismSplitBurst + 0.18 * Math.sin(time * 4.5)
    );
    matPrismGlass.emissiveIntensity = 0.85 + prismEnergy * 0.72;
    matPrismField.opacity = 0.14 + prismEnergy * 0.20;

    // -------------------------------------------------------------------------
    // B. 28 Chaotic Raw Data Packets (Y = -2.05 .. -1.28)
    // -------------------------------------------------------------------------
    let alignedCount = 0;
    for (let i = 0; i < RAW_COUNT; i++) {
      const cfg = rawConfigs[i];
      const u = fract(cfg.phase + time * cfg.speed);
      // Map u in [0..1] from raw chaos region (-2.05 .. -1.35) up into prism (-1.28)
      const y = lerp(-2.06, tokenPrismY + 0.02, Math.pow(u, 0.92));

      // Swirl inward toward prism rim radius as packet nears -1.28
      const funnel = smoothstep(0.45, 0.98, u);
      const r = lerp(cfg.baseRadius, 0.48 + (i % 3) * 0.06, funnel);
      const a = cfg.baseAngle + time * (0.45 + 0.25 * (i % 3)) + funnel * 1.15;

      const jitterX = (1 - funnel) * Math.sin(time * 2.6 + i * 1.7) * 0.055;
      const jitterZ = (1 - funnel) * Math.cos(time * 2.3 + i * 2.1) * 0.055;

      tmpPos.set(Math.cos(a) * r + jitterX, y, Math.sin(a) * r + jitterZ);
      tmpEuler.set(
        time * cfg.spinRateX + i,
        time * cfg.spinRateY + i * 0.5,
        time * cfg.spinRateZ
      );
      tmpQuat.setFromEuler(tmpEuler);

      // Fade in smoothly from bottom and pinch cleanly into prism scan plane
      const birthScale = smoothstep(0.0, 0.14, u);
      const absorbScale = 1.0 - smoothstep(0.84, 1.0, u);
      const sMult = Math.max(0.0001, birthScale * absorbScale * intakeWeight * (1.0 + 0.15 * prismSplitBurst));
      tmpScale.set(cfg.sx * sMult, cfg.sy * sMult, cfg.sz * sMult);

      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      rawPacketInst.setMatrixAt(i, tmpMat);
      rawPacketInst.setColorAt(i, cfg.color);
    }
    rawPacketInst.instanceMatrix.needsUpdate = true;
    if (rawPacketInst.instanceColor) rawPacketInst.instanceColor.needsUpdate = true;

    // -------------------------------------------------------------------------
    // C. 24 Aligned Sky-Cyan Vector Crystal Tokens (Y = -1.26 .. -0.78)
    // -------------------------------------------------------------------------
    for (let k = 0; k < TOKEN_COUNT; k++) {
      const l0Node = layerNeurons[0][k % layerCounts[0]];
      const cycle = fract(k / TOKEN_COUNT + time * (0.42 + 0.12 * prismSplitBurst));

      // Only emerge once prism has warmed slightly (t > 0.45s) or during Beat 6
      const appearGate = smoothstep(0.35, 1.05, time);
      const y = lerp(tokenPrismY + 0.03, layerYs[0] - 0.02, cycle);
      // Funnel radially from prism rim (~0.50m) through tokenVectors (~0.58m) smoothly outward to L0 neuron radius (0.84m)
      const startR = 0.50 + (k % 2) * 0.05;
      const r = lerp(startR, l0Node.radius * 0.96, Math.pow(smoothstep(0.0, 0.96, cycle), 1.45));
      const a = l0Node.theta + (1.0 - cycle) * 0.16;

      tmpPos.set(Math.cos(a) * r, y, Math.sin(a) * r);
      tmpEuler.set(0, -a + time * 1.6 + k * 0.3, 0);
      tmpQuat.setFromEuler(tmpEuler);

      const fadeIn = smoothstep(0.0, 0.14, cycle);
      const enterL0 = 1.0 - smoothstep(0.86, 1.0, cycle);
      const vis = Math.max(0.0001, fadeIn * enterL0 * appearGate * intakeWeight);
      if (vis > 0.15) alignedCount++;

      tmpScale.set(0.82 * vis, (0.95 + 0.25 * prismSplitBurst) * vis, 0.82 * vis);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      tokenCrystalInst.setMatrixAt(k, tmpMat);

      tmpColor.copy(TOKEN_PALETTE[k % TOKEN_PALETTE.length]);
      if (prismSplitBurst > 0.1) tmpColor.lerp(colWhiteCyan, prismSplitBurst * 0.45);
      tokenCrystalInst.setColorAt(k, tmpColor);
    }
    tokenCrystalInst.instanceMatrix.needsUpdate = true;
    if (tokenCrystalInst.instanceColor) tokenCrystalInst.instanceColor.needsUpdate = true;

    // -------------------------------------------------------------------------
    // D. 34 Neurons (Cores + Frosted Glass Iris Shells)
    // -------------------------------------------------------------------------
    for (let i = 0; i < NEURON_COUNT; i++) {
      const n = neurons[i];
      const y = n.pos.y;

      // Layer activation timing across beats
      const beat1L0Active = n.layer === 0 ? smoothstep(1.2, 2.8, time) : 0.25;
      const beat2Cascade = smoothstep(4.9 + n.layer * 0.65, 5.8 + n.layer * 0.65, time);
      const baseActivity = Math.max(beat1L0Active, beat2Cascade);

      const wavePulse = 0.5 + 0.5 * Math.sin(time * 4.4 - n.layer * 1.15 + n.phase);
      const bpBand =
        backpropActiveEnv * Math.exp(-Math.pow((backpropWaveY - y) / 0.36, 2));
      const errBand =
        errorPeakEnv * (n.layer === 3 ? 1.0 : n.layer === 2 ? 0.55 : 0.15);
      const coralSurge = coralForwardEnv * (n.isErrorNode ? 0.95 : 0.40);

      // Core scale & color
      const corePulse =
        0.72 +
        0.34 * baseActivity +
        0.22 * wavePulse * forwardLatticeEnv +
        0.38 * bpBand +
        0.32 * errBand +
        0.16 * attentionEnv * (n.isAttentionHub ? 1.0 : 0.2);

      tmpPos.copy(n.pos);
      tmpQuat.identity();
      tmpScale.setScalar(corePulse);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      neuronCoreInst.setMatrixAt(i, tmpMat);

      tmpColor.copy(colSkyCyan).lerp(colBrightCyan, 0.35 + 0.35 * wavePulse);
      if (attentionEnv > 0.01 && n.isAttentionHub) {
        tmpColor.lerp(colGold, attentionEnv * 0.72);
      }
      if (coralSurge > 0.01 || errBand > 0.01) {
        tmpColor.lerp(colCoral, clamp01(Math.max(coralSurge * 0.78, errBand * 0.95)));
      }
      if (bpBand > 0.01) {
        tmpColor.lerp(colMintGlow, clamp01(bpBand * 0.95));
      } else if (coherenceEnv > 0.01) {
        tmpColor2.copy(colTeal).lerp(colWhiteCyan, 0.35 + 0.35 * wavePulse);
        tmpColor.lerp(tmpColor2, coherenceEnv * 0.68);
      }
      neuronCoreInst.setColorAt(i, tmpColor);

      // Outer frosted iris shell
      const shellPulse =
        0.92 +
        0.14 * wavePulse * baseActivity +
        0.22 * bpBand +
        0.18 * errBand;
      tmpScale.setScalar(shellPulse);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      neuronShellInst.setMatrixAt(i, tmpMat);

      tmpColor.copy(colShellIce);
      if (attentionEnv > 0.01 && n.isAttentionHub) {
        tmpColor.lerp(colGold, attentionEnv * 0.45);
      }
      if (errBand > 0.01 || coralSurge > 0.01) {
        tmpColor.lerp(colCoral, clamp01(Math.max(errBand * 0.85, coralSurge * 0.55)));
      }
      if (bpBand > 0.01) {
        tmpColor.lerp(colEmerald, clamp01(bpBand * 0.90));
      } else if (coherenceEnv > 0.01) {
        tmpColor.lerp(colBrightCyan, coherenceEnv * 0.45);
      }
      neuronShellInst.setColorAt(i, tmpColor);
    }
    neuronCoreInst.instanceMatrix.needsUpdate = true;
    if (neuronCoreInst.instanceColor) neuronCoreInst.instanceColor.needsUpdate = true;
    neuronShellInst.instanceMatrix.needsUpdate = true;
    if (neuronShellInst.instanceColor) neuronShellInst.instanceColor.needsUpdate = true;

    // -------------------------------------------------------------------------
    // E. 116 Weighted Synapses & 116 Bi-Directional Energy Pulses
    // -------------------------------------------------------------------------
    const isReverseFlow = time >= 17.58 && time <= 20.52;

    for (let i = 0; i < SYNAPSE_COUNT; i++) {
      const syn = synapses[i];

      // Local backpropagation sweep progress across this synapse
      const localTuneU =
        time < 17.60
          ? 0.0
          : time > 20.50
          ? 1.0
          : 1.0 - smoothstep(syn.midY - 0.28, syn.midY + 0.28, backpropWaveY);

      const bpWaveGlow =
        backpropActiveEnv * Math.exp(-Math.pow((backpropWaveY - syn.midY) / 0.28, 2));

      const w = lerp(syn.initialWeight, syn.targetWeight, localTuneU);

      // Coral guess surge temporarily inflates wrong synapses before backprop prunes them
      const wrongFlare =
        syn.role === 'wrong' ? coralForwardEnv * (1.0 - localTuneU) * 0.0055 : 0.0;
      const bpFlare = bpWaveGlow * (syn.role === 'wrong' ? 0.003 : 0.0065);
      const radius = 0.0042 + w * 0.0145 + wrongFlare + bpFlare;

      tmpScale.set(radius, syn.len, radius);
      tmpMat.compose(syn.mid, syn.quat, tmpScale);
      synapseInst.setMatrixAt(i, tmpMat);

      // Synapse color logic across beats
      if (syn.role === 'wrong' && localTuneU > 0.5) {
        tmpColor.copy(colDeepSlate).lerp(colSkyCyan, 0.25);
      } else {
        tmpColor.copy(colDeepSlate).lerp(colSkyCyan, 0.45 + 0.55 * w);
      }

      if (coralForwardEnv > 0.01 && syn.role === 'wrong') {
        tmpColor.lerp(colCoral, coralForwardEnv * (1.0 - localTuneU) * 0.92);
      } else if (errorPeakEnv > 0.01 && syn.src.layer === 2) {
        tmpColor.lerp(colCoral, errorPeakEnv * 0.65);
      }

      if (attentionEnv > 0.01 && syn.role === 'optimal') {
        tmpColor.lerp(colGold, attentionEnv * 0.35);
      }

      if (bpWaveGlow > 0.01) {
        tmpColor.lerp(colMint, clamp01(bpWaveGlow * 0.98));
      } else if (localTuneU > 0.01 && syn.role === 'optimal') {
        tmpColor2.copy(colTeal).lerp(colBrightCyan, 0.50);
        tmpColor.lerp(tmpColor2, localTuneU * 0.85);
      }
      synapseInst.setColorAt(i, tmpColor);

      // Traveling energy bead along the synapse
      let travelU;
      if (isReverseFlow) {
        // Reverse downward from dst (L3) -> src (L0)!
        travelU = 1.0 - fract(syn.pulsePhase + time * (syn.pulseSpeed * 1.45));
      } else {
        // Forward upward from src (L0) -> dst (L3)
        travelU = fract(syn.pulsePhase + time * syn.pulseSpeed);
      }

      tmpPos.lerpVectors(syn.src.pos, syn.dst.pos, travelU);
      tmpQuat.identity();

      // Determine pulse visibility & size by beat and pathway weight
      let pulseAmp = 0.0;
      if (time < 5.0) {
        pulseAmp = syn.src.layer === 0 ? smoothstep(2.2, 4.4, time) * 0.55 : 0.18;
      } else if (isReverseFlow) {
        // Strong radiant emerald downward wave near backpropWaveY & along active links
        const nearFront = 0.55 + 0.85 * Math.exp(-Math.pow((backpropWaveY - tmpPos.y) / 0.48, 2));
        pulseAmp = (syn.role === 'wrong' ? 0.65 * (1.0 - localTuneU * 0.7) : 1.15) * nearFront;
      } else if (coralForwardEnv > 0.01) {
        // Forward noisy guess highlights wrong/noisy pathways in coral
        pulseAmp = syn.role === 'wrong' ? 1.25 : 0.72;
      } else {
        // Beats 2, 3, 5, 6 forward pulses scale cleanly with learned weight
        const weightFactor = 0.35 + 0.90 * w;
        pulseAmp =
          (syn.role === 'wrong' && localTuneU > 0.6 ? 0.25 : weightFactor) *
          (0.85 + 0.25 * forwardLatticeEnv);
      }

      const pScale = Math.max(0.0001, (0.58 + 0.55 * w) * pulseAmp);
      tmpScale.setScalar(pScale);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      pulseInst.setMatrixAt(i, tmpMat);

      if (isReverseFlow) {
        tmpColor.copy(colEmerald).lerp(colMintGlow, 0.55 + 0.40 * bpWaveGlow);
      } else if (coralForwardEnv > 0.01 && (syn.role === 'wrong' || errorPeakEnv > 0.25)) {
        tmpColor.copy(colCoral).lerp(colAmber, 0.25 * (1 - errorPeakEnv));
      } else if (attentionEnv > 0.01 && i % 3 === 0) {
        tmpColor.copy(colGold).lerp(colBrightCyan, 0.35);
      } else if (coherenceEnv > 0.01 && syn.role === 'optimal') {
        tmpColor.copy(colTeal).lerp(colWhiteCyan, 0.62);
      } else {
        tmpColor.copy(colSkyCyan).lerp(colWhiteCyan, 0.45 * w);
      }
      pulseInst.setColorAt(i, tmpColor);
    }
    synapseInst.instanceMatrix.needsUpdate = true;
    if (synapseInst.instanceColor) synapseInst.instanceColor.needsUpdate = true;
    pulseInst.instanceMatrix.needsUpdate = true;
    if (pulseInst.instanceColor) pulseInst.instanceColor.needsUpdate = true;

    // -------------------------------------------------------------------------
    // F. 16 Curved Golden-Cyan Attention Beams & 32 Tracing Beads (Beat 3 & 6)
    // -------------------------------------------------------------------------
    const showAttention = attentionEnv > 0.02;
    attentionRibbonMesh.visible = showAttention;
    attentionBeadInst.visible = showAttention;

    if (showAttention) {
      const shimmer = 0.88 + 0.12 * Math.sin(time * 5.6);
      matAttentionRibbon.opacity = clamp01(attentionEnv * 0.82 * shimmer);

      for (let i = 0; i < attentionCurves.length; i++) {
        const ac = attentionCurves[i];
        for (let d = 0; d < 2; d++) {
          const instIdx = i * 2 + d;
          const rawU = fract(ac.phase + time * 0.58 + d * 0.5);
          const u = d === 0 ? rawU : 1.0 - rawU;
          ac.curve.getPoint(u, tmpPos);
          tmpQuat.identity();

          const endTaper = Math.sin(u * Math.PI);
          const s = Math.max(0.0001, attentionEnv * (0.75 + 0.55 * endTaper));
          tmpScale.setScalar(s);
          tmpMat.compose(tmpPos, tmpQuat, tmpScale);
          attentionBeadInst.setMatrixAt(instIdx, tmpMat);

          tmpColor.copy(d === 0 ? colGold : colBrightCyan).lerp(colWhiteCyan, 0.35 * endTaper);
          attentionBeadInst.setColorAt(instIdx, tmpColor);
        }
      }
      attentionBeadInst.instanceMatrix.needsUpdate = true;
      if (attentionBeadInst.instanceColor) attentionBeadInst.instanceColor.needsUpdate = true;
    }

    // -------------------------------------------------------------------------
    // G. Dynamic Anchors & Core Optical Glow Sprite
    // -------------------------------------------------------------------------
    anchors.backpropWave.set(0.56, clamp01((backpropWaveY - layerYs[0]) / (layerYs[3] - layerYs[0])) * (layerYs[3] - layerYs[0]) + layerYs[0], 0.64);

    if (coreGlowSprite.material) {
      tmpColor.copy(colSkyCyan);
      if (attentionEnv > 0.05) tmpColor.lerp(colGold, attentionEnv * 0.42);
      if (coralForwardEnv > 0.05 || errorPeakEnv > 0.05) {
        tmpColor.lerp(colCoral, clamp01(Math.max(coralForwardEnv * 0.7, errorPeakEnv * 0.95)));
      }
      if (backpropActiveEnv > 0.05) {
        tmpColor.lerp(colEmerald, backpropActiveEnv * 0.92);
      } else if (coherenceEnv > 0.05) {
        tmpColor.lerp(colTeal, coherenceEnv * 0.45);
      }
      coreGlowSprite.material.color.copy(tmpColor);
      coreGlowSprite.material.opacity =
        0.34 + 0.18 * Math.max(attentionEnv, backpropActiveEnv, errorPeakEnv, coherenceEnv);
    }

    // Update Telemetry State
    state.tokenFlowActive = intakeWeight > 0.35;
    state.tokensAlignedCount = alignedCount;
    state.prismEnergy = +prismEnergy.toFixed(3);
    state.forwardPulseIntensity = +(isReverseFlow ? 0.15 : Math.max(0.35, forwardLatticeEnv)).toFixed(3);
    state.attentionActive = +attentionEnv.toFixed(3);
    state.errorPulse = +clamp01(Math.max(coralForwardEnv * 0.7, errorPeakEnv)).toFixed(3);
    state.backpropProgress = +convergedGlobal.toFixed(3);
    state.backpropWaveY = +backpropWaveY.toFixed(3);
    state.learningConverged = +convergedGlobal.toFixed(3);
    state.coreCoherence = +coherenceEnv.toFixed(3);

    return state;
  }

  // Initialize cleanly at t = 0
  update(0);

  return {
    neuralGroup,
    update,
    getState: () => state,
    getAnchors: () => anchors,
  };
}
