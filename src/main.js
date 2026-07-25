// src/main.js

import { Generator } from './core/Generator.js';
import { UIController } from './ui/UIController.js';
import { DEFAULT_PALETTES } from './utils/constants.js';

class App {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.generator = new Generator(this.canvas);
        this.ui = new UIController(this.generator);
        
        this.init();
    }

    init() {
        // Set default palette - tunggu sampai uniforms ready
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
}

// Start app
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    window.app = app;
});