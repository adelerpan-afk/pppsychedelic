// src/core/Generator.js

import { Renderer } from './Renderer.js';
import { Exporter } from './Exporter.js';
import { ShaderBuilder } from './ShaderBuilder.js';
import { PsychedelicMode } from '../modes/PsychedelicMode.js';
import { BlobMode } from '../modes/BlobMode.js';
import { KaleidoscopeMode } from '../modes/KaleidoscopeMode.js';

export class Generator {
    // ==================== CONSTRUCTOR ====================
    constructor(canvas) {
        // Core
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);
        this.exporter = new Exporter(this);

        // State
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

        // Modes
        this.modes = {};
        this.activeMode = 'psychedelic';

        // Controls
        this.isPaused = false;
        this.isGenerating = false;
        this.startTime = Date.now();

        // ✅ Frame-based timer
        this.frameCount = 0;
        this.totalFrames = 0;
        this.lastFrameTime = 0;
        this.isLooping = false;

        // Uniforms (akan di-set di initShader)
        this.uniforms = null;

        // INIT
        this.initModes();
        this.initShader();

        // Panggil resize setelah semua method tersedia
        this.resize();

        // Start loop
        this.startLoop();

        console.log('✅ Generator initialized');
    }

    // ==================== MODE MANAGEMENT ====================

    initModes() {
        this.modes = {
            psychedelic: new PsychedelicMode(),
            blob: new BlobMode(),
            kaleidoscope: new KaleidoscopeMode()
        };
        console.log('✅ Modes initialized:', Object.keys(this.modes).join(', '));
    }

    switchMode(name) {
        if (!this.modes[name]) {
            console.warn(`⚠️ Mode "${name}" not found`);
            return;
        }

        this.activeMode = name;
        const index = Object.keys(this.modes).indexOf(name);

        if (this.renderer.gl && this.uniforms) {
            this.renderer.gl.uniform1i(this.uniforms.mode, index);
        }

        console.log(`🎭 Mode switched to: ${name}`);
    }

    getActiveMode() {
        return this.modes[this.activeMode];
    }

    // ==================== SHADER INITIALIZATION ====================

    initShader() {
        const builder = new ShaderBuilder();
        const modeNames = Object.keys(this.modes);

        // Register semua mode
        modeNames.forEach(name => builder.registerMode(this.modes[name]));

        // Build shader sources
        const vsSource = builder.buildVertexShader();
        const fsSource = builder.buildFragmentShader(modeNames);

        // Init renderer
        this.renderer.init(vsSource, fsSource);

        // Get uniform locations
        this.uniforms = builder.getUniformLocations(
            this.renderer.gl,
            this.renderer.program
        );

        // Set uniforms ke renderer
        this.renderer.setUniforms(this.uniforms);

        // Set default mode
        this.renderer.gl.uniform1i(this.uniforms.mode, 0);

        console.log('✅ Shader initialized with', modeNames.length, 'modes');
    }

    // ==================== CANVAS SIZE MANAGEMENT ====================

    getCanvasSize() {
        const height = parseInt(this.state.resolution) || 2160;
        const [w, h] = this.state.aspectRatio.split(':').map(Number) || [16, 9];

        return {
            width: Math.floor(height * w / h),
            height: height
        };
    }

    getDisplaySize() {
        const container = this.canvas?.parentElement;
        if (!container) return { width: 0, height: 0 };

        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return { width: 0, height: 0 };
        }

        const aspectRatio = 16 / 9;
        let width = rect.width;
        let height = rect.width / aspectRatio;

        if (height > rect.height) {
            height = rect.height;
            width = rect.height * aspectRatio;
        }

        return { width, height };
    }

    resize() {
        if (typeof this.getCanvasSize !== 'function') {
            console.error('❌ getCanvasSize is not a function!');
            return { width: 0, height: 0 };
        }

        const { width, height } = this.getCanvasSize();

        if (width === 0 || height === 0) {
            console.warn('⚠️ Invalid canvas size, skipping resize');
            return { width: 0, height: 0 };
        }

        this.renderer.resize(width, height);

        if (this.uniforms && this.uniforms.aspect) {
            this.renderer.gl.uniform1f(this.uniforms.aspect, width / height);
        }

        this.updateDisplaySize();

        // ✅ Reset frame counter saat resize
        this.resetTimer();

        console.log(`📐 Canvas resized: ${width}×${height} (internal)`);
        return { width, height };
    }

    updateDisplaySize() {
        const container = this.canvas?.parentElement;
        if (!container) return;

        const { width, height } = this.getDisplaySize();

        if (width === 0 || height === 0) return;

        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.canvas.style.maxWidth = '100%';
        this.canvas.style.maxHeight = '100%';
        this.canvas.style.objectFit = 'contain';

        return { width, height };
    }

    // ==================== RENDER LOOP ====================

    startLoop() {
        const loop = (timestamp) => {
            if (!this.isPaused && !this.isGenerating) {
                this.renderFrame(timestamp);
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
        console.log('🔄 Render loop started');
    }

    renderFrame(timestamp) {
        const gl = this.renderer.gl;
        if (!gl || !this.uniforms) return;

        // ✅ Frame-based time calculation
        const fps = this.state.fps || 30;
        const duration = this.state.duration || 5;
        const totalFrames = Math.round(duration * fps);
        
        // Increment frame counter
        this.frameCount++;
        
        // Calculate current frame in loop
        const currentFrame = this.frameCount % totalFrames;
        const elapsed = currentFrame / fps;
        
        // Check if loop restarted
        if (currentFrame === 0 && this.frameCount > 0) {
            this.isLooping = true;
            console.log('🔄 Loop restarted at frame', this.frameCount);
        } else {
            this.isLooping = false;
        }

        // Update uniforms with frame-based time
        gl.uniform1f(this.uniforms.time, elapsed);
        gl.uniform1f(this.uniforms.loopDuration, duration);

        // Mode-specific uniforms
        const mode = this.getActiveMode();
        if (mode && typeof mode.updateUniforms === 'function') {
            mode.updateUniforms(gl, this.uniforms, this.state);
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // ==================== TIMER METHODS ====================

    getElapsedTime() {
        const fps = this.state.fps || 30;
        const duration = this.state.duration || 5;
        const totalFrames = Math.round(duration * fps);
        const currentFrame = this.frameCount % totalFrames;
        return currentFrame / fps;
    }

    getCurrentFrame() {
        const fps = this.state.fps || 30;
        const duration = this.state.duration || 5;
        const totalFrames = Math.round(duration * fps);
        return this.frameCount % totalFrames;
    }

    getTotalFrames() {
        const fps = this.state.fps || 30;
        const duration = this.state.duration || 5;
        return Math.round(duration * fps);
    }

    getLoopProgress() {
        const totalFrames = this.getTotalFrames();
        if (totalFrames === 0) return 0;
        return this.getCurrentFrame() / totalFrames;
    }

    resetTimer() {
        this.frameCount = 0;
        this.startTime = Date.now();
        this.isLooping = false;
        console.log('⏱️ Timer reset');
    }

    // ==================== EXPORT ====================

    exportSingleImage() {
        this.exporter.exportSingleImage();
    }

    startExport(opts = {}) {
        return this.exporter.startExport(opts);
    }

    cancelExport() {
        this.exporter.cancel();
    }

    // ==================== STATE MANAGEMENT ====================

    getState() {
        return { ...this.state };
    }

    updateState(newState) {
        Object.assign(this.state, newState);
        console.log('📝 State updated:', this.state);
    }

    setPalette(palette) {
        if (this.renderer && typeof this.renderer.setPalette === 'function') {
            this.renderer.setPalette(palette);
        } else {
            console.warn('⚠️ Renderer not ready for palette');
        }
    }

    getCanvas() {
        return this.canvas;
    }

    // ==================== PAUSE / RESUME ====================

    togglePause() {
        this.isPaused = !this.isPaused;
        console.log(`⏯️ ${this.isPaused ? 'Paused' : 'Resumed'}`);
        return this.isPaused;
    }

    // ==================== DESTROY ====================

    dispose() {
        this.isPaused = true;
        this.isGenerating = false;

        if (this.renderer && typeof this.renderer.dispose === 'function') {
            this.renderer.dispose();
        }

        console.log('🧹 Generator disposed');
    }
}
