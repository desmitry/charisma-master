import * as THREE from 'three'
import { periodicNoiseGLSL } from '@/components/animations/gl/shaders/utils'

function getPlane(count: number, components: number, size: number = 512, scale: number = 1.0) {
  const length = count * components
  const data = new Float32Array(length)
  
  for (let i = 0; i < count; i++) {
    const i4 = i * components
    
    const x = (i % size) / (size - 1)
    const z = Math.floor(i / size) / (size - 1)
    
    data[i4 + 0] = (x - 0.5) * 2 * scale
    data[i4 + 1] = 0
    data[i4 + 2] = (z - 0.5) * 2 * scale
    data[i4 + 3] = 1.0
  }
  
  return data
}

export class SimulationMaterial extends THREE.ShaderMaterial {
  constructor(scale: number = 10.0, maxWaves: number = 4) {
    const waveCount = Math.max(1, Math.min(8, Math.floor(maxWaves)));
    const positionsTexture = new THREE.DataTexture(getPlane(512 * 512, 4, 512, scale), 512, 512, THREE.RGBAFormat, THREE.FloatType)
    positionsTexture.needsUpdate = true

    super({
      vertexShader: /* glsl */`varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
      fragmentShader: /* glsl */`#define MAX_WAVES ${waveCount}
      uniform sampler2D positions;
      uniform float uTime;
      uniform float uNoiseScale;
      uniform float uNoiseIntensity;
      uniform float uTimeScale;
      uniform float uLoopPeriod;
      uniform vec2 uMousePosition;
      uniform float uMouseActive;
      uniform float uClickIntensity;
      uniform float uPlaneScale;
      uniform float uScrollAmount;
      uniform vec2 uWaveOrigins[MAX_WAVES];
      uniform float uWaveProgress[MAX_WAVES];
      uniform float uWaveActive[MAX_WAVES];
      uniform float uWaveIntensity[MAX_WAVES];
      varying vec2 vUv;

      ${periodicNoiseGLSL}

      void main() {
        vec3 originalPos = texture2D(positions, vUv).rgb;
        
        float continuousTime = uTime * uTimeScale * (6.28318530718 / uLoopPeriod);
        
        vec3 noiseInput = originalPos * uNoiseScale;
        
        float displacementX = periodicNoise(noiseInput + vec3(0.0, 0.0, 0.0), continuousTime);
        float displacementY = periodicNoise(noiseInput + vec3(50.0, 0.0, 0.0), continuousTime + 2.094);
        float displacementZ = periodicNoise(noiseInput + vec3(0.0, 50.0, 0.0), continuousTime + 4.188);
        
        float scrollBoost = mix(0.85, 1.35, uScrollAmount);
        vec3 distortion = vec3(displacementX, displacementY, displacementZ) * uNoiseIntensity * scrollBoost;
        vec3 finalPos = originalPos + distortion;
        
        float scrollWave = sin((originalPos.x + originalPos.z) * 1.5 + uScrollAmount * 10.0);
        float scrollTwistX = cos(originalPos.z * 1.2 + uScrollAmount * 8.0);
        float scrollTwistZ = sin(originalPos.x * 1.2 + uScrollAmount * 8.0);
        finalPos.y += scrollWave * 0.35 * uScrollAmount;
        finalPos.x += scrollTwistX * 0.12 * uScrollAmount;
        finalPos.z += scrollTwistZ * 0.12 * uScrollAmount;
        
        vec2 particleXZ = finalPos.xz;
        vec2 mouseXZ = uMousePosition;
        float distToMouse = length(particleXZ - mouseXZ);
        
        float mouseRadius = 1.2;
        
        float influence = 1.0 - smoothstep(0.0, mouseRadius, distToMouse);
        influence = influence * influence * influence;
        
        float depressionStrength = 0.6;
        float mouseEffect = influence * depressionStrength * uMouseActive;
        
        finalPos.y -= mouseEffect;
        
        for (int i = 0; i < MAX_WAVES; i++) {
          if (uWaveActive[i] <= 0.0) {
            continue;
          }
          vec2 waveOrigin = uWaveOrigins[i];
          float maxRadius = min(uPlaneScale * 0.4, 4.0);
          float waveRadius = uWaveProgress[i] * maxRadius;
          float ringWidth = maxRadius * 0.18 + 0.12;
          float dist = length(particleXZ - waveOrigin);
          float intro = smoothstep(0.02, 0.15, uWaveProgress[i]);
          float outro = 1.0 - smoothstep(0.7, 0.95, uWaveProgress[i]);
          float ring = exp(-pow((dist - waveRadius) / ringWidth, 2.0));
          float crest = sin((dist - waveRadius) * 6.5 - uTime * 3.0) * 0.5 + 0.5;
          float wave = ring * crest * intro * outro * uWaveIntensity[i];
          finalPos.y += wave * 0.25;
        }
        
        gl_FragColor = vec4(finalPos, 1.0);
      }`,
      uniforms: {
        positions: { value: positionsTexture },
        uTime: { value: 0 },
        uNoiseScale: { value: 1.0 },
        uNoiseIntensity: { value: 0.5 },
        uTimeScale: { value: 1 },
        uLoopPeriod: { value: 24.0 },
        uMousePosition: { value: new THREE.Vector2(0, 0) },
        uMouseActive: { value: 0.0 },
        uClickIntensity: { value: 0.0 },
        uPlaneScale: { value: scale },
        uScrollAmount: { value: 0 },
        uWaveOrigins: {
          value: Array.from({ length: waveCount }, () => new THREE.Vector2(0, 0)),
        },
        uWaveProgress: { value: Array.from({ length: waveCount }, () => 1.0) },
        uWaveActive: { value: Array.from({ length: waveCount }, () => 0.0) },
        uWaveIntensity: { value: Array.from({ length: waveCount }, () => 0.0) }
      }
    })
  }
}
