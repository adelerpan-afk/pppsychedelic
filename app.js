// app.js - Psychedelic Generator with STREAMING EXPORT, Context Loss Handling & Retry

// ============================================================================
// CONFIGURATION
// ============================================================================
const CPU_THREADS = navigator.hardwareConcurrency || 8;
const RENDER_WORKERS = Math.min(6, Math.max(3, CPU_THREADS - 3));

const DEFAULT_PALETTES = {
    rainbow: [[1, 0, 0], [1, 0.65, 0], [1, 1, 0], [0, 1, 0], [0, 0.5, 1], [0.5, 0, 1]],
    neon: [[1, 0, 1], [0, 1, 1], [1, 0, 1], [0, 1, 1], [1, 0, 1], [0, 1, 1]],
    sunset: [[1, 0.2, 0.2], [1, 0.4, 0], [1, 0.8, 0.2], [0.8, 0.2, 0.4], [1, 0.3, 0.1], [0.9, 0.5, 0.1]],
    ocean: [[0, 0.3, 0.6], [0, 0.6, 0.8], [0.1, 0.8, 0.6], [0, 0.4, 0.7], [0.2, 0.7, 0.5], [0, 0.5, 0.8]],
    cosmic: [[0.2, 0, 0.5], [0.5, 0, 0.8], [0.1, 0.1, 0.8], [0.8, 0.1, 0.5], [0.3, 0, 0.6], [0.6, 0.1, 0.7]],
    acid: [[0.4, 0.9, 0.2], [0.2, 0.8, 0.3], [0.5, 1, 0.1], [0.1, 0.7, 0.5], [0.3, 0.9, 0.4], [0.6, 0.8, 0.2]],
};

// ============================================================================
// MAIN APPLICATION CLASS
// ============================================================================
class PsychedelicGenerator {
    constructor(canvas, gl) {
        this.canvas = canvas;
        this.gl = gl;
        this.isPaused = false;
        this.isGenerating = false;
        this.isCancelled = false;
        this.batchSettings = null;
        this.batchCancelled = false;
        this.startTime = Date.now();
        this.renderWorkers = [];
        this.currentPalette = [...DEFAULT_PALETTES.rainbow];
        this.currentPaletteName = 'rainbow';
        this.currentFormat = 'png';

        this.state = {
            distortion: 1.5,
            complexity: 3,
            speed: 0.5,
            scale: 2.0,
            aspectRatio: '16:9',
            resolution: '2160',
            fps: 30,
            duration: 5
        };

        this.initWebGL();
        this.initUniforms();
        this.bindEvents();
        this.resize();
        this.animate();
    }

    initWebGL() {
        const gl = this.gl;
        const vsSource = `#version 100
            attribute vec2 a_position;
            varying vec2 v_uv;
            uniform float u_time;
            uniform float u_loopDuration;
            void main() {
                float angle = (u_loopDuration > 0.0) ? (6.28318530718 * u_time / u_loopDuration) : 0.0;
                float breathe = 1.02 + 0.02 * sin(angle);
                gl_Position = vec4(a_position * breathe, 0.0, 1.0);
                v_uv = (a_position + 1.0) / 2.0;
            }`;
        const fsSource = `#version 100
            precision highp float;
            varying vec2 v_uv;
            uniform float u_time, u_distortion, u_complexity, u_speed, u_scale, u_aspect, u_loopDuration;
            uniform vec3 u_p0, u_p1, u_p2, u_p3, u_p4, u_p5;
            uniform float u_pCount;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p) {
                vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                           mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
            }
            float fbm(vec2 p) {
                float v = 0.0, a = 0.5, f = 1.0;
                for (int i = 0; i < 8; i++) { if (float(i) >= u_complexity) break; v += a * noise(p * f); f *= 2.0; a *= 0.6; }
                return v;
            }
            vec3 computePattern(vec2 w, float t) {
                float d1 = fbm(w + vec2(t * 0.3, t * 0.2));
                float d2 = fbm(w + vec2(d1 * u_distortion + t * 0.1, d1 * u_distortion - t * 0.15));
                float d3 = fbm(w + vec2(d2 * u_distortion * 1.5 - t * 0.05, d2 * u_distortion * 1.5 + t * 0.08));
                float c = (sin(w.x * 3.0 + d2 * 4.0 + t) * cos(w.y * 3.0 + d1 * 4.0 - t * 0.7) * 0.5 +
                           cos(w.x * 5.0 + d3 * 3.0 - t * 0.5) * sin(w.y * 5.0 + d2 * 3.0 + t * 0.6) * 0.3 +
                           sin((w.x + w.y) * 4.0 + d1 * 5.0 + t * 0.4) * 0.2 + d3 * 0.8) * 0.5 + 0.5;
                float idx = c * (u_pCount - 1.0);
                vec3 col;
                if (idx < 1.0) col = mix(u_p0, u_p1, idx);
                else if (idx < 2.0) col = mix(u_p1, u_p2, idx - 1.0);
                else if (idx < 3.0) col = mix(u_p2, u_p3, idx - 2.0);
                else if (idx < 4.0) col = mix(u_p3, u_p4, idx - 3.0);
                else col = mix(u_p4, u_p5, clamp(idx - 4.0, 0.0, 1.0));
                col *= 0.7 + 0.5 * (d2 * 0.5 + 0.5);
                return col;
            }
            void main() {
                vec2 uv = v_uv; uv.x *= u_aspect; vec2 w = uv * u_scale;
                float t = u_time * u_speed;
                vec3 col;
                if (u_loopDuration > 0.0) {
                    float loopT = u_loopDuration * u_speed;
                    float blend = clamp(u_time / u_loopDuration, 0.0, 1.0);
                    vec3 colA = computePattern(w, t);
                    vec3 colB = computePattern(w, t - loopT);
                    col = mix(colA, colB, blend);
                } else {
                    col = computePattern(w, t);
                }
                float vig = clamp(1.0 - length(v_uv - 0.5) * 1.2, 0.0, 1.0);
                col *= vig * 0.9 + 0.2;
                gl_FragColor = vec4(col, 1.0);
            }`;

        function createShader(type, src) {
            const s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            return s;
        }
        const program = gl.createProgram();
        gl.attachShader(program, createShader(gl.VERTEX_SHADER, vsSource));
        gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fsSource));
        gl.linkProgram(program);
        gl.useProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        this.program = program;
    }

    initUniforms() {
        const gl = this.gl;
        const program = this.program;
        this.uniforms = {
            time: gl.getUniformLocation(program, 'u_time'),
            distortion: gl.getUniformLocation(program, 'u_distortion'),
            complexity: gl.getUniformLocation(program, 'u_complexity'),
            speed: gl.getUniformLocation(program, 'u_speed'),
            scale: gl.getUniformLocation(program, 'u_scale'),
            aspect: gl.getUniformLocation(program, 'u_aspect'),
            loopDuration: gl.getUniformLocation(program, 'u_loopDuration'),
            pCount: gl.getUniformLocation(program, 'u_pCount'),
            p0: gl.getUniformLocation(program, 'u_p0'),
            p1: gl.getUniformLocation(program, 'u_p1'),
            p2: gl.getUniformLocation(program, 'u_p2'),
            p3: gl.getUniformLocation(program, 'u_p3'),
            p4: gl.getUniformLocation(program, 'u_p4'),
            p5: gl.getUniformLocation(program, 'u_p5'),
        };
        this.updatePaletteUniforms(this.currentPalette);
    }

    padPaletteTo6(palette) {
        if (palette.length >= 6) return palette.slice(0, 6);
        const padded = [...palette];
        while (padded.length < 6) padded.push([...palette[palette.length - 1]]);
        return padded;
    }

    updatePaletteUniforms(palette) {
        const gl = this.gl;
        const padded = this.padPaletteTo6(palette);
        gl.uniform3fv(this.uniforms.p0, padded[0]);
        gl.uniform3fv(this.uniforms.p1, padded[1]);
        gl.uniform3fv(this.uniforms.p2, padded[2]);
        gl.uniform3fv(this.uniforms.p3, padded[3]);
        gl.uniform3fv(this.uniforms.p4, padded[4]);
        gl.uniform3fv(this.uniforms.p5, padded[5]);
        gl.uniform1f(this.uniforms.pCount, palette.length);
    }

    getCanvasSize() {
        const height = parseInt(this.state.resolution);
        const [w, h] = this.state.aspectRatio.split(':').map(Number);
        return { width: Math.floor(height * w / h), height };
    }

    resize() {
        const { width, height } = this.getCanvasSize();
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
        this.gl.uniform1f(this.uniforms.aspect, width / height);
        document.getElementById('ratioIndicator').textContent = `${this.state.aspectRatio} (${width}×${height})`;
        const resText = height >= 4320 ? '8K' : height >= 2160 ? '4K' : height >= 1080 ? '1080p' : '720p';
        document.getElementById('resValue').textContent = resText;
        return { width, height };
    }

    animate() {
        if (!this.isPaused && !this.isGenerating) {
            const rawElapsed = (Date.now() - this.startTime) / 1000;
            const loopDuration = this.state.duration;
            const elapsed = loopDuration > 0 ? (rawElapsed % loopDuration) : rawElapsed;
            this.gl.uniform1f(this.uniforms.time, elapsed);
            this.gl.uniform1f(this.uniforms.loopDuration, loopDuration);
            this.gl.uniform1f(this.uniforms.distortion, this.state.distortion);
            this.gl.uniform1f(this.uniforms.complexity, this.state.complexity);
            this.gl.uniform1f(this.uniforms.speed, this.state.speed);
            this.gl.uniform1f(this.uniforms.scale, this.state.scale);
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
        }
        requestAnimationFrame(() => this.animate());
    }

    exportSingleImage() {
        const format = this.currentFormat;
        const link = document.createElement('a');
        link.download = `psychedelic-${this.canvas.width}x${this.canvas.height}-${Date.now()}.${format}`;
        link.href = this.canvas.toDataURL(`image/${format === 'jpeg' ? 'jpeg' : format}`, 0.95);
        link.click();
        this.showToast(`✅ Exported as ${format.toUpperCase()}`);
    }

    setPalette(name) {
        if (name === 'custom') return;
        this.currentPaletteName = name;
        this.currentPalette = [...DEFAULT_PALETTES[name]];
        this.updatePaletteUniforms(this.currentPalette);
        document.getElementById('customPaletteInput').value = '';
        document.getElementById('customPalettePreview').innerHTML = '';
    }

    applyCustomPalette(hexInput) {
        const parsed = this.parseCustomPalette(hexInput);
        if (!parsed || parsed.length < 2) {
            this.showToast('❌ Invalid palette! Need at least 2 colors');
            return false;
        }
        this.currentPalette = parsed;
        this.currentPaletteName = 'custom';
        this.updatePaletteUniforms(parsed);
        this.updateCustomPreview(parsed);
        document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active', 'custom-active'));
        const customBtn = document.querySelector('.preset-btn[data-palette="custom"]');
        if (customBtn) customBtn.classList.add('active', 'custom-active');
        this.showToast(`✅ Custom palette diterapkan (${parsed.length} warna)`);
        return true;
    }

    parseCustomPalette(input) {
        const parsed = [];
        for (const color of input.split(',').map(c => c.trim()).filter(c => c)) {
            const rgb = this.hexToRgb(color);
            if (rgb) parsed.push(rgb);
            if (parsed.length >= 6) break;
        }
        return parsed.length >= 2 ? parsed : null;
    }

    hexToRgb(hex) {
        hex = hex.replace('#', '').trim();
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        if (hex.length !== 6) return null;
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return isNaN(r) ? null : [r / 255, g / 255, b / 255];
    }

    updateCustomPreview(palette) {
        const container = document.getElementById('customPalettePreview');
        container.innerHTML = palette.map(c => {
            const hex = '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
            return `<div class="custom-swatch" style="background:${hex};"></div>`;
        }).join('');
    }

    // ========================================================================
    // STREAMING EXPORT – MENULIS LANGSUNG KE FOLDER (TANPA ZIP)
    // ========================================================================
    async startGenerationStreaming(opts = {}) {
        if (this.isGenerating) return;
        if (window.location.protocol === 'file:') {
            this.showToast('❌ Cannot export from file://! Use http://localhost:8000');
            return;
        }

        let dirHandle = opts.dirHandle;
        if (!dirHandle) {
            try {
                dirHandle = await window.showDirectoryPicker();
            } catch (err) {
                if (err.name !== 'AbortError') {
                    this.showToast('❌ Folder selection failed');
                }
                return;
            }
        }

        const { width, height } = this.getCanvasSize();
        const totalFrames = this.state.fps * this.state.duration;

        if (totalFrames > 1000 && !opts.skipConfirm) {
            if (!confirm(`${totalFrames} frames. This may use a lot of disk space. Continue?`)) return;
        }

        // === SESUAIKAN JUMLAH WORKER BERDASARKAN RESOLUSI ===
        let workerCount = RENDER_WORKERS;
        const pixelCount = width * height;
        if (pixelCount > 3840 * 2160) { // >4K
            workerCount = Math.min(2, RENDER_WORKERS);
        } else if (pixelCount > 1920 * 1080) { // >1080p
            workerCount = Math.min(3, RENDER_WORKERS);
        } else {
            workerCount = Math.min(4, RENDER_WORKERS);
        }
        console.log(`🔧 Using ${workerCount} workers for ${width}x${height}`);

        // Setup UI
        this.isGenerating = true;
        this.isCancelled = false;
        const startTime = performance.now();
        let completed = 0;
        let totalSize = 0;

        document.getElementById('generatingOverlay').classList.add('active');
        document.getElementById('generateBtn').classList.add('generating');
        document.getElementById('generateBtn').textContent = opts.batchLabel ? `💾 Batch ${opts.batchLabel}` : '💾 STREAMING...';
        document.getElementById('generateBtn').disabled = true;
        document.getElementById('cancelBtn').style.display = 'block';
        document.getElementById('generatingProgressFill').style.width = '0%';
        document.getElementById('miniProgressFill').style.width = '0%';
        document.getElementById('exportStatus').innerHTML = `📁 Saving to: ${dirHandle.name}`;

        // Buat render workers
        const workerUrl = 'render.worker.js';
        this.renderWorkers = [];
        for (let i = 0; i < workerCount; i++) {
            this.renderWorkers.push(new Worker(workerUrl));
        }

        const queue = Array.from({ length: totalFrames }, (_, i) => i);
        const busy = new Array(workerCount).fill(false);
        const frameRetryCount = new Map(); // untuk retry frame yang gagal
        const MAX_RETRIES = 3;

        const updateProgress = () => {
            const progress = (completed / totalFrames) * 100;
            document.getElementById('generatingProgressFill').style.width = `${progress}%`;
            document.getElementById('miniProgressFill').style.width = `${progress}%`;
            document.getElementById('generatingDetails').textContent = `Writing: ${completed} / ${totalFrames} frames`;
            const elapsed = (performance.now() - startTime) / 1000;
            const fps = completed / elapsed || 0;
            document.getElementById('generatingSpeed').innerHTML = `⚡ ${fps.toFixed(1)} fps | 💾 ${(totalSize / 1024 / 1024).toFixed(1)} MB written`;
        };

        const dispatchNext = () => {
            if (this.isCancelled || queue.length === 0) return;
            for (let i = 0; i < workerCount && queue.length > 0; i++) {
                if (!busy[i]) {
                    const frameIndex = queue.shift();
                    busy[i] = true;
                    const worker = this.renderWorkers[i];

                    worker.onmessage = async (e) => {
                        busy[i] = false;

                        if (e.data.success && !this.isCancelled) {
                            const blob = e.data.blob;
                            const filename = `frame_${String(frameIndex).padStart(4, '0')}.png`;
                            try {
                                const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
                                const writable = await fileHandle.createWritable();
                                await writable.write(blob);
                                await writable.close();
                                totalSize += blob.size;
                                completed++;
                                updateProgress();
                                if (completed >= totalFrames) {
                                    const renderTime = (performance.now() - startTime) / 1000;
                                    this.showSummaryStreaming(width, height, totalFrames, totalSize, renderTime, dirHandle.name);
                                    this.resetGenerationUI();
                                    if (this._resolveGeneration) {
                                        this._resolveGeneration({ status: 'complete' });
                                        this._resolveGeneration = null;
                                    }
                                    // terminate workers
                                    this.renderWorkers.forEach(w => w.terminate());
                                    this.renderWorkers = [];
                                } else {
                                    dispatchNext();
                                }
                            } catch (err) {
                                console.error('Write error:', err);
                                this.showToast(`❌ Error writing ${filename}`);
                                busy[i] = false;
                                dispatchNext();
                            }
                        } else if (!this.isCancelled) {
                            // === FRAME GAGAL: RETRY ===
                            const retries = frameRetryCount.get(frameIndex) || 0;
                            if (retries < MAX_RETRIES) {
                                frameRetryCount.set(frameIndex, retries + 1);
                                queue.push(frameIndex); // masukkan kembali ke antrian
                                console.warn(`🔄 Retrying frame ${frameIndex} (attempt ${retries+1}/${MAX_RETRIES})`);
                                dispatchNext();
                            } else {
                                console.error(`❌ Frame ${frameIndex} failed after ${MAX_RETRIES} retries`);
                                this.showToast(`❌ Frame ${frameIndex} failed, stopping.`);
                                this.cancelGeneration();
                            }
                        }
                    };

                    // Kirim tugas ke worker
                    worker.postMessage({
                        frameIndex: frameIndex,
                        params: {
                            width, height,
                            time: frameIndex / this.state.fps,
                            distortion: this.state.distortion,
                            complexity: this.state.complexity,
                            speed: this.state.speed,
                            scale: this.state.scale,
                            aspect: width / height,
                            loopDuration: this.state.duration,
                            palette: this.padPaletteTo6(this.currentPalette),
                            paletteCount: this.currentPalette.length
                        }
                    });
                }
            }
        };

        // Mulai worker
        for (let i = 0; i < Math.min(workerCount, totalFrames); i++) {
            dispatchNext();
        }
    }

    showSummaryStreaming(w, h, tf, totalSize, renderTime, folderName) {
        const existing = document.querySelector('.summary-card');
        if (existing) existing.remove();

        const card = document.createElement('div');
        card.className = 'summary-card';
        card.innerHTML = `
            <div style="background:rgba(8,12,25,0.98);backdrop-filter:blur(20px);border-radius:18px;border:1px solid rgba(52,152,219,0.4);overflow:hidden;">
                <div style="background:linear-gradient(135deg,rgba(52,152,219,0.3),rgba(46,204,113,0.1));padding:12px 16px;border-bottom:1px solid rgba(52,152,219,0.3);display:flex;align-items:center;gap:10px;">
                    <span style="font-size:22px;">💾</span>
                    <div style="flex:1;">
                        <div style="color:#3498db;font-weight:700;font-size:0.85rem;">STREAMING EXPORT COMPLETE</div>
                        <div style="color:#feca57;font-size:0.6rem;">📁 ${folderName} | ${new Date().toLocaleTimeString()}</div>
                    </div>
                    <button id="closeSummary" style="background:transparent;border:none;color:#8ec8e0;cursor:pointer;font-size:18px;">✕</button>
                </div>
                <div style="padding:14px 16px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
                    <div style="text-align:center;background:rgba(10,15,30,0.6);border-radius:10px;padding:8px;">
                        <div style="color:#8ec8e0;font-size:0.55rem;">FRAMES</div>
                        <div style="color:#2ecc71;font-size:1rem;font-weight:700;">${tf.toLocaleString()}</div>
                    </div>
                    <div style="text-align:center;background:rgba(10,15,30,0.6);border-radius:10px;padding:8px;">
                        <div style="color:#8ec8e0;font-size:0.55rem;">RESOLUTION</div>
                        <div style="color:#3498db;font-size:1rem;font-weight:700;">${w}×${h}</div>
                    </div>
                    <div style="text-align:center;background:rgba(10,15,30,0.6);border-radius:10px;padding:8px;">
                        <div style="color:#8ec8e0;font-size:0.55rem;">RENDER SPEED</div>
                        <div style="color:#e74c3c;font-size:1rem;font-weight:700;">${(tf / renderTime).toFixed(0)} fps</div>
                    </div>
                </div>
                <div style="padding:0 16px 14px;">
                    <div style="background:rgba(46,204,113,0.1);border-radius:10px;padding:8px;text-align:center;font-size:0.7rem;color:#2ecc71;">
                        ✅ Semua file tersimpan di folder "${folderName}" tanpa makan RAM berlebih!
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(card);
        document.getElementById('closeSummary').onclick = () => {
            card.style.animation = 'slideOutSummary 0.3s ease forwards';
            setTimeout(() => card.remove(), 300);
        };
        setTimeout(() => {
            if (document.body.contains(card)) {
                card.style.animation = 'slideOutSummary 0.3s ease forwards';
                setTimeout(() => card.remove(), 300);
            }
        }, 15000);
    }

    cancelGeneration() {
        this.isCancelled = true;
        this.isGenerating = false;
        this.batchCancelled = true;
        if (this.renderWorkers.length) {
            this.renderWorkers.forEach(w => w.terminate());
            this.renderWorkers = [];
        }
        this.resetGenerationUI();
        this.showToast('⚠️ Export cancelled');
        document.getElementById('exportStatus').innerHTML = '⚠️ CANCELLED';
        if (this._resolveGeneration) {
            this._resolveGeneration({ status: 'aborted' });
            this._resolveGeneration = null;
        }
    }

    resetGenerationUI() {
        this.isGenerating = false;
        document.getElementById('generatingOverlay').classList.remove('active');
        document.getElementById('miniProgress').style.display = 'none';
        document.getElementById('generateBtn').classList.remove('generating');
        document.getElementById('generateBtn').disabled = false;
        this.updateGenerateButtonLabel();
        document.getElementById('cancelBtn').style.display = 'none';
        document.getElementById('generatingProgressFill').style.width = '0%';
        document.getElementById('miniProgressFill').style.width = '0%';
        document.getElementById('generatingDetails').textContent = '0 / 0 frames';
        document.getElementById('memoryUsage').innerHTML = '';
    }

    showToast(msg) {
        const old = document.querySelector('.toast-msg');
        if (old) old.remove();
        const t = document.createElement('div');
        t.className = 'toast-msg';
        t.textContent = msg;
        t.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;background:rgba(22,33,62,0.95);color:#feca57;padding:10px 18px;border-radius:8px;font-size:0.8rem;border:1px solid rgba(254,202,87,0.3);animation:slideInSummary 0.3s ease;max-width:350px;';
        document.body.appendChild(t);
        setTimeout(() => {
            t.style.animation = 'slideOutSummary 0.3s ease forwards';
            setTimeout(() => t.remove(), 300);
        }, 3000);
    }

    updateFFmpegCommand() {
        document.getElementById('ffmpegCommand').textContent = `ffmpeg -framerate ${this.state.fps} -i frame_%04d.png -c:v libx264 -pix_fmt yuv420p -preset ultrafast -crf 18 output_${this.state.fps}fps.mp4`;
    }

    // ============================================================================
    // JSON SETTINGS (BATCH)
    // ============================================================================
    getCurrentSettingsObject() {
        return {
            distortion: this.state.distortion,
            complexity: this.state.complexity,
            speed: this.state.speed,
            scale: this.state.scale,
            aspectRatio: this.state.aspectRatio,
            resolution: this.state.resolution,
            fps: this.state.fps,
            duration: this.state.duration,
            paletteName: this.currentPaletteName,
            palette: this.currentPalette,
            sessionName: document.getElementById('sessionNameInput').value.trim() || undefined
        };
    }

    downloadSettingsJSON() {
        const settings = this.getCurrentSettingsObject();
        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const name = (settings.sessionName || 'settings').replace(/[^a-zA-Z0-9_\-]/g, '_');
        link.download = `psychedelic_settings_${name}_${Date.now()}.json`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        this.showToast('✅ Settings JSON diunduh');
    }

    applySettingsObject(settings) {
        if (!settings || typeof settings !== 'object') return;
        if (settings.distortion !== undefined) this.state.distortion = parseFloat(settings.distortion);
        if (settings.complexity !== undefined) this.state.complexity = parseInt(settings.complexity);
        if (settings.speed !== undefined) this.state.speed = parseFloat(settings.speed);
        if (settings.scale !== undefined) this.state.scale = parseFloat(settings.scale);
        if (settings.aspectRatio !== undefined) this.state.aspectRatio = String(settings.aspectRatio);
        if (settings.resolution !== undefined) this.state.resolution = String(settings.resolution);
        if (settings.fps !== undefined) this.state.fps = parseInt(settings.fps);
        if (settings.duration !== undefined) this.state.duration = parseInt(settings.duration);
        if (settings.sessionName) document.getElementById('sessionNameInput').value = settings.sessionName;

        if (settings.paletteName && settings.paletteName !== 'custom' && DEFAULT_PALETTES[settings.paletteName]) {
            this.setPalette(settings.paletteName);
        } else if (Array.isArray(settings.palette) && settings.palette.length >= 2) {
            const parsed = settings.palette.map(c => Array.isArray(c) ? c : this.hexToRgb(c)).filter(Boolean);
            if (parsed.length >= 2) {
                this.currentPalette = parsed;
                this.currentPaletteName = settings.paletteName || 'custom';
                this.updatePaletteUniforms(this.currentPalette);
                this.updateCustomPreview(this.currentPalette);
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active', 'custom-active'));
                const customBtn = document.querySelector('.preset-btn[data-palette="custom"]');
                if (customBtn) customBtn.classList.add('active', 'custom-active');
            }
        }

        this.syncUIFromState();
        this.resize();
        this.updateFFmpegCommand();
    }

    syncUIFromState() {
        const s = this.state;
        document.getElementById('distortion').value = s.distortion;
        document.getElementById('distortValue').textContent = s.distortion.toFixed(1);
        document.getElementById('complexity').value = s.complexity;
        document.getElementById('complexValue').textContent = s.complexity;
        document.getElementById('speed').value = s.speed;
        document.getElementById('speedValue').textContent = s.speed.toFixed(2);
        document.getElementById('scale').value = s.scale;
        document.getElementById('scaleValue').textContent = s.scale.toFixed(1);
        document.getElementById('aspectRatio').value = s.aspectRatio;
        document.getElementById('ratioValue').textContent = s.aspectRatio;
        document.getElementById('resolution').value = s.resolution;
        document.getElementById('fps').value = s.fps;
        document.getElementById('fpsValue').textContent = s.fps;
        document.getElementById('duration').value = s.duration;
        document.getElementById('durationValue').textContent = s.duration;
    }

    async handleSettingsFileUpload(e) {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const list = Array.isArray(parsed) ? parsed : [parsed];
            if (list.length === 0) {
                this.showToast('❌ JSON kosong / tidak valid');
                return;
            }
            this.batchSettings = list;
            this.renderBatchStatus();
            this.showToast(`✅ ${list.length} settingan dimuat dari JSON`);
        } catch (err) {
            this.showToast('❌ Gagal membaca JSON: ' + err.message);
        }
    }

    renderBatchStatus() {
        const el = document.getElementById('batchStatus');
        if (this.batchSettings && this.batchSettings.length > 0) {
            el.innerHTML = `📦 ${this.batchSettings.length} settingan siap • <span class="clear-batch" id="clearBatchBtn">✕ batal</span>`;
            document.getElementById('clearBatchBtn').onclick = () => {
                this.batchSettings = null;
                this.renderBatchStatus();
            };
        } else {
            el.innerHTML = '';
        }
        this.updateGenerateButtonLabel();
    }

    updateGenerateButtonLabel() {
        const btn = document.getElementById('generateBtn');
        if (this.isGenerating) return;
        btn.textContent = (this.batchSettings && this.batchSettings.length > 0)
            ? `🔥 Export ${this.batchSettings.length}x dari JSON`
            : '💾 Streaming Export';
    }

    async startBatchGeneration() {
        if (this.isGenerating) return;
        const list = this.batchSettings;
        if (!list || list.length === 0) return;

        let rootDirHandle;
        try {
            rootDirHandle = await window.showDirectoryPicker();
        } catch (err) {
            if (err.name !== 'AbortError') {
                this.showToast('❌ Gagal memilih folder');
            }
            return;
        }

        this.batchCancelled = false;
        this.showToast(`🚀 Batch export dimulai: ${list.length} settingan`);

        for (let i = 0; i < list.length; i++) {
            if (this.batchCancelled) break;
            this.applySettingsObject(list[i]);

            const subFolderName = `export_${String(i + 1).padStart(2, '0')}`;
            let subDirHandle;
            try {
                subDirHandle = await rootDirHandle.getDirectoryHandle(subFolderName, { create: true });
            } catch (err) {
                this.showToast(`❌ Gagal membuat folder ${subFolderName}`);
                break;
            }

            document.getElementById('exportStatus').innerHTML = `📦 Batch ${i + 1}/${list.length}: menulis ke ${subFolderName}`;
            await new Promise((resolve) => {
                this._resolveGeneration = resolve;
                this.startGenerationStreaming({
                    skipConfirm: true,
                    dirHandle: subDirHandle,
                    batchLabel: `${i + 1}/${list.length}`
                });
            });
            if (this.batchCancelled) break;
            await new Promise(r => setTimeout(r, 400));
        }

        this.updateGenerateButtonLabel();
        if (!this.batchCancelled) {
            this.showToast(`✅ Batch export selesai! (${list.length} folder di dalam "${rootDirHandle.name}")`);
        }
    }

    // ============================================================================
    // BIND EVENTS
    // ============================================================================
    bindEvents() {
        document.getElementById('distortion').addEventListener('input', (e) => {
            this.state.distortion = parseFloat(e.target.value);
            document.getElementById('distortValue').textContent = this.state.distortion.toFixed(1);
        });
        document.getElementById('complexity').addEventListener('input', (e) => {
            this.state.complexity = parseInt(e.target.value);
            document.getElementById('complexValue').textContent = this.state.complexity;
        });
        document.getElementById('speed').addEventListener('input', (e) => {
            this.state.speed = parseFloat(e.target.value);
            document.getElementById('speedValue').textContent = this.state.speed.toFixed(2);
        });
        document.getElementById('scale').addEventListener('input', (e) => {
            this.state.scale = parseFloat(e.target.value);
            document.getElementById('scaleValue').textContent = this.state.scale.toFixed(1);
        });
        document.getElementById('aspectRatio').addEventListener('change', (e) => {
            this.state.aspectRatio = e.target.value;
            this.resize();
        });
        document.getElementById('resolution').addEventListener('change', (e) => {
            this.state.resolution = e.target.value;
            this.resize();
        });
        document.getElementById('fps').addEventListener('input', (e) => {
            this.state.fps = parseInt(e.target.value);
            document.getElementById('fpsValue').textContent = this.state.fps;
            this.updateFFmpegCommand();
        });
        document.getElementById('duration').addEventListener('input', (e) => {
            this.state.duration = parseInt(e.target.value);
            document.getElementById('durationValue').textContent = this.state.duration;
        });

        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.isPaused = !this.isPaused;
            document.getElementById('pauseBtn').textContent = this.isPaused ? '▶️ Play' : '⏯️ Pause';
        });

        document.getElementById('generateBtn').addEventListener('click', () => {
            if (this.batchSettings && this.batchSettings.length > 0) {
                this.startBatchGeneration();
            } else {
                this.startGenerationStreaming();
            }
        });

        document.getElementById('cancelBtn').addEventListener('click', () => this.cancelGeneration());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportSingleImage());
        document.getElementById('downloadSettingsBtn').addEventListener('click', () => this.downloadSettingsJSON());
        document.getElementById('loadSettingsBtn').addEventListener('click', () => document.getElementById('settingsFileInput').click());
        document.getElementById('settingsFileInput').addEventListener('change', (e) => this.handleSettingsFileUpload(e));
        document.getElementById('applyCustomPaletteBtn').addEventListener('click', () => {
            const input = document.getElementById('customPaletteInput').value;
            this.applyCustomPalette(input);
        });

        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const pn = btn.dataset.palette;
                if (pn === 'custom') {
                    const input = document.getElementById('customPaletteInput').value;
                    this.applyCustomPalette(input);
                    return;
                }
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active', 'custom-active'));
                btn.classList.add('active');
                this.setPalette(pn);
            });
        });

        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active-format'));
                btn.classList.add('active-format');
                this.currentFormat = btn.dataset.format;
            });
        });

        document.getElementById('customPaletteInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.applyCustomPalette(e.target.value);
        });

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && document.activeElement === document.body) {
                e.preventDefault();
                if (!this.isGenerating) {
                    this.isPaused = !this.isPaused;
                    document.getElementById('pauseBtn').textContent = this.isPaused ? '▶️ Play' : '⏯️ Pause';
                }
            }
        });

        window.addEventListener('resize', () => this.resize());
    }
}

// ============================================================================
// INIT
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('mainCanvas');
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, powerPreference: 'high-performance' }) ||
        canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, powerPreference: 'high-performance' });
    if (!gl) {
        alert('WebGL not supported!');
        return;
    }
    if (window.location.protocol === 'file:') {
        const warning = document.getElementById('serverWarning');
        warning.style.background = 'rgba(231,76,60,0.3)';
        warning.style.borderLeft = '3px solid #ff6b6b';
        warning.innerHTML = '❌ RUN WITH LOCAL SERVER!<br><code>python -m http.server 8000</code><br>Then open: <code>http://localhost:8000</code>';
        document.getElementById('generateBtn').disabled = true;
        document.getElementById('generateBtn').style.opacity = '0.5';
    }
    const app = new PsychedelicGenerator(canvas, gl);
    document.getElementById('memoryStats').innerHTML = `🧠 ${CPU_THREADS} cores | 🚀 ${RENDER_WORKERS} workers`;
    console.log(`🔥 Ready | ${CPU_THREADS} threads | ${RENDER_WORKERS} workers`);
});