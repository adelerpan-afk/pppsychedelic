// src/modes/BlobMode.js
import { BaseMode } from './BaseMode.js';

export class BlobMode extends BaseMode {
    constructor() {
        super();
        this.name = 'blob';
        
        this.paramDefinitions = [
            { id: 'blobCount', label: '🦠 Bakteri Count', min: 2, max: 14, step: 1, default: 8 },
            { id: 'blobSize', label: '🔬 Ukuran', min: 0.03, max: 0.3, step: 0.01, default: 0.12 },
            { id: 'blobSpeed', label: '🏊 Kecepatan Orbit', min: 0.2, max: 2.0, step: 0.1, default: 1.0 },
            { id: 'blobWobble', label: '🌀 Kelenturan', min: 0.0, max: 1.5, step: 0.1, default: 0.6 }
        ];
        
        this.resetParams();
    }

    getShaderCode() {
        return `
            // ============================================================
            // BLOB MODE – BAKTERI DI CAWAN PETRI
            // Setiap individu mengorbit titik pusat dengan periode tepat = durasi loop.
            // Bentuk dan deformasi juga periodik, sehingga loop sempurna.
            // ============================================================
            
            vec3 renderBlob(vec2 uv, float t) {
                float count = u_blobCount;
                float size = u_blobSize;
                float speed = u_blobSpeed;
                float wobble = u_blobWobble;
                float loopDur = u_loopDuration;
                
                float D = max(loopDur, 0.001);
                float twoPi = 6.28318530718;
                
                float sum = 0.0;
                
                for (int i = 0; i < 14; i++) {
                    if (float(i) >= count) break;
                    float fi = float(i);
                    
                    // Seed unik
                    float seed = fi * 12.9898 + 78.233;
                    float phase = fract(sin(seed) * 43758.5453);
                    
                    // Orbit periodik: putaran 1 atau 2
                    float rotations = 1.0 + floor(phase * 2.0);
                    float angle = twoPi * (t / D) * rotations * speed + phase * twoPi;
                    
                    // Sumbu elips
                    float rx = size * (0.4 + 0.3 * sin(seed * 2.0)) * 1.8;
                    float ry = size * (0.4 + 0.3 * cos(seed * 1.7)) * 1.8;
                    
                    // Pusat orbit tersebar
                    vec2 orbitCenter = vec2(
                        0.5 + 0.35 * sin(seed * 1.3 + 0.5),
                        0.5 + 0.35 * cos(seed * 1.7 + 0.2)
                    );
                    
                    vec2 center = orbitCenter + vec2(rx * cos(angle), ry * sin(angle));
                    
                    vec2 dir = uv - center;
                    float dist = length(dir);
                    
                    // Radius dasar
                    float baseRadius = size * (0.5 + 0.3 * sin(seed * 1.1));
                    
                    // Deformasi bentuk (periodik, frekuensi 1)
                    float deformAngle = atan(dir.y, dir.x);
                    float timePhase = twoPi * (t / D) * 1.0 + phase * twoPi;
                    
                    float deform = 1.0 + wobble * 0.25 * (
                        sin(deformAngle * 3.0 + timePhase + seed * 2.0) * 0.6 +
                        cos(deformAngle * 5.0 - timePhase * 0.7 + seed * 1.3) * 0.4
                    );
                    
                    float effectiveRadius = baseRadius * deform;
                    
                    // Metaball field
                    sum += (effectiveRadius * effectiveRadius) / (dist * dist + 0.0001);
                }
                
                // Threshold
                float threshold = 0.85 + 0.1 * sin(twoPi * (t / D) * 0.5);
                float pattern = smoothstep(threshold + 0.3, threshold - 0.1, sum);
                
                // Glow
                float glow = exp(-abs(sum - threshold) * 3.0) * 0.5;
                pattern = clamp(pattern + glow, 0.0, 1.0);
                
                return vec3(pattern);
            }
        `;
    }

    updateUniforms(gl, uniforms, params) {
        const p = { ...this.params, ...params };
        gl.uniform1f(uniforms.blobCount, p.blobCount);
        gl.uniform1f(uniforms.blobSize, p.blobSize);
        gl.uniform1f(uniforms.blobSpeed, p.blobSpeed);
        gl.uniform1f(uniforms.blobWobble, p.blobWobble);
    }
}