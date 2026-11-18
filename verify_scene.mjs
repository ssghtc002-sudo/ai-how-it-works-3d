/**
 * Sub-1-Second Node Pre-Flight Gate (/home/antigravity/ai-how-it-works-3d/verify_scene.mjs)
 * Evaluates 30 timestamps (0..30s) across all 6 beats for:
 *  - Presence of all 15 coordinated 3D anchor keys
 *  - Zero NaN matrices across entire Three.js scene graph
 *  - Strict WebGL budgets (<= 55 draws, <= 55,000 tris, <= 25 materials, <= 3 lights)
 *  - Projected 3D anchor & outer silhouette safe framing (|ndcX| <= 0.90, ndcY in [-0.62 .. +0.88])
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { MaterialRegistry } from './src/engine/aiUtils.js';
import { buildHoloChamber } from './src/scene/holoChamber.js';
import { buildNeuralCoreRig } from './src/scene/neuralCoreRig.js';
import { createAiDirector } from './src/camera/director.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const timeline = JSON.parse(await fs.readFile(path.join(__dirname, 'config', 'timeline.json'), 'utf-8'));

const BUDGETS = {
  maxDraws: 55,
  maxTris: 55000,
  maxMaterials: 25,
  maxLights: 3,
};

const COORDINATED_ANCHOR_KEYS = [
  'rawInput',
  'tokenPrism',
  'tokenVectors',
  'layerInput',
  'weightedSynapses',
  'hiddenLayers',
  'attentionHalo',
  'attentionLinks',
  'lossGauge',
  'backpropWave',
  'neuralCoreCenter',
  'softmaxDeck',
  'topMatchBar',
  'topMatchCrown',
  'stageBase',
];

function countSceneMetrics(root) {
  let draws = 0;
  let totalTris = 0;
  let lights = 0;
  const uniqueMaterials = new Set();

  function walk(obj) {
    if (!obj.visible) return;
    if (obj.isLight) lights++;

    if (obj.isInstancedMesh) {
      draws++;
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => uniqueMaterials.add(m));
        else uniqueMaterials.add(obj.material);
      }
      const g = obj.geometry;
      if (g) {
        const trisPerInst = g.index
          ? g.index.count / 3
          : g.attributes.position
            ? g.attributes.position.count / 3
            : 0;
        totalTris += Math.round(trisPerInst * obj.count);
      }
    } else if (obj.isMesh || obj.isSprite || obj.isLine || obj.isLineSegments || obj.isPoints) {
      draws++;
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => uniqueMaterials.add(m));
        else uniqueMaterials.add(obj.material);
      }
      if (obj.geometry) {
        const g = obj.geometry;
        const tris = g.index
          ? g.index.count / 3
          : g.attributes.position
            ? g.attributes.position.count / 3
            : 0;
        totalTris += Math.round(tris);
      }
    }

    for (let i = 0; i < obj.children.length; i++) {
      walk(obj.children[i]);
    }
  }

  walk(root);
  return {
    draws,
    totalTris,
    uniqueMaterials: uniqueMaterials.size,
    lights,
  };
}

function findNaNNode(root) {
  let bad = null;
  root.traverse((obj) => {
    if (bad) return;
    const elems = obj.matrixWorld.elements;
    for (let i = 0; i < 16; i++) {
      if (!Number.isFinite(elems[i])) {
        bad = obj.name || obj.type;
        return;
      }
    }
  });
  return bad;
}

function resolveAnchorVec(raw, outVec) {
  if (!raw) return null;
  if (raw.isVector3 || (typeof raw.x === 'number' && typeof raw.y === 'number' && typeof raw.z === 'number')) {
    outVec.set(raw.x, raw.y, raw.z);
    return { vec: outVec, visible: raw.visible !== false };
  }
  const src = raw.worldPos || raw.pos || raw.position;
  if (src && typeof src.x === 'number') {
    outVec.set(src.x, src.y, src.z);
    return { vec: outVec, visible: raw.visible !== false };
  }
  if (Array.isArray(raw) && raw.length >= 3) {
    outVec.set(raw[0], raw[1], raw[2]);
    return { vec: outVec, visible: true };
  }
  return null;
}

const wc = timeline.worldContract || {};
const stageFloorY = wc.stageFloorY ?? -2.35;
const tokenPrismY = wc.tokenPrismY ?? -1.28;
const layer0Y = wc.layer0Y ?? -0.78;
const layer1Y = wc.layer1Y ?? -0.05;
const layer3Y = wc.layer3Y ?? 1.38;
const attentionHaloY = wc.attentionHaloY ?? 0.32;
const attentionHaloRadius = wc.attentionHaloRadius ?? 1.28;
const lossGaugeY = wc.lossGaugeY ?? 1.48;
const softmaxDeckY = wc.softmaxDeckY ?? 1.66;

const BEAT_CHECKS = {
  beat_1_data_tokens: {
    anchors: ['rawInput', 'tokenPrism', 'tokenVectors'],
    bounds: [
      { label: 'rawBottom', pt: [0, -2.06, 0] },
      { label: 'prismLeft', pt: [-0.81, tokenPrismY, 0] },
      { label: 'prismRight', pt: [0.81, tokenPrismY, 0] },
      { label: 'layer0Center', pt: [0, layer0Y, 0] },
    ],
  },
  beat_2_neural_layers: {
    anchors: ['layerInput', 'weightedSynapses', 'hiddenLayers', 'neuralCoreCenter'],
    bounds: [
      { label: 'layer0Bottom', pt: [0, layer0Y, 0] },
      { label: 'layer3Top', pt: [0, layer3Y, 0] },
      { label: 'layer1RimL', pt: [-0.94, layer1Y, 0] },
      { label: 'layer1RimR', pt: [0.94, layer1Y, 0] },
    ],
  },
  beat_3_attention_context: {
    anchors: ['attentionHalo', 'attentionLinks', 'neuralCoreCenter'],
    bounds: [
      { label: 'haloOuterRimL', pt: [-(attentionHaloRadius + 0.055), attentionHaloY, 0] },
      { label: 'haloOuterRimR', pt: [attentionHaloRadius + 0.055, attentionHaloY, 0] },
      { label: 'layer0Bottom', pt: [0, layer0Y, 0] },
      { label: 'layer3Top', pt: [0, layer3Y, 0] },
    ],
  },
  beat_4_training_backprop: {
    anchors: ['lossGauge', 'backpropWave', 'neuralCoreCenter', 'layerInput'],
    bounds: [
      { label: 'lossRingRimL', pt: [-0.82, lossGaugeY, 0] },
      { label: 'lossRingRimR', pt: [0.82, lossGaugeY, 0] },
      { label: 'haloOuterRimL', pt: [-(attentionHaloRadius + 0.055), attentionHaloY, 0] },
      { label: 'haloOuterRimR', pt: [attentionHaloRadius + 0.055, attentionHaloY, 0] },
      { label: 'layer0Bottom', pt: [0, layer0Y, 0] },
    ],
  },
  beat_5_probability_output: {
    anchors: ['softmaxDeck', 'topMatchBar', 'topMatchCrown'],
    bounds: [
      { label: 'softmaxDeckRimL', pt: [-0.86, softmaxDeckY, 0] },
      { label: 'softmaxDeckRimR', pt: [0.86, softmaxDeckY, 0] },
      { label: 'layer3Top', pt: [0, layer3Y, 0] },
    ],
  },
  beat_6_intelligence_recap: {
    anchors: [
      'stageBase',
      'rawInput',
      'tokenPrism',
      'neuralCoreCenter',
      'attentionHalo',
      'softmaxDeck',
      'topMatchBar',
      'topMatchCrown',
    ],
    bounds: [
      { label: 'pedestalRimL', pt: [-1.64, stageFloorY, 0] },
      { label: 'pedestalRimR', pt: [1.64, stageFloorY, 0] },
      { label: 'haloOuterRimL', pt: [-(attentionHaloRadius + 0.055), attentionHaloY, 0] },
      { label: 'haloOuterRimR', pt: [attentionHaloRadius + 0.055, attentionHaloY, 0] },
    ],
  },
};

// Build scene matching src/main.js
const width = timeline.resolution?.width || 1080;
const height = timeline.resolution?.height || 1920;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050b18);
scene.fog = new THREE.FogExp2(0x050b18, 0.022);

const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 80);

scene.add(new THREE.HemisphereLight(0xdceeff, 0x101c34, 0.95));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.80);
keyLight.position.set(3.6, 5.2, 6.2);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
rimLight.position.set(-4.4, 2.4, -3.6);
scene.add(rimLight);

const registry = new MaterialRegistry();
const chamber = buildHoloChamber(scene, registry, timeline);
const neuralCore = buildNeuralCoreRig(scene, registry, timeline);
const director = createAiDirector(camera, timeline);

const errors = [];
const warnings = [];
const tmpVec = new THREE.Vector3();

// Verify all 15 coordinated anchor keys exist
const initialAnchors = {
  ...(chamber.getAnchors ? chamber.getAnchors() : {}),
  ...(neuralCore.getAnchors ? neuralCore.getAnchors() : {}),
};
for (const key of COORDINATED_ANCHOR_KEYS) {
  if (!initialAnchors[key]) {
    errors.push(`Missing coordinated anchor key: ${key}`);
  }
}

// Evaluate 30 timestamps across 0..30s
const timestamps = Array.from({ length: 30 }, (_, i) => +((i + 0.5) * (timeline.duration / 30)).toFixed(2));
let peakMetrics = { draws: 0, totalTris: 0, uniqueMaterials: 0, registryMaterials: 0, lights: 0 };

function checkPointNdc(t, beatId, label, vec) {
  const ndc = vec.clone().project(camera);
  const inFront = ndc.z >= -1 && ndc.z <= 1;
  if (!inFront) {
    errors.push(`t=${t.toFixed(2)}s (${beatId}) ${label} behind/outside clip plane (ndcZ=${ndc.z.toFixed(3)})`);
    return;
  }
  if (Math.abs(ndc.x) > 0.90) {
    errors.push(`t=${t.toFixed(2)}s (${beatId}) ${label} clipped X safe bound (ndcX=${ndc.x.toFixed(3)}, limit=0.90)`);
  } else if (Math.abs(ndc.x) > 0.86) {
    warnings.push(`t=${t.toFixed(2)}s (${beatId}) ${label} near horizontal margin (ndcX=${ndc.x.toFixed(3)})`);
  }
  if (ndc.y < -0.62 || ndc.y > 0.88) {
    errors.push(`t=${t.toFixed(2)}s (${beatId}) ${label} outside vertical safe bound (ndcY=${ndc.y.toFixed(3)}, allowed=[-0.62..0.88])`);
  } else if (ndc.y < -0.55 || ndc.y > 0.84) {
    warnings.push(`t=${t.toFixed(2)}s (${beatId}) ${label} near top/subtitle margin (ndcY=${ndc.y.toFixed(3)})`);
  }
}

for (const t of timestamps) {
  neuralCore.update(t);
  const coreState = neuralCore.getState ? neuralCore.getState() : {};
  chamber.update(t, {
    ...coreState,
    attentionEnergy: coreState.attentionActive,
  });
  director.update(t, coreState);

  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const nanNode = findNaNNode(scene);
  if (nanNode) {
    errors.push(`t=${t.toFixed(2)}s NaN world matrix at ${nanNode}`);
  }

  const m = countSceneMetrics(scene);
  const regCount = registry.count();
  peakMetrics.draws = Math.max(peakMetrics.draws, m.draws);
  peakMetrics.totalTris = Math.max(peakMetrics.totalTris, m.totalTris);
  peakMetrics.uniqueMaterials = Math.max(peakMetrics.uniqueMaterials, m.uniqueMaterials);
  peakMetrics.registryMaterials = Math.max(peakMetrics.registryMaterials, regCount);
  peakMetrics.lights = Math.max(peakMetrics.lights, m.lights);

  const beat = director.findBeatAt(t);
  const allAnchors = {
    ...(chamber.getAnchors ? chamber.getAnchors() : {}),
    ...(neuralCore.getAnchors ? neuralCore.getAnchors() : {}),
  };

  const checkCfg = BEAT_CHECKS[beat?.id];
  if (checkCfg) {
    for (const key of checkCfg.anchors) {
      const resolved = resolveAnchorVec(allAnchors[key], tmpVec);
      if (!resolved) {
        errors.push(`t=${t.toFixed(2)}s (${beat.id}) missing anchor ${key}`);
        continue;
      }
      if (!resolved.visible) continue;
      checkPointNdc(t, beat.id, `anchor:${key}`, resolved.vec);
    }
    for (const bnd of checkCfg.bounds) {
      tmpVec.set(bnd.pt[0], bnd.pt[1], bnd.pt[2]);
      checkPointNdc(t, beat.id, `bound:${bnd.label}`, tmpVec);
    }
  }
}

if (peakMetrics.draws > BUDGETS.maxDraws) {
  errors.push(`Draw budget exceeded: peak visible draws=${peakMetrics.draws} > ${BUDGETS.maxDraws}`);
}
if (peakMetrics.totalTris > BUDGETS.maxTris) {
  errors.push(`Triangle budget exceeded: peak tris=${peakMetrics.totalTris} > ${BUDGETS.maxTris}`);
}
const matPeak = Math.max(peakMetrics.uniqueMaterials, peakMetrics.registryMaterials);
if (matPeak > BUDGETS.maxMaterials) {
  errors.push(`Material budget exceeded: ${matPeak} > ${BUDGETS.maxMaterials}`);
}
if (peakMetrics.lights > BUDGETS.maxLights) {
  errors.push(`Light budget exceeded: ${peakMetrics.lights} > ${BUDGETS.maxLights}`);
}

console.log('[VerifyScene] Peak Metrics:', JSON.stringify(peakMetrics));
if (warnings.length > 0) {
  console.log(`[VerifyScene] Warnings (${warnings.length}):`);
  for (const w of warnings) console.log('  WARN:', w);
}
if (errors.length > 0) {
  console.error(`[VerifyScene] FAILED (${errors.length} errors):`);
  for (const e of errors) console.error('  ERR:', e);
  process.exit(1);
}
console.log('[VerifyScene] ALL 30 TIMESTAMPS PASSED BUDGET & SAFE-FRAME GATES!');
