// src/modes/KaleidoscopeMode.js

import { BaseMode } from './BaseMode.js';

export class KaleidoscopeMode extends BaseMode {
    constructor() {
        super();
        this.name = 'kaleidoscope';
        
        this.paramDefinitions = [
            { id: 'segments', label: '🔮 Segments', min: 3, max: 16, step: 1, default: 8 },
            { id: 'rotationSpeed', label: '🌀 Rotate Speed', min: 0.0, max: 2.0, step: 0.05, default: 0.3 },
            { id: 'zoom', label: '🔍 Zoom', min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
            { id: 'complexity', label: '✨ Detail', min: 1, max: 8, step: 1, default: 3 }
        ];
        
        this.resetParams();
    }

    getShaderCode() {
        return `
            // ========== KALEIDOSCOPE MODE ==========
            
            vec2 kaleidoscopeUV(vec2 uv, float segments) {
                vec2 p = uv - 0.5;
                float angle = atan(p.y, p.x);
                float radius = length(p);
                float segAngle = 6.28318 / segments;
                angle = mod(angle, segAngle);
                angle = abs(angle - segAngle * 0.5);
                return vec2(cos(angle), sin(angle)) * radius + 0.5;
            }
            
            vec3 renderKaleidoscope(vec2 uv, float t) {
                float segments = u_segments;
                float rotateSpeed = u_rotationSpeed;
                float zoom = u_zoom;
                
                // Rotasi (tetap linear, tidak diubah)
                float angle = t * rotateSpeed;
                mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
                
                vec2 kuv = kaleidoscopeUV(uv, segments);
                vec2 p = (kuv - 0.5) * zoom;
                p = rot * p;
                p = p + 0.5;
                
                vec2 w = p * 2.0;
                
                // ============================================================
                // 🔄 PERIODIC FBM DRIFT (SEAMLESS LOOP)
                // ============================================================
                // Hitung phase 0 → 2π berdasarkan durasi loop (dalam shader time)
                float loopT = u_loopDuration * u_speed;
                float phase = (loopT > 0.0) ? (t / loopT) * 6.28318530718 : 0.0;
                
                // Lissajous multi-frekuensi. Kembali ke (0,0) tepat di phase = 2π
                vec2 drift = vec2(sin(phase * 1.0), cos(phase * 1.3)) * 0.15 +
                             vec2(sin(phase * 2.1), cos(phase * 0.7)) * 0.05;
                
                // FBM layer 1 (dengan drift periodik)
                float n = fbm(w + drift);
                // FBM layer 2 (dengan drift periodik, arah sedikit berbeda)
                float n2 = fbm(w * 1.5 - drift * 0.8 + n * 0.5);
                
                // Pola utama
                float pattern = sin((p.x - 0.5) * 20.0 + n * 5.0) * 
                               cos((p.y - 0.5) * 20.0 + n2 * 5.0) * 0.5 + 0.5;
                
                // Layer detail (juga pakai drift periodik, biar tidak loncat)
                float detail = fbm(w * 3.0 + drift * 1.5) * 0.3;
                pattern = mix(pattern, detail, 0.2);
                
                float glow = exp(-length(p - 0.5) * 3.0) * 0.4;
                pattern = clamp(pattern + glow, 0.0, 1.0);
                
                return vec3(pattern);
            }
        `;
    }

    updateUniforms(gl, uniforms, params) {
        const p = { ...this.params, ...params };
        gl.uniform1f(uniforms.segments, p.segments);
        gl.uniform1f(uniforms.rotationSpeed, p.rotationSpeed);
        gl.uniform1f(uniforms.zoom, p.zoom);
        gl.uniform1f(uniforms.complexity, p.complexity);
    }
}