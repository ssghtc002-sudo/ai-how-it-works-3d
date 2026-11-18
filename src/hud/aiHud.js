/**
 * Clean Boxless YouTube HUD & 3D-Projected Vector Callout Compositor
 * (/home/antigravity/ai-how-it-works-3d/src/hud/aiHud.js)
 *
 * Strictly obeys AGENTS.md §3 Item 6:
 *  - ZERO top UI headers, chapter banners, counters, or progress bars
 *  - ZERO bottom subtitle box, card, border, waveform, or speaker tag
 *  - Uses shared createHudCompositor (offscreen 1080x260 subCanvas anti-bleed compositing,
 *    #FFFFFF base + #38BDF8 active spoken word highlight, balanced 1-2 line 800 42px at y=1650)
 *  - Beat-scoped 3D-projected vector callout pills strictly constrained to y in [95..1445]px
 */
import { createHudCompositor, createFrameCompositor } from '../engine/hudCompositor.js';

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function drawRoundedRect(c, x, y, w, h, r) {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  c.beginPath();
  c.moveTo(x + rad, y);
  c.lineTo(x + w - rad, y);
  c.quadraticCurveTo(x + w, y, x + w, y + rad);
  c.lineTo(x + w, y + h - rad);
  c.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  c.lineTo(x + rad, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - rad);
  c.lineTo(x, y + rad);
  c.quadraticCurveTo(x, y, x + rad, y);
  c.closePath();
}

const CALLOUT_DEFS_BY_BEAT = {
  beat_1_data_tokens: [
    {
      id: 'raw_input',
      anchorKeys: ['rawInputHud', 'rawInput', 'stageBase'],
      label: 'RAW DATA PACKETS',
      side: 'left',
      accent: '#38BDF8',
      yOffset: 24,
      delay: 0.25,
    },
    {
      id: 'token_prism',
      anchorKeys: ['tokenPrismHud', 'tokenPrism'],
      label: 'TOKENIZER PRISM',
      side: 'right',
      accent: '#22D3EE',
      yOffset: -4,
      delay: 0.65,
    },
    {
      id: 'token_vectors',
      anchorKeys: ['tokenVectorsHud', 'tokenVectors', 'layerInput'],
      label: 'VECTOR EMBEDDINGS',
      side: 'left',
      accent: '#A78BFA',
      yOffset: -18,
      delay: 1.35,
    },
  ],
  beat_2_neural_layers: [
    {
      id: 'layer_input',
      anchorKeys: ['layerInput', 'tokenVectors'],
      label: 'INPUT LAYER',
      side: 'left',
      accent: '#38BDF8',
      yOffset: 20,
      delay: 0.25,
    },
    {
      id: 'weighted_synapses',
      anchorKeys: ['weightedSynapses', 'neuralCoreCenter'],
      label: 'WEIGHTED SYNAPSES',
      side: 'left',
      accent: '#22D3EE',
      yOffset: -8,
      delay: 0.70,
    },
    {
      id: 'hidden_layers',
      anchorKeys: ['hiddenLayers', 'neuralCoreCenter'],
      label: 'HIDDEN LAYERS',
      side: 'right',
      accent: '#60A5FA',
      yOffset: -24,
      delay: 1.15,
    },
  ],
  beat_3_attention_context: [
    {
      id: 'attention_halo',
      anchorKeys: ['attentionHaloRim', 'attentionHalo', 'neuralCoreCenter'],
      label: 'ATTENTION RINGS',
      side: 'left',
      accent: '#FBBF24',
      yOffset: -28,
      delay: 0.25,
    },
    {
      id: 'attention_links',
      anchorKeys: ['attentionLinks', 'neuralCoreCenter'],
      label: 'CONTEXT ARCS',
      side: 'right',
      accent: '#38BDF8',
      yOffset: 22,
      delay: 0.68,
    },
  ],
  beat_4_training_backprop: [
    {
      id: 'loss_gauge',
      anchorKeys: ['lossGaugeRim', 'lossGauge'],
      label: 'ERROR LOSS RING',
      side: 'right',
      accent: '#FB7185',
      yOffset: -36,
      delay: 0.45,
    },
    {
      id: 'backprop_wave',
      anchorKeys: ['backpropWave', 'neuralCoreCenter'],
      label: 'BACKPROPAGATION',
      side: 'right',
      accent: '#34D399',
      yOffset: -12,
      delay: 1.35,
    },
    {
      id: 'weight_tuning',
      anchorKeys: ['neuralCoreCenter', 'weightedSynapses'],
      label: 'WEIGHT TUNING',
      side: 'left',
      accent: '#34D399',
      yOffset: 24,
      delay: 1.80,
    },
  ],
  beat_5_probability_output: [
    {
      id: 'softmax_deck',
      anchorKeys: ['softmaxDeckRim', 'softmaxDeck'],
      label: 'SOFTMAX SCORING',
      side: 'left',
      accent: '#38BDF8',
      yOffset: 58,
      delay: 0.25,
    },
    {
      id: 'top_match_bar',
      anchorKeys: ['topMatchShaftHud', 'topMatchBar', 'topMatchCrown'],
      label: '92% TOP MATCH',
      side: 'right',
      accent: '#34D399',
      yOffset: -16,
      delay: 1.25,
    },
    {
      id: 'top_match_crown',
      anchorKeys: ['topMatchCrown', 'topMatchBar'],
      label: 'SELECTED OUTPUT',
      side: 'left',
      accent: '#FBBF24',
      yOffset: -52,
      delay: 1.85,
    },
  ],
  beat_6_intelligence_recap: [
    {
      id: 'recap_output',
      anchorKeys: ['topMatchCrown', 'topMatchBar'],
      label: 'PREDICTED TOKEN',
      side: 'right',
      accent: '#34D399',
      yOffset: -10,
      delay: 0.30,
    },
    {
      id: 'recap_core',
      anchorKeys: ['neuralCoreCenter', 'attentionHalo'],
      label: 'CONVERGED CORE',
      side: 'left',
      accent: '#38BDF8',
      yOffset: 0,
      delay: 0.55,
    },
    {
      id: 'recap_tokens',
      anchorKeys: ['tokenPrism', 'rawInput'],
      label: 'TOKEN EMBEDDINGS',
      side: 'right',
      accent: '#A78BFA',
      yOffset: 10,
      delay: 0.80,
    },
  ],
};

export function createAiHud(timeline, manifest = null, hudCanvas = null) {
  const width = timeline?.resolution?.width || 1080;
  const height = timeline?.resolution?.height || 1920;
  const duration = Number(timeline?.duration || 30.0);
  const beats = Array.isArray(timeline?.beats) ? timeline.beats : [];

  function getActiveBeat(t) {
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i];
      if (t >= b.start && (t < b.end || i === beats.length - 1)) return b;
    }
    return beats[0] || { id: 'beat_1_data_tokens', start: 0, end: 5.0 };
  }

  function pickAnchor(screenAnchors, candidateKeys) {
    if (!screenAnchors) return null;
    for (const k of candidateKeys) {
      const a = screenAnchors[k];
      if (a && a.visible !== false && Number.isFinite(a.x) && Number.isFinite(a.y)) {
        return a;
      }
    }
    return null;
  }

  function drawVectorCallouts(ctx, t, beat, screenAnchors) {
    const defs = CALLOUT_DEFS_BY_BEAT[beat?.id] || [];
    if (defs.length === 0 || !screenAnchors) return;

    const beatElapsed = t - (beat?.start ?? 0);
    const beatRemaining = (beat?.end ?? duration) - t;
    const beatFadeOut = beatRemaining < 0.24 ? clamp01(beatRemaining / 0.24) : 1.0;

    const prepared = [];
    ctx.save();
    ctx.font = '700 19px "DejaVu Sans", sans-serif';

    for (const def of defs) {
      const anchor = pickAnchor(screenAnchors, def.anchorKeys);
      if (!anchor) continue;
      const ax = anchor.x;
      const ay = anchor.y;
      if (ax < 30 || ax > width - 30 || ay < 75 || ay > 1475) continue;

      const fadeIn = clamp01((beatElapsed - (def.delay || 0)) / 0.28);
      const alpha = fadeIn * beatFadeOut;
      if (alpha <= 0.02) continue;

      const pillW = Math.min(370, ctx.measureText(def.label).width + 48);
      const pillH = 42;

      let side = def.side || 'left';
      if (side === 'left' && ax < 40 + pillW + 28) side = 'right';
      if (side === 'right' && ax > width - 40 - pillW - 28) side = 'left';

      let pillX;
      if (side === 'left') {
        pillX = clamp(Math.min(ax - 62 - pillW, 396 - pillW), 40, width - 40 - pillW);
        if (pillX + pillW > ax - 26) {
          pillX = clamp(ax - 32 - pillW, 40, width - 40 - pillW);
        }
      } else {
        pillX = clamp(Math.max(ax + 62, 684), 40, width - 40 - pillW);
        if (pillX < ax + 26) {
          pillX = clamp(ax + 32, 40, width - 40 - pillW);
        }
      }

      const pillY = clamp(ay + (def.yOffset || 0) - pillH * 0.5, 95, 1445 - pillH);

      prepared.push({
        def,
        ax,
        ay,
        side,
        pillX,
        pillY,
        pillW,
        pillH,
        alpha,
      });
    }

    // Resolve vertical overlaps cleanly per side inside [95 .. 1445 - pillH]
    for (const side of ['left', 'right']) {
      const group = prepared.filter((p) => p.side === side).sort((a, b) => a.pillY - b.pillY);
      const minGap = 56;
      for (let i = 1; i < group.length; i++) {
        if (group[i].pillY - group[i - 1].pillY < minGap) {
          group[i].pillY = Math.min(1445 - group[i].pillH, group[i - 1].pillY + minGap);
        }
      }
      for (let i = group.length - 2; i >= 0; i--) {
        if (group[i + 1].pillY - group[i].pillY < minGap) {
          group[i].pillY = Math.max(95, group[i + 1].pillY - minGap);
        }
      }
    }

    for (const item of prepared) {
      const { def, ax, ay, side, pillX, pillY, pillW, pillH, alpha } = item;
      const accent = def.accent || '#38BDF8';
      const badgeEdgeX = side === 'left' ? pillX + pillW : pillX;
      const badgeMidY = pillY + pillH * 0.5;
      const dy = badgeMidY - ay;
      const dxTotal = Math.abs(badgeEdgeX - ax);
      const diagRun = Math.min(dxTotal * 0.46, Math.max(20, Math.abs(dy) * 0.85 + 14));
      const elbowX = side === 'left' ? ax - diagRun : ax + diagRun;

      ctx.save();
      ctx.globalAlpha = alpha;

      // 1. Dark under-stroke halo for clean separation over glowing geometry
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(elbowX, badgeMidY);
      ctx.lineTo(badgeEdgeX, badgeMidY);
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = 'rgba(4, 10, 22, 0.82)';
      ctx.stroke();

      // 2. Precision 2px accented vector leader line
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = accent;
      ctx.stroke();

      // 3. Target anchor pulse ring + bright core dot
      const pulseR = 10 + 2.8 * Math.sin(t * 4.4);
      ctx.beginPath();
      ctx.arc(ax, ay, pulseR, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = accent;
      ctx.globalAlpha = alpha * 0.46;
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(ax, ay, 4.8, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ax, ay, 2.0, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // 4. Sleek translucent slate callout pill
      drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 8);
      ctx.fillStyle = 'rgba(7, 17, 36, 0.90)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = accent;
      ctx.stroke();

      // Accent dot inside pill
      ctx.beginPath();
      ctx.arc(pillX + 18, badgeMidY, 4.0, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();

      ctx.font = '700 19px "DejaVu Sans", sans-serif';
      ctx.fillStyle = '#F1F5F9';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.label, pillX + 32, badgeMidY + 0.5);

      ctx.restore();
    }

    ctx.restore();
  }

  const compositor = createHudCompositor(timeline, manifest, hudCanvas, {
    accentColor: '#38BDF8',
    accentGlow: 'rgba(56, 189, 248, 0.50)',
    subtitleY: 1650,
    drawOverlay: (ctx, t, hudState) => {
      const beat = getActiveBeat(t);
      const anchors = hudState?.screenAnchors || hudState?.anchors || {};
      drawVectorCallouts(ctx, t, beat, anchors);
    },
  });

  function draw(t, hudState = {}, screenAnchors = null) {
    const resolvedAnchors = screenAnchors || hudState?.screenAnchors || hudState?.anchors || {};
    compositor.draw(t, {
      ...(hudState && typeof hudState === 'object' ? hudState : {}),
      screenAnchors: resolvedAnchors,
      flashAlpha: 0,
    });
  }

  return {
    canvas: compositor.canvas,
    draw,
    getActiveBeat,
    getActiveSubtitlePage: compositor.getActiveSubtitlePage,
    subtitlePages: compositor.subtitlePages,
  };
}

export { createFrameCompositor };
export const createHud = createAiHud;
