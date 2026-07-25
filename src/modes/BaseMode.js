// src/modes/BaseMode.js

export class BaseMode {
    constructor() {
        this.name = 'base';
        this.params = {};
        this.paramDefinitions = [];
    }

    getParams() {
        return this.params;
    }

    getParamDefinitions() {
        return this.paramDefinitions;
    }

    getShaderCode() {
        return `
            vec3 renderMode(vec2 uv, float t) {
                return vec3(0.0);
            }
        `;
    }

    updateUniforms(gl, uniforms, params) {
        // Override di child class
    }

    resetParams() {
        this.paramDefinitions.forEach(def => {
            this.params[def.id] = def.default;
        });
    }
}
