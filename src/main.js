// src/main.js - Tambah timer handling

import { Generator } from './core/Generator.js';
import { UIController } from './ui/UIController.js';
import { DEFAULT_PALETTES } from './utils/constants.js';

class App {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.canvasWrapper = document.getElementById('canvasWrapper');

        if (!this.canvas) {
            console.error('❌ Canvas not found!');
            return;
        }

        console.log('🚀 Initializing App...');

        // Timer elements
        this.timerDisplay = document.getElementById('timerDisplay');
        this.timerProgressFill = document.getElementById('timerProgressFill');
        this.timerFrame = document.getElementById('timerFrame');
        this.timerFPS = document.getElementById('timerFPS');
        this.timerStatus = document.getElementById('timerStatus');

        // Create generator
        this.generator = new Generator(this.canvas);

        // Create UI controller
        this.ui = new UIController(this.generator);

        // Init
        this.init();

        // Setup resize
        this.setupResize();

        // Start timer update loop
        this.startTimerLoop();

        console.log('✅ App initialized');
    }

    // ==================== INIT ====================

    init() {
        // Set default palette
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

        // Timer status
        this.updateTimerStatus('live');
    }

    // ==================== TIMER LOOP ====================

    startTimerLoop() {
        // Update timer setiap 50ms (20fps update)
        this.timerInterval = setInterval(() => {
            this.updateTimer();
        }, 50);
    }

    updateTimer() {
        if (!this.generator) return;

        const state = this.generator.state;
        const duration = state.duration || 5;
        const fps = state.fps || 30;
        const elapsed = this.generator.getElapsedTime();

        // Raw elapsed (tanpa modulo)
        const rawElapsed = (Date.now() - this.generator.startTime) / 1000;

        // Loop time (dengan modulo)
        const loopTime = duration > 0 ? (rawElapsed % duration) : rawElapsed;
        const loopProgress = duration > 0 ? (loopTime / duration) : 0;

        // Current frame
        const currentFrame = Math.floor(loopTime * fps);
        const totalFrames = duration * fps;

        // Format time
        const minutes = Math.floor(loopTime / 60);
        const seconds = Math.floor(loopTime % 60);
        const centiseconds = Math.floor((loopTime % 1) * 100);

        // Update timer display
        if (this.timerDisplay) {
            this.timerDisplay.textContent = 
                `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
            
            // Color based on progress
            this.timerDisplay.classList.remove('warning', 'danger');
            if (loopProgress > 0.85) {
                this.timerDisplay.classList.add('danger');
            } else if (loopProgress > 0.7) {
                this.timerDisplay.classList.add('warning');
            }
        }

        // Update progress bar
        if (this.timerProgressFill) {
            this.timerProgressFill.style.width = `${loopProgress * 100}%`;
        }

        // Update frame info
        if (this.timerFrame) {
            this.timerFrame.textContent = `Frame: ${Math.min(currentFrame, totalFrames)}/${Math.round(totalFrames)}`;
        }

        // Update FPS info
        if (this.timerFPS) {
            this.timerFPS.textContent = `FPS: ${fps}`;
        }

        // Update status
        if (this.timerStatus) {
            if (this.generator.isPaused) {
                this.updateTimerStatus('paused');
            } else if (duration > 0 && loopProgress > 0.95) {
                this.updateTimerStatus('looping');
            } else {
                this.updateTimerStatus('live');
            }
        }
    }

    updateTimerStatus(status) {
        if (!this.timerStatus) return;

        const statusTexts = {
            live: { text: '● LIVE', class: 'live' },
            paused: { text: '⏸ PAUSED', class: 'paused' },
            looping: { text: '🔄 LOOPING', class: 'looping' }
        };

        const info = statusTexts[status] || statusTexts.live;
        this.timerStatus.textContent = info.text;
        this.timerStatus.className = `timer-status ${info.class}`;
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
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.resizeCanvas(), 100);
        });

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

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        if (containerWidth === 0 || containerHeight === 0) return;

        const aspectRatio = 16 / 9;
        let width = containerWidth;
        let height = containerWidth / aspectRatio;

        if (height > containerHeight) {
            height = containerHeight;
            width = containerHeight * aspectRatio;
        }

        wrapper.style.width = `${width}px`;
        wrapper.style.height = `${height}px`;
        wrapper.style.maxWidth = '100%';
        wrapper.style.maxHeight = '100%';

        if (this.generator && this.generator.updateDisplaySize) {
            this.generator.updateDisplaySize();
        }

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
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

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
