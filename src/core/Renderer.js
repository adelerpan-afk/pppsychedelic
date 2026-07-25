// src/core/Renderer.js

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.program = null;
        this.isInitialized = false;
        this.palette = [];
        this.uniforms = {};
    }

    init(vsSource, fsSource, uniforms) {
        const gl = this.canvas.getContext('webgl2', {
            preserveDrawingBuffer: true,
            antialias: false,
            powerPreference: 'high-performance'
        }) || this.canvas.getContext('webgl', {
            preserveDrawingBuffer: true,
            antialias: false,
            powerPreference: 'high-performance'
        });

        if (!gl) throw new Error('WebGL not supported');
        this.gl = gl;

        this.program = this.buildProgram(vsSource, fsSource);
        gl.useProgram(this.program);

        this.setupBuffer();
        
        this.uniforms = uniforms || {};
        this.isInitialized = true;
        return gl;
    }

    buildProgram(vsSource, fsSource) {
        const gl = this.gl;
        
        const vs = this.createShader(gl.VERTEX_SHADER, vsSource);
        const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource);
        
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Program link failed');
        }
        
        return program;
    }

    createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader error:', gl.getShaderInfoLog(shader));
            throw new Error('Shader compile failed');
        }
        
        return shader;
    }

    setupBuffer() {
        const gl = this.gl;
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1, 1, 1
        ]), gl.STATIC_DRAW);
        
        const aPos = gl.getAttribLocation(this.program, 'a_position');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
    }

    setPalette(palette) {
        this.palette = palette;
        const gl = this.gl;
        if (!gl || !this.uniforms || !this.uniforms.p0) {
            console.warn('Uniforms not ready, palette will be applied later');
            return;
        }
        
        const padded = this.padPalette(palette);
        gl.uniform3fv(this.uniforms.p0, padded[0]);
        gl.uniform3fv(this.uniforms.p1, padded[1]);
        gl.uniform3fv(this.uniforms.p2, padded[2]);
        gl.uniform3fv(this.uniforms.p3, padded[3]);
        gl.uniform3fv(this.uniforms.p4, padded[4]);
        gl.uniform3fv(this.uniforms.p5, padded[5]);
        gl.uniform1f(this.uniforms.pCount, palette.length);
    }

    padPalette(palette) {
        if (palette.length >= 6) return palette.slice(0, 6);
        const padded = [...palette];
        while (padded.length < 6) padded.push([...palette[palette.length - 1]]);
        return padded;
    }

    getUniforms() {
        return this.uniforms;
    }
}