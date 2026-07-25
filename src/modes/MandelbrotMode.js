// src/modes/MandelbrotMode.js

import { BaseMode } from './BaseMode.js';

export class MandelbrotMode extends BaseMode {
    constructor() {
        super();
        this.name = 'mandelbrot';

        this.paramDefinitions = [
            { id: 'mandelbrotIter', label: '🔁 Iterations', min: 8, max: 64, step: 1, default: 32 },
            { id: 'mandelbrotZoom', label: '🔍 Zoom', min: 0.5, max: 4.0, step: 0.1, default: 1.5 },
            { id: 'mandelbrotJuliaMix', label: '🌌 Julia Mix', min: 0.0, max: 1.0, step: 0.05, default: 0.5 },
            { id: 'mandelbrotSpeed', label: '🌊 Drift Speed', min: 0.1, max: 2.0, step: 0.05, default: 0.4 }
        ];

        this.resetParams();
    }

    getShaderCode() {
        return `
            // ========== FRACTAL (MANDELBROT/JULIA) MODE ==========
            // Julia constant drifts smoothly via sin/cos of t, keeping the whole
            // pattern continuous — the generic crossfade wrapper then makes the
            // loop seamless.

            vec3 renderMandelbrot(vec2 uv, float t) {
                vec2 p = (uv - 0.5) * u_mandelbrotZoom * 2.5;
                float speed = u_mandelbrotSpeed;
                float juliaMix = u_mandelbrotJuliaMix;
                float maxIter = u_mandelbrotIter;

                vec2 juliaC = vec2(0.355 + 0.15 * sin(t * speed * 0.6), 0.355 + 0.15 * cos(t * speed * 0.45));
                vec2 c = mix(p, juliaC, juliaMix);
                vec2 z = mix(vec2(0.0, 0.0), p, juliaMix);

                float iter = 0.0;
                for (int i = 0; i < 64; i++) {
                    if (float(i) >= maxIter) break;
                    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
                    if (dot(z, z) > 4.0) break;
                    iter += 1.0;
                }

                float pattern = pow(iter / maxIter, 0.5);
                return vec3(pattern);
            }
        `;
    }

    updateUniforms(gl, uniforms, params) {
        const p = { ...this.params, ...params };
        gl.uniform1f(uniforms.mandelbrotIter, p.mandelbrotIter);
        gl.uniform1f(uniforms.mandelbrotZoom, p.mandelbrotZoom);
        gl.uniform1f(uniforms.mandelbrotJuliaMix, p.mandelbrotJuliaMix);
        gl.uniform1f(uniforms.mandelbrotSpeed, p.mandelbrotSpeed);
    }
}
