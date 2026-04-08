export const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    darkness: { value: 1.0 },
    offset: { value: 1.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float darkness;
    uniform float offset;
    varying vec2 vUv;
    
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      
      vec2 uv = (vUv - 0.5) * 2.0;
      float dist = dot(uv, uv);
      
      float vignette = 1.0 - smoothstep(offset, offset + darkness, dist);
      
      gl_FragColor = vec4(texel.rgb * vignette, texel.a);
    }
  `
};
