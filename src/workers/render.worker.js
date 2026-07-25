// src/workers/render.worker.js
// Module worker: builds the SAME multi-mode shader (via ShaderBuilder + all
// mode classes) that the live preview uses, so exported frames always match
// what's shown on screen — including the seamless per-mode loop crossfade.

import { ShaderBuilder } from '../core/ShaderBuilder.js';
import { PsychedelicMode } from '../modes/PsychedelicMode.js';
import { BlobMode } from '../modes/BlobMode.js';
import { KaleidoscopeMode } from '../modes/KaleidoscopeMode.js';
import { FluidMode } from '../modes/FluidMode.js';
import { TunnelMode } from '../modes/TunnelMode.js';
import { MorphMode } from '../modes/MorphMode.js';
import { LiquidMode } from '../modes/LiquidMode.js';
import { MandelbrotMode } from '../modes/MandelbrotMode.js';
import { FireMode } from '../modes/FireMode.js';
import { AuroraMode } from '../modes/AuroraMode.js';
import { ParticleMode } from '../modes/ParticleMode.js';

// Must match the same key order used in Generator.js so mode indices line up.
const MODE_FACTORY = {
    psychedelic: () => new PsychedelicMode(),
    blob: () => new BlobMode(),
    kaleidoscope: () => new KaleidoscopeMode(),
    fluid: () => new FluidMode(),
    tunnel: () => new TunnelMode(),
    morph: () => new MorphMode(),
    liquid: () => new LiquidMode(),
    mandelbrot: () => new MandelbrotMode(),
    fire: () => new FireMode(),
    aurora: () => new AuroraMode(),
    particle: () => new ParticleMode(),
};

let offscreen = null, gl = null, program = null, uniforms = {}, initialized = false;
let currentWidth = 0, currentHeight = 0;

function initGL(width, height) {
    try {
        if (!offscreen || currentWidth !== width || currentHeight !== height) {
            offscreen = new OffscreenCanvas(width, height);
            currentWidth = width;
            currentHeight = height;
        }

        gl = offscreen.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, powerPreference: 'high-performance' }) ||
             offscreen.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, powerPreference: 'high-performance' });

        if (!gl) throw new Error('WebGL not supported');

        offscreen.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.warn('WebGL context lost in worker');
            initialized = false;
            gl = null;
        });
        offscreen.addEventListener('webglcontextrestored', () => {
            console.log('WebGL context restored in worker');
        });

        // Build the exact same multi-mode shader as the live renderer.
        const builder = new ShaderBuilder();
        const modeNames = Object.keys(MODE_FACTORY);
        const modeInstances = modeNames.map(name => MODE_FACTORY[name]());
        modeInstances.forEach(mode => builder.registerMode(mode));

        const vsSource = builder.buildVertexShader();
        const fsSource = builder.buildFragmentShader(modeNames);

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
        const vs = createShader(gl.VERTEX_SHADER, vsSource);
        const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Program link failed: ' + gl.getProgramInfoLog(program));
        }
        gl.useProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        uniforms = builder.getUniformLocations(gl, program);

        initialized = true;
    } catch (err) {
        console.error('initGL error:', err);
        initialized = false;
        throw err;
    }
}

function setUniforms(params) {
    if (!initialized || !gl || !program) throw new Error('WebGL not ready');

    // Reserved keys handled explicitly; everything else maps 1:1 to a
    // float uniform of the same name (mode params, distortion, etc).
    const reserved = new Set([
        'width', 'height', 'time', 'aspect', 'loopDuration',
        'palette', 'paletteCount', 'modeNames', 'modeName', 'modeIndex'
    ]);

    gl.uniform1f(uniforms.time, params.time);
    gl.uniform1f(uniforms.aspect, params.aspect);
    gl.uniform1f(uniforms.loopDuration, params.loopDuration || 0.0);
    gl.uniform1i(uniforms.mode, params.modeIndex >= 0 ? params.modeIndex : 0);

    const palette = params.palette && params.palette.length ? params.palette : [
        [1, 0, 0], [1, 0.65, 0], [1, 1, 0], [0, 1, 0], [0, 0.5, 1], [0.5, 0, 1]
    ];
    const padded = palette.length >= 6 ? palette.slice(0, 6) : (() => {
        const p = [...palette];
        const last = palette[palette.length - 1] || [0.5, 0.5, 0.5];
        while (p.length < 6) p.push([...last]);
        return p;
    })();
    gl.uniform1f(uniforms.pCount, params.paletteCount !== undefined ? params.paletteCount : palette.length);
    gl.uniform3fv(uniforms.p0, padded[0]);
    gl.uniform3fv(uniforms.p1, padded[1]);
    gl.uniform3fv(uniforms.p2, padded[2]);
    gl.uniform3fv(uniforms.p3, padded[3]);
    gl.uniform3fv(uniforms.p4, padded[4]);
    gl.uniform3fv(uniforms.p5, padded[5]);

    Object.keys(params).forEach((key) => {
        if (reserved.has(key)) return;
        const loc = uniforms[key];
        if (loc) {
            gl.uniform1f(loc, params[key]);
        }
    });
}

async function renderFrame(params) {
    if (!initialized || !gl || currentWidth !== params.width || currentHeight !== params.height) {
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
