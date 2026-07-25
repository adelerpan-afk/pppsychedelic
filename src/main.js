// src/main.js

import { Generator } from './core/Generator.js';
import { UIController } from './ui/UIController.js';
import { DEFAULT_PALETTES } from './utils/constants.js';

class App {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.canvasWrapper = document.getElementById('canvasWrapper');
        this.generator = new Generator(this.canvas);
        this.ui = new UIController(this.generator);
        
        this.init();
        this.setupResize();
    }

    init() {
        // Set default palette
        setTimeout(() => {
            this.generator.setPalette(DEFAULT_PALETTES.rainbow);
        }, 100);
        
        // Check server
        if (window.location.protocol === 'file:') {
            document.getElementById('serverWarning').innerHTML = 
                '❌ RUN WITH LOCAL SERVER!<br><code>python -m http.server 8000</code>';
            document.getElementById('generateBtn').disabled = true;
        }
        
        // Set worker info
        const cores = navigator.hardwareConcurrency || 8;
        const workers = Math.min(4, Math.max(2, cores - 2));
        document.getElementById('memoryStats').textContent = 
            `🧠 ${cores} cores | 🚀 ${workers} workers`;
        
        console.log(`🔥 Ready | ${cores} threads | ${workers} workers`);
    }

    setupResize() {
        // Resize canvas wrapper berdasarkan container
        this.resizeCanvas();
        
        // Debounce resize event
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.resizeCanvas(), 100);
        });

        // Observer untuk perubahan ukuran container
        if (window.ResizeObserver) {
            const observer = new ResizeObserver(() => {
                this.resizeCanvas();
            });
            observer.observe(this.canvasWrapper);
        }
    }

    resizeCanvas() {
        const wrapper = this.canvasWrapper;
        const container = wrapper.parentElement;
        
        if (!container) return;
        
        // Dapatkan ukuran container
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // Hitung ukuran canvas berdasarkan aspect ratio 16:9
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
        
        // Canvas internal size tetap mengikuti resolusi export
        // Tapi display size mengikuti wrapper
        const canvas = this.canvas;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        
        // Update aspect ratio indicator
        const indicator = document.getElementById('ratioIndicator');
        const state = this.generator.state;
        if (state) {
            const [w, h] = state.aspectRatio.split(':').map(Number);
            const displayWidth = Math.round(width);
            const displayHeight = Math.round(height);
            indicator.textContent = `${state.aspectRatio} (${displayWidth}×${displayHeight})`;
        }
        
        console.log(`📐 Canvas resized: ${width}×${height} (display)`);
    }
}

// Start app
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    window.app = app;
});
