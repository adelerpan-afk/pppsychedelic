// src/main.js

import { Generator } from './core/Generator.js';
import { UIController } from './ui/UIController.js';
import { DEFAULT_PALETTES } from './utils/constants.js';

class App {
    // ==================== CONSTRUCTOR ====================
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.canvasWrapper = document.getElementById('canvasWrapper');

        if (!this.canvas) {
            console.error('❌ Canvas not found!');
            return;
        }

        console.log('🚀 Initializing App...');

        // Create generator
        this.generator = new Generator(this.canvas);

        // Create UI controller
        this.ui = new UIController(this.generator);

        // Init
        this.init();

        // Setup resize
        this.setupResize();

        console.log('✅ App initialized');
    }

    // ==================== INIT ====================

    init() {
        // Set default palette (delay agar renderer siap)
        setTimeout(() => {
            if (this.generator && this.generator.setPalette) {
                this.generator.setPalette(DEFAULT_PALETTES.rainbow);
                console.log('🎨 Default palette set: rainbow');
            }
        }, 200);

        // Check server
        this.checkServer();

        // Set worker info
        this.setWorkerInfo();

        // Update display size
        setTimeout(() => this.resizeCanvas(), 300);
    }

    // ==================== SERVER CHECK ====================

    checkServer() {
        if (window.location.protocol === 'file:') {
            const warning = document.getElementById('serverWarning');
            if (warning) {
                warning.innerHTML = `
                    ❌ RUN WITH LOCAL SERVER!<br>
                    <code>python -m http.server 8000</code><br>
                    Then open: <code>http://localhost:8000</code>
                `;
                warning.style.background = 'rgba(231,76,60,0.3)';
                warning.style.borderLeft = '3px solid #ff6b6b';
            }

            const btn = document.getElementById('generateBtn');
            if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
            }

            console.warn('⚠️ Running from file:// protocol - Export disabled');
        }
    }

    // ==================== WORKER INFO ====================

    setWorkerInfo() {
        const cores = navigator.hardwareConcurrency || 8;
        const workers = Math.min(4, Math.max(2, cores - 2));

        const stats = document.getElementById('memoryStats');
        if (stats) {
            stats.textContent = `🧠 ${cores} cores | 🚀 ${workers} workers`;
        }

        console.log(`🔥 Ready | ${cores} threads | ${workers} workers`);
    }

    // ==================== RESIZE HANDLING ====================

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
        this.updateRatioIndicator(width, height);

        console.log(`📐 Display resized: ${Math.round(width)}×${Math.round(height)}`);
    }

    updateRatioIndicator(displayWidth, displayHeight) {
        const indicator = document.getElementById('ratioIndicator');
        if (!indicator || !this.generator) return;

        const state = this.generator.state;
        if (state) {
            const ratio = state.aspectRatio || '16:9';
            indicator.textContent = `${ratio} (${Math.round(displayWidth)}×${Math.round(displayHeight)})`;
        }
    }

    // ==================== PUBLIC METHODS ====================

    getGenerator() {
        return this.generator;
    }

    dispose() {
        if (this.generator && typeof this.generator.dispose === 'function') {
            this.generator.dispose();
        }
        console.log('🧹 App disposed');
    }
}

// ==================== START APP ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded, starting app...');

    try {
        const app = new App();
        window.app = app;

        // Additional resize after fonts/images load
        window.addEventListener('load', () => {
            setTimeout(() => {
                if (window.app && window.app.resizeCanvas) {
                    window.app.resizeCanvas();
                }
            }, 100);
        });

        console.log('✅ App started successfully');

    } catch (err) {
        console.error('❌ Failed to start app:', err);

        // Show error on page
        const container = document.getElementById('canvasContainer');
        if (container) {
            container.innerHTML = `
                <div style="color:#e74c3c;text-align:center;padding:40px;">
                    <h2>❌ Failed to initialize</h2>
                    <p>${err.message}</p>
                    <p style="font-size:0.8rem;color:#888;">Check console for details</p>
                </div>
            `;
        }
    }
});
