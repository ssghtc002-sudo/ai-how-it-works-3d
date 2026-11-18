"""
Futuristic AI Explainer Audio & Tech Foley Generator
(/home/antigravity/ai-how-it-works-3d/audio/generate_audio.py)

Synthesizes:
  1. Crisp, confident tech-documentary narration via Kokoro ONNX (`am_michael`, en-us)
     using shared `audio/dspCore.py`.
  2. Futuristic minimalist ambient tech underscore at 96 BPM:
     - Clean spatial quantum air bed
     - Warm analog stereo synth pads (Am9 / Fmaj9 / Cmaj9 / G6) with breathing LFO filter
     - Delicate crystalline plucked arpeggio shimmer with stereo eighth-note ping-pong echo
     - Muted 96 BPM precision sub & micro-clock pulse
  3. All 13 synchronized tech Foley SFX events from `config/timeline.json`:
     `holo_boot`, `prism_split`, `layer_surge`, `synapse_spark`, `attention_lock`,
     `arc_shimmer`, `forward_guess`, `loss_error_ping`, `backprop_sweep`,
     `softmax_rise`, `top_match_lock`, `core_swell`, `outro_chime`.
  4. Mastered 44.1 kHz stereo WAV (`30.000s`, `-5.5 dB` sidechain BGM ducking,
     peak <= -1.0 dBFS), `audio/output/voice_manifest.json`, and `output/subtitles.srt`.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np

try:
    from audio.dspCore import (
        CHANNELS,
        DURATION,
        SR,
        TOTAL_SAMPLES,
        add_stereo_event,
        adsr_env,
        butter_filter,
        master_and_export,
        midi_to_hz,
        pan_stereo,
        peaking_eq,
        synthesize_dialogue,
    )
except ImportError:
    from dspCore import (
        CHANNELS,
        DURATION,
        SR,
        TOTAL_SAMPLES,
        add_stereo_event,
        adsr_env,
        butter_filter,
        master_and_export,
        midi_to_hz,
        pan_stereo,
        peaking_eq,
        synthesize_dialogue,
    )

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TIMELINE_PATH = PROJECT_ROOT / "config" / "timeline.json"


def load_timeline(path: Path = TIMELINE_PATH) -> dict[str, Any]:
    """Load timeline contract JSON from disk."""
    return json.loads(path.read_text(encoding="utf-8"))


def synth_analog_pad_chord(
    midis: list[int],
    dur: float,
    gain: float = 0.16,
    attack: float = 0.55,
    release: float = 0.85,
) -> np.ndarray:
    """Warm stereo analog synth pad chord with gentle harmonic richness and breathing sweep."""
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros((0, CHANNELS), dtype=np.float32)
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)

    left = np.zeros(n, dtype=np.float32)
    right = np.zeros(n, dtype=np.float32)

    # Smooth low-frequency analog drift for subtle stereo chorus movement
    drift_l = 0.0016 * np.sin(2.0 * math.pi * 0.22 * t)
    drift_r = 0.0016 * np.sin(2.0 * math.pi * 0.27 * t + 1.1)

    for idx, m in enumerate(midis):
        f = midi_to_hz(m)
        det = 0.0018 * (1.0 + 0.12 * idx)
        fl = f * (1.0 - det)
        fr = f * (1.0 + det)

        ph_l = 2.0 * math.pi * np.cumsum(fl * (1.0 + drift_l)) / SR
        ph_r = 2.0 * math.pi * np.cumsum(fr * (1.0 + drift_r)) / SR

        # Warm band-limited analog polysynth wave (rich fundamental + velvety 2nd/3rd/4th/5th)
        wl = (
            0.66 * np.sin(ph_l)
            + 0.21 * np.sin(2.0 * ph_l)
            + 0.08 * np.sin(3.0 * ph_l)
            + 0.035 * np.sin(4.0 * ph_l)
            + 0.015 * np.sin(5.0 * ph_l)
        )
        wr = (
            0.66 * np.sin(ph_r)
            + 0.21 * np.sin(2.0 * ph_r)
            + 0.08 * np.sin(3.0 * ph_r)
            + 0.035 * np.sin(4.0 * ph_r)
            + 0.015 * np.sin(5.0 * ph_r)
        )

        # Gentle downward tilt on upper extensions so pads feel lush, never harsh
        weight = 1.0 / (1.0 + 0.12 * idx)
        # Subtle voice stereo spread across chord tones
        spread = -0.18 if idx % 2 == 0 else 0.18
        left += wl * weight * (1.0 - 0.15 * spread)
        right += wr * weight * (1.0 + 0.15 * spread)

    norm = max(1.0, len(midis) * 0.68)
    stereo = np.stack([left / norm, right / norm], axis=-1).astype(np.float32)

    # Analog low-pass warmth + subtle midrange pocket so baritone narration cuts through cleanly
    stereo = butter_filter(stereo, "low", 1180.0, order=2)
    stereo[:, 0] = peaking_eq(stereo[:, 0], 1900.0, 0.9, -2.5)
    stereo[:, 1] = peaking_eq(stereo[:, 1], 1900.0, 0.9, -2.5)

    # Gentle breathing swell
    breath = 0.88 + 0.12 * np.sin(2.0 * math.pi * 0.20 * t)
    env = adsr_env(n, attack=attack, decay=0.22, sustain=0.86, release=release)
    return (stereo * (env * breath)[:, None] * gain).astype(np.float32)


def synth_crystalline_pluck(freq: float, dur: float = 0.72, gain: float = 0.095) -> np.ndarray:
    """Delicate futuristic crystalline plucked shimmer with clean glassy transient."""
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)

    # Glassy additive pluck: pure fundamental + octave + bright crystalline 3rd/4th partials
    body = (
        0.62 * np.sin(2.0 * math.pi * freq * t) * np.exp(-t * 4.8)
        + 0.25 * np.sin(2.0 * math.pi * (freq * 2.0) * t) * np.exp(-t * 8.2)
        + 0.09 * np.sin(2.0 * math.pi * (freq * 3.0) * t) * np.exp(-t * 14.5)
        + 0.04 * np.sin(2.0 * math.pi * (freq * 4.0) * t) * np.exp(-t * 22.0)
    )
    # Subtle soft-mallet / optical micro-transient (no click artifact)
    shimmer_ping = np.sin(2.0 * math.pi * (freq * 5.0) * t) * np.exp(-t * 48.0) * 0.045
    attack = np.clip(t / 0.004, 0.0, 1.0)
    sig = (body + shimmer_ping) * attack * gain

    fade = min(n, int(0.045 * SR))
    sig[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
    return sig.astype(np.float32)


def synth_precision_pulse(step_type: str = "downbeat", gain: float = 0.095) -> np.ndarray:
    """Muted 96 BPM futuristic precision sub-pulse and delicate micro-clock tick."""
    dur = 0.16
    n = int(round(dur * SR))
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)

    if step_type == "downbeat":
        # Muted warm sub-kick thump + ultra-clean clock grain
        f_curve = 86.0 * (0.50 ** np.clip(t / 0.055, 0.0, 1.0))
        phase = 2.0 * math.pi * np.cumsum(f_curve) / SR
        sub = np.sin(phase) * np.exp(-t * 26.0)
        tick = np.sin(2.0 * math.pi * 2400.0 * t) * np.exp(-t * 140.0) * 0.11
        sig = sub + tick
    elif step_type == "quarter":
        # Soft precision pulse on beats 2, 3, 4
        f_curve = 70.0 * (0.58 ** np.clip(t / 0.05, 0.0, 1.0))
        phase = 2.0 * math.pi * np.cumsum(f_curve) / SR
        sub = np.sin(phase) * np.exp(-t * 32.0) * 0.68
        tick = np.sin(2.0 * math.pi * 3100.0 * t) * np.exp(-t * 175.0) * 0.07
        sig = sub + tick
    else:
        # Delicate muted 8th-note micro-clock shimmer tick
        tick = (
            0.65 * np.sin(2.0 * math.pi * 4200.0 * t)
            + 0.35 * np.sin(2.0 * math.pi * 5800.0 * t)
        ) * np.exp(-t * 210.0) * 0.28
        sig = tick

    env = np.clip(t / 0.0025, 0.0, 1.0)
    return (sig * env * gain).astype(np.float32)


def apply_stereo_shimmer_delay(bus: np.ndarray, delay_sec: float, feedback: float = 0.28) -> np.ndarray:
    """Apply clean stereo ping-pong echo tail to crystalline arpeggio bus."""
    d_samples = int(round(delay_sec * SR))
    out = np.copy(bus)
    if d_samples <= 0 or d_samples >= len(bus):
        return out

    # Tap 1: cross-channel ping-pong
    tap1 = np.zeros_like(bus)
    tap1[d_samples:, 0] = bus[:-d_samples, 1] * feedback
    tap1[d_samples:, 1] = bus[:-d_samples, 0] * feedback

    # Tap 2: softer 2x delay
    d2 = d_samples * 2
    tap2 = np.zeros_like(bus)
    if d2 < len(bus):
        tap2[d2:, 0] = bus[:-d2, 0] * (feedback * 0.45)
        tap2[d2:, 1] = bus[:-d2, 1] * (feedback * 0.45)

    wet = butter_filter(tap1 + tap2, "low", 4400.0, order=2)
    return (out + wet).astype(np.float32)


def generate_bgm() -> np.ndarray:
    """Generate 30.0s futuristic minimalist ambient tech underscore at 96 BPM."""
    rng = np.random.default_rng(20261118)

    bgm = np.zeros((TOTAL_SAMPLES, CHANNELS), dtype=np.float32)
    t_all = np.linspace(0.0, DURATION, TOTAL_SAMPLES, endpoint=False, dtype=np.float32)

    # 1. Clean Spatial Quantum Air Bed (silky warm stereo room tone, zero harsh hiss)
    air_l = butter_filter(rng.standard_normal(TOTAL_SAMPLES).astype(np.float32), "band", (240.0, 1250.0), order=2)
    air_r = butter_filter(rng.standard_normal(TOTAL_SAMPLES).astype(np.float32), "band", (265.0, 1320.0), order=2)
    air_lfo = 0.84 + 0.16 * np.sin(2.0 * math.pi * 0.13 * t_all)
    bgm[:, 0] += air_l * air_lfo * 0.018
    bgm[:, 1] += air_r * air_lfo * 0.018

    # 2. Warm Analog Synth Pads: Am9 / Fmaj9 / Cmaj9 / G6 aligned to 96 BPM bars (1 bar = 2.50s)
    # Harmonically aligned to all 6 story beats & dramatic arc
    chord_schedule = [
        # (start, dur, midi_notes, bass_midi, pad_gain)
        (0.00, 2.95, [45, 52, 55, 59, 64], 45, 0.185),       # Bar 1 (Beat 1a): Am9 — mysterious tech intake
        (2.45, 3.05, [53, 57, 60, 64, 67], 41, 0.188),       # Bar 2 (Beat 1b): Fmaj9 — prism tokens emerge
        (4.95, 3.05, [48, 52, 55, 59, 62], 36, 0.192),       # Bar 3 (Beat 2a): Cmaj9 — expansive neural core
        (7.45, 3.15, [43, 47, 50, 55, 64], 43, 0.188),       # Bar 4 (Beat 2b): G6    — weighted propulsion
        (10.10, 3.10, [45, 52, 59, 64, 67], 45, 0.190),      # Bar 5 (Beat 3a): Am9   — attention gyro lock
        (12.65, 3.15, [53, 57, 60, 64, 67], 41, 0.195),      # Bar 6 (Beat 3b): Fmaj9 — context beams shimmer
        (15.30, 2.85, [45, 52, 55, 59, 64], 45, 0.186),      # Bar 7 (Beat 4a): Am9   — forward guess / error check
        (17.65, 3.25, [43, 50, 55, 59, 64], 43, 0.192),      # Bar 8 (Beat 4b): G6    — backprop sweep lift
        (20.50, 3.15, [53, 57, 60, 64, 67], 41, 0.194),      # Bar 9 (Beat 5a): Fmaj9 — softmax chamber climb
        (23.10, 3.15, [48, 55, 59, 62, 64], 36, 0.200),      # Bar 10 (Beat 5b): Cmaj9 — 92% top match lock!
        (25.70, 2.35, [43, 50, 55, 59, 64], 43, 0.188),      # Bar 11 (Beat 6a): G6    — hero pullback swell
        (27.55, 2.45, [48, 55, 59, 62, 64, 67], 36, 0.205),  # Bar 12 (Beat 6b): Cmaj9 — converged intelligence
    ]

    for st, dur, midis, bass_midi, gain in chord_schedule:
        pad = synth_analog_pad_chord(midis, dur, gain=gain, attack=0.52, release=0.82)
        add_stereo_event(bgm, pad, st)

        # Warm analog sub-bass with gentle 2nd harmonic so low-end reads on both headphones & mobile
        bn = int(round(dur * SR))
        bt = np.linspace(0.0, dur, bn, endpoint=False, dtype=np.float32)
        bf = midi_to_hz(bass_midi)
        bass = (
            0.80 * np.sin(2.0 * math.pi * bf * bt)
            + 0.20 * np.sin(2.0 * math.pi * (bf * 2.0) * bt)
        ) * adsr_env(bn, attack=0.35, decay=0.20, sustain=0.82, release=0.72) * 0.095
        add_stereo_event(bgm, pan_stereo(bass, 0.0), st)

    # 3. Delicate Crystalline Plucked Arpeggio Shimmer at 96 BPM (8th note = 0.3125s)
    # 96 BPM -> quarter = 0.625s, eighth = 0.3125s (96 steps in 30.0s)
    arp_bus = np.zeros((TOTAL_SAMPLES, CHANNELS), dtype=np.float32)
    eighth_dur = 60.0 / 96.0 / 2.0  # 0.3125 s

    arp_sections = [
        # (end_time, midi_arpeggio, pattern, pan_spread, gain)
        (2.50, [69, 72, 76, 79, 83], [0, 1, 2, 4, 3, 2, 1, 2], 0.28, 0.125),  # Am9
        (5.00, [69, 72, 76, 79, 84], [0, 1, 2, 3, 4, 3, 2, 1], 0.30, 0.130),  # Fmaj9
        (7.50, [67, 71, 74, 76, 79], [0, 1, 2, 4, 3, 2, 1, 3], 0.30, 0.135),  # Cmaj9
        (10.15, [67, 71, 74, 76, 83], [0, 1, 2, 3, 4, 2, 1, 2], 0.28, 0.132), # G6
        (12.70, [69, 72, 76, 79, 83], [0, 2, 1, 3, 4, 3, 2, 1], 0.32, 0.138), # Am9
        (15.35, [69, 72, 76, 79, 84], [0, 1, 3, 2, 4, 3, 2, 1], 0.32, 0.142), # Fmaj9
        (17.65, [69, 72, 76, 79, 83], [0, 1, 2, 3, 2, 1, 2, 3], 0.26, 0.130), # Am9 (training focus)
        (20.55, [67, 71, 74, 76, 83], [0, 1, 2, 3, 4, 3, 4, 2], 0.30, 0.140), # G6 (backprop build)
        (23.15, [69, 72, 76, 79, 84], [0, 1, 2, 3, 4, 3, 2, 1], 0.32, 0.142), # Fmaj9
        (25.75, [72, 74, 76, 79, 83], [0, 1, 2, 3, 4, 3, 2, 3], 0.28, 0.148), # Cmaj9 (top match lock)
        (27.60, [67, 71, 74, 76, 83], [0, 1, 2, 3, 4, 3, 2, 1], 0.26, 0.140), # G6
        (30.00, [72, 74, 76, 79, 84], [0, 1, 2, 3, 4, 3, 4, 4], 0.22, 0.145), # Cmaj9 finale
    ]

    step_idx = 0
    cur = 0.0
    while cur < DURATION - 0.65:
        # Leave graceful breath on step 7 of each 8-step bar so phrases stay clean and spacious
        if step_idx % 8 != 7:
            sec = next((s for s in arp_sections if cur < s[0]), arp_sections[-1])
            _, notes, pat, pan_amt, base_g = sec
            midi_note = notes[pat[step_idx % len(pat)]]
            freq = midi_to_hz(midi_note)
            vel = 1.0 if (step_idx % 2 == 0) else 0.72
            pan = -pan_amt if (step_idx % 2 == 0) else pan_amt
            pluck = synth_crystalline_pluck(freq, dur=0.72, gain=base_g * vel)
            add_stereo_event(arp_bus, pan_stereo(pluck, pan), cur)
        step_idx += 1
        cur = step_idx * eighth_dur

    # Add delicate stereo eighth-note ping-pong shimmer to the arpeggio layer
    arp_bus = apply_stereo_shimmer_delay(arp_bus, delay_sec=eighth_dur, feedback=0.26)
    arp_bus[:, 0] = peaking_eq(arp_bus[:, 0], 1800.0, 0.9, -2.5)
    arp_bus[:, 1] = peaking_eq(arp_bus[:, 1], 1800.0, 0.9, -2.5)
    bgm += arp_bus

    # 4. Muted Precision Pulse at 96 BPM (quarter = 0.625s, eighth = 0.3125s)
    quarter_dur = 60.0 / 96.0  # 0.625 s
    eighth_idx = 0
    pos = 0.0
    while pos < DURATION - 0.85:
        if eighth_idx % 2 == 0:
            beat_idx = eighth_idx // 2
            is_down = (beat_idx % 4 == 0)
            p = synth_precision_pulse("downbeat" if is_down else "quarter", gain=0.105 if is_down else 0.072)
            add_stereo_event(bgm, pan_stereo(p, -0.04 if is_down else 0.04), pos)
        elif 5.0 <= pos <= 25.8:
            # Subtle muted 8th-note precision tick through active engine beats 2-5
            p = synth_precision_pulse("eighth_tick", gain=0.042)
            add_stereo_event(bgm, pan_stereo(p, 0.16 if (eighth_idx % 4 == 1) else -0.16), pos)
        eighth_idx += 1
        pos = eighth_idx * eighth_dur

    # Clean fade-in (0.20s) and smooth tail fade-out (0.85s) + gentle +0.6 dB trim
    fade_in = int(0.20 * SR)
    fade_out = int(0.85 * SR)
    bgm[:fade_in] *= np.linspace(0.0, 1.0, fade_in, dtype=np.float32)[:, None]
    bgm[-fade_out:] *= np.linspace(1.0, 0.0, fade_out, dtype=np.float32)[:, None]
    return (bgm * 1.07).astype(np.float32)


def _bandpass_swept_noise(
    dur: float,
    f_start: float,
    f_end: float,
    bw_ratio: float = 0.45,
    seed: int = 101,
) -> np.ndarray:
    """Generate smooth frequency-swept bandpass air/energy noise with zero clicks."""
    rng = np.random.default_rng(seed)
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros(0, dtype=np.float32)

    noise = rng.standard_normal(n).astype(np.float32)
    num_segs = 28
    seg_hop = max(64, n // num_segs)
    win_len = min(n, seg_hop * 2)
    hann = np.hanning(win_len).astype(np.float32)
    out = np.zeros(n, dtype=np.float32)
    norm = np.zeros(n, dtype=np.float32)

    pos = 0
    while pos < n:
        frac = min(1.0, pos / max(1, n - 1))
        fc = f_start + (f_end - f_start) * frac
        lo = max(60.0, fc * (1.0 - bw_ratio * 0.5))
        hi = min(SR * 0.42, fc * (1.0 + bw_ratio * 0.8))
        if hi <= lo + 20.0:
            hi = lo + 40.0
        end = min(n, pos + win_len)
        seg_n = end - pos
        if seg_n >= 16:
            filt = butter_filter(noise[pos:end], "band", (lo, hi), order=2)
            w = hann[:seg_n]
            out[pos:end] += filt * w
            norm[pos:end] += w
        pos += seg_hop

    mask = norm > 1e-4
    out[mask] /= norm[mask]
    return out.astype(np.float32)


def synth_sfx(sfx_type: str) -> np.ndarray:
    """Synthesize all 13 tailored futuristic tech Foley SFX matching timeline.json sfxEvents."""
    if sfx_type == "holo_boot":
        # Holographic system ignition: clean sub-anchor + rising crystal power-up triad
        dur = 0.90
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        out = np.zeros(n, dtype=np.float32)
        # Soft warm power thump
        f_sub = 115.0 * (0.48 ** np.clip(t / 0.11, 0.0, 1.0))
        out += np.sin(2.0 * math.pi * np.cumsum(f_sub) / SR) * np.exp(-t * 18.0) * 0.36
        # Rising glassy hologram harmonics (A4 -> E5 -> B5)
        tones = [(0.02, 440.0, 0.28, 4.5), (0.07, 659.25, 0.26, 4.8), (0.12, 987.77, 0.22, 5.2)]
        for delay_s, fr, amp, dec in tones:
            d = int(round(delay_s * SR))
            tt = t[: n - d]
            tone = 0.80 * np.sin(2.0 * math.pi * fr * tt) + 0.20 * np.sin(2.0 * math.pi * (fr * 2.0) * tt)
            att = np.clip(tt / 0.008, 0.0, 1.0)
            out[d:] += tone * np.exp(-tt * dec) * att * amp
        air = _bandpass_swept_noise(dur, 480.0, 2600.0, bw_ratio=0.50, seed=101)
        air_env = np.sin(math.pi * np.clip(t / 0.45, 0.0, 1.0)) * np.exp(-t * 3.5)
        out += air * air_env * 0.25
        fade = min(n, int(0.05 * SR))
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return out.astype(np.float32)

    if sfx_type == "prism_split":
        # Crystal prism refraction splitting messy input into aligned stereo vector shards
        dur = 0.95
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        left = np.zeros(n, dtype=np.float32)
        right = np.zeros(n, dtype=np.float32)

        # Center crystal strike
        strike = (
            0.48 * np.sin(2.0 * math.pi * 1318.51 * t) * np.exp(-t * 8.5)
            + 0.26 * np.sin(2.0 * math.pi * 2637.02 * t) * np.exp(-t * 13.0)
        ) * np.clip(t / 0.003, 0.0, 1.0)
        left += strike * 0.65
        right += strike * 0.65

        # Cascading split shards fanned L/R across stereo field
        shards = [
            (0.03, 1046.50, -0.55, 0.26),
            (0.06, 1318.51, 0.55, 0.25),
            (0.09, 1567.98, -0.75, 0.23),
            (0.12, 1975.53, 0.75, 0.21),
            (0.15, 2349.32, 0.00, 0.18),
        ]
        for delay_s, fr, pan, amp in shards:
            d = int(round(delay_s * SR))
            tt = t[: n - d]
            w = (0.78 * np.sin(2.0 * math.pi * fr * tt) + 0.22 * np.sin(2.0 * math.pi * (fr * 2.0) * tt))
            w = w * np.exp(-tt * 7.8) * np.clip(tt / 0.004, 0.0, 1.0) * amp
            ang = (pan + 1.0) * (math.pi / 4.0)
            left[d:] += w * math.cos(ang)
            right[d:] += w * math.sin(ang)

        refract_air = _bandpass_swept_noise(dur, 1800.0, 5600.0, bw_ratio=0.55, seed=202)
        air_env = np.sin(math.pi * np.clip(t / 0.35, 0.0, 1.0)) * np.exp(-t * 4.5)
        left += refract_air * air_env * 0.28
        right += refract_air * air_env * 0.28

        fade = min(n, int(0.06 * SR))
        left[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        right[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return np.stack([left, right], axis=-1).astype(np.float32)

    if sfx_type == "layer_surge":
        # Smooth upward energy glide into the 4-layer neural core
        dur = 0.85
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        air = _bandpass_swept_noise(dur, 240.0, 2100.0, bw_ratio=0.55, seed=303)
        env = (np.sin(math.pi * t / dur) ** 1.25) * np.exp(-t * 1.1)
        f_glide = 180.0 + 360.0 * (t / dur) ** 1.1
        ph = 2.0 * math.pi * np.cumsum(f_glide) / SR
        synth_swell = (0.65 * np.sin(ph) + 0.35 * np.sin(1.5 * ph)) * env * 0.26
        sub_lift = np.sin(2.0 * math.pi * np.cumsum(65.0 + 35.0 * (t / dur)) / SR) * env * 0.22
        return (air * env * 0.78 + synth_swell + sub_lift).astype(np.float32)

    if sfx_type == "synapse_spark":
        # Fast electric-glass synaptic firing cascade across weighted axon lines
        dur = 0.55
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        rng = np.random.default_rng(404)
        out = np.zeros(n, dtype=np.float32)
        sparks = [(0.00, 987.77, 0.45), (0.055, 1318.51, 0.42), (0.11, 1661.22, 0.37), (0.17, 2093.00, 0.32)]
        for delay_s, fr, amp in sparks:
            d = int(round(delay_s * SR))
            m = n - d
            tt = t[:m]
            zap = butter_filter(rng.standard_normal(m).astype(np.float32), "band", (2800.0, 7600.0), order=2)
            crackle = zap * np.exp(-tt * 150.0) * 0.44
            ping = (0.75 * np.sin(2.0 * math.pi * fr * tt) + 0.25 * np.sin(2.0 * math.pi * (fr * 2.0) * tt))
            ping = ping * np.exp(-tt * 22.0) * np.clip(tt / 0.002, 0.0, 1.0)
            out[d:] += (ping + crackle) * amp
        fade = min(n, int(0.04 * SR))
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return out.astype(np.float32)

    if sfx_type == "attention_lock":
        # Twin gyroscope rings spinning into magnetic-optical alignment lock
        dur = 0.72
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        rng = np.random.default_rng(505)
        out = np.zeros(n, dtype=np.float32)

        # Dual counter-sweeping gyro resonance converging at t=0.18s
        gyro_env = np.exp(-((t - 0.10) ** 2) / (2.0 * 0.065 ** 2))
        f_up = 340.0 + 440.0 * np.clip(t / 0.18, 0.0, 1.0)
        f_dn = 1480.0 - 700.0 * np.clip(t / 0.18, 0.0, 1.0)
        out += 0.22 * np.sin(2.0 * math.pi * np.cumsum(f_up) / SR) * gyro_env
        out += 0.18 * np.sin(2.0 * math.pi * np.cumsum(f_dn) / SR) * gyro_env

        # Crisp magnetic-glass detent lock at t=0.16s
        d = int(round(0.16 * SR))
        tt = t[: n - d]
        snap_noise = butter_filter(rng.standard_normal(n - d).astype(np.float32), "band", (2000.0, 5600.0), order=2)
        snap = snap_noise * np.exp(-tt * 145.0) * 0.45
        thump = np.sin(2.0 * math.pi * 118.0 * tt) * np.exp(-tt * 38.0) * 0.38
        lock_ring = (0.55 * np.sin(2.0 * math.pi * 783.99 * tt) + 0.30 * np.sin(2.0 * math.pi * 1567.98 * tt)) * np.exp(-tt * 8.5) * 0.44
        out[d:] += (snap + thump + lock_ring) * np.clip(tt / 0.002, 0.0, 1.0)

        fade = min(n, int(0.05 * SR))
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return out.astype(np.float32)

    if sfx_type == "arc_shimmer":
        # Luminous curved golden-cyan attention beams fanning across stereo field
        dur = 0.95
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        left = np.zeros(n, dtype=np.float32)
        right = np.zeros(n, dtype=np.float32)

        beams = [
            (0.00, 880.00, -0.45, 0.30),
            (0.05, 1046.50, 0.45, 0.28),
            (0.10, 1318.51, -0.65, 0.25),
            (0.15, 1567.98, 0.65, 0.23),
            (0.20, 1975.53, 0.15, 0.20),
        ]
        for delay_s, fr, pan, amp in beams:
            d = int(round(delay_s * SR))
            tt = t[: n - d]
            shimmer_mod = 1.0 + 0.003 * np.sin(2.0 * math.pi * 5.5 * tt)
            tone = 0.80 * np.sin(2.0 * math.pi * np.cumsum(fr * shimmer_mod) / SR) + 0.20 * np.sin(2.0 * math.pi * (fr * 2.0) * tt)
            tone = tone * np.exp(-tt * 4.8) * np.clip(tt / 0.015, 0.0, 1.0) * amp
            ang = (pan + 1.0) * (math.pi / 4.0)
            left[d:] += tone * math.cos(ang)
            right[d:] += tone * math.sin(ang)

        air = _bandpass_swept_noise(dur, 2400.0, 6200.0, bw_ratio=0.50, seed=606)
        air_env = np.sin(math.pi * t / dur) ** 1.3
        left += air * air_env * 0.22
        right += air * air_env * 0.22

        fade = min(n, int(0.06 * SR))
        left[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        right[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return np.stack([left, right], axis=-1).astype(np.float32)

    if sfx_type == "forward_guess":
        # Quick forward propagation computation zip ending in a slightly uncertain soft ping
        dur = 0.55
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        out = np.zeros(n, dtype=np.float32)
        # Forward upward zip (0..0.18s)
        zip_mask = t < 0.22
        f_zip = 310.0 + 780.0 * np.clip(t / 0.18, 0.0, 1.0) ** 1.3
        zip_env = np.sin(math.pi * np.clip(t / 0.22, 0.0, 1.0)) * zip_mask
        out += np.sin(2.0 * math.pi * np.cumsum(f_zip) / SR) * zip_env * 0.34
        air = _bandpass_swept_noise(0.24, 500.0, 2200.0, bw_ratio=0.50, seed=707)
        out[: len(air)] += air * np.sin(math.pi * np.linspace(0.0, 1.0, len(air), dtype=np.float32)) * 0.30
        # Soft tentative prediction ping at t=0.17s
        d = int(round(0.17 * SR))
        tt = t[: n - d]
        guess = (0.60 * np.sin(2.0 * math.pi * 659.25 * tt) + 0.35 * np.sin(2.0 * math.pi * 698.46 * tt))
        out[d:] += guess * np.exp(-tt * 9.0) * np.clip(tt / 0.004, 0.0, 1.0) * 0.34
        return out.astype(np.float32)

    if sfx_type == "loss_error_ping":
        # Coral error pulse at Loss Ring: clear, refined minor-2nd/tritone telemetry alert
        dur = 0.65
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        # Warm low warning thump
        thump = np.sin(2.0 * math.pi * np.cumsum(145.0 - 55.0 * np.clip(t / 0.12, 0.0, 1.0)) / SR) * np.exp(-t * 19.0) * 0.36
        # Dual crisp telemetry delta ping (t=0ms and t=85ms descending minor interval)
        out = thump.copy()
        alerts = [(0.00, 932.33, 659.25, 0.34, 10.5), (0.085, 783.99, 554.37, 0.32, 7.5)]
        for delay_s, f1, f2, amp, dec in alerts:
            d = int(round(delay_s * SR))
            tt = t[: n - d]
            bell = 0.65 * np.sin(2.0 * math.pi * f1 * tt) + 0.35 * np.sin(2.0 * math.pi * f2 * tt)
            out[d:] += bell * np.exp(-tt * dec) * np.clip(tt / 0.003, 0.0, 1.0) * amp
        fade = min(n, int(0.05 * SR))
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return out.astype(np.float32)

    if sfx_type == "backprop_sweep":
        # Emerald backpropagation wave sweeping backward through 4 neural layers tuning weights
        dur = 1.65
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        # Smooth downward resonant wave
        air = _bandpass_swept_noise(dur, 2400.0, 260.0, bw_ratio=0.55, seed=909)
        wave_env = (np.sin(math.pi * t / dur) ** 1.15) * np.exp(-t * 0.45)
        f_wave = 880.0 * (0.28 ** np.clip(t / 1.35, 0.0, 1.0))
        harmonic_wave = (
            0.70 * np.sin(2.0 * math.pi * np.cumsum(f_wave) / SR)
            + 0.30 * np.sin(2.0 * math.pi * np.cumsum(f_wave * 1.5) / SR)
        ) * wave_env * 0.28
        out = air * wave_env * 0.68 + harmonic_wave

        # 5 crisp downward weight-tuning calibration ticks (from Layer 3 back down to Layer 0)
        ticks = [(0.12, 1318.51), (0.36, 1046.50), (0.60, 880.00), (0.84, 659.25), (1.08, 523.25)]
        for delay_s, fr in ticks:
            d = int(round(delay_s * SR))
            tt = t[: n - d]
            tick = (0.78 * np.sin(2.0 * math.pi * fr * tt) + 0.22 * np.sin(2.0 * math.pi * (fr * 2.0) * tt))
            out[d:] += tick * np.exp(-tt * 14.0) * np.clip(tt / 0.002, 0.0, 1.0) * 0.24

        fade = min(n, int(0.08 * SR))
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return out.astype(np.float32)

    if sfx_type == "softmax_rise":
        # Ascending harmonic swell as 5 crystal probability columns calibrate scores
        dur = 1.25
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        air = _bandpass_swept_noise(dur, 320.0, 2800.0, bw_ratio=0.50, seed=1010)
        air_env = np.sin(math.pi * t / dur) ** 1.3
        out = air * air_env * 0.45

        # 5 rising crystal column calibration pings (Fmaj9 -> Cmaj9 climb)
        cols = [(0.05, 523.25), (0.20, 659.25), (0.35, 783.99), (0.50, 987.77), (0.65, 1174.66)]
        for delay_s, fr in cols:
            d = int(round(delay_s * SR))
            tt = t[: n - d]
            ping = 0.80 * np.sin(2.0 * math.pi * fr * tt) + 0.20 * np.sin(2.0 * math.pi * (fr * 2.0) * tt)
            out[d:] += ping * np.exp(-tt * 6.5) * np.clip(tt / 0.010, 0.0, 1.0) * 0.22

        fade = min(n, int(0.08 * SR))
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return out.astype(np.float32)

    if sfx_type == "top_match_lock":
        # Flagship 92% match confirmation lock: crisp sub punch + tactile snap + radiant Cmaj lock chord
        dur = 0.95
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        rng = np.random.default_rng(1111)

        # Warm punchy sub-thump
        f_sub = 135.0 * (0.42 ** np.clip(t / 0.07, 0.0, 1.0))
        sub = np.sin(2.0 * math.pi * np.cumsum(f_sub) / SR) * np.exp(-t * 22.0) * 0.42
        # Precision optical micro-snap
        snap = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (2600.0, 6800.0), order=2)
        snap = snap * np.exp(-t * 170.0) * 0.40

        # Radiant crystalline confirmation dyad/triad (G5 lead-in -> C6 + E6 + G6)
        out = sub + snap
        tones = [(0.00, 783.99, 0.26, 6.2), (0.045, 1046.50, 0.34, 4.4), (0.045, 1318.51, 0.24, 4.8), (0.045, 1567.98, 0.18, 5.4)]
        for delay_s, fr, amp, dec in tones:
            d = int(round(delay_s * SR))
            tt = t[: n - d]
            tone = 0.82 * np.sin(2.0 * math.pi * fr * tt) + 0.18 * np.sin(2.0 * math.pi * (fr * 2.0) * tt)
            out[d:] += tone * np.exp(-tt * dec) * np.clip(tt / 0.004, 0.0, 1.0) * amp

        fade = min(n, int(0.06 * SR))
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return out.astype(np.float32)

    if sfx_type == "core_swell":
        # Wide cinematic harmonic bloom during the full hero pullback finale
        dur = 1.85
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        env = adsr_env(n, attack=0.55, decay=0.30, sustain=0.70, release=0.75)

        air = _bandpass_swept_noise(dur, 320.0, 3200.0, bw_ratio=0.58, seed=1212)
        # Warm Cmaj9/G harmonic bloom rising softly
        bloom = (
            0.40 * np.sin(2.0 * math.pi * 261.63 * t)
            + 0.30 * np.sin(2.0 * math.pi * 392.00 * t)
            + 0.20 * np.sin(2.0 * math.pi * 523.25 * t)
            + 0.12 * np.sin(2.0 * math.pi * 659.25 * t)
        )
        sub = np.sin(2.0 * math.pi * 65.41 * t) * 0.22
        return ((air * 0.42 + bloom * 0.48 + sub) * env * 0.80).astype(np.float32)

    if sfx_type == "outro_chime":
        # Clean resolving Cmaj9 crystalline bell cascade ending cleanly before 30.0s
        dur = 1.02
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        out = np.zeros(n, dtype=np.float32)
        tones = [
            (0.00, 523.25, 0.28, 3.6),   # C5
            (0.045, 659.25, 0.25, 3.8),  # E5
            (0.090, 783.99, 0.23, 4.0),  # G5
            (0.135, 987.77, 0.19, 4.4),  # B5
            (0.180, 1174.66, 0.17, 4.8), # D6
        ]
        for delay_s, fr, amp, dec in tones:
            d = int(round(delay_s * SR))
            if d < n:
                tt = t[: n - d]
                tri = (2.0 / math.pi) * np.arcsin(np.sin(2.0 * math.pi * fr * tt))
                tone = 0.80 * np.sin(2.0 * math.pi * fr * tt) + 0.20 * tri
                out[d:] += tone * np.exp(-tt * dec) * np.clip(tt / 0.006, 0.0, 1.0) * amp
        fade = min(n, int(0.16 * SR))
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return out.astype(np.float32)

    return np.zeros(int(0.1 * SR), dtype=np.float32)


def main() -> None:
    timeline = load_timeline(TIMELINE_PATH)

    print("[Audio] Synthesizing Kokoro tech-documentary narration (am_michael, en-us)...")
    dialogue_bus, speaker_mono_buses, manifest_lines = synthesize_dialogue(timeline)

    print("[Audio] Synthesizing futuristic ambient tech underscore (96 BPM, Am9/Fmaj9/Cmaj9/G6)...")
    bgm_bus = generate_bgm()

    sfx_events = timeline.get("sfxEvents", [])
    print(f"[Audio] Synthesizing {len(sfx_events)} synchronized tech Foley SFX events...")
    sfx_bus = np.zeros((TOTAL_SAMPLES, CHANNELS), dtype=np.float32)
    for ev in sfx_events:
        wav = synth_sfx(ev["type"]) * float(ev.get("gain", 0.60))
        pan = float(ev.get("pan", 0.0))
        if wav.ndim == 2:
            # Apply gentle pan balance if event already carries stereo spread
            ang = (float(np.clip(pan, -1.0, 1.0)) + 1.0) * (math.pi / 4.0)
            wav = np.stack([wav[:, 0] * math.cos(ang) * 1.414, wav[:, 1] * math.sin(ang) * 1.414], axis=-1).astype(np.float32)
        else:
            wav = pan_stereo(wav, pan)
        add_stereo_event(sfx_bus, wav, float(ev["time"]))

    master_and_export(PROJECT_ROOT, timeline, dialogue_bus, bgm_bus, sfx_bus, speaker_mono_buses, manifest_lines)


if __name__ == "__main__":
    main()
