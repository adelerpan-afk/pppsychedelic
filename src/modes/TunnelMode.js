// src/modes/TunnelMode.js

import { BaseMode } from './BaseMode.js';

export class TunnelMode extends BaseMode {
    constructor() {
        super();
        this.name = 'tunnel';

        this.paramDefinitions = [
            { id: 'tunnelRings', label: '🌀 Rings', min: 3, max: 30, step: 1, default: 12 },
            { id: 'tunnelSpeed', label: '🚀 Speed', min: 0.1, max: 3.0, step: 0.1, default: 1.0 },
            { id: 'tunnelTwist', label: '🔀 Twist', min: 0.0, max: 3.0, step: 0.1, default: 1.0 },
            { id: 'tunnelGlow', label: '✨ Glow', min: 0.0, max: 2.0, step: 0.1, default: 0.8 }
        ];

        this.resetParams();
    }

    getShaderCode() {
        return `
            // ========== HYPERSPACE TUNNEL MODE ==========
            // Polar-coordinate zoom. Continuous in t so the generic crossfade
            // wrapper produces a seamless loop even though this pattern is not
            // itself periodic.

            vec3 renderTunnel(vec2 uv, float t) {
                vec2 p = uv - 0.5;
                float radius = length(p) + 0.0008;
                float angle = atan(p.y, p.x);

                float speed = u_tunnelSpeed;
                float rings = u_tunnelRings;
                float twist = u_tunnelTwist;

                float depth = 1.0 / radius;
                float z = depth + t * speed * 3.0;

                angle += twist * depth * 0.15 + t * 0.2;

                float ringPattern = sin(z * rings * 0.3) * 0.5 + 0.5;
                float spokes = sin(angle * 8.0 + z * 0.5) * 0.5 + 0.5;

                float pattern = mix(ringPattern, spokes, 0.4);
                float glow = clamp(u_tunnelGlow / (radius * 4.0 + 0.5), 0.0, 1.0);
                pattern = clamp(pattern * 0.7 + glow * 0.4, 0.0, 1.0);

                return vec3(pattern);
            }
        `;
    }

    updateUniforms(gl, uniforms, params) {
        const p = { ...this.params, ...params };
        gl.uniform1f(uniforms.tunnelRings, p.tunnelRings);
        gl.uniform1f(uniforms.tunnelSpeed, p.tunnelSpeed);
        gl.uniform1f(uniforms.tunnelTwist, p.tunnelTwist);
        gl.uniform1f(uniforms.tunnelGlow, p.tunnelGlow);
    }
}
