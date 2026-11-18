/**
 * Cinematic Educational Camera Director (/home/antigravity/ai-how-it-works-3d/src/camera/director.js)
 * Smooth cubic-eased parallax dolly & orbital sweeps across all 6 AI explainer beats.
 * Frames all active 3D structures & anchors inside |ndcX| <= 0.86, ndcY in [-0.54 .. +0.84],
 * keeping the lower YouTube subtitle zone (y = 1650px) completely unobstructed.
 */
import { createBaseDirector, clamp01, lerp } from '../engine/baseDirector.js';

function easeInOutCubic(x) {
  const u = clamp01(x);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

function easeOutCubic(x) {
  const u = clamp01(x);
  return 1 - Math.pow(1 - u, 3);
}

const TRANSITIONS = {
  token_prism_intake: { duration: 0.50, whipFov: 0.0, whipRoll: 0.0 },
  neural_lattice_sweep: { duration: 0.52, whipFov: 0.0, whipRoll: 0.0 },
  attention_matrix_orbit: { duration: 0.52, whipFov: 0.0, whipRoll: 0.0 },
  backprop_weight_tuning: { duration: 0.52, whipFov: 0.0, whipRoll: 0.0 },
  softmax_probability_lock: { duration: 0.52, whipFov: 0.0, whipRoll: 0.0 },
  converged_core_finale: { duration: 0.58, whipFov: 0.0, whipRoll: 0.0 },
};

export function createAiDirector(camera, timeline) {
  function evaluateShot(shotName, t, activeBeat, _state, outPos, outLook, outScalars) {
    const start = activeBeat?.start ?? 0;
    const end = activeBeat?.end ?? start + 5.0;
    const u = clamp01((t - start) / Math.max(0.01, end - start));
    const s = easeInOutCubic(u);
    const glide = easeOutCubic(u);

    outScalars.roll = 0.0;
    outScalars.swayAmp = 0.14;

    switch (shotName) {
      case 'token_prism_intake':
      case 'beat_1_data_tokens': {
        // Beat 1 (0..5.0s): Data packets -> Token Prism -> Vector Embeddings (Y=-2.05..-0.75)
        outPos.set(
          lerp(0.35, -0.35, s),
          lerp(-1.14, -1.18, s),
          lerp(4.70, 4.48, s)
        );
        outLook.set(
          0.0,
          lerp(-1.52, -1.46, glide),
          0.0
        );
        outScalars.fov = lerp(46.0, 45.0, s);
        break;
      }

      case 'neural_lattice_sweep':
      case 'beat_2_neural_layers': {
        // Beat 2 (5.0..10.2s): 4-Layer Neural Lattice sweep (Y=-0.85..+1.45, max R=0.94)
        outPos.set(
          lerp(-0.85, 0.80, s),
          lerp(0.22, 0.28, s),
          lerp(5.45, 5.25, s)
        );
        outLook.set(
          0.0,
          lerp(-0.02, 0.04, s),
          0.0
        );
        outScalars.fov = lerp(46.0, 45.0, s);
        break;
      }

      case 'attention_matrix_orbit':
      case 'beat_3_attention_context': {
        // Beat 3 (10.2..15.4s): Self-Attention Halo (R=1.335) & Curved Arcs
        outPos.set(
          lerp(0.75, -0.65, s),
          lerp(0.36, 0.42, s),
          lerp(6.88, 6.70, s)
        );
        outLook.set(
          0.0,
          lerp(0.06, 0.10, s),
          0.0
        );
        outScalars.fov = lerp(47.5, 47.0, s);
        break;
      }

      case 'backprop_weight_tuning':
      case 'beat_4_training_backprop': {
        // Beat 4 (15.4..20.6s): Loss Ring (Y=1.48) + Downward Backprop Cascade (Y=-0.8..+1.5)
        outPos.set(
          lerp(0.45, -0.30, s),
          lerp(0.38, 0.30, s),
          lerp(6.80, 6.68, s)
        );
        outLook.set(
          0.0,
          lerp(0.14, 0.10, s),
          0.0
        );
        outScalars.fov = lerp(47.5, 47.0, s);
        break;
      }

      case 'softmax_probability_lock':
      case 'beat_5_probability_output': {
        // Beat 5 (20.6..25.8s): Softmax Probability Columns (Y=1.35..2.52, deck R=0.86)
        outPos.set(
          lerp(-0.32, 0.26, s),
          lerp(1.96, 2.02, s),
          lerp(4.68, 4.52, s)
        );
        outLook.set(
          0.0,
          lerp(1.70, 1.74, s),
          0.0
        );
        outScalars.fov = lerp(46.0, 45.5, s);
        break;
      }

      case 'converged_core_finale':
      case 'beat_6_intelligence_recap':
      default: {
        // Beat 6 (25.8..30.0s): Full Hero Converged Core Pullback (Y=-2.35..+2.52)
        outPos.set(
          lerp(0.45, 0.0, s),
          lerp(0.04, 0.08, glide),
          lerp(9.10, 9.50, glide)
        );
        outLook.set(
          0.0,
          lerp(-0.46, -0.42, glide),
          0.0
        );
        outScalars.fov = 47.0;
        break;
      }
    }
  }

  const base = createBaseDirector(camera, timeline, evaluateShot, {
    transitions: TRANSITIONS,
  });

  function update(t = 0, state = {}) {
    base.update(t, { ...state, sfxShake: 0 });
  }

  return {
    update,
    findBeatAt: base.findBeatAt,
  };
}

export const createDirector = createAiDirector;
