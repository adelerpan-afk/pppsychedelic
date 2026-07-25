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

    /**
     * Initialize WebGL context and shaders
     */
    init(vsSource, fsSource) {
        try {
            const gl = this.canvas.getContext('webgl2', {
                preserveDrawingBuffer: true,
                antialias: false,
                powerPreference: 'high-performance'
            }) || this.canvas.getContext('webgl', {
                preserveDrawingBuffer: true,
                antialias: false,
                powerPreference: 'high-performance'
            });

            if (!gl) {
                throw new Error('WebGL not supported by this browser');
            }

            this.gl = gl;

            // Build and link program
            this.program = this.buildProgram(vsSource, fsSource);
            gl.useProgram(this.program);

            // Setup vertex buffer
            this.setupBuffer();

            // Context loss handling
            this.setupContextLoss();

            this.isInitialized = true;
            console.log('✅ WebGL Renderer initialized');

            return gl;

        } catch (err) {
            console.error('❌ Renderer init error:', err);
            throw err;
        }
    }

    /**
     * Setup WebGL context loss handlers
     */
    setupContextLoss() {
        const gl = this.gl;
        if (!gl) return;

        // Context lost
        this.canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.warn('⚠️ WebGL context lost');
            this.isInitialized = false;
            this.gl = null;
        });

        // Context restored
        this.canvas.addEventListener('webglcontextrestored', () => {
            console.log('✅ WebGL context restored');
            // Re-initialize with stored shaders
            if (this.vsSource && this.fsSource) {
                this.init(this.vsSource, this.fsSource);
            }
        });
    }

    /**
     * Build WebGL program from vertex and fragment shaders
     */
    buildProgram(vsSource, fsSource) {
        const gl = this.gl;
        if (!gl) {
            throw new Error('WebGL context not initialized');
        }

        // Store sources for context restore
        this.vsSource = vsSource;
        this.fsSource = fsSource;

        // Create shaders
        const vs = this.createShader(gl.VERTEX_SHADER, vsSource);
        const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource);

        // Create and link program
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        // Check link status
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(program);
            console.error('Program link error:', info);
            throw new Error('Program link failed: ' + info);
        }

        // Delete shaders after linking
        gl.deleteShader(vs);
        gl.deleteShader(fs);

        return program;
    }

    /**
     * Create and compile a shader
     */
    createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);

        if (!shader) {
            throw new Error('Failed to create shader');
        }

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        // Check compile status
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            console.error('Shader compile error:', info);
            console.error('Shader source:', source);

            // Try to find line with error
            const lines = source.split('\n');
            const errorLine = info.match(/ERROR:\s*\d+:(\d+)/);
            if (errorLine) {
                const lineNum = parseInt(errorLine[1]);
                console.error(`Error at line ${lineNum}:`, lines[lineNum - 1]);
                // Show context
                const start = Math.max(0, lineNum - 3);
                const end = Math.min(lines.length, lineNum + 2);
                console.error('Context:');
                for (let i = start; i < end; i++) {
                    console.error(`${i + 1}: ${lines[i]}`);
                }
            }

            gl.deleteShader(shader);
            throw new Error('Shader compile failed: ' + info);
        }

        return shader;
    }

    /**
     * Setup vertex buffer (fullscreen triangle strip)
     */
    setupBuffer() {
        const gl = this.gl;
        const program = this.program;

        // Create buffer
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

        // Fullscreen quad vertices (triangle strip)
        const vertices = new Float32Array([
            -1, -1,  // bottom-left
             1, -1,  // bottom-right
            -1,  1,  // top-left
             1,  1   // top-right
        ]);

        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        // Get attribute location
        const aPos = gl.getAttribLocation(program, 'a_position');
        if (aPos === -1) {
            console.warn('a_position attribute not found in shader');
            return;
        }

        // Enable and set attribute
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        console.log('✅ Vertex buffer setup complete');
    }

    /**
     * Set uniforms object reference
     */
    setUniforms(uniforms) {
        this.uniforms = uniforms || {};
    }

    /**
     * Resize canvas and viewport
     */
    resize(width, height) {
        if (!this.canvas) return;

        // Set canvas size (internal resolution)
        this.canvas.width = width;
        this.canvas.height = height;

        // Update viewport
        if (this.gl) {
            this.gl.viewport(0, 0, width, height);
        }

        console.log(`🖼️ Renderer resized: ${width}×${height}`);
    }

    /**
     * Set palette colors to shader uniforms
     */
    setPalette(palette) {
        this.palette = palette;

        const gl = this.gl;
        if (!gl || !this.uniforms || !this.uniforms.p0) {
            console.warn('⚠️ Uniforms not ready, palette will be applied later');
            return;
        }

        try {
            const padded = this.padPalette(palette);

            gl.uniform3fv(this.uniforms.p0, padded[0]);
            gl.uniform3fv(this.uniforms.p1, padded[1]);
            gl.uniform3fv(this.uniforms.p2, padded[2]);
            gl.uniform3fv(this.uniforms.p3, padded[3]);
            gl.uniform3fv(this.uniforms.p4, padded[4]);
            gl.uniform3fv(this.uniforms.p5, padded[5]);
            gl.uniform1f(this.uniforms.pCount, palette.length);

            console.log(`🎨 Palette applied: ${palette.length} colors`);

        } catch (err) {
            console.error('Failed to set palette:', err);
        }
    }

    /**
     * Pad palette to 6 colors (for shader)
     */
    padPalette(palette) {
        if (!palette || palette.length === 0) {
            // Default fallback
            return [
                [1, 0, 0], [1, 0.65, 0], [1, 1, 0],
                [0, 1, 0], [0, 0.5, 1], [0.5, 0, 1]
            ];
        }

        if (palette.length >= 6) {
            return palette.slice(0, 6);
        }

        const padded = [...palette];
        const lastColor = palette[palette.length - 1] || [0.5, 0.5, 0.5];

        while (padded.length < 6) {
            padded.push([...lastColor]);
        }

        return padded;
    }

    /**
     * Get current uniforms
     */
    getUniforms() {
        return this.uniforms;
    }

    /**
     * Check if renderer is ready
     */
    isReady() {
        return this.isInitialized && this.gl !== null && this.program !== null;
    }

    /**
     * Clean up WebGL resources
     */
    dispose() {
        try {
            if (this.gl) {
                if (this.program) {
                    this.gl.deleteProgram(this.program);
                    this.program = null;
                }
                // Clear all contexts
                this.gl = null;
            }
            this.isInitialized = false;
            console.log('🧹 Renderer disposed');
        } catch (err) {
            console.warn('Error disposing renderer:', err);
        }
    }
}
