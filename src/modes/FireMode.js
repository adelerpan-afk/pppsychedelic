// src/modes/FireMode.js

import { BaseMode } from './BaseMode.js';

export class FireMode extends BaseMode {
    constructor() {
        super();
        this.name = 'fire';

        this.paramDefinitions = [
            { id: 'fireIntensity', label: '🔥 Intensity', min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
            { id: 'fireSpeed', label: '🌊 Rise Speed', min: 0.1, max: 3.0, step: 0.1, default: 1.0 },
            { id: 'fireTurbulence', label: '💨 Turbulence', min: 1.0, max: 5.0, step: 0.1, default: 2.5 },
            { id: 'fireHeight', label: '📏 Height', min: 0.5, max: 3.0, step: 0.1, default: 1.5 }
        ];

        this.resetParams();
    }

    getShaderCode() {
        return `
            // ========== FIRE MODE ==========
            // Upward-flowing turbulent fbm masked by a height falloff.
            // Continuous in t → seamless via the generic crossfade wrapper.

            vec3 renderFire(vec2 uv, float t) {
                float intensity = u_fireIntensity;
                float speed = u_fireSpeed;
                float turb = u_fireTurbulence;
                float heightP = u_fireHeight;

                vec2 w = uv * vec2(3.0, 4.0);
                vec2 flow = vec2(w.x + sin(t * speed * 0.3) * 0.3, w.y - t * speed * 2.0);

                float n = fbm(flow * turb * 0.5);
                float n2 = fbm(flow * turb + vec2(n * 1.5, -t * speed * 0.5));

                float base = 1.0 - uv.y;
                float flame = base * heightP - n2 * 0.5 - (1.0 - n) * 0.3;
                flame = clamp(flame * intensity, 0.0, 1.0);
                flame = pow(flame, 1.3);

                return vec3(flame);
            }
        `;
    }

    updateUniforms(gl, uniforms, params) {
        const p = { ...this.params, ...params };
        gl.uniform1f(uniforms.fireIntensity, p.fireIntensity);
        gl.uniform1f(uniforms.fireSpeed, p.fireSpeed);
        gl.uniform1f(uniforms.fireTurbulence, p.fireTurbulence);
        gl.uniform1f(uniforms.fireHeight, p.fireHeight);
    }
}
