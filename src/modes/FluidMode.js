// src/modes/FluidMode.js

import { BaseMode } from './BaseMode.js';

export class FluidMode extends BaseMode {
    constructor() {
        super();
        this.name = 'fluid';

        this.paramDefinitions = [
            { id: 'fluidTurbulence', label: '💨 Turbulence', min: 0.5, max: 4.0, step: 0.1, default: 2.0 },
            { id: 'fluidSpeed', label: '🌊 Flow Speed', min: 0.1, max: 2.0, step: 0.05, default: 0.6 },
            { id: 'fluidScale', label: '💫 Scale', min: 0.5, max: 5.0, step: 0.1, default: 2.0 },
            { id: 'fluidSwirl', label: '🌀 Swirl', min: 0.0, max: 2.0, step: 0.1, default: 1.0 }
        ];

        this.resetParams();
    }

    getShaderCode() {
        return `
            // ========== FLUID MODE ==========
            // Domain-warped fbm advected with a swirl term. Fully continuous in t,
            // so the generic crossfade blend (t vs t-loopDuration) produces a seamless loop.

            vec3 renderFluid(vec2 uv, float t) {
                vec2 w = uv * u_fluidScale;
                float turb = u_fluidTurbulence;
                float swirl = u_fluidSwirl;

                vec2 flow = vec2(
                    fbm(w + vec2(t * 0.4, -t * 0.3)),
                    fbm(w + vec2(-t * 0.25, t * 0.35))
                );
                vec2 warped = w + (flow - 0.5) * turb * 0.8;

                float angle = atan(warped.y - 0.5, warped.x - 0.5);
                warped += vec2(cos(angle * 3.0 + t * 0.5), sin(angle * 3.0 - t * 0.5)) * swirl * 0.15;

                float n1 = fbm(warped + vec2(t * 0.15, t * 0.1));
                float n2 = fbm(warped * 1.7 - vec2(t * 0.1, -t * 0.15) + n1 * 0.6);

                float pattern = mix(n1, n2, 0.5);
                pattern = smoothstep(0.1, 0.9, pattern);

                return vec3(pattern);
            }
        `;
    }

    updateUniforms(gl, uniforms, params) {
        const p = { ...this.params, ...params };
        gl.uniform1f(uniforms.fluidTurbulence, p.fluidTurbulence);
        gl.uniform1f(uniforms.fluidSpeed, p.fluidSpeed);
        gl.uniform1f(uniforms.fluidScale, p.fluidScale);
        gl.uniform1f(uniforms.fluidSwirl, p.fluidSwirl);
    }
}
