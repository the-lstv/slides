class ShaderContext {
    constructor(gl, source) {
        this.gl = gl;
        this.source = source
        this.program = this.createProgram()
        this.uniformLocations = {};
        this.positionAttribute = -1;
    }

    createProgram() {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, this.source.vertexShader);
        this.gl.attachShader(program, this.source.fragmentShader);
        this.gl.linkProgram(program);

        // if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
        //     console.error('Program linking error:', this.gl.getProgramInfoLog(program));
        //     return null;
        // }

        return program;
    }

    getUniformLocation(name) {
        if (!(name in this.uniformLocations)) {
            this.uniformLocations[name] = this.gl.getUniformLocation(this.program, name);
        }
        return this.uniformLocations[name];
    }

    getPositionAttribute() {
        if (this.positionAttribute === -1) {
            this.positionAttribute = this.gl.getAttribLocation(this.program, 'a_position');
        }
        return this.positionAttribute;
    }
}

class CombinedShaderRenderer extends LS.Util.FrameScheduler {
    constructor(canvas, dimensions = { width: 512, height: 512 }, options = {}) {
        super(null, options);

        this.callback = this.render.bind(this);

        this.width = dimensions.width;
        this.height = dimensions.height;
        canvas.width = this.width;
        canvas.height = this.height;

        this.gl = canvas.getContext('webgl2', {
            alpha: true,
            // premultipliedAlpha: false,
            // antialias: true,
        });

        if (!this.gl) {
            console.error('WebGL2 not supported');
            return;
        }

        this.canvas = canvas;
        this.shaders = [];
        this.uniforms = [];
        this.qualityReduction = 1;
        this.paused = true;

        // FPS tracking
        this.fpsEnabled = false;
        this.fpsCallback = null;
        this.fpsFrameTimes = [];
        this.fpsLastReportTime = 0;
        this.fpsReportInterval = 500; // Report FPS every 500ms

        this.setupBuffers();
        this.frame = this.render.bind(this);
    }

    compileShader(vertexShader, fragmentShader){
        return new ShaderSource(this.gl, vertexShader, fragmentShader)
    }

    addShaderContext(source, uniforms){
        this.shaders.push(new ShaderContext(this.gl, source))
        this.uniforms.push(uniforms || {});
    }

    setupBuffers() {
        const gl = this.gl;

        // Fullscreen quad
        const vertices = new Float32Array([
            -1.0, -1.0,
            1.0, -1.0,
            -1.0, 1.0,
            1.0, 1.0,
        ]);

        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    }

    render(time) {
        // FPS tracking
        if (this.fpsEnabled) {
            this.fpsFrameTimes.push(time);
            // Keep only last 60 frame times
            if (this.fpsFrameTimes.length > 60) {
                this.fpsFrameTimes.shift();
            }
            
            // Report FPS at interval
            if (time - this.fpsLastReportTime >= this.fpsReportInterval) {
                const fps = this.calculateFPS();
                if (this.fpsCallback) {
                    this.fpsCallback(fps);
                }
                this.fpsLastReportTime = time;
            }
        }

        const gl = this.gl;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.enable(gl.BLEND);
        // gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

        // Bind buffer once for all shaders sharing the same quad geometry
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);

        this.shaders.forEach((shaderContext, index) => {
            const uniforms = this.uniforms[index];
            gl.useProgram(shaderContext.program);

            // Bind position buffer
            // Use cached attribute location
            const positionLocation = shaderContext.getPositionAttribute();
            
            if (positionLocation !== -1) {
                gl.enableVertexAttribArray(positionLocation);
                gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
            }

            // Set uniforms
            for (const [name, { type, value }] of Object.entries(uniforms)) {
                const location = shaderContext.getUniformLocation(name);
                const uniformValue = typeof value === 'function' ? value(time) : value;
                gl[type](location, ...uniformValue);
            }

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        });
    }

    calculateFPS() {
        if (this.fpsFrameTimes.length < 2) return 0;
        
        const timeSpan = this.fpsFrameTimes[this.fpsFrameTimes.length - 1] - this.fpsFrameTimes[0];
        const frameCount = this.fpsFrameTimes.length - 1;
        
        if (timeSpan === 0) return 0;
        
        return Math.round((frameCount / timeSpan) * 1000);
    }

    watchFPS(callback, reportInterval = 500) {
        this.fpsEnabled = true;
        this.fpsCallback = callback;
        this.fpsReportInterval = reportInterval;
        this.fpsFrameTimes = [];
        this.fpsLastReportTime = 0;
    }

    unwatchFPS() {
        this.fpsEnabled = false;
        this.fpsCallback = null;
        this.fpsFrameTimes = [];
    }

    resize(width = this.width, height = this.height) {
        this.width = Math.max(128, width) - (64 * this.qualityReduction);
        this.height = Math.max(128, height) - (64 * this.qualityReduction);
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    destroy() {
        // Stop animation
        this.stop();

        const gl = this.gl;
        if (!gl) return;

        // Delete position buffer
        if (this.positionBuffer) {
            gl.deleteBuffer(this.positionBuffer);
            this.positionBuffer = null;
        }

        // Delete shaders and programs
        this.shaders.forEach((shaderContext) => {
            if (shaderContext.program) {
                // Detach and delete shaders
                if (shaderContext.source.vertexShader) {
                    gl.detachShader(shaderContext.program, shaderContext.source.vertexShader);
                    // gl.deleteShader(shaderContext.source.vertexShader);
                }
                if (shaderContext.source.fragmentShader) {
                    gl.detachShader(shaderContext.program, shaderContext.source.fragmentShader);
                    // gl.deleteShader(shaderContext.source.fragmentShader);
                }
                gl.deleteProgram(shaderContext.program);
            }
        });

        // Clear arrays
        this.shaders = [];
        this.uniforms = [];

        // Clear FPS tracking
        this.unwatchFPS();

        super.destroy();
    }
}

class ShaderSource {
    constructor(gl, vertexShaderSource, fragmentShaderSource) {
        this.gl = gl;
        this.vertexShader = this.compileShader(vertexShaderSource, gl.VERTEX_SHADER);
        this.fragmentShader = this.compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);
    }

    compileShader(source, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        // if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
        //     console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
        //     this.gl.deleteShader(shader);
        //     return null;
        // }

        return shader;
    }

    static gl2_vertex = `#version 300 es\nprecision mediump float; in vec4 a_position; void main() { gl_Position = a_position; }`;
    static gl_vertex  = `attribute vec4 a_position;\nvoid main() { gl_Position = a_position; }`;

    // Shader presets

    static waves(gl) {
        return new ShaderSource(gl, `#version 300 es\nprecision highp float;\nin vec4 a_position;\n\nvoid main() {\n  gl_Position = a_position;\n \n}`, `#version 300 es
precision highp float;
/* Credits: 
   Author: [uuuulala](https://github.com/paper-design/shaders)
*/
out vec4 outColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_background;
uniform vec4 u_color;
uniform float u_speed;
uniform float u_phase;
uniform float u_scale;
uniform float u_brightness;

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float neuro_shape(vec2 uv, float t) {
  vec2 sine_acc = vec2(0.);
  vec2 res = vec2(0.);
  float scale = 8.;

  for (int j = 0; j < 15; j++) {
    uv = rotate(uv, 1.);
    sine_acc = rotate(sine_acc, 1.);
    vec2 layer = uv * scale + float(j) + sine_acc - t;
    sine_acc += sin(layer);
    res += (.5 + .5 * cos(layer)) / scale;
    scale *= (1.2);
  }
  return res.x + res.y;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  uv -= .5;
  float scale = .75 * u_scale + 1e-4;
  uv *= (.001 * (1. - step(1. - scale, 1.) / scale));
  uv *= u_resolution;
  uv += .5;

  float t = u_time * u_speed + u_phase*10.;

  float noise = neuro_shape(uv, t);

  noise = u_brightness * pow(noise, 3.);
  noise += pow(noise, 12.);
  noise = max(.0, noise - .5);

  vec3 color = mix(u_background.rgb * u_background.a, u_color.rgb * u_color.a, noise);
  float opacity = mix(u_background.a, u_color.a, noise);

  outColor = vec4(color, opacity);
}`);
    }


    static blurredColors(gl) {
        return new ShaderSource(gl, ShaderSource.gl_vertex, `precision highp float;uniform vec2 u_resolution;uniform vec2 u_mouse;uniform float u_time;uniform float alpha;uniform vec4 u_colors[4];uniform float u_blur;uniform bool u_animate;uniform float u_animate_speed;uniform float u_frequency;
#define S(a,b,t) smoothstep(a,b,t)
#ifndef SRGB_EPSILON
#define SRGB_EPSILON 0.00000001
#endif
#ifndef FNC_SRGB2RGB
#define FNC_SRGB2RGB
float srgb2rgb(float channel){return(channel<0.04045)?channel*0.0773993808:pow((channel+0.055)*0.947867298578199,2.4);}
vec3 srgb2rgb(vec3 srgb){return vec3(srgb2rgb(srgb.r+SRGB_EPSILON),srgb2rgb(srgb.g+SRGB_EPSILON),srgb2rgb(srgb.b+SRGB_EPSILON));}
vec4 srgb2rgb(vec4 srgb){return vec4(srgb2rgb(srgb.rgb),srgb.a);}
#endif
#if !defined(FNC_SATURATE)&&!defined(saturate)
#define FNC_SATURATE
#define saturate(x) clamp(x,0.0,1.0)
#endif
#ifndef SRGB_EPSILON
#define SRGB_EPSILON 0.00000001
#endif
#ifndef FNC_RGB2SRGB
#define FNC_RGB2SRGB
float rgb2srgb(float channel){return(channel<0.0031308)?channel*12.92:1.055*pow(channel,0.4166666666666667)-0.055;}
vec3 rgb2srgb(vec3 rgb){return saturate(vec3(rgb2srgb(rgb.r-SRGB_EPSILON),rgb2srgb(rgb.g-SRGB_EPSILON),rgb2srgb(rgb.b-SRGB_EPSILON)));}
vec4 rgb2srgb(vec4 rgb){return vec4(rgb2srgb(rgb.rgb),rgb.a);}
#endif
#ifndef FNC_MIXOKLAB
#define FNC_MIXOKLAB
vec3 mixOklab(vec3 colA,vec3 colB,float h){
#ifdef MIXOKLAB_COLORSPACE_SRGB
colA=srgb2rgb(colA);colB=srgb2rgb(colB);
#endif
const mat3 kCONEtoLMS=mat3(0.4121656120,0.2118591070,0.0883097947,0.5362752080,0.6807189584,0.2818474174,0.0514575653,0.1074065790,0.6302613616);
const mat3 kLMStoCONE=mat3(4.0767245293,-1.2681437731,-0.0041119885,-3.3072168827,2.6093323231,-0.7034763098,0.2307590544,-0.3411344290,1.7068625689);
vec3 lmsA=pow(kCONEtoLMS*colA,vec3(1.0/3.0));vec3 lmsB=pow(kCONEtoLMS*colB,vec3(1.0/3.0));
vec3 lms=mix(lmsA,lmsB,h);vec3 rgb=kLMStoCONE*(lms*lms*lms);
#ifdef MIXOKLAB_COLORSPACE_SRGB
return rgb2srgb(rgb);
#else
return rgb;
#endif
}
vec4 mixOklab(vec4 colA,vec4 colB,float h){return vec4(mixOklab(colA.rgb,colB.rgb,h),mix(colA.a,colB.a,h));}
#endif
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
// Created by inigo quilez - iq/2014
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);}
float noise(in vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);return 0.5+0.5*n;}
void main(){
vec2 uv=gl_FragCoord.xy/u_resolution.xy;float ratio=u_resolution.x/u_resolution.y;vec2 tuv=uv;tuv-=.5;float speed=u_time*10.*u_animate_speed;if(u_animate==false){speed=0.0;}
float degree=noise(vec2(speed/100.0,tuv.x*tuv.y));tuv.y*=1./ratio;tuv*=Rot(radians((degree-.5)*720.+180.));tuv.y*=ratio;float frequency=20.*u_frequency;float amplitude=30.*(10.*(0.01+u_blur));
tuv.x+=sin(tuv.y*frequency+speed)/amplitude;tuv.y+=sin(tuv.x*frequency*1.5+speed)/(amplitude*.5);
vec4 layer1=mixOklab(u_colors[0],u_colors[1],S(-.3,.2,(tuv*Rot(radians(-5.))).x)),layer2=mixOklab(u_colors[2],u_colors[3],S(-.3,.2,(tuv*Rot(radians(-5.))).x));
vec4 finalComp=mixOklab(layer1,layer2,S(.5,-.3,tuv.y));gl_FragColor=vec4(finalComp.rgb, finalComp.a * alpha);}`);
    }
}

window.CombinedShaderRenderer = CombinedShaderRenderer;
window.ShaderSource = ShaderSource;
window.ShaderContext = ShaderContext;