// src/ui/BatchUI.js

import { DEFAULT_PALETTES } from '../utils/constants.js';
import { hexToRgb } from '../utils/helpers.js';

export class BatchUI {
    constructor(generator, paletteUI, uiController) {
        this.generator = generator;
        this.paletteUI = paletteUI;
        this.uiController = uiController;
        this.batchSettings = null;
        this.batchCancelled = false;
        this.isBatchRunning = false;
        
        this.bindEvents();
        this.renderStatus();
    }

    bindEvents() {
        document.getElementById('downloadSettingsBtn').addEventListener('click', () => {
            this.downloadSettingsJSON();
        });

        document.getElementById('loadSettingsBtn').addEventListener('click', () => {
            document.getElementById('settingsFileInput').click();
        });

        document.getElementById('settingsFileInput').addEventListener('change', (e) => {
            this.handleSettingsFileUpload(e);
        });

        document.getElementById('batchStatus').addEventListener('click', (e) => {
            if (e.target.classList.contains('clear-batch')) {
                this.clearBatch();
            }
        });
    }

    getCurrentSettingsObject() {
        const state = this.generator.state;
        const mode = this.generator.getActiveMode();
        
        return {
            distortion: state.distortion,
            complexity: state.complexity,
            speed: state.speed,
            scale: state.scale,
            aspectRatio: state.aspectRatio,
            resolution: state.resolution,
            fps: state.fps,
            duration: state.duration,
            mode: this.generator.activeMode,
            modeParams: { ...mode.params },
            paletteName: this.paletteUI.currentPalette,
            palette: this.paletteUI.currentPalette === 'custom' 
                ? this.paletteUI.customPalette 
                : DEFAULT_PALETTES[this.paletteUI.currentPalette] || null,
            sessionName: document.getElementById('sessionNameInput').value.trim() || undefined,
            timestamp: new Date().toISOString()
        };
    }

    downloadSettingsJSON() {
        const settings = this.getCurrentSettingsObject();
        const blob = new Blob([JSON.stringify(settings, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const name = (settings.sessionName || 'settings').replace(/[^a-zA-Z0-9_\-]/g, '_');
        link.download = `psychedelic_settings_${name}_${Date.now()}.json`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        
        this.showToast('✅ Settings JSON downloaded');
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
                this.showToast('❌ JSON is empty or invalid');
                return;
            }
            
            this.batchSettings = list;
            this.renderStatus();
            this.showToast(`✅ ${list.length} settings loaded from JSON`);
            
            if (list.length === 1) {
                this.applySettingsObject(list[0]);
            }
            
        } catch (err) {
            this.showToast('❌ Failed to read JSON: ' + err.message);
        }
    }

    applySettingsObject(settings) {
        if (!settings || typeof settings !== 'object') return;
        
        const state = this.generator.state;
        
        if (settings.distortion !== undefined) state.distortion = parseFloat(settings.distortion);
        if (settings.complexity !== undefined) state.complexity = parseInt(settings.complexity);
        if (settings.speed !== undefined) state.speed = parseFloat(settings.speed);
        if (settings.scale !== undefined) state.scale = parseFloat(settings.scale);
        if (settings.aspectRatio !== undefined) state.aspectRatio = String(settings.aspectRatio);
        if (settings.resolution !== undefined) state.resolution = String(settings.resolution);
        if (settings.fps !== undefined) state.fps = parseInt(settings.fps);
        if (settings.duration !== undefined) state.duration = parseInt(settings.duration);
        
        if (settings.sessionName) {
            document.getElementById('sessionNameInput').value = settings.sessionName;
        }
        
        if (settings.mode) {
            this.generator.switchMode(settings.mode);
            if (settings.modeParams) {
                const mode = this.generator.getActiveMode();
                Object.keys(settings.modeParams).forEach(key => {
                    if (mode.params[key] !== undefined) {
                        mode.params[key] = settings.modeParams[key];
                    }
                });
                mode.updateUniforms(this.generator.renderer.gl, this.generator.uniforms, mode.params);
            }
        }
        
        if (this.paletteUI && typeof this.paletteUI.applyPaletteFromSettings === 'function') {
            this.paletteUI.applyPaletteFromSettings(settings);
        }
        
        this.syncUIFromState();
        this.generator.resize();
        this.updateFFmpegCommand();
    }

    async startBatchExport() {
        if (this.isBatchRunning) return;
        
        const list = this.batchSettings;
        if (!list || list.length === 0) {
            this.showToast('❌ No batch settings loaded');
            return;
        }

        if (window.location.protocol === 'file:') {
            this.showToast('❌ Export requires HTTP server!');
            return;
        }

        let rootDirHandle;
        try {
            rootDirHandle = await window.showDirectoryPicker();
        } catch (err) {
            if (err.name !== 'AbortError') {
                this.showToast('❌ Folder selection failed');
            }
            return;
        }

        this.isBatchRunning = true;
        this.batchCancelled = false;
        
        const generateBtn = document.getElementById('generateBtn');
        const originalText = generateBtn.textContent;
        generateBtn.disabled = true;
        generateBtn.textContent = '📦 BATCH EXPORTING...';
        
        document.getElementById('generatingOverlay').classList.add('active');
        document.getElementById('cancelBtn').style.display = 'block';

        try {
            for (let i = 0; i < list.length; i++) {
                if (this.batchCancelled) break;
                
                const settings = list[i];
                this.applySettingsObject(settings);
                
                const subFolderName = `export_${String(i + 1).padStart(2, '0')}`;
                let subDirHandle;
                try {
                    subDirHandle = await rootDirHandle.getDirectoryHandle(subFolderName, { create: true });
                } catch (err) {
                    this.showToast(`❌ Failed to create folder ${subFolderName}`);
                    break;
                }

                document.getElementById('exportStatus').textContent = 
                    `📦 Batch ${i + 1}/${list.length}: ${subFolderName}`;
                document.getElementById('generatingDetails').textContent = 
                    `Processing ${i + 1}/${list.length}`;
                document.getElementById('generatingProgressFill').style.width = 
                    `${((i + 1) / list.length) * 100}%`;

                await new Promise((resolve, reject) => {
                    const onComplete = (result) => {
                        if (result.status === 'cancelled') {
                            reject(new Error('Cancelled'));
                        } else {
                            resolve();
                        }
                    };
                    
                    this.generator.startExport({
                        dirHandle: subDirHandle,
                        skipConfirm: true,
                        batchLabel: `${i + 1}/${list.length}`,
                        onComplete: onComplete
                    }).then(resolve).catch(reject);
                });

                if (this.batchCancelled) break;
                await new Promise(r => setTimeout(r, 300));
            }

            if (!this.batchCancelled) {
                this.showToast(`✅ Batch export complete! (${list.length} folders in "${rootDirHandle.name}")`);
                document.getElementById('exportStatus').textContent = 
                    `✅ Batch complete: ${list.length} exports`;
            }

        } catch (err) {
            if (err.message === 'Cancelled') {
                this.showToast('⚠️ Batch cancelled');
            } else {
                console.error('Batch error:', err);
                this.showToast('❌ Batch failed: ' + err.message);
            }
        }

        this.isBatchRunning = false;
        generateBtn.disabled = false;
        generateBtn.textContent = originalText || '🔥 OPTIMIZED Export';
        document.getElementById('generatingOverlay').classList.remove('active');
        document.getElementById('cancelBtn').style.display = 'none';
        document.getElementById('generatingProgressFill').style.width = '0%';
    }

    cancelBatch() {
        this.batchCancelled = true;
        this.generator.cancelExport();
    }

    renderStatus() {
        const el = document.getElementById('batchStatus');
        if (this.batchSettings && this.batchSettings.length > 0) {
            el.innerHTML = `
                📦 ${this.batchSettings.length} settings ready • 
                <span class="clear-batch" style="color:#e74c3c;cursor:pointer;text-decoration:underline;">
                    ✕ clear
                </span>
            `;
        } else {
            el.innerHTML = '';
        }
        this.updateGenerateButtonLabel();
    }

    clearBatch() {
        this.batchSettings = null;
        this.renderStatus();
        this.showToast('🗑️ Batch cleared');
    }

    updateGenerateButtonLabel() {
        const btn = document.getElementById('generateBtn');
        if (this.isBatchRunning) return;
        
        if (this.batchSettings && this.batchSettings.length > 0) {
            btn.textContent = `🔥 Export ${this.batchSettings.length}x from JSON`;
        } else {
            btn.textContent = '🔥 OPTIMIZED Export';
        }
    }

    syncUIFromState() {
        if (this.uiController && typeof this.uiController.updateUI === 'function') {
            this.uiController.updateUI();
        } else {
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

            if (this.generator.resize) {
                this.generator.resize();
            }
        }
    }

    updateFFmpegCommand() {
        const fps = document.getElementById('fps').value;
        document.getElementById('ffmpegCommand').textContent = 
            `ffmpeg -framerate ${fps} -i frame_%04d.png -c:v libx264 -pix_fmt yuv420p -preset ultrafast -crf 18 output_${fps}fps.mp4`;
    }

    showToast(msg) {
        const existing = document.querySelector('.toast-msg');
        if (existing) existing.remove();
        
        const t = document.createElement('div');
        t.className = 'toast-msg';
        t.textContent = msg;
        t.style.cssText = `
            position:fixed; top:20px; right:20px; z-index:99999;
            background:rgba(22,33,62,0.95); color:#feca57;
            padding:10px 18px; border-radius:8px; font-size:0.8rem;
            border:1px solid rgba(254,202,87,0.3);
            animation:slideInSummary 0.3s ease; max-width:350px;
        `;
        document.body.appendChild(t);
        
        setTimeout(() => {
            t.style.animation = 'slideOutSummary 0.3s ease forwards';
            setTimeout(() => t.remove(), 300);
        }, 3000);
    }

    hasBatch() {
        return this.batchSettings && this.batchSettings.length > 0;
    }

    getBatchCount() {
        return this.batchSettings ? this.batchSettings.length : 0;
    }
}