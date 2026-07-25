// src/core/ShaderBuilder.js

export class ShaderBuilder {
    constructor() {
        this.modeCodes = new Map();
    }

    registerMode(mode) {
        this.modeCodes.set(mode.name, mode.getShaderCode());
    }

    buildVertexShader() {
        return `#version 100
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
    }

    buildFragmentShader(modeNames) {
        let modeCode = '';
        const modeList = [];
        modeNames.forEach((name, index) => {
            const code = this.modeCodes.get(name);
            if (code) {
                modeCode += code;
                modeList.push(name);
            }
        });

        let modeSelector = '';
        modeList.forEach((name, index) => {
            const funcName = `render${name.charAt(0).toUpperCase() + name.slice(1)}`;
            modeSelector += `else if (u_mode == ${index}) pattern = ${funcName}(uv, t);\n`;
        });

        return `#version 100
        precision highp float;
        varying vec2 v_uv;
        
        uniform float u_time, u_loopDuration, u_aspect;
        uniform vec3 u_p0, u_p1, u_p2, u_p3, u_p4, u_p5;
        uniform float u_pCount;
        uniform int u_mode;
        
        uniform float u_distortion, u_complexity, u_speed, u_scale;
        uniform float u_blobCount, u_blobSize, u_blobSpeed, u_blobWobble;
        uniform float u_segments, u_rotationSpeed, u_zoom;
        
        ${modeCode}
        
        vec3 mixPalette(float idx) {
            vec3 col;
            if (idx < 1.0) col = mix(u_p0, u_p1, idx);
            else if (idx < 2.0) col = mix(u_p1, u_p2, idx - 1.0);
            else if (idx < 3.0) col = mix(u_p2, u_p3, idx - 2.0);
            else if (idx < 4.0) col = mix(u_p3, u_p4, idx - 3.0);
            else col = mix(u_p4, u_p5, clamp(idx - 4.0, 0.0, 1.0));
            return col;
        }
        
        void main() {
            vec2 uv = v_uv;
            uv.x *= u_aspect;
            float t = u_time * u_speed;
            
            vec3 pattern;
            if (u_mode == 0) pattern = renderPsychedelic(uv, t);
            ${modeSelector}
            
            float idx = pattern.r * (u_pCount - 1.0);
            vec3 col = mixPalette(idx);
            
            float vig = clamp(1.0 - length(v_uv - 0.5) * 1.2, 0.0, 1.0);
            col *= vig * 0.9 + 0.2;
            gl_FragColor = vec4(col, 1.0);
        }`;
    }

    getUniformLocations(gl, program) {
        return {
            time: gl.getUniformLocation(program, 'u_time'),
            loopDuration: gl.getUniformLocation(program, 'u_loopDuration'),
            aspect: gl.getUniformLocation(program, 'u_aspect'),
            pCount: gl.getUniformLocation(program, 'u_pCount'),
            p0: gl.getUniformLocation(program, 'u_p0'),
            p1: gl.getUniformLocation(program, 'u_p1'),
            p2: gl.getUniformLocation(program, 'u_p2'),
            p3: gl.getUniformLocation(program, 'u_p3'),
            p4: gl.getUniformLocation(program, 'u_p4'),
            p5: gl.getUniformLocation(program, 'u_p5'),
            mode: gl.getUniformLocation(program, 'u_mode'),
            distortion: gl.getUniformLocation(program, 'u_distortion'),
            complexity: gl.getUniformLocation(program, 'u_complexity'),
            speed: gl.getUniformLocation(program, 'u_speed'),
            scale: gl.getUniformLocation(program, 'u_scale'),
            blobCount: gl.getUniformLocation(program, 'u_blobCount'),
            blobSize: gl.getUniformLocation(program, 'u_blobSize'),
            blobSpeed: gl.getUniformLocation(program, 'u_blobSpeed'),
            blobWobble: gl.getUniformLocation(program, 'u_blobWobble'),
            segments: gl.getUniformLocation(program, 'u_segments'),
            rotationSpeed: gl.getUniformLocation(program, 'u_rotationSpeed'),
            zoom: gl.getUniformLocation(program, 'u_zoom'),
        };
    }
}