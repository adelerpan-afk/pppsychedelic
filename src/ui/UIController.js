// src/ui/UIController.js

import { PaletteUI } from './PaletteUI.js';
import { ExportUI } from './ExportUI.js';
import { BatchUI } from './BatchUI.js';
import { getCanvasSize } from '../utils/helpers.js';

export class UIController {
    constructor(generator) {
        this.generator = generator;
        this.paletteUI = new PaletteUI(generator);
        this.exportUI = new ExportUI(generator);
        this.batchUI = new BatchUI(generator, this.paletteUI, this);
        
        this.bindEvents();
        this.updateUI();
        this.updateFFmpegCommand();
        this.checkServer();
        
        window.batchUI = this.batchUI;
    }

    bindEvents() {
        // Parameters
        document.getElementById('distortion').addEventListener('input', (e) => {
            this.generator.state.distortion = parseFloat(e.target.value);
            document.getElementById('distortValue').textContent = this.generator.state.distortion.toFixed(1);
        });
        
        document.getElementById('complexity').addEventListener('input', (e) => {
            this.generator.state.complexity = parseInt(e.target.value);
            document.getElementById('complexValue').textContent = this.generator.state.complexity;
        });
        
        document.getElementById('speed').addEventListener('input', (e) => {
            this.generator.state.speed = parseFloat(e.target.value);
            document.getElementById('speedValue').textContent = this.generator.state.speed.toFixed(2);
        });
        
        document.getElementById('scale').addEventListener('input', (e) => {
            this.generator.state.scale = parseFloat(e.target.value);
            document.getElementById('scaleValue').textContent = this.generator.state.scale.toFixed(1);
        });

// Tambahkan juga di resolution change
document.getElementById('aspectRatio').addEventListener('change', (e) => {
    this.generator.state.aspectRatio = e.target.value;
    this.updateResolution();
    if (this.generator.resetTimer) {
        this.generator.resetTimer();
    }
});
        
document.getElementById('resolution').addEventListener('change', (e) => {
    this.generator.state.resolution = e.target.value;
    this.updateResolution();
    if (this.generator.resetTimer) {
        this.generator.resetTimer();
    }
});

        // Video
        document.getElementById('fps').addEventListener('input', (e) => {
            this.generator.state.fps = parseInt(e.target.value);
            document.getElementById('fpsValue').textContent = this.generator.state.fps;
            this.exportUI.updateFFmpegCommand();
        });
        
document.getElementById('duration').addEventListener('input', (e) => {
    this.generator.state.duration = parseInt(e.target.value);
    document.getElementById('durationValue').textContent = this.generator.state.duration;
    
    // ✅ Reset timer agar loop mulai dari awal
    if (this.generator.resetTimer) {
        this.generator.resetTimer();
    }
});
        

        // Mode
        document.getElementById('animationMode').addEventListener('change', (e) => {
            this.generator.switchMode(e.target.value);
            this.updateModeUI();
        });

        // Pause
        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.generator.isPaused = !this.generator.isPaused;
            document.getElementById('pauseBtn').textContent = 
                this.generator.isPaused ? '▶️ Play' : '⏯️ Pause';
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && document.activeElement === document.body) {
                e.preventDefault();
                document.getElementById('pauseBtn').click();
            }
        });

        // Window resize
        window.addEventListener('resize', () => this.updateResolution());

        // Generate button - single source of truth
        document.getElementById('generateBtn').addEventListener('click', () => {
            if (this.batchUI.hasBatch()) {
                this.batchUI.startBatchExport();
            } else {
                this.exportUI.startExport();
            }
        });

        // Cancel button
        document.getElementById('cancelBtn').addEventListener('click', () => {
            if (this.batchUI.isBatchRunning) {
                this.batchUI.cancelBatch();
            } else if (this.exportUI.isExporting) {
                this.exportUI.cancelExport();
            }
        });
    }

    updateUI() {
        const s = this.generator.state;
        document.getElementById('distortion').value = s.distortion;
        document.getElementById('distortValue').textContent = s.distortion.toFixed(1);
        document.getElementById('complexity').value = s.complexity;
        document.getElementById('complexValue').textContent = s.complexity;
        document.getElementById('speed').value = s.speed;
        document.getElementById('speedValue').textContent = s.speed.toFixed(2);
        document.getElementById('scale').value = s.scale;
        document.getElementById('scaleValue').textContent = s.scale.toFixed(1);
        document.getElementById('aspectRatio').value = s.aspectRatio;

        const ratioVal = document.getElementById('ratioValue');
        if (ratioVal) ratioVal.textContent = s.aspectRatio;

        document.getElementById('resolution').value = s.resolution;
        document.getElementById('fps').value = s.fps;
        document.getElementById('fpsValue').textContent = s.fps;
        document.getElementById('duration').value = s.duration;
        document.getElementById('durationValue').textContent = s.duration;
        
        const modeSelect = document.getElementById('animationMode');
        if (modeSelect) {
            modeSelect.value = this.generator.activeMode;
        }

        this.updateModeUI();
        this.updateResolution();
    }

// src/ui/UIController.js - Update updateResolution()

// src/ui/UIController.js - Update updateResolution()

updateResolution() {
    const { width, height } = getCanvasSize(
        this.generator.state.resolution,
        this.generator.state.aspectRatio
    );
    this.generator.resize();
    
    // Update ratio text label and ratio indicator
    const ratioVal = document.getElementById('ratioValue');
    if (ratioVal) {
        ratioVal.textContent = this.generator.state.aspectRatio;
    }
    const displaySize = this.generator.getDisplaySize?.() || { width, height };
    const indicator = document.getElementById('ratioIndicator');
    if (indicator) {
        indicator.textContent = 
            `${this.generator.state.aspectRatio} (${Math.round(displaySize.width)}×${Math.round(displaySize.height)})`;
    }
    
    const resText = height >= 4320 ? '8K' : 
                   height >= 2160 ? '4K' : 
                   height >= 1080 ? '1080p' : '720p';
    const resEl = document.getElementById('resValue');
    if (resEl) resEl.textContent = resText;
    
    // Trigger resize di main.js
    if (window.app && window.app.resizeCanvas) {
        setTimeout(() => window.app.resizeCanvas(), 50);
    }
}

    updateModeUI() {
        const mode = this.generator.getActiveMode();
        const container = document.getElementById('modeParamsContainer');
        if (!container) return;
        
        container.innerHTML = '';

        // Skip duplicate rendering for psychedelic mode since its parameters are already in the main controls!
        if (mode.name === 'psychedelic') {
            return;
        }

        const defs = mode.getParamDefinitions();
        
        defs.forEach(def => {
            const group = document.createElement('div');
            group.className = 'control-group';
            
            const currentVal = mode.params[def.id] !== undefined ? mode.params[def.id] : def.default;

            const label = document.createElement('label');
            label.innerHTML = `${def.label} <span class="value-display" id="${def.id}Value">${currentVal}</span>`;
            
            const input = document.createElement('input');
            input.type = 'range';
            input.id = `mode_param_${def.id}`;
            input.min = def.min;
            input.max = def.max;
            input.step = def.step;
            input.value = currentVal;
            
            input.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                const displayEl = document.getElementById(`${def.id}Value`);
                if (displayEl) {
                    displayEl.textContent = val;
                }
                mode.params[def.id] = val;
                mode.updateUniforms(this.generator.renderer.gl, this.generator.uniforms, mode.params);
            });
            
            group.appendChild(label);
            group.appendChild(input);
            container.appendChild(group);
        });
    }

    updateFFmpegCommand() {
        this.exportUI.updateFFmpegCommand();
    }

    checkServer() {
        if (window.location.protocol === 'file:') {
            const warning = document.getElementById('serverWarning');
            warning.style.background = 'rgba(231,76,60,0.3)';
            warning.style.borderLeft = '3px solid #ff6b6b';
            warning.innerHTML = `
                ❌ RUN WITH LOCAL SERVER!<br>
                <code>python -m http.server 8000</code><br>
                Then open: <code>http://localhost:8000</code>
            `;
            document.getElementById('generateBtn').disabled = true;
            document.getElementById('generateBtn').style.opacity = '0.5';
        }
    }
}
