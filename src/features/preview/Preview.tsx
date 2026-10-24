import { Component, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Alert, Button, Group, SegmentedControl, Switch, Text } from '@mantine/core';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { BufferGeometry, Material, Object3D, PerspectiveCamera } from 'three';
import type { ReadyGeometry } from '../../app/useGeometry';
import type { FocusRegion } from '../printability/AnalysisPanel';

interface PreviewProps { result: ReadyGeometry | null; stale: boolean; status: string; riskMap: { key: string; colors: Float32Array } | null; focused: FocusRegion | null;
  showMap: boolean; onMapChange: (checked: boolean) => void; analysisStatus: string }
type ViewMode = 'print' | 'hanging';
export interface PreviewDiagnostics {
  revision: number; geometries: number; materials: number; programs: number;
  camera: number[]; target: number[];
}
declare global { interface Window { __bulbPreview?: () => PreviewDiagnostics } }

function Fallback({ retry }: { retry?: () => void }) {
  return <div className="preview-fallback"><Alert color="yellow" title="3D náhled není dostupný">
    Prohlížeč nemá dostupné WebGL nebo se ztratil grafický kontext. Parametry, geometrické kontroly a export STL i JSON dál fungují.
  </Alert>{retry && <Button variant="light" onClick={retry} mt="md">Zkusit 3D znovu</Button>}</div>;
}
class PreviewBoundary extends Component<{ children: ReactNode; retry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <Fallback retry={this.props.retry} /> : this.props.children; }
}

function CameraRig({ reset, mode, height, width, revision }: { reset: number; mode: ViewMode; height: number; width: number; revision: number }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera, gl, scene, invalidate } = useThree();
  const latestBounds = useRef({ height, width }); latestBounds.current = { height, width };
  useEffect(() => {
    const { height: h, width: w } = latestBounds.current;
    const perspective = camera as PerspectiveCamera;
    const halfFov = Math.atan(Math.tan(perspective.fov * Math.PI / 360) * Math.min(1, perspective.aspect));
    const radius = Math.hypot(w / 2, h / 2);
    const distance = Math.max(100, radius / Math.sin(halfFov) * 1.15);
    const directionLength = Math.hypot(0.7, -1, 0.42);
    camera.up.set(0, 0, 1); camera.position.set(distance * 0.7 / directionLength, -distance / directionLength, h * 0.5 + distance * 0.42 / directionLength);
    controls.current?.target.set(0, 0, h * 0.5);
    camera.lookAt(0, 0, h * 0.5); controls.current?.update(); invalidate();
    // Height changes alone must preserve the user's camera and pan target.
  }, [reset, mode, camera, invalidate]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const snapshot = () => {
      const materials = new Set<Material>();
      scene.traverse(object => {
        const material = (object as Object3D & { material?: Material | Material[]; geometry?: BufferGeometry }).material;
        if (Array.isArray(material)) material.forEach(m => materials.add(m)); else if (material) materials.add(material);
      });
      return { revision, geometries: gl.info.memory.geometries, materials: materials.size, programs: gl.info.programs?.length ?? 0,
        camera: [...camera.position.toArray(), ...camera.quaternion.toArray()], target: controls.current?.target.toArray() ?? [] };
    };
    window.__bulbPreview = snapshot;
    return () => { if (window.__bulbPreview === snapshot) delete window.__bulbPreview; };
  }, [camera, gl, scene, revision]);
  return <OrbitControls ref={controls} makeDefault minDistance={40} maxDistance={700} enableDamping dampingFactor={0.12} />;
}

function Model({ result, mode, riskMap, focused }: { result: ReadyGeometry; mode: ViewMode; riskMap: PreviewProps['riskMap']; focused: FocusRegion | null }) {
  const render = result.render!;
  const height = result.validation.bounds.size[2]!;
  return <group rotation={mode === 'hanging' ? [Math.PI, 0, 0] : [0, 0, 0]} position={[0, 0, mode === 'hanging' ? height : 0]}>
    <mesh castShadow receiveShadow>
      {/* Each revision owns a declarative geometry. R3F disposes the old GPU
          buffers; materials and the Canvas remain mounted across revisions. */}
      <bufferGeometry key={`${result.revision}:${riskMap?.key ?? 'neutral'}`}>
        <bufferAttribute attach="attributes-position" args={[render.positions, 3]} />
        <bufferAttribute attach="attributes-normal" args={[render.normals, 3]} />
        <bufferAttribute attach="attributes-color" args={[riskMap?.colors ?? render.colors, 3]} />
      </bufferGeometry>
      <meshStandardMaterial vertexColors metalness={0.12} roughness={0.48} />
    </mesh>
    {focused && [focused.zMinMm, focused.zMaxMm].map((z, i) => <mesh key={i} position={[0, 0, z]}>
      <ringGeometry args={[result.validation.bounds.size[0]! / 2 + 4, result.validation.bounds.size[0]! / 2 + 4.5, 80]} />
      <meshBasicMaterial color="#498acc" transparent opacity={0.8} side={2} depthWrite={false} />
    </mesh>)}
  </group>;
}

function Dimension({ width, height }: { width: number; height: number }) {
  const points = useMemo(() => {
    const x = width / 2 + 14;
    return Float32Array.from([x, 0, 0, x, 0, height, x - 3, 0, 0, x + 3, 0, 0, x - 3, 0, height, x + 3, 0, height]);
  }, [width, height]);
  return <group>
    <lineSegments><bufferGeometry key={`${width}:${height}`}><bufferAttribute attach="attributes-position" args={[points, 3]} /></bufferGeometry><lineBasicMaterial color="#788b7a" /></lineSegments>
  </group>;
}

function ContextMonitor({ onLost }: { onLost: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onLost(); };
    gl.domElement.addEventListener('webglcontextlost', lost);
    return () => gl.domElement.removeEventListener('webglcontextlost', lost);
  }, [gl, onLost]);
  return null;
}

export default function Preview({ result, stale, status, riskMap, focused, showMap, onMapChange, analysisStatus }: PreviewProps) {
  const [mode, setMode] = useState<ViewMode>('print'), [reset, setReset] = useState(0);
  const [lost, setLost] = useState(false), [attempt, setAttempt] = useState(0);
  const retry = () => { setLost(false); setAttempt(a => a + 1); };
  const height = result?.validation.bounds.size[2] ?? 96, width = result?.validation.bounds.size[0] ?? 56;
  return <section className="preview-panel" aria-label="3D náhled baňky" data-testid="preview" data-rendered-revision={result?.revision ?? -1} data-risk-map={riskMap?.key ?? 'off'}>
    <div className="preview-toolbar"><Text className="eyebrow" mb="0">02 / 3D NÁHLED</Text><Group gap="sm" wrap="nowrap">
      <Switch label="Mapa rizik" size="xs" checked={showMap} onChange={event => onMapChange(event.currentTarget.checked)} />
      <Button size="compact-xs" variant="subtle" onClick={() => setReset(value => value + 1)}>Reset kamery ↺</Button></Group></div>
    <div className="canvas-frame">
      {!result?.render ? <div className="preview-loading"><Text c="dimmed">Připravuji náhled…</Text></div> : lost ? <Fallback retry={retry} /> :
        <PreviewBoundary key={attempt} retry={retry}><Canvas shadows="percentage" frameloop="demand" dpr={[1, 1.7]}
          camera={{ position: [145, -205, 135], up: [0, 0, 1], fov: 38, near: 0.1, far: 2000 }}
          fallback={<span>Váš prohlížeč nepodporuje HTML canvas.</span>} gl={{ antialias: true }}>
          <color attach="background" args={['#eef1e9']} />
          <ambientLight intensity={0.9} />
          <hemisphereLight args={['#ffffff', '#a6aa91', 1.8]} />
          <directionalLight position={[70, -100, 160]} intensity={3} castShadow shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-110} shadow-camera-right={110} shadow-camera-top={160} shadow-camera-bottom={-110} shadow-camera-far={500} shadow-normalBias={0.15} />
          <directionalLight position={[-90, 50, 90]} intensity={1.3} />
          <mesh position={[0, 0, -0.22]} receiveShadow><planeGeometry args={[220, 220]} /><meshStandardMaterial color="#e6eadf" roughness={1} /></mesh>
          <gridHelper args={[220, 22, '#adbda9', '#ccd7c6']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.1]} />
          <axesHelper args={[28]} position={[-55, 0, 0]} />
          <Model result={result} mode={mode} riskMap={riskMap} focused={focused} />
          <Dimension width={width} height={height} />
          <CameraRig reset={reset} mode={mode} height={height} width={width} revision={result.revision} />
          <ContextMonitor onLost={() => setLost(true)} />
        </Canvas></PreviewBoundary>}
      {stale && result && <div className="stale-label" role="status">{status === 'invalid' ? 'Neplatný vstup · poslední platný náhled' : status === 'failed' ? 'Výpočet selhal · předchozí náhled' : 'Přepočítávám · zobrazen předchozí náhled'}</div>}
      {result && !lost && <div className="canvas-dimensions"><span className="axis-label">Z-UP · +Z</span><span className="dimension-label">Výška {height.toLocaleString('cs-CZ')} mm</span></div>}
      {riskMap && <div className="map-caption">MAPA GEOMETRICKÝCH RIZIK{focused ? ` · Z ${focused.zMinMm.toFixed(1)}–${focused.zMaxMm.toFixed(1)} mm` : ''}</div>}
      {showMap && !riskMap && <div className={`map-caption${stale && result ? ' map-caption-stale' : ''}`} role="status">{analysisStatus === 'failed' ? 'MAPA NENÍ DOSTUPNÁ · ANALÝZA NEDOKONČENA' : 'MAPA ČEKÁ NA AKTUÁLNÍ ANALÝZU'}</div>}
      <div className="bed-label">{mode === 'print' ? 'KRČEK NA PODLOŽCE · Z = 0' : 'ZAVĚŠENÝ POHLED · POUZE NÁHLED'}</div>
    </div>
    <Group justify="space-between" className="preview-controls" gap="sm"><SegmentedControl size="xs" value={mode}
      onChange={value => setMode(value as ViewMode)} data={[{ value: 'print', label: 'Pro tisk' }, { value: 'hanging', label: 'Zavěšená' }]} />
      <Text size="xs" c="dimmed">Tažení: otočení · kolečko: zoom · pravé tlačítko: posun</Text></Group>
    <Text size="xs" c="dimmed" className="orientation-note">Otáčení pohledu nemění STL. Export má vždy krček dole a osu Z vzhůru.</Text>
  </section>;
}
