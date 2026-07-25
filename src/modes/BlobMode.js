// src/modes/BlobMode.js

import { BaseMode } from './BaseMode.js';

export class BlobMode extends BaseMode {
    constructor() {
        super();
        this.name = 'blob';
        
        this.paramDefinitions = [
            { id: 'blobCount', label: '🫧 Blob Count', min: 3, max: 15, step: 1, default: 7 },
            { id: 'blobSize', label: '📏 Blob Size', min: 0.05, max: 0.4, step: 0.01, default: 0.2 },
            { id: 'blobSpeed', label: '🌊 Blob Speed', min: 0.1, max: 2.0, step: 0.1, default: 0.5 },
            { id: 'blobWobble', label: '🌀 Wobble', min: 0.0, max: 2.0, step: 0.1, default: 0.5 }
        ];
        
        this.resetParams();
    }

    getShaderCode() {
        return `
            float sdCircle(vec2 p, float r) {
                return length(p) - r;
            }
            
            vec3 renderBlob(vec2 uv, float t) {
                float d = 0.0;
                float count = u_blobCount;
                float size = u_blobSize;
                float speed = u_blobSpeed;
                float wobble = u_blobWobble;
                
                for (int i = 0; i < 15; i++) {
                    if (float(i) >= count) break;
                    float fi = float(i);
                    
                    vec2 center = vec2(
                        0.5 + 0.4 * sin(t * 0.2 * speed + fi * 1.7 + fi * fi * 0.3),
                        0.5 + 0.4 * cos(t * 0.25 * speed + fi * 2.3 + fi * fi * 0.2)
                    );
                    
                    float radius = size * (0.7 + 0.3 * sin(t * 0.3 * speed + fi * 1.1 + fi * fi * 0.1));
                    
                    vec2 dir = uv - center;
                    float angle = atan(dir.y, dir.x);
                    float dist = length(dir);
                    
                    float wobbleFactor = 1.0 + wobble * 0.3 * sin(angle * 3.0 + t * 0.5 + fi);
                    float adjustedRadius = radius * wobbleFactor;
                    
                    float blob = 1.0 - smoothstep(0.0, adjustedRadius, dist);
                    d += blob * 0.15;
                }
                
                d = clamp(d * 1.5, 0.0, 1.0);
                float glow = exp(-d * 4.0) * 0.3;
                d = d + glow;
                
                return vec3(d);
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