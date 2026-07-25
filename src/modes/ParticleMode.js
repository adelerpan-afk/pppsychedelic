// src/modes/ParticleMode.js

import { BaseMode } from './BaseMode.js';

export class ParticleMode extends BaseMode {
    constructor() {
        super();
        this.name = 'particle';

        this.paramDefinitions = [
            { id: 'particleCount', label: '✨ Count', min: 10, max: 60, step: 1, default: 30 },
            { id: 'particleSpeed', label: '🌊 Speed', min: 0.1, max: 2.0, step: 0.05, default: 0.6 },
            { id: 'particleSize', label: '⚪ Size', min: 0.005, max: 0.05, step: 0.001, default: 0.02 },
            { id: 'particleTrail', label: '💫 Glow', min: 0.0, max: 2.0, step: 0.1, default: 1.0 }
        ];

        this.resetParams();
    }

    getShaderCode() {
        return `
            // ========== PARTICLE MODE ==========
            // Procedural point-sprite field: each particle follows a smooth
            // Lissajous-style orbit that is a continuous function of t, so the
            // generic crossfade wrapper produces a seamless loop.

            vec3 renderParticle(vec2 uv, float t) {
                float count = u_particleCount;
                float speed = u_particleSpeed;
                float size = u_particleSize;
                float trail = u_particleTrail;

                float pattern = 0.0;
                for (int i = 0; i < 60; i++) {
                    if (float(i) >= count) break;
                    float fi = float(i);
                    float seedA = fi * 12.9898;
                    float seedB = fi * 78.233;
                    float rateA = 0.3 + fract(sin(seedA) * 43758.5453) * 0.4;
                    float rateB = 0.3 + fract(sin(seedB) * 43758.5453) * 0.4;

                    vec2 center = vec2(
                        0.5 + 0.4 * sin(t * speed * rateA + fi * 2.4),
                        0.5 + 0.4 * cos(t * speed * rateB + fi * 1.7)
                    );

                    float dist = length(uv - center);
                    float glowSize = size * (0.6 + 0.4 * sin(t * speed * 2.0 + fi));
                    float p = exp(-dist * dist / (glowSize * glowSize)) * trail;
                    pattern += p;
                }

                pattern = clamp(pattern, 0.0, 1.0);
                return vec3(pattern);
            }
        `;
    }

    updateUniforms(gl, uniforms, params) {
        const p = { ...this.params, ...params };
        gl.uniform1f(uniforms.particleCount, p.particleCount);
        gl.uniform1f(uniforms.particleSpeed, p.particleSpeed);
        gl.uniform1f(uniforms.particleSize, p.particleSize);
        gl.uniform1f(uniforms.particleTrail, p.particleTrail);
    }
}
