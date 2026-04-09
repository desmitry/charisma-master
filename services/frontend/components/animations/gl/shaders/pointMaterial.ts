import * as THREE from 'three'
import { periodicNoiseGLSL } from '@/components/animations/gl/shaders/utils'

export class DofPointsMaterial extends THREE.ShaderMaterial {
  constructor(maxWaves: number = 4) {
    const waveCount = Math.max(1, Math.min(8, Math.floor(maxWaves)));
    super({
      vertexShader: /* glsl */ `
      uniform sampler2D positions;
      uniform sampler2D initialPositions;
      uniform float uTime;
      uniform float uFocus;
      uniform float uFov;
      uniform float uBlur;
      uniform float uPointSize;
      uniform vec2 uMousePosition;
      uniform float uMouseActive;
      uniform float uScrollAmount;
      varying float vDistance;
      varying float vPosY;
      varying vec3 vWorldPosition;
      varying vec3 vInitialPosition;
      varying float vDistToMouse;
      void main() { 
        vec3 pos = texture2D(positions, position.xy).xyz;
        vec3 initialPos = texture2D(initialPositions, position.xy).xyz;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        vDistance = abs(uFocus - -mvPosition.z);
        vPosY = pos.y;
        vWorldPosition = pos;
        vInitialPosition = initialPos;
        
        vDistToMouse = length(pos.xz - uMousePosition);
        
        float mouseInfluence = 1.0 - smoothstep(0.0, 3.0, vDistToMouse);
        mouseInfluence = mouseInfluence * mouseInfluence * uMouseActive;
        float sizeBoost = 1.0 + mouseInfluence * 0.5 + uScrollAmount * 0.2;
        
        gl_PointSize = max(vDistance * uBlur * uPointSize * sizeBoost, 3.0);
      }`,
      fragmentShader: /* glsl */ `#define MAX_WAVES ${waveCount}
      uniform float uOpacity;
      uniform float uRevealFactor;
      uniform float uRevealProgress;
      uniform float uTime;
      uniform vec2 uMousePosition;
      uniform float uMouseActive;
      uniform float uClickIntensity;
      uniform float uPlaneScale;
      uniform float uScrollAmount;
      uniform vec2 uWaveOrigins[MAX_WAVES];
      uniform float uWaveProgress[MAX_WAVES];
      uniform float uWaveActive[MAX_WAVES];
      uniform float uWaveIntensity[MAX_WAVES];
      varying float vDistance;
      varying float vPosY;
      varying vec3 vWorldPosition;
      varying vec3 vInitialPosition;
      varying float vDistToMouse;
      uniform float uTransition;

      ${periodicNoiseGLSL}

      float sparkleNoise(vec3 seed, float time) {
        float hash = sin(seed.x * 127.1 + seed.y * 311.7 + seed.z * 74.7) * 43758.5453;
        hash = fract(hash);
        
        float slowTime = time * 1.0;
        
        float sparkle = 0.0;
        sparkle += sin(slowTime + hash * 6.28318) * 0.5;
        sparkle += sin(slowTime * 1.7 + hash * 12.56636) * 0.3;
        sparkle += sin(slowTime * 0.8 + hash * 18.84954) * 0.2;
        
        float hash2 = sin(seed.x * 113.5 + seed.y * 271.9 + seed.z * 97.3) * 37849.3241;
        hash2 = fract(hash2);
        
        float sparkleMask = sin(hash2 * 6.28318) * 0.7;
        sparkleMask += sin(hash2 * 12.56636) * 0.3;
        
        if (sparkleMask < 0.3) {
          sparkle *= 0.05;
        }
        
        float normalizedSparkle = (sparkle + 1.0) * 0.5;
        
        float smoothCurve = pow(normalizedSparkle, 4.0);
        
        float blendFactor = normalizedSparkle * normalizedSparkle;
        float finalBrightness = mix(normalizedSparkle, smoothCurve, blendFactor);
        
        return 0.7 + finalBrightness * 1.3;
      }

      float sdCircle(vec2 p, float r) {
        return length(p) - r;
      }

      void main() {
        vec2 cxy = 2.0 * gl_PointCoord - 1.0;
        
        float sdf = sdCircle(cxy, 0.5);
        
        if (sdf > 0.0) discard;

        float distanceFromCenter = length(vWorldPosition.xz);
        
        float noiseValue = periodicNoise(vInitialPosition * 4.0, 0.0);
        float revealThreshold = uRevealFactor + noiseValue * 0.3;
        
        float revealMask = 1.0 - smoothstep(revealThreshold - 0.2, revealThreshold + 0.1, distanceFromCenter);
        
        float sparkleBrightness = sparkleNoise(vInitialPosition, uTime);
        
        float yGradient = smoothstep(-0.8, 0.5, vPosY);
        
        vec3 baseColor = vec3(0.85, 0.9, 1.0);
        
        vec3 warmColor = vec3(1.0, 0.95, 0.88);
        vec3 scrollAccent = vec3(1.02, 0.82, 0.6);
        
        vec3 color = mix(baseColor, warmColor, yGradient * 0.4);
        color = mix(color, scrollAccent, uScrollAmount * 0.4);
        
        float mouseGlow = 1.0 - smoothstep(0.0, 2.0, vDistToMouse);
        mouseGlow = mouseGlow * mouseGlow * uMouseActive;
        
        vec3 mouseAccent = vec3(0.7, 0.95, 1.0);
        color = mix(color, mouseAccent, mouseGlow * 0.5);
        
        float brightnessBump = 1.0 + mouseGlow * 0.6 + uScrollAmount * 0.35;
        
        float clickGlow = 1.0 - smoothstep(0.0, 2.2, vDistToMouse);
        clickGlow = clickGlow * clickGlow * uClickIntensity * 0.8;
        vec3 clickColor = vec3(1.0, 0.9, 0.7);
        color = mix(color, clickColor, clickGlow * 0.7);
        brightnessBump += clickGlow * 0.8;
        
        float waveGlow = 0.0;
        for (int i = 0; i < MAX_WAVES; i++) {
          if (uWaveActive[i] <= 0.0) {
            continue;
          }
          float maxRadius = min(uPlaneScale * 0.4, 4.0);
          float waveRadius = uWaveProgress[i] * maxRadius;
          float ringWidth = maxRadius * 0.2 + 0.1;
          float dist = length(vWorldPosition.xz - uWaveOrigins[i]);
          float intro = smoothstep(0.02, 0.15, uWaveProgress[i]);
          float outro = 1.0 - smoothstep(0.7, 0.95, uWaveProgress[i]);
          float ring = exp(-pow((dist - waveRadius) / ringWidth, 2.0));
          waveGlow += ring * intro * outro * uWaveIntensity[i];
        }
        vec3 waveColor = vec3(1.0, 0.92, 0.68);
        color = mix(color, waveColor, clamp(waveGlow * 1.1, 0.0, 1.0));
        brightnessBump += waveGlow * 0.5;
        
        float alpha = (1.04 - clamp(vDistance, 0.0, 1.0)) * clamp(smoothstep(-0.5, 0.25, vPosY), 0.0, 1.0) * uOpacity * revealMask * uRevealProgress * sparkleBrightness * brightnessBump;

        float edgeFalloff = 1.0 - smoothstep(0.3, 0.5, length(cxy));
        alpha *= edgeFalloff;

        gl_FragColor = vec4(color, mix(alpha, sparkleBrightness - 1.1, uTransition));
      }`,
      uniforms: {
        positions: { value: null },
        initialPositions: { value: null },
        uTime: { value: 0 },
        uFocus: { value: 5.1 },
        uFov: { value: 50 },
        uBlur: { value: 30 },
        uTransition: { value: 0.0 },
        uPointSize: { value: 2.0 },
        uOpacity: { value: 1.0 },
        uRevealFactor: { value: 0.0 },
        uRevealProgress: { value: 0.0 },
        uMousePosition: { value: new THREE.Vector2(0, 0) },
        uMouseActive: { value: 0.0 },
        uClickIntensity: { value: 0.0 },
        uPlaneScale: { value: 10.0 },
        uScrollAmount: { value: 0 },
        uWaveOrigins: {
          value: Array.from({ length: waveCount }, () => new THREE.Vector2(0, 0)),
        },
        uWaveProgress: { value: Array.from({ length: waveCount }, () => 1.0) },
        uWaveActive: { value: Array.from({ length: waveCount }, () => 0.0) },
        uWaveIntensity: { value: Array.from({ length: waveCount }, () => 0.0) }
      },
      transparent: true,
      depthWrite: false
    })
  }
}
