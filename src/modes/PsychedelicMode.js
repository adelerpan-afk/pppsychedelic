// src/modes/PsychedelicMode.js

import { BaseMode } from './BaseMode.js';

export class PsychedelicMode extends BaseMode {
    constructor() {
        super();
        this.name = 'psychedelic';
        
        this.paramDefinitions = [
            { id: 'distortion', label: '🌀 Distortion', min: 0.2, max: 3.0, step: 0.1, default: 1.5 },
            { id: 'complexity', label: '✨ Complexity', min: 1, max: 8, step: 1, default: 3 },
            { id: 'speed', label: '🌊 Speed', min: 0.05, max: 2.0, step: 0.05, default: 0.5 },
            { id: 'scale', label: '💫 Scale', min: 0.5, max: 5.0, step: 0.1, default: 2.0 }
        ];
        
        this.resetParams();
    }

    getShaderCode() {
        return `
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }
            
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                           mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
            }
            
            float fbm(vec2 p) {
                float v = 0.0, a = 0.5, f = 1.0;
                for (int i = 0; i < 8; i++) {
                    if (float(i) >= u_complexity) break;
                    v += a * noise(p * f);
                    f *= 2.0;
                    a *= 0.6;
                }
                return v;
            }
            
            vec3 renderPsychedelic(vec2 uv, float t) {
                vec2 w = uv * u_scale;
                float d1 = fbm(w + vec2(t * 0.3, t * 0.2));
                float d2 = fbm(w + vec2(d1 * u_distortion + t * 0.1, d1 * u_distortion - t * 0.15));
                float d3 = fbm(w + vec2(d2 * u_distortion * 1.5 - t * 0.05, d2 * u_distortion * 1.5 + t * 0.08));
                
                float c = (sin(w.x * 3.0 + d2 * 4.0 + t) * cos(w.y * 3.0 + d1 * 4.0 - t * 0.7) * 0.5 +
                           cos(w.x * 5.0 + d3 * 3.0 - t * 0.5) * sin(w.y * 5.0 + d2 * 3.0 + t * 0.6) * 0.3 +
                           sin((w.x + w.y) * 4.0 + d1 * 5.0 + t * 0.4) * 0.2 + d3 * 0.8) * 0.5 + 0.5;
                
                return c * vec3(1.0);
            }
        `;
    }

    updateUniforms(gl, uniforms, params) {
        gl.uniform1f(uniforms.distortion, params.distortion || this.params.distortion);
        gl.uniform1f(uniforms.complexity, params.complexity || this.params.complexity);
        gl.uniform1f(uniforms.speed, params.speed || this.params.speed);
        gl.uniform1f(uniforms.scale, params.scale || this.params.scale);
    }
}