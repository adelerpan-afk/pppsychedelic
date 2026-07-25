// src/utils/helpers.js

// src/utils/helpers.js - Tambahan

// ... existing code ...

/**
 * Get display size berdasarkan container
 */
export function getDisplaySize(container, aspectRatio = 16/9) {
    if (!container) return { width: 0, height: 0 };
    
    const rect = container.getBoundingClientRect();
    let width = rect.width;
    let height = width / aspectRatio;
    
    if (height > rect.height) {
        height = rect.height;
        width = height * aspectRatio;
    }
    
    return { width, height };
}

/**
 * Update canvas display size
 */
export function updateCanvasDisplay(canvas, container, aspectRatio = 16/9) {
    const { width, height } = getDisplaySize(container, aspectRatio);
    
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    
    return { width, height };
}

export function hexToRgb(hex) {
    hex = hex.replace('#', '').trim();
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) return null;
    
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    
    return isNaN(r) ? null : [r / 255, g / 255, b / 255];
}

export function rgbToHex(rgb) {
    return '#' + rgb.map(v => 
        Math.round(v * 255).toString(16).padStart(2, '0')
    ).join('');
}

export function parseCustomPalette(input) {
    const parsed = [];
    const colors = input.split(',').map(c => c.trim()).filter(c => c);
    
    for (const color of colors) {
        const rgb = hexToRgb(color);
        if (rgb) parsed.push(rgb);
        if (parsed.length >= 6) break;
    }
    
    return parsed.length >= 2 ? parsed : null;
}

export function getCanvasSize(resolution, aspectRatio) {
    const height = parseInt(resolution);
    const [w, h] = aspectRatio.split(':').map(Number);
    return {
        width: Math.floor(height * w / h),
        height
    };
}

export function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

export function debounce(fn, delay = 100) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

export function getOptimalWorkers(width, height, maxWorkers = 6) {
    const cores = navigator.hardwareConcurrency || 4;
    const available = Math.min(maxWorkers, Math.max(2, cores - 2));
    const pixels = width * height;
    
    if (pixels > 3840 * 2160) return Math.min(2, available);
    if (pixels > 1920 * 1080) return Math.min(3, available);
    return Math.min(4, available);
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
