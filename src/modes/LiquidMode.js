// src/modes/LiquidMode.js

import { BaseMode } from './BaseMode.js';

export class LiquidMode extends BaseMode {
    constructor() {
        super();
        this.name = 'liquid';

        this.paramDefinitions = [
            { id: 'liquidShine', label: '✨ Shine', min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
            { id: 'liquidFlow', label: '🌊 Flow Speed', min: 0.1, max: 2.0, step: 0.05, default: 0.6 },
            { id: 'liquidScale', label: '💫 Scale', min: 0.5, max: 5.0, step: 0.1, default: 2.0 },
            { id: 'liquidRipple', label: '🌀 Ripple', min: 0.0, max: 3.0, step: 0.1, default: 1.2 }
        ];

        this.resetParams();
    }

    getShaderCode() {
        return `
            // ========== LIQUID METAL MODE ==========
            // Derives a fake surface normal from the gradient of an fbm height
            // field, then lights it like chrome. Continuous in t → seamless
            // via the generic crossfade wrapper.

            vec3 renderLiquid(vec2 uv, float t) {
                vec2 w = uv * u_liquidScale;
                float flow = u_liquidFlow;
                float ripple = u_liquidRipple;
                float shine = u_liquidShine;

                float eps = 0.01;
                vec2 drift = vec2(t * flow * 0.3, t * flow * 0.2);

                float h  = fbm(w + drift) + fbm(w * 2.0 - vec2(t * flow * 0.2, -t * flow * 0.25)) * 0.5;
                float hx = fbm(w + vec2(eps, 0.0) + drift) - h;
                float hy = fbm(w + vec2(0.0, eps) + drift) - h;

                vec2 grad = vec2(hx, hy) / eps;
                vec3 normal = normalize(vec3(-grad * ripple, 1.0));

                vec3 lightDir = normalize(vec3(sin(t * 0.5), cos(t * 0.5), 0.8));
                float diff = max(dot(normal, lightDir), 0.0);
                float spec = pow(diff, 12.0) * shine;

                float pattern = clamp(diff * 0.6 + spec + h * 0.2, 0.0, 1.0);
                return vec3(pattern);
            }
        `;
    }

    updateUniforms(gl, uniforms, params) {
        const p = { ...this.params, ...params };
        gl.uniform1f(uniforms.liquidShine, p.liquidShine);
        gl.uniform1f(uniforms.liquidFlow, p.liquidFlow);
        gl.uniform1f(uniforms.liquidScale, p.liquidScale);
        gl.uniform1f(uniforms.liquidRipple, p.liquidRipple);
    }
}
