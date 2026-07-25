// src/modes/KaleidoscopeMode.js

import { BaseMode } from './BaseMode.js';

export class KaleidoscopeMode extends BaseMode {
    constructor() {
        super();
        this.name = 'kaleidoscope';
        
        this.paramDefinitions = [
            { id: 'segments', label: '🔮 Segments', min: 3, max: 16, step: 1, default: 8 },
            { id: 'rotationSpeed', label: '🌀 Rotate Speed', min: 0.0, max: 2.0, step: 0.05, default: 0.3 },
            { id: 'zoom', label: '🔍 Zoom', min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
            { id: 'complexity', label: '✨ Detail', min: 1, max: 8, step: 1, default: 3 }
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
            
            vec2 kaleidoscopeUV(vec2 uv, float segments) {
                vec2 p = uv - 0.5;
                float angle = atan(p.y, p.x);
                float radius = length(p);
                float segAngle = 6.28318 / segments;
                angle = mod(angle, segAngle);
                angle = abs(angle - segAngle * 0.5);
                return vec2(cos(angle), sin(angle)) * radius + 0.5;
            }
            
            vec3 renderKaleidoscope(vec2 uv, float t) {
                float segments = u_segments;
                float rotateSpeed = u_rotationSpeed;
                float zoom = u_zoom;
                
                float angle = t * rotateSpeed;
                mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
                
                vec2 kuv = kaleidoscopeUV(uv, segments);
                vec2 p = (kuv - 0.5) * zoom;
                p = rot * p;
                p = p + 0.5;
                
                vec2 w = p * 2.0;
                float n = fbm(w + vec2(t * 0.1, t * 0.15));
                float n2 = fbm(w * 1.5 - vec2(t * 0.08, t * 0.12) + n * 0.5);
                
                float pattern = sin((p.x - 0.5) * 20.0 + n * 5.0) * 
                               cos((p.y - 0.5) * 20.0 + n2 * 5.0) * 0.5 + 0.5;
                
                float detail = fbm(w * 3.0 + t * 0.05) * 0.3;
                pattern = mix(pattern, detail, 0.2);
                
                float glow = exp(-length(p - 0.5) * 3.0) * 0.4;
                pattern = clamp(pattern + glow, 0.0, 1.0);
                
                return vec3(pattern);
            }
        `;
    }

    updateUniforms(gl, uniforms, params) {
        const p = { ...this.params, ...params };
        gl.uniform1f(uniforms.segments, p.segments);
        gl.uniform1f(uniforms.rotationSpeed, p.rotationSpeed);
        gl.uniform1f(uniforms.zoom, p.zoom);
        gl.uniform1f(uniforms.complexity, p.complexity);
    }
}
