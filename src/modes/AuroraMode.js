// src/modes/AuroraMode.js

import { BaseMode } from './BaseMode.js';

export class AuroraMode extends BaseMode {
    constructor() {
        super();
        this.name = 'aurora';

        this.paramDefinitions = [
            { id: 'auroraBands', label: '🌈 Bands', min: 2, max: 8, step: 1, default: 4 },
            { id: 'auroraSpeed', label: '🌊 Speed', min: 0.1, max: 2.0, step: 0.05, default: 0.5 },
            { id: 'auroraWave', label: '💫 Wave', min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
            { id: 'auroraGlow', label: '✨ Glow', min: 0.0, max: 2.0, step: 0.1, default: 1.0 }
        ];

        this.resetParams();
    }

    getShaderCode() {
        return `
            // ========== AURORA MODE ==========
            // Stacked drifting glow bands. Continuous in t → seamless via the
            // generic crossfade wrapper.

            vec3 renderAurora(vec2 uv, float t) {
                float bands = u_auroraBands;
                float speed = u_auroraSpeed;
                float wave = u_auroraWave;
                float glowAmt = u_auroraGlow;

                float pattern = 0.0;
                for (int i = 0; i < 8; i++) {
                    if (float(i) >= bands) break;
                    float fi = float(i);

                    float yOff = 0.3 + fi * 0.08;
                    float wavePos = sin(uv.x * wave * 3.0 + t * speed * (0.5 + fi * 0.1) + fi * 1.5) * 0.15;
                    float bandY = yOff + wavePos + sin(t * speed * 0.3 + fi) * 0.05;

                    float dist = abs(uv.y - bandY - fbm(vec2(uv.x * 2.0 + t * speed * 0.2, fi)) * 0.1);
                    float band = exp(-dist * 20.0) * glowAmt;
                    pattern += band;
                }

                pattern = clamp(pattern, 0.0, 1.0);
                return vec3(pattern);
            }
        `;
    }

    updateUniforms(gl, uniforms, params) {
        const p = { ...this.params, ...params };
        gl.uniform1f(uniforms.auroraBands, p.auroraBands);
        gl.uniform1f(uniforms.auroraSpeed, p.auroraSpeed);
        gl.uniform1f(uniforms.auroraWave, p.auroraWave);
        gl.uniform1f(uniforms.auroraGlow, p.auroraGlow);
    }
}
