# How AI Works — 3D Neural Core Explainer (`1080×1920`, 30s)

A 30-second, 9:16 vertical 3D animated explainer visualizing how modern artificial intelligence works across six continuous beats:

1. **01 • Input & Tokenization (`0.0–5.0s`)**: Messy raw data blocks flow through an optical prism ring and transform into ordered numerical vector embeddings.
2. **02 • Multi-Layer Neural Network (`5.0–10.2s`)**: 34 translucent neurons and 116 weighted synaptic pathways transmit signals layer by layer.
3. **03 • Self-Attention & Context (`10.2–15.4s`)**: Twin counter-rotating Attention Gyroscope Rings and curved golden-cyan attention arcs correlate distant tokens simultaneously.
4. **04 • Training & Backpropagation (`15.4–20.6s`)**: A forward prediction guess hits the Error Loss Ring in coral, then fires an emerald backpropagation wave downward to tune synaptic weights.
5. **05 • Probability Prediction (`20.6–25.8s`)**: Five Softmax crystal columns compute candidate scores (`2%`, `5%`, `92%`, `0.8%`, `0.2%`) and lock onto the top match.
6. **06 • Converged Intelligence (`25.8–30.0s`)**: Full-stack hero view of the synchronized neural architecture operating end to end.

## Architecture & Pipeline
- **3D Scene**: Three.js (`src/scene/neuralCoreRig.js`, `src/scene/holoChamber.js`), strict 3-light studio setup, `THREE.FogExp2`, instanced axons/pulses/tokens (`27` peak draw calls, `25,418` triangles).
- **Camera & HUD**: Cubic-eased documentary director (`src/camera/director.js`) and Clean Frame + Boxless YouTube Subtitle compositor (`src/hud/aiHud.js`, `src/engine/hudCompositor.js`) using offscreen `subCanvas` anti-bleed fade compositing.
- **Audio**: `Kokoro ONNX` (`am_michael`, `en-us`) narration, custom 96 BPM ambient synth underscore, and 13 synchronized Foley SFX (`audio/generate_audio.py`, `audio/dspCore.py`) mastered at `-13.3 LUFS` (`-2.2 dBFS` peak).
- **Render**: Headless Google Chrome SwiftShader WebGL + native `VideoEncoder` H.264 High Profile muxed with FFmpeg -> `output/ai_how_it_works.mp4`.
