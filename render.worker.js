// render.worker.js - Update fragmentShaderSource

const fragmentShaderSource = `#version 100
precision highp float;
varying vec2 v_uv;
uniform float u_time, u_distortion, u_complexity, u_speed, u_scale, u_aspect, u_loopDuration;
uniform vec3 u_p0, u_p1, u_p2, u_p3, u_p4, u_p5;
uniform float u_pCount;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
    float v = 0.0, a = 0.5, f = 1.0;
    for (int i = 0; i < 8; i++) { if (float(i) >= u_complexity) break; v += a * noise(p * f); f *= 2.0; a *= 0.6; }
    return v;
}

// ===== SEAMLESS LOOP =====
// Menggunakan modulo time agar waktu selalu dalam rentang [0, loopDuration]
float getLoopTime(float rawTime, float duration) {
    if (duration <= 0.0) return rawTime;
    // Modulo untuk loop seamless
    float loopTime = mod(rawTime, duration);
    return loopTime;
}

vec3 computePattern(vec2 w, float t) {
    float d1 = fbm(w + vec2(t * 0.3, t * 0.2));
    float d2 = fbm(w + vec2(d1 * u_distortion + t * 0.1, d1 * u_distortion - t * 0.15));
    float d3 = fbm(w + vec2(d2 * u_distortion * 1.5 - t * 0.05, d2 * u_distortion * 1.5 + t * 0.08));
    float c = (sin(w.x * 3.0 + d2 * 4.0 + t) * cos(w.y * 3.0 + d1 * 4.0 - t * 0.7) * 0.5 +
               cos(w.x * 5.0 + d3 * 3.0 - t * 0.5) * sin(w.y * 5.0 + d2 * 3.0 + t * 0.6) * 0.3 +
               sin((w.x + w.y) * 4.0 + d1 * 5.0 + t * 0.4) * 0.2 + d3 * 0.8) * 0.5 + 0.5;
    float idx = c * (u_pCount - 1.0);
    vec3 col;
    if (idx < 1.0) col = mix(u_p0, u_p1, idx);
    else if (idx < 2.0) col = mix(u_p1, u_p2, idx - 1.0);
    else if (idx < 3.0) col = mix(u_p2, u_p3, idx - 2.0);
    else if (idx < 4.0) col = mix(u_p3, u_p4, idx - 3.0);
    else col = mix(u_p4, u_p5, clamp(idx - 4.0, 0.0, 1.0));
    col *= 0.7 + 0.5 * (d2 * 0.5 + 0.5);
    return col;
}

void main() {
    vec2 uv = v_uv; uv.x *= u_aspect; vec2 w = uv * u_scale;
    
    // ✅ SEAMLESS LOOP: gunakan modulo time
    float rawTime = u_time * u_speed;
    float loopTime;
    
    if (u_loopDuration > 0.0) {
        // Loop time dalam rentang [0, loopDuration * speed]
        float loopDurationScaled = u_loopDuration * u_speed;
        loopTime = mod(rawTime, loopDurationScaled);
    } else {
        loopTime = rawTime;
    }
    
    vec3 col = computePattern(w, loopTime);
    
    float vig = clamp(1.0 - length(v_uv - 0.5) * 1.2, 0.0, 1.0);
    col *= vig * 0.9 + 0.2;
    gl_FragColor = vec4(col, 1.0);
}`;
