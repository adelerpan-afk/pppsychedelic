// src/ui/ExportUI.js

export class ExportUI {
    constructor(generator) {
        this.generator = generator;
        this.isExporting = false;
        this.exportFormat = 'png';
        this.startTime = 0;
        this.completed = 0;
        this.totalFrames = 0;
        this.totalSize = 0;
        
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportSingleImage();
        });

        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.format-btn').forEach(b => 
                    b.classList.remove('active-format')
                );
                btn.classList.add('active-format');
                this.exportFormat = btn.dataset.format;
            });
        });

        document.getElementById('fps').addEventListener('input', () => {
            this.updateFFmpegCommand();
        });
    }

    async startExport() {
        if (this.isExporting) return;
        
        if (window.location.protocol === 'file:') {
            this.showToast('❌ Export requires HTTP server!');
            return;
        }

        const { width, height } = this.generator.getCanvasSize();
        const totalFrames = this.generator.state.fps * this.generator.state.duration;
        
        if (totalFrames > 1000) {
            if (!confirm(`${totalFrames} frames. Continue?`)) return;
        }

        try {
            const dirHandle = await window.showDirectoryPicker();
            this.isExporting = true;
            this.startTime = performance.now();
            this.totalFrames = totalFrames;
            this.completed = 0;
            this.totalSize = 0;
            this.showProgress();
            
            await this.generator.startExport({
                dirHandle,
                skipConfirm: false,
                onProgress: (progress, completed, total) => {
                    this.updateProgress(progress, completed, total);
                },
                onComplete: (data) => {
                    this.showSummary(data);
                    this.resetUI();
                }
            });
            
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Export error:', err);
                this.showToast('❌ Export failed: ' + err.message);
            }
            this.resetUI();
        }
    }

    cancelExport() {
        this.generator.cancelExport();
        this.isExporting = false;
        this.resetUI();
        this.showToast('⚠️ Export cancelled');
    }

    exportSingleImage() {
        const canvas = this.generator.getCanvas();
        const format = this.exportFormat;
        const mimeType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
        
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `psychedelic-${canvas.width}x${canvas.height}-${Date.now()}.${format}`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            this.showToast(`✅ Exported as ${format.toUpperCase()}`);
        }, mimeType, 0.95);
    }

    showProgress() {
        document.getElementById('generatingOverlay').classList.add('active');
        document.getElementById('generateBtn').classList.add('generating');
        document.getElementById('generateBtn').textContent = '💾 EXPORTING...';
        document.getElementById('generateBtn').disabled = true;
        document.getElementById('cancelBtn').style.display = 'block';
        document.getElementById('miniProgress').style.display = 'block';
        document.getElementById('generatingProgressFill').style.width = '0%';
        document.getElementById('miniProgressFill').style.width = '0%';
    }

    updateProgress(progress, completed, total) {
        document.getElementById('generatingProgressFill').style.width = `${progress}%`;
        document.getElementById('miniProgressFill').style.width = `${progress}%`;
        document.getElementById('generatingDetails').textContent = 
            `Writing: ${completed} / ${total} frames`;
        
        const elapsed = (performance.now() - this.startTime) / 1000;
        const fps = completed / elapsed || 0;
        document.getElementById('generatingSpeed').textContent = 
            `⚡ ${fps.toFixed(1)} fps`;
    }

    showSummary(data) {
        const { width, height, totalFrames, totalSize, renderTime, folderName } = data;
        
        const existing = document.querySelector('.summary-card');
        if (existing) existing.remove();

        const card = document.createElement('div');
        card.className = 'summary-card';
        card.innerHTML = `
            <div style="background:rgba(8,12,25,0.98);backdrop-filter:blur(20px);
                        border-radius:18px;border:1px solid rgba(52,152,219,0.4);overflow:hidden;">
                <div style="background:linear-gradient(135deg,rgba(52,152,219,0.3),rgba(46,204,113,0.1));
                            padding:12px 16px;border-bottom:1px solid rgba(52,152,219,0.3);
                            display:flex;align-items:center;gap:10px;">
                    <span style="font-size:22px;">💾</span>
                    <div style="flex:1;">
                        <div style="color:#3498db;font-weight:700;font-size:0.85rem;">EXPORT COMPLETE</div>
                        <div style="color:#feca57;font-size:0.6rem;">📁 ${folderName}</div>
                    </div>
                    <button id="closeSummary" style="background:transparent;border:none;
                            color:#8ec8e0;cursor:pointer;font-size:18px;">✕</button>
                </div>
                <div style="padding:14px 16px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
                    <div style="text-align:center;background:rgba(10,15,30,0.6);border-radius:10px;padding:8px;">
                        <div style="color:#8ec8e0;font-size:0.55rem;">FRAMES</div>
                        <div style="color:#2ecc71;font-size:1rem;font-weight:700;">${totalFrames.toLocaleString()}</div>
                    </div>
                    <div style="text-align:center;background:rgba(10,15,30,0.6);border-radius:10px;padding:8px;">
                        <div style="color:#8ec8e0;font-size:0.55rem;">RESOLUTION</div>
                        <div style="color:#3498db;font-size:1rem;font-weight:700;">${width}×${height}</div>
                    </div>
                    <div style="text-align:center;background:rgba(10,15,30,0.6);border-radius:10px;padding:8px;">
                        <div style="color:#8ec8e0;font-size:0.55rem;">RENDER SPEED</div>
                        <div style="color:#e74c3c;font-size:1rem;font-weight:700;">${(totalFrames / renderTime).toFixed(0)} fps</div>
                    </div>
                </div>
                <div style="padding:0 16px 14px;">
                    <div style="background:rgba(46,204,113,0.1);border-radius:10px;
                                padding:8px;text-align:center;font-size:0.7rem;color:#2ecc71;">
                        ✅ All frames saved to "${folderName}"
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(card);
        
        document.getElementById('closeSummary').onclick = () => {
            card.style.animation = 'slideOutSummary 0.3s ease forwards';
            setTimeout(() => card.remove(), 300);
        };
    }

    resetUI() {
        this.isExporting = false;
        document.getElementById('generatingOverlay').classList.remove('active');
        document.getElementById('miniProgress').style.display = 'none';
        document.getElementById('generateBtn').classList.remove('generating');
        document.getElementById('generateBtn').disabled = false;
        document.getElementById('generateBtn').textContent = '🔥 OPTIMIZED Export';
        document.getElementById('cancelBtn').style.display = 'none';
        document.getElementById('generatingProgressFill').style.width = '0%';
        document.getElementById('miniProgressFill').style.width = '0%';
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
}