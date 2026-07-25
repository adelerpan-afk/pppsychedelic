// src/main.js

import { Generator } from './core/Generator.js';
import { UIController } from './ui/UIController.js';
import { DEFAULT_PALETTES } from './utils/constants.js';

class App {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.canvasWrapper = document.getElementById('canvasWrapper');
        
        if (!this.canvas) {
            console.error('Canvas not found!');
            return;
        }
        
        console.log('🚀 Initializing App...');
        
        this.generator = new Generator(this.canvas);
        this.ui = new UIController(this.generator);
        
        this.init();
        this.setupResize();
    }

    init() {
        // Set default palette
        setTimeout(() => {
            if (this.generator && this.generator.setPalette) {
                this.generator.setPalette(DEFAULT_PALETTES.rainbow);
                console.log('🎨 Default palette set: rainbow');
            }
        }, 200);
        
        // Check server
        if (window.location.protocol === 'file:') {
            const warning = document.getElementById('serverWarning');
            if (warning) {
                warning.innerHTML = 
                    '❌ RUN WITH LOCAL SERVER!<br><code>python -m http.server 8000</code>';
            }
            const btn = document.getElementById('generateBtn');
            if (btn) {
                btn.disabled = true;
            }
        }
        
        // Set worker info
        const cores = navigator.hardwareConcurrency || 8;
        const workers = Math.min(4, Math.max(2, cores - 2));
        const stats = document.getElementById('memoryStats');
        if (stats) {
            stats.textContent = `🧠 ${cores} cores | 🚀 ${workers} workers`;
        }
        
        console.log(`🔥 Ready | ${cores} threads | ${workers} workers`);
        
        // Update display size after init
        setTimeout(() => this.resizeCanvas(), 300);
    }

    setupResize() {
        // Debounce resize event
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.resizeCanvas(), 100);
        });

        // Observer untuk perubahan ukuran container
        if (window.ResizeObserver && this.canvasWrapper) {
            const observer = new ResizeObserver(() => {
                this.resizeCanvas();
            });
            observer.observe(this.canvasWrapper);
        }
        
        console.log('📐 Resize handler setup complete');
    }

    resizeCanvas() {
        if (!this.canvas || !this.canvasWrapper) return;
        
        const wrapper = this.canvasWrapper;
        const container = wrapper.parentElement;
        
        if (!container) return;
        
        // Dapatkan ukuran container
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        if (containerWidth === 0 || containerHeight === 0) return;
        
        // Hitung ukuran display berdasarkan aspect ratio 16:9
        const aspectRatio = 16 / 9;
        let width = containerWidth;
        let height = containerWidth / aspectRatio;
        
        // Jika tinggi melebihi container, sesuaikan dengan tinggi
        if (height > containerHeight) {
            height = containerHeight;
            width = containerHeight * aspectRatio;
        }
        
        // Set wrapper size
        wrapper.style.width = `${width}px`;
        wrapper.style.height = `${height}px`;
        wrapper.style.maxWidth = '100%';
        wrapper.style.maxHeight = '100%';
        
        // Update canvas display size
        if (this.generator && this.generator.updateDisplaySize) {
            this.generator.updateDisplaySize();
        }
        
        // Update aspect ratio indicator
        const indicator = document.getElementById('ratioIndicator');
        if (indicator && this.generator && this.generator.state) {
            const state = this.generator.state;
            const [w, h] = state.aspectRatio.split(':').map(Number);
            const displayWidth = Math.round(width);
            const displayHeight = Math.round(height);
            indicator.textContent = `${state.aspectRatio} (${displayWidth}×${displayHeight})`;
        }
        
        // Update resolution display
        if (this.generator && this.generator.state) {
            const height = parseInt(this.generator.state.resolution);
            const resText = height >= 4320 ? '8K' : 
                           height >= 2160 ? '4K' : 
                           height >= 1080 ? '1080p' : '720p';
            const resEl = document.getElementById('resValue');
            if (resEl) resEl.textContent = resText;
        }
        
        console.log(`📐 Display resized: ${Math.round(width)}×${Math.round(height)}`);
    }
}

// Start app
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded, starting app...');
    const app = new App();
    window.app = app;
    
    // Additional resize after fonts/images load
    window.addEventListener('load', () => {
        setTimeout(() => app.resizeCanvas(), 100);
    });
});
