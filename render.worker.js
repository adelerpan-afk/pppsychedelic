// render.worker.js - with context loss handling and retry
let offscreen = null, gl = null, program = null, uniforms = {}, initialized = false;

const vertexShaderSource = `#version 100
attribute vec2 a_position;
varying vec2 v_uv;
uniform float u_time;
uniform float u_loopDuration;
void main() {
    float angle = (u_loopDuration > 0.0) ? (6.28318530718 * u_time / u_loopDuration) : 0.0;
    float breathe = 1.02 + 0.02 * sin(angle);
    gl_Position = vec4(a_position * breathe, 0.0, 1.0);
    v_uv = (a_position + 1.0) / 2.0;
}`;

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
    float t = u_time * u_speed;
    vec3 col;
    if (u_loopDuration > 0.0) {
        float loopT = u_loopDuration * u_speed;
        float blend = clamp(u_time / u_loopDuration, 0.0, 1.0);
        vec3 colA = computePattern(w, t);
        vec3 colB = computePattern(w, t - loopT);
        col = mix(colA, colB, blend);
    } else {
        col = computePattern(w, t);
    }
    float vig = clamp(1.0 - length(v_uv - 0.5) * 1.2, 0.0, 1.0);
    col *= vig * 0.9 + 0.2;
    gl_FragColor = vec4(col, 1.0);
}`;

function initGL(width, height) {
    try {
        if (offscreen) {
            gl = offscreen.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, powerPreference: 'high-performance' }) ||
                 offscreen.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, powerPreference: 'high-performance' });
            if (!gl) {
                offscreen = new OffscreenCanvas(width, height);
                gl = offscreen.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, powerPreference: 'high-performance' }) ||
                     offscreen.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, powerPreference: 'high-performance' });
            }
        } else {
            offscreen = new OffscreenCanvas(width, height);
            gl = offscreen.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, powerPreference: 'high-performance' }) ||
                 offscreen.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, powerPreference: 'high-performance' });
        }
        if (!gl) throw new Error('WebGL not supported');

        // Event handlers untuk context loss
        offscreen.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.warn('WebGL context lost in worker');
            initialized = false;
            gl = null;
        });
        offscreen.addEventListener('webglcontextrestored', () => {
            console.log('WebGL context restored in worker');
        });

        function createShader(type, source) {
            const s = gl.createShader(type);
            gl.shaderSource(s, source);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                console.error('Shader compile error:', gl.getShaderInfoLog(s));
                throw new Error('Shader compile failed');
            }
            return s;
        }

        program = gl.createProgram();
        const vs = createShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fs = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Program link failed');
        }
        gl.useProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        uniforms = {
            time: gl.getUniformLocation(program, 'u_time'),
            distortion: gl.getUniformLocation(program, 'u_distortion'),
            complexity: gl.getUniformLocation(program, 'u_complexity'),
            speed: gl.getUniformLocation(program, 'u_speed'),
            scale: gl.getUniformLocation(program, 'u_scale'),
            aspect: gl.getUniformLocation(program, 'u_aspect'),
            loopDuration: gl.getUniformLocation(program, 'u_loopDuration'),
            pCount: gl.getUniformLocation(program, 'u_pCount'),
            p0: gl.getUniformLocation(program, 'u_p0'),
            p1: gl.getUniformLocation(program, 'u_p1'),
            p2: gl.getUniformLocation(program, 'u_p2'),
            p3: gl.getUniformLocation(program, 'u_p3'),
            p4: gl.getUniformLocation(program, 'u_p4'),
            p5: gl.getUniformLocation(program, 'u_p5'),
        };
        initialized = true;
    } catch (err) {
        console.error('initGL error:', err);
        initialized = false;
        throw err;
    }
}

function setUniforms(params) {
    if (!initialized || !gl || !program) throw new Error('WebGL not ready');
    gl.uniform1f(uniforms.time, params.time);
    gl.uniform1f(uniforms.distortion, params.distortion);
    gl.uniform1f(uniforms.complexity, params.complexity);
    gl.uniform1f(uniforms.speed, params.speed);
    gl.uniform1f(uniforms.scale, params.scale);
    gl.uniform1f(uniforms.aspect, params.aspect);
    gl.uniform1f(uniforms.loopDuration, params.loopDuration || 0.0);
    gl.uniform1f(uniforms.pCount, params.paletteCount !== undefined ? params.paletteCount : params.palette.length);
    gl.uniform3fv(uniforms.p0, params.palette[0]);
    gl.uniform3fv(uniforms.p1, params.palette[1]);
    gl.uniform3fv(uniforms.p2, params.palette[2]);
    gl.uniform3fv(uniforms.p3, params.palette[3]);
    gl.uniform3fv(uniforms.p4, params.palette[4]);
    gl.uniform3fv(uniforms.p5, params.palette[5]);
}

async function renderFrame(params) {
    if (!initialized || !gl) {
        try {
            initGL(params.width, params.height);
        } catch (err) {
            throw new Error('Failed to init WebGL: ' + err.message);
        }
    }
    try {
        gl.viewport(0, 0, params.width, params.height);
        setUniforms(params);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.finish();
        const err = gl.getError();
        if (err !== gl.NO_ERROR) {
            if (err === gl.CONTEXT_LOST_WEBGL) {
                initialized = false;
                gl = null;
                throw new Error('WebGL context lost');
            }
            console.warn('WebGL error:', err);
        }
        return await offscreen.convertToBlob({ type: 'image/png' });
    } catch (err) {
        console.error('renderFrame error:', err);
        if (err.message && err.message.includes('context')) {
            initialized = false;
            gl = null;
        }
        throw err;
    }
}

self.onmessage = async (e) => {
    const { frameIndex, params } = e.data;
    try {
        const blob = await renderFrame(params);
        self.postMessage({ frameIndex, blob, success: true });
    } catch (err) {
        self.postMessage({ frameIndex, error: err.message, success: false });
    }
};