// src/core/Exporter.js

export class Exporter {
    constructor(generator) {
        this.generator = generator;
        this.isRunning = false;
        this.isCancelled = false;
        this.workers = [];
        this.completed = 0;
        this.totalFrames = 0;
        this.startTime = 0;
        this.resolve = null;
        this.totalSize = 0;
        this.folderName = '';
        this.onProgress = null;
        this.onComplete = null;
    }

    async startExport(opts = {}) {
        if (this.isRunning) return;
        if (window.location.protocol === 'file:') {
            alert('❌ Export requires HTTP server!');
            return;
        }

        const { width, height } = this.generator.getCanvasSize();
        const totalFrames = this.generator.state.fps * this.generator.state.duration;
        
        if (totalFrames > 1000 && !opts.skipConfirm) {
            if (!confirm(`${totalFrames} frames. Continue?`)) return;
        }

        let dirHandle = opts.dirHandle;
        if (!dirHandle) {
            try {
                dirHandle = await window.showDirectoryPicker();
            } catch (err) {
                if (err.name !== 'AbortError') {
                    alert('Folder selection cancelled');
                }
                return;
            }
        }

        this.onProgress = opts.onProgress || null;
        this.onComplete = opts.onComplete || null;
        this.folderName = dirHandle.name;
        this.totalSize = 0;

        this.isRunning = true;
        this.isCancelled = false;
        this.completed = 0;
        this.totalFrames = totalFrames;
        this.startTime = performance.now();
        
        this.showProgress();
        
        const workerCount = this.getWorkerCount(width, height);
        this.startWorkers(workerCount, totalFrames, width, height, dirHandle);
        
        return new Promise((resolve) => {
            this.resolve = resolve;
        });
    }

    getWorkerCount(width, height) {
        const cores = navigator.hardwareConcurrency || 8;
        const maxWorkers = Math.min(6, Math.max(2, cores - 2));
        const pixels = width * height;
        
        if (pixels > 3840 * 2160) return Math.min(2, maxWorkers);
        if (pixels > 1920 * 1080) return Math.min(3, maxWorkers);
        return Math.min(4, maxWorkers);
    }

    startWorkers(count, totalFrames, width, height, dirHandle) {
        const workerUrl = new URL('../workers/render.worker.js', import.meta.url);
        const busy = new Array(count).fill(false);
        const queue = Array.from({ length: totalFrames }, (_, i) => i);
        const frameRetryCount = new Map();
        const MAX_RETRIES = 3;
        
        for (let i = 0; i < count; i++) {
            // type: 'module' lets the worker import ShaderBuilder + all mode
            // classes so exported frames use the EXACT same shader as the
            // live preview (all modes, not just psychedelic).
            this.workers.push(new Worker(workerUrl, { type: 'module' }));
        }

        const dispatchNext = () => {
            if (this.isCancelled || queue.length === 0) return;
            
            for (let i = 0; i < count; i++) {
                if (!busy[i] && queue.length > 0) {
                    const frameIndex = queue.shift();
                    busy[i] = true;
                    
                    this.workers[i].onmessage = async (e) => {
                        busy[i] = false;
                        
                        if (e.data.success && !this.isCancelled) {
                            await this.saveFrame(e.data.blob, frameIndex, dirHandle);
                            this.completed++;
                            this.totalSize += e.data.blob.size;
                            this.updateProgress();
                            
                            if (this.completed >= totalFrames) {
                                this.finish();
                            } else {
                                dispatchNext();
                            }
                        } else if (!this.isCancelled) {
                            const retries = frameRetryCount.get(frameIndex) || 0;
                            if (retries < MAX_RETRIES) {
                                frameRetryCount.set(frameIndex, retries + 1);
                                queue.push(frameIndex);
                                console.warn(`🔄 Retry frame ${frameIndex} (${retries+1}/${MAX_RETRIES})`);
                                dispatchNext();
                            } else {
                                console.error(`❌ Frame ${frameIndex} failed after ${MAX_RETRIES} retries`);
                                this.cancel();
                            }
                        }
                    };
                    
                    this.workers[i].postMessage({
                        frameIndex,
                        params: this.getFrameParams(frameIndex, width, height)
                    });
                }
            }
        };

        for (let i = 0; i < Math.min(count, totalFrames); i++) {
            dispatchNext();
        }
    }

    // src/core/Exporter.js - Update getFrameParams()

// src/core/Exporter.js

getFrameParams(frameIndex, width, height) {
    const state = this.generator.state;
    const mode = this.generator.getActiveMode();
    const modeNames = Object.keys(this.generator.modes);
    const palette = this.generator.renderer.palette;
    
    // ✅ Frame-based time for export
    const time = frameIndex / state.fps;
    
    return {
        width, height,
        time: time,
        distortion: state.distortion,
        complexity: state.complexity,
        speed: state.speed,
        scale: state.scale,
        aspect: width / height,
        loopDuration: state.duration,
        palette: palette,
        paletteCount: palette.length,
        // Which animation mode to render — the worker builds a shader with
        // ALL modes (same as the live renderer) and selects by index, so
        // exported frames always match what's shown on screen.
        modeNames: modeNames,
        modeName: this.generator.activeMode,
        modeIndex: modeNames.indexOf(this.generator.activeMode),
        ...mode.getParams()
    };
}

    async saveFrame(blob, index, dirHandle) {
        const filename = `frame_${String(index).padStart(4, '0')}.png`;
        try {
            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
        } catch (err) {
            console.error('Save error:', err);
        }
    }

    updateProgress() {
        const progress = (this.completed / this.totalFrames) * 100;
        if (this.onProgress) {
            this.onProgress(progress, this.completed, this.totalFrames);
        }
    }

    showProgress() {
        if (this.onProgress) {
            this.onProgress(0, 0, this.totalFrames);
        }
    }

    finish() {
        this.isRunning = false;
        this.workers.forEach(w => w.terminate());
        this.workers = [];
        
        const renderTime = (performance.now() - this.startTime) / 1000;
        const { width, height } = this.generator.getCanvasSize();
        
        if (this.onComplete) {
            this.onComplete({
                width,
                height,
                totalFrames: this.totalFrames,
                totalSize: this.totalSize,
                renderTime,
                folderName: this.folderName
            });
        }
        
        if (this.resolve) {
            this.resolve({ status: 'complete' });
            this.resolve = null;
        }
    }

    cancel() {
        this.isCancelled = true;
        this.isRunning = false;
        this.workers.forEach(w => w.terminate());
        this.workers = [];
        
        if (this.resolve) {
            this.resolve({ status: 'cancelled' });
            this.resolve = null;
        }
    }

    exportSingleImage() {
        const canvas = this.generator.getCanvas();
        const format = 'png';
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `psychedelic-${canvas.width}x${canvas.height}-${Date.now()}.${format}`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        }, `image/${format}`, 0.95);
    }
}
