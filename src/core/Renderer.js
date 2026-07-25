// src/core/Generator.js

import { Renderer } from './Renderer.js';
import { Exporter } from './Exporter.js';
import { ShaderBuilder } from './ShaderBuilder.js';
import { PsychedelicMode } from '../modes/PsychedelicMode.js';
import { BlobMode } from '../modes/BlobMode.js';
import { KaleidoscopeMode } from '../modes/KaleidoscopeMode.js';

export class Generator {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);
        this.exporter = new Exporter(this);
        
        this.modes = {};
        this.activeMode = 'psychedelic';
        this.isPaused = false;
        this.isGenerating = false;
        this.startTime = Date.now();
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
        
        this.initModes();
        this.initShader();
        this.resize(); // ← ini memanggil getCanvasSize()
        this.startLoop();
        
        console.log('✅ Generator initialized');
    }

    initModes() {
        this.modes = {
            psychedelic: new PsychedelicMode(),
            blob: new BlobMode(),
            kaleidoscope: new KaleidoscopeMode()
        };
    }

    initShader() {
        const builder = new ShaderBuilder();
        const modeNames = Object.keys(this.modes);
        
        modeNames.forEach(name => builder.registerMode(this.modes[name]));
        
        const vsSource = builder.buildVertexShader();
        const fsSource = builder.buildFragmentShader(modeNames);
        
        this.renderer.init(vsSource, fsSource);
        
        this.uniforms = builder.getUniformLocations(
            this.renderer.gl,
            this.renderer.program
        );
        
        this.renderer.setUniforms(this.uniforms);
        this.renderer.gl.uniform1i(this.uniforms.mode, 0);
        
        console.log('✅ Shader initialized with', modeNames.length, 'modes');
    }

    /**
     * Get internal canvas size based on resolution and aspect ratio
     * Digunakan untuk export dan render internal
     */
    getCanvasSize() {
        const height = parseInt(this.state.resolution);
        const [w, h] = this.state.aspectRatio.split(':').map(Number);
        return {
            width: Math.floor(height * w / h),
            height: height
        };
    }

    /**
     * Get display size based on container (responsive)
     * Digunakan untuk tampilan di layar
     */
    getDisplaySize() {
        const container = this.canvas.parentElement;
        if (!container) return { width: 0, height: 0 };
        
        const rect = container.getBoundingClientRect();
        const aspectRatio = 16 / 9;
        let width = rect.width;
        let height = rect.width / aspectRatio;
        
        if (height > rect.height) {
            height = rect.height;
            width = rect.height * aspectRatio;
        }
        
        return { width, height };
    }

    switchMode(name) {
        if (!this.modes[name]) return;
        this.activeMode = name;
        const index = Object.keys(this.modes).indexOf(name);
        if (this.renderer.gl && this.uniforms) {
            this.renderer.gl.uniform1i(this.uniforms.mode, index);
        }
        console.log(`🎭 Mode: ${name}`);
    }

    getActiveMode() {
        return this.modes[this.activeMode];
    }

    /**
     * Resize internal canvas (untuk render dan export)
     * Ukuran internal tetap berdasarkan resolusi
     */
   // src/core/Renderer.js - Update resize()

resize(width, height) {
    if (!this.canvas) return;
    
    this.canvas.width = width;
    this.canvas.height = height;
    
    if (this.gl) {
        this.gl.viewport(0, 0, width, height);
    }
    
    console.log(`🖼️ Renderer resized: ${width}×${height}`);
}

    /**
     * Update display size via CSS (responsive)
     * Tidak mengubah internal canvas size
     */
    updateDisplaySize() {
        const container = this.canvas.parentElement;
        if (!container) return;
        
        const { width, height } = this.getDisplaySize();
        
        // Set display size via CSS
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.canvas.style.maxWidth = '100%';
        this.canvas.style.maxHeight = '100%';
        this.canvas.style.objectFit = 'contain';
        
        return { width, height };
    }

    startLoop() {
        const loop = () => {
            if (!this.isPaused && !this.isGenerating) {
                this.renderFrame();
            }
            requestAnimationFrame(loop);
        };
        loop();
    }

    renderFrame() {
        const gl = this.renderer.gl;
        if (!gl || !this.uniforms) return;
        
        const elapsed = this.getElapsedTime();
        
        gl.uniform1f(this.uniforms.time, elapsed);
        gl.uniform1f(this.uniforms.loopDuration, this.state.duration);
        
        const mode = this.getActiveMode();
        mode.updateUniforms(gl, this.uniforms, this.state);
        
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    getElapsedTime() {
        const raw = (Date.now() - this.startTime) / 1000;
        const dur = this.state.duration;
        return dur > 0 ? (raw % dur) : raw;
    }

    exportSingleImage() {
        this.exporter.exportSingleImage();
    }

    startExport(opts = {}) {
        return this.exporter.startExport(opts);
    }

    cancelExport() {
        this.exporter.cancel();
    }

    getState() {
        return { ...this.state };
    }

    updateState(newState) {
        Object.assign(this.state, newState);
    }

    setPalette(palette) {
        this.renderer.setPalette(palette);
    }

    getCanvas() {
        return this.canvas;
    }
}
