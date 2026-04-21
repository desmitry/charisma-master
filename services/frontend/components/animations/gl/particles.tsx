import { useFBO } from "@react-three/drei";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import * as easing from "maath/easing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { DofPointsMaterial } from "@/components/animations/gl/shaders/pointMaterial";
import { SimulationMaterial } from "@/components/animations/gl/shaders/simulationMaterial";

const MAX_WAVES = 50;
const WAVE_DURATION = 2;
const WAVE_FADE_TIME = 1;

type WaveState = {
	origin: THREE.Vector2;
	elapsed: number;
	progress: number;
	intensity: number;
	active: boolean;
};

export function Particles({
	speed,
	aperture,
	focus,
	size = 512,
	noiseScale = 1.0,
	noiseIntensity = 0.5,
	timeScale = 0.5,
	pointSize = 2.0,
	opacity = 1.0,
	planeScale = 1.0,
	useManualTime = false,
	manualTime = 0,
	introspect = false,
	...props
}: {
	speed: number;
	aperture: number;
	focus: number;
	size: number;
	noiseScale?: number;
	noiseIntensity?: number;
	timeScale?: number;
	pointSize?: number;
	opacity?: number;
	planeScale?: number;
	useManualTime?: boolean;
	manualTime?: number;
	introspect?: boolean;
}) {
	const mousePosition = useRef(new THREE.Vector2(0, 0));
	const targetMouseWorld = useRef(new THREE.Vector3(0, 0, 0));
	const currentMouseWorld = useRef(new THREE.Vector3(0, 0, 0));
	const isMouseOver = useRef(true);
	const clickIntensity = useRef(0);
	const targetClickIntensity = useRef(0);
	const scrollTarget = useRef(0);
	const scrollCurrent = useRef(0);
	const waves = useRef<WaveState[]>(
		Array.from({ length: MAX_WAVES }, () => ({
			origin: new THREE.Vector2(0, 0),
			elapsed: WAVE_DURATION,
			progress: 1,
			intensity: 0,
			active: false,
		})),
	);
	const { gl, camera: mainCamera } = useThree();

	const groundPlane = useMemo(
		() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
		[],
	);
	const raycaster = useMemo(() => new THREE.Raycaster(), []);

	const spawnWave = useCallback((origin: THREE.Vector2) => {
		const pool = waves.current;
		let slot = -1;
		for (let i = 0; i < MAX_WAVES; i++) {
			if (!pool[i].active || pool[i].progress >= 1) {
				slot = i;
				break;
			}
		}
		if (slot === -1) {
			let maxProgress = -Infinity;
			for (let i = 0; i < MAX_WAVES; i++) {
				if (pool[i].progress > maxProgress) {
					maxProgress = pool[i].progress;
					slot = i;
				}
			}
		}
		const wave = pool[slot];
		wave.origin.copy(origin);
		wave.elapsed = 0;
		wave.progress = 0;
		wave.intensity = 1;
		wave.active = true;
	}, []);

	useEffect(() => {
		const canvas = gl.domElement;
		const clickPoint = new THREE.Vector3();

		const handleMouseMove = (event: MouseEvent) => {
			const rect = canvas.getBoundingClientRect();
			mousePosition.current.x =
				((event.clientX - rect.left) / rect.width) * 2 - 1;
			mousePosition.current.y =
				-((event.clientY - rect.top) / rect.height) * 2 + 1;
			isMouseOver.current = true;
		};

		const handleMouseLeaveWindow = () => {
			isMouseOver.current = false;
		};

		const handleMouseDown = () => {
			targetClickIntensity.current = 1.0;
			raycaster.setFromCamera(mousePosition.current, mainCamera);
			const hit = raycaster.ray.intersectPlane(groundPlane, clickPoint);
			if (hit) {
				spawnWave(new THREE.Vector2(hit.x, hit.z));
			} else {
				spawnWave(
					new THREE.Vector2(
						currentMouseWorld.current.x,
						currentMouseWorld.current.z,
					),
				);
			}
		};

		const handleMouseUp = () => {
			targetClickIntensity.current = 0;
		};

		window.addEventListener("mousemove", handleMouseMove, { passive: true });
		window.addEventListener("mouseleave", handleMouseLeaveWindow);
		window.addEventListener("mousedown", handleMouseDown);
		window.addEventListener("mouseup", handleMouseUp);

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseleave", handleMouseLeaveWindow);
			window.removeEventListener("mousedown", handleMouseDown);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [gl, mainCamera, groundPlane, raycaster, spawnWave]);

	useEffect(() => {
		const updateScroll = () => {
			const doc = document.documentElement;
			const maxScroll = doc.scrollHeight - window.innerHeight;
			const normalized = maxScroll > 0 ? window.scrollY / maxScroll : 0;
			scrollTarget.current = THREE.MathUtils.clamp(normalized, 0, 1);
		};
		updateScroll();
		window.addEventListener("scroll", updateScroll, { passive: true });
		window.addEventListener("resize", updateScroll);
		return () => {
			window.removeEventListener("scroll", updateScroll);
			window.removeEventListener("resize", updateScroll);
		};
	}, []);

	const revealStartTime = useRef<number | null>(null);
	const [isRevealing, setIsRevealing] = useState(true);
	const revealDuration = 3.5;
	const simulationMaterial = useMemo(() => {
		return new SimulationMaterial(planeScale, MAX_WAVES);
	}, [planeScale]);

	const target = useFBO(size, size, {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
		type: THREE.FloatType,
	});

	const dofPointsMaterial = useMemo(() => {
		const m = new DofPointsMaterial(MAX_WAVES);
		m.uniforms.positions.value = target.texture;
		m.uniforms.initialPositions.value =
			simulationMaterial.uniforms.positions.value;
		return m;
	}, [simulationMaterial]);

	const [scene] = useState(() => new THREE.Scene());
	const [orthoCamera] = useState(
		() => new THREE.OrthographicCamera(-1, 1, 1, -1, 1 / 2 ** 53, 1),
	);
	const [positions] = useState(
		() =>
			new Float32Array([
				-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0,
			]),
	);
	const [uvs] = useState(
		() => new Float32Array([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0]),
	);

	const particles = useMemo(() => {
		const length = size * size;
		const particles = new Float32Array(length * 3);
		for (let i = 0; i < length; i++) {
			const i3 = i * 3;
			particles[i3 + 0] = (i % size) / size;
			particles[i3 + 1] = i / size / size;
		}
		return particles;
	}, [size]);

	useFrame((state, delta) => {
		if (!dofPointsMaterial || !simulationMaterial) return;

		raycaster.setFromCamera(mousePosition.current, state.camera);
		const intersectPoint = new THREE.Vector3();
		raycaster.ray.intersectPlane(groundPlane, intersectPoint);

		if (intersectPoint && isMouseOver.current) {
			targetMouseWorld.current.copy(intersectPoint);
		}

		currentMouseWorld.current.lerp(targetMouseWorld.current, 0.08);

		clickIntensity.current +=
			(targetClickIntensity.current - clickIntensity.current) * 0.15;

		scrollCurrent.current = THREE.MathUtils.lerp(
			scrollCurrent.current,
			scrollTarget.current,
			0.08,
		);

		for (let i = 0; i < MAX_WAVES; i++) {
			const wave = waves.current[i];
			if (!wave.active) continue;
			wave.elapsed += delta;
			wave.progress = Math.min(wave.elapsed / WAVE_DURATION, 1);
			const fadeRatio = Math.min(wave.elapsed / WAVE_FADE_TIME, 1);
			wave.intensity = Math.max(1 - fadeRatio, 0);
			if (wave.progress >= 1 && wave.intensity <= 0.01) {
				wave.active = false;
				wave.progress = 1;
				wave.intensity = 0;
			}
		}

		state.gl.setRenderTarget(target);
		state.gl.clear();
		state.gl.render(scene, orthoCamera);
		state.gl.setRenderTarget(null);

		const currentTime = useManualTime ? manualTime : state.clock.elapsedTime;

		if (revealStartTime.current === null) {
			revealStartTime.current = currentTime;
		}

		const revealElapsed = currentTime - revealStartTime.current;
		const revealProgress = Math.min(revealElapsed / revealDuration, 1.0);

		const easedProgress = 1 - (1 - revealProgress) ** 3;

		const revealFactor = easedProgress * 4.0;

		if (revealProgress >= 1.0 && isRevealing) {
			setIsRevealing(false);
		}

		dofPointsMaterial.uniforms.uTime.value = currentTime;

		dofPointsMaterial.uniforms.uFocus.value = focus;
		dofPointsMaterial.uniforms.uBlur.value = aperture;

		easing.damp(
			dofPointsMaterial.uniforms.uTransition,
			"value",
			introspect ? 1.0 : 0.0,
			introspect ? 0.35 : 0.2,
			delta,
		);

		simulationMaterial.uniforms.uMousePosition.value.set(
			currentMouseWorld.current.x,
			currentMouseWorld.current.z,
		);
		simulationMaterial.uniforms.uMouseActive.value = isMouseOver.current
			? 1.0
			: 0.0;
		simulationMaterial.uniforms.uClickIntensity.value = clickIntensity.current;
		simulationMaterial.uniforms.uPlaneScale.value = planeScale;
		simulationMaterial.uniforms.uScrollAmount.value = scrollCurrent.current;

		const simWaveOrigins = simulationMaterial.uniforms.uWaveOrigins
			.value as THREE.Vector2[];
		const simWaveProgress = simulationMaterial.uniforms.uWaveProgress
			.value as number[];
		const simWaveActive = simulationMaterial.uniforms.uWaveActive
			.value as number[];
		const simWaveIntensity = simulationMaterial.uniforms.uWaveIntensity
			.value as number[];

		const maxShaderWaves = Math.min(MAX_WAVES, simWaveOrigins.length);
		for (let idx = 0; idx < maxShaderWaves; idx++) {
			const wave = waves.current[idx];
			if (!simWaveOrigins[idx]) continue;
			simWaveOrigins[idx].set(wave.origin.x, wave.origin.y);
			simWaveProgress[idx] = wave.progress;
			simWaveActive[idx] = wave.active ? 1 : 0;
			simWaveIntensity[idx] = wave.intensity;
		}
		for (let idx = maxShaderWaves; idx < simWaveActive.length; idx++) {
			if (simWaveActive[idx]) simWaveActive[idx] = 0;
		}

		simulationMaterial.uniforms.uTime.value = currentTime;
		simulationMaterial.uniforms.uNoiseScale.value = noiseScale;
		simulationMaterial.uniforms.uNoiseIntensity.value = noiseIntensity;
		simulationMaterial.uniforms.uTimeScale.value = timeScale * speed;

		dofPointsMaterial.uniforms.uPointSize.value = pointSize;
		dofPointsMaterial.uniforms.uOpacity.value = opacity;
		dofPointsMaterial.uniforms.uRevealFactor.value = revealFactor;
		dofPointsMaterial.uniforms.uRevealProgress.value = easedProgress;

		dofPointsMaterial.uniforms.uMousePosition.value.set(
			currentMouseWorld.current.x,
			currentMouseWorld.current.z,
		);
		dofPointsMaterial.uniforms.uMouseActive.value = isMouseOver.current
			? 1.0
			: 0.0;
		dofPointsMaterial.uniforms.uClickIntensity.value = clickIntensity.current;
		dofPointsMaterial.uniforms.uPlaneScale.value = planeScale;
		dofPointsMaterial.uniforms.uScrollAmount.value = scrollCurrent.current;

		const pointWaveOrigins = dofPointsMaterial.uniforms.uWaveOrigins
			.value as THREE.Vector2[];
		const pointWaveProgress = dofPointsMaterial.uniforms.uWaveProgress
			.value as number[];
		const pointWaveActive = dofPointsMaterial.uniforms.uWaveActive
			.value as number[];
		const pointWaveIntensity = dofPointsMaterial.uniforms.uWaveIntensity
			.value as number[];

		const maxShaderWavesPoint = Math.min(MAX_WAVES, pointWaveOrigins.length);
		for (let idx = 0; idx < maxShaderWavesPoint; idx++) {
			const wave = waves.current[idx];
			if (!pointWaveOrigins[idx]) continue;
			pointWaveOrigins[idx].set(wave.origin.x, wave.origin.y);
			pointWaveProgress[idx] = wave.progress;
			pointWaveActive[idx] = wave.active ? 1 : 0;
			pointWaveIntensity[idx] = wave.intensity;
		}
		for (let idx = maxShaderWavesPoint; idx < pointWaveActive.length; idx++) {
			if (pointWaveActive[idx]) pointWaveActive[idx] = 0;
		}
	});

	return (
		<>
			{createPortal(
				<mesh material={simulationMaterial}>
					<bufferGeometry>
						<bufferAttribute
							attach="attributes-position"
							args={[positions, 3]}
						/>
						<bufferAttribute attach="attributes-uv" args={[uvs, 2]} />
					</bufferGeometry>
				</mesh>,
				scene,
			)}
			<points material={dofPointsMaterial} {...props}>
				<bufferGeometry>
					<bufferAttribute attach="attributes-position" args={[particles, 3]} />
				</bufferGeometry>
			</points>
		</>
	);
}
