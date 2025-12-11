import { useCallback, useState } from "react";
import * as THREE from "three";
import { Effects } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useControls } from "leva";
import { Particles } from "./particles";
import { VignetteShader } from "./shaders/vignetteShader";
import { useEcoMode } from "@/lib/eco-mode-context";

export const GL = () => {
  const { isEcoMode } = useEcoMode();
  const [contextLost, setContextLost] = useState(false);
  const [key, setKey] = useState(0);

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    const canvas = gl.domElement;
    
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
      console.warn("WebGL context lost, attempting recovery...");
    };
    
    const handleContextRestored = () => {
      setContextLost(false);
      setKey(prev => prev + 1);
      console.log("WebGL context restored");
    };
    
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);
    
    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
    };
  }, []);
  const {
    speed,
    focus,
    aperture,
    size,
    noiseScale,
    noiseIntensity,
    timeScale,
    pointSize,
    opacity,
    planeScale,
    vignetteDarkness,
    vignetteOffset,
    useManualTime,
    manualTime,
  } = useControls("Particle System", {
    speed: { value: 1.0, min: 0, max: 2, step: 0.01 },
    noiseScale: { value: 0.6, min: 0.1, max: 5, step: 0.1 },
    noiseIntensity: { value: 0.52, min: 0, max: 2, step: 0.01 },
    timeScale: { value: 1, min: 0, max: 2, step: 0.01 },
    focus: { value: 3.8, min: 0.1, max: 20, step: 0.1 },
    aperture: { value: 1.79, min: 0, max: 2, step: 0.01 },
    pointSize: { value: 10.0, min: 0.1, max: 10, step: 0.1 },
    opacity: { value: 0.8, min: 0, max: 1, step: 0.01 },
    planeScale: { value: 10.0, min: 0.1, max: 10, step: 0.1 },
    size: {
      value: 512,
      options: [256, 512, 1024],
    },
    showDebugPlane: { value: false },
    vignetteDarkness: { value: 1.5, min: 0, max: 2, step: 0.1 },
    vignetteOffset: { value: 0.4, min: 0, max: 2, step: 0.1 },
    useManualTime: { value: false },
    manualTime: { value: 0, min: 0, max: 50, step: 0.01 },
  });
  const effectiveSize = isEcoMode ? Math.min(size, 256) : size;

  if (contextLost) {
    return (
      <div id="webgl">
        <div className="eco-bg w-full h-full" />
      </div>
    );
  }

  return (
    <div id="webgl" key={key}>
      <Canvas
        camera={{
          position: [
            1.2629783123314589, 2.664606471394044, -1.8178993743288914,
          ],
          fov: 50,
          near: 0.01,
          far: 300,
        }}
        dpr={isEcoMode ? [1, 1] : [1, 2]}
        gl={{ 
          powerPreference: isEcoMode ? "low-power" : "high-performance",
          antialias: false,
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false,
        }}
        onCreated={handleCreated}
      >
        <color attach="background" args={["#000"]} />
        <Particles
          speed={speed}
          aperture={aperture}
          focus={focus}
          size={effectiveSize}
          noiseScale={noiseScale}
          noiseIntensity={noiseIntensity}
          timeScale={timeScale}
          pointSize={isEcoMode ? pointSize * 1.3 : pointSize}
          opacity={opacity}
          planeScale={planeScale}
          useManualTime={useManualTime}
          manualTime={manualTime}
          introspect={false}
          isEcoMode={isEcoMode}
        />
        <Effects multisamping={0} disableGamma>
          <shaderPass
            args={[VignetteShader]}
            uniforms-darkness-value={vignetteDarkness}
            uniforms-offset-value={vignetteOffset}
          />
        </Effects>
      </Canvas>
    </div>
  );
};
