// src/ui/PaletteUI.js

import { DEFAULT_PALETTES } from '../utils/constants.js';
import { hexToRgb, parseCustomPalette, rgbToHex } from '../utils/helpers.js';

export class PaletteUI {
    constructor(generator) {
        this.generator = generator;
        this.currentPalette = 'rainbow';
        this.customPalette = [];
        this.paletteData = { ...DEFAULT_PALETTES };
        
        this.bindEvents();
        this.updatePresetActive('rainbow');
    }

    bindEvents() {
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = btn.dataset.palette;
                if (name === 'custom') {
                    this.applyCustomPalette();
                    return;
                }
                this.setPalette(name);
            });
        });

        document.getElementById('applyCustomPaletteBtn').addEventListener('click', () => {
            this.applyCustomPalette();
        });

        document.getElementById('customPaletteInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.applyCustomPalette();
            }
        });
    }

    setPalette(name) {
        if (!this.paletteData[name]) return;
        
        this.currentPalette = name;
        const palette = this.paletteData[name];
        this.generator.setPalette(palette);
        this.updatePresetActive(name);
        
        document.getElementById('customPaletteInput').value = '';
        document.getElementById('customPalettePreview').innerHTML = '';
        
        console.log(`🎨 Palette: ${name}`);
    }

    applyCustomPalette() {
        const input = document.getElementById('customPaletteInput').value;
        const parsed = parseCustomPalette(input);
        
        if (!parsed || parsed.length < 2) {
            this.showToast('❌ Invalid palette! Need at least 2 colors');
            return false;
        }
        
        this.customPalette = parsed;
        this.generator.setPalette(parsed);
        this.updatePresetActive('custom');
        this.updateCustomPreview(parsed);
        
        this.showToast(`✅ Custom palette applied (${parsed.length} colors)`);
        return true;
    }

    updateCustomPreview(palette) {
        const container = document.getElementById('customPalettePreview');
        container.innerHTML = palette.map(c => {
            const hex = rgbToHex(c);
            return `<div class="custom-swatch" style="background:${hex};"></div>`;
        }).join('');
    }

    updatePresetActive(name) {
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.remove('active', 'custom-active');
        });
        
        const target = document.querySelector(`.preset-btn[data-palette="${name}"]`);
        if (target) {
            target.classList.add('active');
            if (name === 'custom') target.classList.add('custom-active');
        }
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

    applyPaletteFromSettings(settings) {
        if (settings.paletteName && settings.paletteName !== 'custom' && this.paletteData[settings.paletteName]) {
            this.setPalette(settings.paletteName);
        } else if (Array.isArray(settings.palette) && settings.palette.length >= 2) {
            const parsed = settings.palette.map(c => 
                Array.isArray(c) ? c : hexToRgb(c)
            ).filter(Boolean);
            
            if (parsed.length >= 2) {
                this.customPalette = parsed;
                this.generator.setPalette(parsed);
                this.updatePresetActive('custom');
                this.updateCustomPreview(parsed);
                this.currentPalette = 'custom';
            }
        }
    }
}