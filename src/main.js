/**
 * How AI Works 3D Explainer Main App (/home/antigravity/ai-how-it-works-3d/src/main.js)
 * Wires strict 3-light studio, FogExp2 atmospheric depth, HoloChamber + NeuralCoreRig,
 * 6-beat smooth cubic camera director, boxless YouTube HUD + 3D vector callouts,
 * and deterministic WebCodecs frame compositor hooks.
 */
import * as THREE from 'three';
import { MaterialRegistry } from './engine/aiUtils.js';
import { buildHoloChamber } from './scene/holoChamber.js';
import { buildNeuralCoreRig } from './scene/neuralCoreRig.js';
import { createAiDirector } from './camera/director.js';
import { createAiHud, createFrameCompositor } from './hud/aiHud.js';

function resolveAnchorInput(raw, outVec) {
  if (!raw) return null;
  if (raw.isVector3 || (typeof raw.x === 'number' && typeof raw.y === 'number' && typeof raw.z === 'number')) {
    outVec.set(raw.x, raw.y, raw.z);
    return { vec: outVec, visible: raw.visible !== false };
  }
  const vecSrc = raw.worldPos || raw.pos || raw.position;
  if (vecSrc && typeof vecSrc.x === 'number') {
    outVec.set(vecSrc.x, vecSrc.y, vecSrc.z);
    return { vec: outVec, visible: raw.visible !== false };
  }
  if (Array.isArray(raw) && raw.length >= 3) {
    outVec.set(raw[0], raw[1], raw[2]);
    return { vec: outVec, visible: true };
  }
  return null;
}

async function init() {
  const [timeline, manifest] = await Promise.all([
    fetch('/config/timeline.json').then((r) => r.json()),
    fetch('/audio/output/voice_manifest.json').then((r) => r.json()).catch(() => null),
  ]);

  const width = timeline.resolution?.width || 1080;
  const height = timeline.resolution?.height || 1920;
  const fps = timeline.fps || 30;
  const duration = timeline.duration || 30.0;
  const totalFrames = timeline.totalFrames || 900;

  const webglCanvas = document.getElementById('webgl-canvas');
  const hudCanvas = document.getElementById('hud-canvas');

  const renderer = new THREE.WebGLRenderer({
    canvas: webglCanvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050b18);
  scene.fog = new THREE.FogExp2(0x050b18, 0.022);

  const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 80);

  // Strict 3-Light Cap (HemisphereLight + Key DirectionalLight + Colored Rim DirectionalLight)
  const hemiLight = new THREE.HemisphereLight(0xdceeff, 0x101c34, 0.95);
  scene.add(hemiLight);

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
  const hud = createAiHud(timeline, manifest, hudCanvas);
  const compositor = createFrameCompositor(webglCanvas, hudCanvas, width, height);

  const tmpVec = new THREE.Vector3();

  function projectAnchors(rawAnchors) {
    const out = {};
    if (!rawAnchors) return out;
    for (const [key, val] of Object.entries(rawAnchors)) {
      const resolved = resolveAnchorInput(val, tmpVec);
      if (!resolved) continue;
      resolved.vec.project(camera);
      const inFront = resolved.vec.z >= -1 && resolved.vec.z <= 1;
      const x = (resolved.vec.x * 0.5 + 0.5) * width;
      const y = (1 - (resolved.vec.y * 0.5 + 0.5)) * height;
      out[key] = {
        x,
        y,
        ndcX: resolved.vec.x,
        ndcY: resolved.vec.y,
        visible: resolved.visible && inFront && Math.abs(resolved.vec.x) <= 1.05 && Math.abs(resolved.vec.y) <= 1.05,
      };
    }
    return out;
  }

  function renderFrame(frameIdx) {
    const f = Math.max(0, Math.min(totalFrames - 1, Math.round(frameIdx)));
    const t = f / fps;

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

    const rawAnchors = {
      ...(chamber.getAnchors ? chamber.getAnchors() : {}),
      ...(neuralCore.getAnchors ? neuralCore.getAnchors() : {}),
    };
    rawAnchors.rawInputHud = new THREE.Vector3(-0.24, -1.78, 0.44);
    rawAnchors.tokenPrismHud = new THREE.Vector3(0.28, timeline.worldContract?.tokenPrismY ?? -1.28, 0.68);
    rawAnchors.tokenVectorsHud = new THREE.Vector3(-0.32, -1.03, 0.46);
    rawAnchors.attentionHaloRim = new THREE.Vector3(-0.56, timeline.worldContract?.attentionHaloY ?? 0.32, 1.15);
    rawAnchors.lossGaugeRim = new THREE.Vector3(0.46, timeline.worldContract?.lossGaugeY ?? 1.48, 0.64);
    rawAnchors.softmaxDeckRim = new THREE.Vector3(-0.26, timeline.worldContract?.softmaxDeckY ?? 1.66, 0.82);
    if (rawAnchors.topMatchCrown) {
      rawAnchors.topMatchShaftHud = new THREE.Vector3(0.08, Math.max((timeline.worldContract?.softmaxDeckY ?? 1.66) + 0.25, rawAnchors.topMatchCrown.y - 0.08), 0.06);
    }

    const screenAnchors = projectAnchors(rawAnchors);

    renderer.render(scene, camera);
    hud.draw(t, coreState, screenAnchors);

    return {
      frame: f,
      t: +t.toFixed(4),
      calls: renderer.info.render.calls,
      tris: renderer.info.render.triangles,
      materials: registry.count(),
    };
  }

  window.__RENDER_FRAME__ = renderFrame;
  window.__GET_COMPOSITE_CANVAS__ = () => compositor.composite();
  window.__TIMELINE__ = timeline;
  window.__SCENE_READY__ = true;

  renderFrame(0);

  const params = new URLSearchParams(window.location.search);
  if (!params.has('render')) {
    const startMs = performance.now();
    function tick() {
      const elapsed = ((performance.now() - startMs) / 1000) % duration;
      renderFrame(Math.round(elapsed * fps));
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
}

init().catch((err) => {
  console.error('[Main Init Error]', err);
});
