// src/modes/MorphMode.js

import { BaseMode } from './BaseMode.js';

export class MorphMode extends BaseMode {
    constructor() {
        super();
        this.name = 'morph';

        this.paramDefinitions = [
            { id: 'morphShapes', label: '🔷 Shape Sides', min: 3, max: 9, step: 1, default: 6 },
            { id: 'morphSpeed', label: '🌊 Morph Speed', min: 0.1, max: 2.0, step: 0.05, default: 0.5 },
            { id: 'morphScale', label: '💫 Scale', min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
            { id: 'morphBlend', label: '✨ Noise Blend', min: 0.0, max: 2.0, step: 0.1, default: 1.0 }
        ];

        this.resetParams();
    }

    getShaderCode() {
        return `
            // ========== MORPHING SHAPES MODE ==========
            // Continuously morphs a rotating polygon between a triangle and an
            // N-gon using a smooth sine wave (no discrete jumps), then perturbs
            // the edge with fbm. Fully continuous in t for a seamless crossfade loop.

            float morphShapeDist(vec2 p, float sides, float t) {
                float angle = atan(p.y, p.x) + t * 0.3;
                float r = length(p);
                float seg = 6.28318530718 / sides;
                float a = mod(angle, seg) - seg * 0.5;
                return cos(a) * r;
            }

            vec3 renderMorph(vec2 uv, float t) {
                vec2 p = (uv - 0.5) * u_morphScale;
                float shapes = u_morphShapes;
                float speed = u_morphSpeed;
                float blendAmt = u_morphBlend;

                float phase = t * speed;
                float wave = sin(phase) * 0.5 + 0.5;

                float sidesA = 3.0;
                float sidesB = 3.0 + max(shapes - 3.0, 1.0);

                float dA = morphShapeDist(p, sidesA, t);
                float dB = morphShapeDist(p, sidesB, t * 1.15);
                float d = mix(dA, dB, wave);

                float n = fbm(p * 1.5 + t * 0.2);
                d += (n - 0.5) * blendAmt * 0.3;

                float pattern = smoothstep(0.6, 0.3, abs(d - 0.45));
                float core = smoothstep(0.5, 0.0, d);
                pattern = clamp(pattern + core * 0.5, 0.0, 1.0);

                return vec3(pattern);
            }
        `;
    }

    updateUniforms(gl, uniforms, params) {
        const p = { ...this.params, ...params };
        gl.uniform1f(uniforms.morphShapes, p.morphShapes);
        gl.uniform1f(uniforms.morphSpeed, p.morphSpeed);
        gl.uniform1f(uniforms.morphScale, p.morphScale);
        gl.uniform1f(uniforms.morphBlend, p.morphBlend);
    }
}
