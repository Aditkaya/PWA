import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { globalActiveDraggedBanId, TireDetailModal, type StockBanItem, type WheelMeta } from './VehicleSchematic3D';

export interface VehicleWheelConfig {
  wheelCount?: number;
  title?: string;
  badgeLabel?: string;
  chassisType?: string;
  wheels: WheelMeta[];
  axleSummary?: string;
  treadPatternSummary?: string;
}

interface VehicleAnimation3DProps {
  wheelCount: number;
  selectedWheelId: string | null;
  onWheelClick?: (wheelId: string, tire?: StockBanItem | null) => void;
  getTireForWheel: (wheelId: string) => StockBanItem | null;
  wheelConfig?: VehicleWheelConfig | null;
  category?: string;
  onDropTireToWheel?: (wheelId: string, banId: number) => void;
  onRemoveTireFromWheel?: (wheelId: string) => void;
  onReturnBorrowedTire?: (tireId: number) => void;
  draggedTireId?: number | null;
  touchCoords?: { x: number; y: number } | null;
  onTargetWheelChange?: (wheelId: string | null) => void;
}

export type WheelCoord = {
  id: string;
  x: number;
  y: number;
  z: number;
  side: 'L' | 'R';
  isDual?: boolean;
  isOuter?: boolean;
  isInner?: boolean;
  partnerId?: string;
  axleGroup: string;
};

// Preset Sudut & Target Kamera yang dioptimasi untuk setiap jenis kendaraan
const getVehicleCameraPreset = (count: number) => {
  if (count === 4) {
    return {
      target: new THREE.Vector3(0, 0.8, 0.1),
      perspective: new THREE.Vector3(-4.8, 2.8, 4.2),
      top: new THREE.Vector3(0.001, 5.5, 0.1),
      side: new THREE.Vector3(-4.2, 0.9, 0.1),
      dualFocus: new THREE.Vector3(-3.4, 2.0, 1.6),
      dualTarget: new THREE.Vector3(-0.4, 0.6, 0.1)
    };
  }
  if (count === 6) {
    return {
      target: new THREE.Vector3(0, 1.15, 0.1),
      perspective: new THREE.Vector3(-7.2, 3.6, 6.2),
      top: new THREE.Vector3(0.001, 7.0, 0.1),
      side: new THREE.Vector3(-5.8, 1.15, 0.1),
      dualFocus: new THREE.Vector3(-4.2, 2.2, -0.2), // Elevated 45° angle clearly exposing inner & outer dual rear wheels
      dualTarget: new THREE.Vector3(-0.6, 0.7, -1.7)
    };
  }
  if (count === 8) {
    return {
      target: new THREE.Vector3(0, 0.75, -0.6),
      perspective: new THREE.Vector3(-8.8, 4.5, 7.2),
      top: new THREE.Vector3(0.001, 7.8, -0.6),
      side: new THREE.Vector3(-7.2, 0.95, -0.6),
      dualFocus: new THREE.Vector3(-4.6, 2.3, -1.0),
      dualTarget: new THREE.Vector3(-0.6, 0.65, -2.1)
    };
  }
  // 12 Roda
  return {
    target: new THREE.Vector3(0, 0.75, -1.0),
    perspective: new THREE.Vector3(-10.8, 5.5, 8.8),
    top: new THREE.Vector3(0.001, 8.8, -1.0),
    side: new THREE.Vector3(-8.8, 0.95, -1.0),
    dualFocus: new THREE.Vector3(-5.2, 2.4, -1.8),
    dualTarget: new THREE.Vector3(-0.6, 0.65, -3.3)
  };
};

const getMaxCameraDistance = (count: number) => {
  if (count <= 4) return 8.0;
  if (count <= 6) return 11.0;
  if (count <= 8) return 13.5;
  return 16.0;
};

// Generator Tekstur Lantai Garasi Bengkel Industri Realistis
const createWorkshopFloorTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // 1. Dasar Lantai Epoxy Bengkel Abu-abu Industri
  ctx.fillStyle = '#1e2430';
  ctx.fillRect(0, 0, 1024, 1024);

  // Butiran Tekstur Beton/Semen Halus
  const imgData = ctx.getImageData(0, 0, 1024, 1024);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    data[i] = Math.min(255, Math.max(0, data[i] + n));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n + 2));
  }
  ctx.putImageData(imgData, 0, 0);

  // 2. Garis Sambungan Cor Lantai Beton
  ctx.strokeStyle = '#141822';
  ctx.lineWidth = 3;
  for (let p = 0; p <= 1024; p += 128) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 1024);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(1024, p);
    ctx.stroke();
  }

  // 3. Service Bay Stall
  const bayX = 180, bayY = 80, bayW = 664, bayH = 864;
  ctx.fillStyle = '#242c3b';
  ctx.fillRect(bayX, bayY, bayW, bayH);

  // 4. Garis Pembatas Hazard Kuning-Hitam
  ctx.save();
  ctx.lineWidth = 20;
  ctx.strokeStyle = '#eab308';
  ctx.strokeRect(bayX, bayY, bayW, bayH);
  ctx.restore();

  // Strip Diagonal Hitam pada Garis Hazard
  ctx.fillStyle = '#0f172a';
  for (let x = bayX; x < bayX + bayW; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, bayY - 10);
    ctx.lineTo(x + 16, bayY - 10);
    ctx.lineTo(x + 6, bayY + 10);
    ctx.lineTo(x - 10, bayY + 10);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, bayY + bayH - 10);
    ctx.lineTo(x + 16, bayY + bayH - 10);
    ctx.lineTo(x + 6, bayY + bayH + 10);
    ctx.lineTo(x - 10, bayY + bayH + 10);
    ctx.fill();
  }
  for (let y = bayY; y < bayY + bayH; y += 36) {
    ctx.beginPath();
    ctx.moveTo(bayX - 10, y);
    ctx.lineTo(bayX - 10, y + 16);
    ctx.lineTo(bayX + 10, y + 6);
    ctx.lineTo(bayX + 10, y - 10);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(bayX + bayW - 10, y);
    ctx.lineTo(bayX + bayW - 10, y + 16);
    ctx.lineTo(bayX + bayW + 10, y + 6);
    ctx.lineTo(bayX + bayW + 10, y - 10);
    ctx.fill();
  }

  // 5. Dyno Pit / Area Roller Pengujian Tengah
  ctx.fillStyle = '#111722';
  ctx.fillRect(bayX + 70, bayY + 180, bayW - 140, bayH - 360);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(bayX + 70, bayY + 180, bayW - 140, bayH - 360);

  // 6. Garis Putus-Putus Jalur Roda
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.setLineDash([20, 20]);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(340, bayY + 40);
  ctx.lineTo(340, bayY + bayH - 40);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(684, bayY + 40);
  ctx.lineTo(684, bayY + bayH - 40);
  ctx.stroke();
  ctx.setLineDash([]);

  // 7. Stensil Teks Bengkel
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('▶ SERVICE BAY 01 ◀', 512, bayY + 68);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('TIRE & BRAKE INSPECTION AREA', 512, bayY + bayH - 50);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
};

// Generator Tekstur Alur Tapak Ban Realistis (Commercial Truck Radial Tread Pattern)
const createTireTreadTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#1a1a1e';
  ctx.fillRect(0, 0, 512, 128);

  // Longitudinal main grooves
  ctx.fillStyle = '#08080a';
  ctx.fillRect(0, 24, 512, 14);
  ctx.fillRect(0, 57, 512, 14);
  ctx.fillRect(0, 90, 512, 14);

  // Lateral sipes & rib blocks
  ctx.fillStyle = '#0d0d10';
  for (let x = 0; x < 512; x += 16) {
    ctx.fillRect(x, 4, 3, 20);
    ctx.fillRect(x + 8, 38, 3, 19);
    ctx.fillRect(x, 71, 3, 19);
    ctx.fillRect(x + 8, 104, 3, 20);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(4, 1);
  texture.needsUpdate = true;
  return texture;
};

export default function VehicleAnimation3D({
  wheelCount,
  selectedWheelId,
  onWheelClick,
  getTireForWheel,
  wheelConfig,
  category,
  onDropTireToWheel,
  onRemoveTireFromWheel,
  onReturnBorrowedTire,
  draggedTireId,
  touchCoords,
  onTargetWheelChange
}: VehicleAnimation3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const wheelsMeshMap = useRef<Map<string, THREE.Group>>(new Map());
  const animationFrameId = useRef<number | null>(null);

  // Map data koordinat & metadata roda
  const wheelCoordsMapRef = useRef<Map<string, WheelCoord>>(new Map());

  // Synchronized refs for 60fps render loop
  const selectedWheelIdRef = useRef<string | null>(selectedWheelId);
  useEffect(() => {
    selectedWheelIdRef.current = selectedWheelId;
  }, [selectedWheelId]);

  const getTireForWheelRef = useRef(getTireForWheel);
  useEffect(() => {
    getTireForWheelRef.current = getTireForWheel;
  }, [getTireForWheel]);

  const onWheelClickRef = useRef(onWheelClick);
  useEffect(() => {
    onWheelClickRef.current = onWheelClick;
  }, [onWheelClick]);

  const onDropTireToWheelRef = useRef(onDropTireToWheel);
  useEffect(() => {
    onDropTireToWheelRef.current = onDropTireToWheel;
  }, [onDropTireToWheel]);

  const touchCoordsRef = useRef(touchCoords);
  useEffect(() => {
    touchCoordsRef.current = touchCoords;
  }, [touchCoords]);

  // Status Auto Rotate & Rolling Dyno Test
  const [isAutoRotate, setIsAutoRotate] = useState<boolean>(false);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const isRollingRef = useRef<boolean>(false);
  useEffect(() => {
    isRollingRef.current = isRolling;
  }, [isRolling]);

  // Mode Pisahkan Roda Ganda (Exploded Dual Wheels View)
  const [isDualSeparated, setIsDualSeparated] = useState<boolean>(false);
  const isDualSeparatedRef = useRef<boolean>(false);
  useEffect(() => {
    isDualSeparatedRef.current = isDualSeparated;
  }, [isDualSeparated]);

  const [cameraView, setCameraView] = useState<'perspective' | 'top' | 'side' | 'dualFocus'>('perspective');

  // State Modal Detail Data Ban yang Terpasang
  const [detailModalTire, setDetailModalTire] = useState<{ tire: StockBanItem; wheelId: string } | null>(null);

  // State & Ref untuk Drag and Drop langsung ke 3D canvas
  const [dndHoverWheelId, setDndHoverWheelId] = useState<string | null>(null);
  const dndHoverWheelIdRef = useRef<string | null>(null);
  const [isCanvasDragOver, setIsCanvasDragOver] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);

  useEffect(() => {
    isDraggingRef.current = Boolean(isCanvasDragOver || draggedTireId || touchCoords);
  }, [isCanvasDragOver, draggedTireId, touchCoords]);

  const setDndTarget = (id: string | null) => {
    dndHoverWheelIdRef.current = id;
    setDndHoverWheelId(id);
  };

  // Transisi Animasi Kamera Halus (Cinematic Lerp)
  const cameraTransitionRef = useRef<{
    active: boolean;
    startPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    targetTarget: THREE.Vector3;
    progress: number;
  } | null>(null);

  const triggerCameraTransition = (targetPos: THREE.Vector3, targetLookAt: THREE.Vector3) => {
    if (!cameraRef.current || !controlsRef.current) return;
    setIsAutoRotate(false);
    cameraTransitionRef.current = {
      active: true,
      startPos: cameraRef.current.position.clone(),
      targetPos: targetPos.clone(),
      startTarget: controlsRef.current.target.clone(),
      targetTarget: targetLookAt.clone(),
      progress: 0
    };
  };

  // Animasi Pasang Ban (Mounting Slide-in & Flash Shockwave)
  const mountingAnims = useRef<Map<string, { startTime: number; duration: number }>>(new Map());



  // ── BANGUN KOORDINAT RODA SESUAI JUMLAH RODA ──
  const wheelCoords = useMemo(() => {
    let list: WheelCoord[] = [];
    if (wheelCount === 4) {
      list = [
        { id: 'w1', x: -0.9, y: 0.45, z: 1.1, side: 'L', axleGroup: 'Depan' },
        { id: 'w2', x: 0.9, y: 0.45, z: 1.1, side: 'R', axleGroup: 'Depan' },
        { id: 'w3', x: -0.85, y: 0.4, z: -1.0, side: 'L', axleGroup: 'Belakang' },
        { id: 'w4', x: 0.85, y: 0.4, z: -1.0, side: 'R', axleGroup: 'Belakang' }
      ];
    } else if (wheelCount === 6) {
      list = [
        { id: 'w1', x: -1.15, y: 0.52, z: 2.1, side: 'L', isDual: false, axleGroup: 'Depan' },
        { id: 'w2', x: 1.15, y: 0.52, z: 2.1, side: 'R', isDual: false, axleGroup: 'Depan' },
        { id: 'w3', x: -1.36, y: 0.52, z: -1.7, side: 'L', isDual: true, isOuter: true, partnerId: 'w4', axleGroup: 'Belakang' },
        { id: 'w4', x: -1.04, y: 0.52, z: -1.7, side: 'L', isDual: true, isInner: true, partnerId: 'w3', axleGroup: 'Belakang' },
        { id: 'w5', x: 1.04, y: 0.52, z: -1.7, side: 'R', isDual: true, isInner: true, partnerId: 'w6', axleGroup: 'Belakang' },
        { id: 'w6', x: 1.36, y: 0.52, z: -1.7, side: 'R', isDual: true, isOuter: true, partnerId: 'w5', axleGroup: 'Belakang' }
      ];
    } else if (wheelCount === 8) {
      list = [
        { id: 'w1', x: -1.36, y: 0.52, z: -1.4, side: 'L', isDual: true, isOuter: true, partnerId: 'w2', axleGroup: 'G1' },
        { id: 'w2', x: -1.04, y: 0.52, z: -1.4, side: 'L', isDual: true, isInner: true, partnerId: 'w1', axleGroup: 'G1' },
        { id: 'w3', x: 1.04, y: 0.52, z: -1.4, side: 'R', isDual: true, isInner: true, partnerId: 'w4', axleGroup: 'G1' },
        { id: 'w4', x: 1.36, y: 0.52, z: -1.4, side: 'R', isDual: true, isOuter: true, partnerId: 'w3', axleGroup: 'G1' },
        { id: 'w5', x: -1.36, y: 0.52, z: -2.8, side: 'L', isDual: true, isOuter: true, partnerId: 'w6', axleGroup: 'G2' },
        { id: 'w6', x: -1.04, y: 0.52, z: -2.8, side: 'L', isDual: true, isInner: true, partnerId: 'w5', axleGroup: 'G2' },
        { id: 'w7', x: 1.04, y: 0.52, z: -2.8, side: 'R', isDual: true, isInner: true, partnerId: 'w8', axleGroup: 'G2' },
        { id: 'w8', x: 1.36, y: 0.52, z: -2.8, side: 'R', isDual: true, isOuter: true, partnerId: 'w7', axleGroup: 'G2' }
      ];
    } else {
      list = [
        { id: 'w1', x: -1.36, y: 0.52, z: -1.9, side: 'L', isDual: true, isOuter: true, partnerId: 'w2', axleGroup: 'G1' },
        { id: 'w2', x: -1.04, y: 0.52, z: -1.9, side: 'L', isDual: true, isInner: true, partnerId: 'w1', axleGroup: 'G1' },
        { id: 'w3', x: 1.04, y: 0.52, z: -1.9, side: 'R', isDual: true, isInner: true, partnerId: 'w4', axleGroup: 'G1' },
        { id: 'w4', x: 1.36, y: 0.52, z: -1.9, side: 'R', isDual: true, isOuter: true, partnerId: 'w3', axleGroup: 'G1' },
        { id: 'w5', x: -1.36, y: 0.52, z: -3.3, side: 'L', isDual: true, isOuter: true, partnerId: 'w6', axleGroup: 'G2' },
        { id: 'w6', x: -1.04, y: 0.52, z: -3.3, side: 'L', isDual: true, isInner: true, partnerId: 'w5', axleGroup: 'G2' },
        { id: 'w7', x: 1.04, y: 0.52, z: -3.3, side: 'R', isDual: true, isInner: true, partnerId: 'w8', axleGroup: 'G2' },
        { id: 'w8', x: 1.36, y: 0.52, z: -3.3, side: 'R', isDual: true, isOuter: true, partnerId: 'w7', axleGroup: 'G2' },
        { id: 'w9', x: -1.36, y: 0.52, z: -4.7, side: 'L', isDual: true, isOuter: true, partnerId: 'w10', axleGroup: 'G3' },
        { id: 'w10', x: -1.04, y: 0.52, z: -4.7, side: 'L', isDual: true, isInner: true, partnerId: 'w9', axleGroup: 'G3' },
        { id: 'w11', x: 1.04, y: 0.52, z: -4.7, side: 'R', isDual: true, isInner: true, partnerId: 'w12', axleGroup: 'G3' },
        { id: 'w12', x: 1.36, y: 0.52, z: -4.7, side: 'R', isDual: true, isOuter: true, partnerId: 'w11', axleGroup: 'G3' }
      ];
    }
    const map = new Map<string, WheelCoord>();
    list.forEach((c) => map.set(c.id, c));
    wheelCoordsMapRef.current = map;
    return list;
  }, [wheelCount]);

  // Kelompok Roda untuk Ribbon Navigasi Cepat
  const axleGroups = useMemo(() => {
    const groups: { label: string; wheels: WheelCoord[] }[] = [];
    wheelCoords.forEach((w) => {
      let g = groups.find((grp) => grp.label === w.axleGroup);
      if (!g) {
        g = { label: w.axleGroup, wheels: [] };
        groups.push(g);
      }
      g.wheels.push(w);
    });
    return groups;
  }, [wheelCoords]);

  // Setup Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const width = container.clientWidth || 360;
    const height = container.clientHeight || Math.min(Math.max(window.innerHeight * 0.54, 360), 500);

    // 1. Renderer (High Fidelity, Vivid Lighting)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.Fog(0x0a0f1d, 22, 45);
    sceneRef.current = scene;

    // 3. Camera
    const presets = getVehicleCameraPreset(wheelCount);
    const isMobile = width < 500;
    const fov = isMobile ? 48 : 40;
    const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 100);
    camera.position.copy(presets.perspective);
    camera.lookAt(presets.target);
    cameraRef.current = camera;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 3.0;
    controls.maxDistance = getMaxCameraDistance(wheelCount);
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minPolarAngle = 0.05;
    controls.target.copy(presets.target);
    controls.autoRotate = false;
    controls.autoRotateSpeed = 1.2;
    controlsRef.current = controls;

    // 5. Pencahayaan Studio Automotive
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x0f172a, 1.2);
    hemiLight.position.set(0, 24, 0);
    scene.add(hemiLight);

    const mainSun = new THREE.DirectionalLight(0xffffff, 2.5);
    mainSun.position.set(9, 18, 11);
    mainSun.castShadow = true;
    mainSun.shadow.mapSize.width = 2048;
    mainSun.shadow.mapSize.height = 2048;
    mainSun.shadow.bias = -0.0003;
    scene.add(mainSun);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 1.5);
    rimLight.position.set(-11, 9, -7);
    scene.add(rimLight);

    const frontFillLight = new THREE.DirectionalLight(0xffffff, 1.1);
    frontFillLight.position.set(0, 5, 12);
    scene.add(frontFillLight);

    // 6. LINGKUNGAN BENGKEL
    const baseFloorGeo = new THREE.PlaneGeometry(120, 120);
    const baseFloorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.92,
      metalness: 0.08,
    });
    const baseFloorMesh = new THREE.Mesh(baseFloorGeo, baseFloorMat);
    baseFloorMesh.rotation.x = -Math.PI / 2;
    baseFloorMesh.position.set(0, -0.015, 0);
    baseFloorMesh.receiveShadow = true;
    scene.add(baseFloorMesh);

    const floorTexture = createWorkshopFloorTexture();
    floorTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const floorGeo = new THREE.PlaneGeometry(36, 46);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.36,
      metalness: 0.24,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, -0.005, 0);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Dyno Rollers
    const rollerMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.88, roughness: 0.22 });
    const rollerHousingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.4 });
    const dynoRollers: THREE.Mesh[] = [];

    const rollerZPositions = wheelCount === 4
      ? [1.05, -0.95]
      : wheelCount === 6
        ? [1.6, -1.7]
        : wheelCount === 8
          ? [-1.4, -2.8]
          : [-1.9, -3.3, -4.7];

    rollerZPositions.forEach((rz) => {
      [-1.25, 1.25].forEach((rx) => {
        const housing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.85), rollerHousingMat);
        housing.position.set(rx, 0.01, rz);
        scene.add(housing);

        [-0.24, 0.24].forEach((offsetZ) => {
          const rollerGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.78, 20);
          rollerGeo.rotateZ(Math.PI / 2);
          const rollerMesh = new THREE.Mesh(rollerGeo, rollerMat);
          rollerMesh.position.set(rx, 0.04, rz + offsetZ);
          rollerMesh.castShadow = true;
          scene.add(rollerMesh);
          dynoRollers.push(rollerMesh);
        });
      });
    });

    // Rangka Atap Kuda-Kuda
    const ceilingGroup = new THREE.Group();
    scene.add(ceilingGroup);
    const steelBeamMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.35 });

    for (let tz = -16; tz <= 16; tz += 10.6) {
      const truss = new THREE.Mesh(new THREE.BoxGeometry(35, 0.4, 0.35), steelBeamMat);
      truss.position.set(0, 11.5, tz);
      ceilingGroup.add(truss);
    }

    [-6.5, 6.5].forEach((lx) => {
      [-8, 8].forEach((lz) => {
        const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 8.5), steelBeamMat);
        fixture.position.set(lx, 11.2, lz);
        ceilingGroup.add(fixture);

        const tube = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, 0.05, 8.2),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        tube.position.set(lx, 11.1, lz);
        ceilingGroup.add(tube);
      });
    });

    // ── KELOMPOK UTAMA KENDARAAN ──
    const vehicleGroup = new THREE.Group();
    scene.add(vehicleGroup);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.75, roughness: 0.3 });
    const crossmemberMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.82, roughness: 0.35 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });
    const twistlockMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.28 });
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.3 });

    const createBox = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, castShadow = true) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      vehicleGroup.add(mesh);
      return mesh;
    };

    const createCylinder = (rt: number, rb: number, h: number, seg: number, mat: THREE.Material, x: number, y: number, z: number, rx = 0, rz = 0) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
      mesh.position.set(x, y, z);
      mesh.rotation.x = rx;
      mesh.rotation.z = rz;
      mesh.castShadow = true;
      vehicleGroup.add(mesh);
      return mesh;
    };

    // Variabel komponen bergerak
    let driveshaftMesh: THREE.Mesh | null = null;
    let mudflapLeft: THREE.Mesh | null = null;
    let mudflapRight: THREE.Mesh | null = null;

    if (wheelCount === 4) {
      // Forklift
      const forkliftBodyMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.5, roughness: 0.3 });
      createBox(1.5, 0.9, 2.2, forkliftBodyMat, 0, 0.8, 0);
      createBox(1.5, 0.8, 0.7, new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 }), 0, 0.75, -1.2);
      createBox(1.3, 1.4, 1.3, frameMat, 0, 1.9, -0.2);
      createBox(0.12, 2.6, 0.12, chromeMat, -0.55, 1.5, 1.25);
      createBox(0.12, 2.6, 0.12, chromeMat, 0.55, 1.5, 1.25);
      createBox(0.14, 0.05, 1.4, chromeMat, -0.35, 0.2, 1.9);
      createBox(0.14, 0.05, 1.4, chromeMat, 0.35, 0.2, 1.9);
    } else if (wheelCount === 6) {
      // TRACTOR HEAD PRIME MOVER
      const thCabWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.18, roughness: 0.2 });
      const thCabBlueMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.35, roughness: 0.22 });
      const thNavyStripeMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.45, roughness: 0.18 });
      const thTrimMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.4 });
      const thGrilleMat = new THREE.MeshStandardMaterial({ color: 0x0b0f19, metalness: 0.9, roughness: 0.2 });
      const thGlassMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, metalness: 0.92, roughness: 0.06, transparent: true, opacity: 0.82 });
      const thFifthWheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.94, roughness: 0.2 });
      const thDeckMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.25 });

      // Sasis Utama
      createBox(0.18, 0.34, 6.2, frameMat, -0.48, 0.75, 0);
      createBox(0.18, 0.34, 6.2, frameMat, 0.48, 0.75, 0);
      createBox(1.72, 0.04, 1.25, thDeckMat, 0, 0.93, 0.25);
      for (let z = -2.4; z <= 2.4; z += 1.2) {
        createBox(0.9, 0.14, 0.14, crossmemberMat, 0, 0.75, z);
      }
      createBox(2.14, 0.18, 0.12, thCabBlueMat, 0, 0.65, -2.95);
      createBox(0.44, 0.12, 0.04, new THREE.MeshBasicMaterial({ color: 0xef4444 }), -0.76, 0.66, -3.02);
      createBox(0.44, 0.12, 0.04, new THREE.MeshBasicMaterial({ color: 0xef4444 }), 0.76, 0.66, -3.02);
      createBox(0.12, 0.12, 0.04, new THREE.MeshBasicMaterial({ color: 0xf59e0b }), -0.46, 0.66, -3.02);
      createBox(0.12, 0.12, 0.04, new THREE.MeshBasicMaterial({ color: 0xf59e0b }), 0.46, 0.66, -3.02);

      // Kabin Depan
      createBox(2.26, 0.42, 2.15, thCabBlueMat, 0, 1.12, 1.78);
      createBox(2.24, 0.62, 2.05, thCabBlueMat, 0, 1.58, 1.74);
      createBox(2.18, 0.88, 1.95, thCabWhiteMat, 0, 2.18, 1.68);
      createBox(2.20, 0.08, 1.96, thNavyStripeMat, 0, 1.88, 1.68);
      createBox(2.20, 0.04, 1.82, thCabBlueMat, 0, 1.98, 1.68);

      const roofFairing = createBox(2.12, 0.52, 1.84, thCabWhiteMat, 0, 2.76, 1.62);
      roofFairing.rotation.x = -0.07;
      createBox(0.05, 0.64, 0.68, thCabWhiteMat, -1.07, 2.72, 0.95);
      createBox(0.05, 0.64, 0.68, thCabWhiteMat, 1.07, 2.72, 0.95);

      for (let lx = -0.75; lx <= 0.75; lx += 0.38) {
        createBox(0.08, 0.03, 0.06, new THREE.MeshBasicMaterial({ color: 0xfbbf24 }), lx, 3.02, 2.38);
      }

      const leftVane = createBox(0.06, 1.12, 0.28, thCabBlueMat, -1.14, 1.72, 2.65);
      leftVane.rotation.y = 0.18;
      const rightVane = createBox(0.06, 1.12, 0.28, thCabBlueMat, 1.14, 1.72, 2.65);
      rightVane.rotation.y = -0.18;

      createBox(0.05, 1.75, 0.48, thCabBlueMat, -1.10, 2.12, 0.64);
      createBox(0.05, 1.75, 0.48, thCabBlueMat, 1.10, 2.12, 0.64);

      const windshield = createBox(2.04, 0.98, 0.08, thGlassMat, 0, 2.26, 2.68);
      windshield.rotation.x = -0.18;
      const windshieldFrame = createBox(2.08, 0.04, 0.10, thTrimMat, 0, 1.78, 2.78);
      windshieldFrame.rotation.x = -0.18;

      const sunvisor = createBox(2.16, 0.18, 0.32, thCabBlueMat, 0, 2.74, 2.74);
      sunvisor.rotation.x = -0.22;
      createBox(1.65, 0.02, 0.04, new THREE.MeshBasicMaterial({ color: 0xe0f2fe }), 0, 2.76, 2.88);

      createBox(0.62, 0.03, 0.02, thTrimMat, -0.42, 1.84, 2.72);
      createBox(0.62, 0.03, 0.02, thTrimMat, 0.42, 1.84, 2.72);

      createBox(0.06, 0.68, 1.05, thGlassMat, -1.10, 2.22, 1.86);
      createBox(0.06, 0.68, 1.05, thGlassMat, 1.10, 2.22, 1.86);

      // Spion West-Coast
      createBox(0.10, 0.58, 0.16, thCabBlueMat, -1.32, 2.22, 2.48);
      createBox(0.02, 0.52, 0.12, chromeMat, -1.27, 2.22, 2.46);
      createBox(0.10, 0.58, 0.16, thCabBlueMat, 1.32, 2.22, 2.48);
      createBox(0.02, 0.52, 0.12, chromeMat, 1.27, 2.22, 2.46);

      // Grille Radiator Chrome Bertingkat
      createBox(1.72, 0.74, 0.08, thGrilleMat, 0, 1.48, 2.76);
      createBox(1.52, 0.09, 0.05, chromeMat, 0, 1.72, 2.80);
      createBox(1.62, 0.09, 0.05, chromeMat, 0, 1.52, 2.81);
      createBox(1.68, 0.09, 0.05, chromeMat, 0, 1.32, 2.82);
      createBox(0.24, 0.20, 0.07, chromeMat, 0, 1.52, 2.84);

      // Bumper Depan & Headlights
      createBox(2.34, 0.44, 0.34, thCabBlueMat, 0, 0.72, 2.86);
      createBox(1.62, 0.11, 0.26, chromeMat, 0, 0.46, 2.88);

      [-0.92, 0.92].forEach((lx) => {
        createBox(0.36, 0.20, 0.08, chromeMat, lx, 0.74, 3.02);
        createBox(0.30, 0.04, 0.02, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }), lx, 0.81, 3.07);
        createBox(0.12, 0.12, 0.02, new THREE.MeshBasicMaterial({ color: 0xffffff }), lx > 0 ? lx + 0.04 : lx - 0.04, 0.72, 3.07);
        createBox(0.08, 0.08, 0.02, new THREE.MeshBasicMaterial({ color: 0xf59e0b }), lx > 0 ? lx - 0.1 : lx + 0.1, 0.72, 3.07);
      });

      // Twin Chrome Vertical Exhaust Stacks
      createCylinder(0.065, 0.065, 2.5, 16, chromeMat, 0.84, 2.45, 0.58);
      createCylinder(0.11, 0.11, 1.2, 16, chromeMat, 0.84, 1.85, 0.58);
      createCylinder(0.065, 0.065, 2.5, 16, chromeMat, -0.84, 2.45, 0.58);
      createCylinder(0.11, 0.11, 1.2, 16, chromeMat, -0.84, 1.85, 0.58);

      // Driveshaft Berputar (Mechanical Driveshaft)
      driveshaftMesh = createCylinder(0.045, 0.045, 2.3, 12, chromeMat, 0, 0.52, -0.55, Math.PI / 2);

      // Fifth Wheel
      createBox(1.20, 0.16, 0.62, thTrimMat, 0, 0.93, -1.6);
      const fifthWheelPlate = createCylinder(0.58, 0.58, 0.10, 28, thFifthWheelMat, 0, 1.05, -1.6);
      fifthWheelPlate.rotation.x = 0.08;

      // Tangki Solar Aluminium Kiri & Kanan
      createCylinder(0.36, 0.36, 1.75, 24, chromeMat, -0.98, 0.68, 0.25, Math.PI / 2);
      createCylinder(0.36, 0.36, 1.75, 24, chromeMat, 0.98, 0.68, 0.25, Math.PI / 2);

      // Spakbor & Mudflaps Belakang
      createBox(0.74, 0.06, 1.35, thCabBlueMat, -1.36, 1.14, -1.7);
      mudflapLeft = createBox(0.70, 0.36, 0.04, new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 }), -1.36, 0.78, -2.35);
      mudflapLeft.rotation.x = -0.15;

      createBox(0.74, 0.06, 1.35, thCabBlueMat, 1.36, 1.14, -1.7);
      mudflapRight = createBox(0.70, 0.36, 0.04, new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 }), 1.36, 0.78, -2.35);
      mudflapRight.rotation.x = -0.15;
    } else if (wheelCount === 8) {
      // 8 Roda
      createBox(0.18, 0.36, 7.8, frameMat, -0.65, 0.82, 0);
      createBox(0.18, 0.36, 7.8, frameMat, 0.65, 0.82, 0);
      for (let z = -3.2; z <= 3.2; z += 1.4) {
        createBox(1.4, 0.16, 0.16, crossmemberMat, 0, 0.82, z);
      }
      createBox(0.26, 0.22, 0.26, twistlockMat, -1.15, 0.98, 3.7);
      createBox(0.26, 0.22, 0.26, twistlockMat, 1.15, 0.98, 3.7);
      createBox(0.26, 0.22, 0.26, twistlockMat, -1.15, 0.98, -3.7);
      createBox(0.26, 0.22, 0.26, twistlockMat, 1.15, 0.98, -3.7);
      createBox(2.2, 0.22, 0.12, hazardMat, 0, 0.65, -3.85);
    } else if (wheelCount === 12) {
      // 12 Roda
      createBox(0.18, 0.36, 11.2, frameMat, -0.65, 0.82, 0);
      createBox(0.18, 0.36, 11.2, frameMat, 0.65, 0.82, 0);
      for (let z = -4.8; z <= 4.8; z += 1.5) {
        createBox(1.4, 0.16, 0.16, crossmemberMat, 0, 0.82, z);
      }
      createBox(0.26, 0.22, 0.26, twistlockMat, -1.15, 0.98, 5.4);
      createBox(0.26, 0.22, 0.26, twistlockMat, 1.15, 0.98, 5.4);
      createBox(0.26, 0.22, 0.26, twistlockMat, -1.15, 0.98, -5.4);
      createBox(0.26, 0.22, 0.26, twistlockMat, 1.15, 0.98, -5.4);
      createBox(2.2, 0.22, 0.12, hazardMat, 0, 0.65, -5.55);
    }

    // ── SIMULASI ASAP KNALPOT DIESEL REALISTIS (EXHAUST SMOKE SYSTEM) ──
    const smokeParticles: Array<{
      mesh: THREE.Mesh;
      vx: number;
      vy: number;
      vz: number;
      baseX: number;
      baseY: number;
      baseZ: number;
      life: number;
      maxLife: number;
    }> = [];

    if (wheelCount === 6) {
      const smokeGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const smokeBaseMat = new THREE.MeshBasicMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.2,
        depthWrite: false
      });

      [-0.84, 0.84].forEach((exX) => {
        for (let i = 0; i < 12; i++) {
          const sMesh = new THREE.Mesh(smokeGeo, smokeBaseMat.clone());
          sMesh.position.set(exX, 3.2, 0.58);
          scene.add(sMesh);
          smokeParticles.push({
            mesh: sMesh,
            vx: (Math.random() - 0.5) * 0.08,
            vy: 0.35 + Math.random() * 0.25,
            vz: -0.2 - Math.random() * 0.15,
            baseX: exX,
            baseY: 3.2,
            baseZ: 0.58,
            life: Math.random() * 1.5,
            maxLife: 1.4 + Math.random() * 0.8
          });
        }
      });
    }

    // ── BANGUN GEOMETRI BAN 3D & POSISI RODA REALISTIS ──
    wheelsMeshMap.current.clear();

    const tireRadius = 0.52;
    const tireWidth = 0.26;

    const treadTexture = createTireTreadTexture();
    const tireRubberMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      map: treadTexture || undefined,
      roughness: 0.88,
      metalness: 0.12
    });

    const rimAlloyMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.18
    });

    // Poros Gandar (Axles)
    const distinctAxleZ = Array.from(new Set(wheelCoords.map((c) => c.z)));
    distinctAxleZ.forEach((zVal) => {
      createCylinder(0.08, 0.08, 2.6, 16, frameMat, 0, 0.52, zVal, 0, Math.PI / 2);
      if (wheelCount === 6 && zVal < 0) {
        createCylinder(0.24, 0.24, 0.35, 16, new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 }), 0, 0.52, zVal, Math.PI / 2);
      }
    });

    // Buat Mesh untuk Setiap Roda
    wheelCoords.forEach((coord) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(coord.x, coord.y, coord.z);
      wheelGroup.userData = { wheelId: coord.id, baseCoord: coord };

      // 1. Karet Ban
      const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 32);
      tireGeo.rotateZ(Math.PI / 2);
      const tireMesh = new THREE.Mesh(tireGeo, tireRubberMat.clone());
      tireMesh.name = 'tireMesh';
      tireMesh.castShadow = true;
      tireMesh.userData = { wheelId: coord.id, isTire: true };
      wheelGroup.add(tireMesh);

      // Alur Ring Tapak Ban
      const treadRingGeo = new THREE.CylinderGeometry(tireRadius + 0.006, tireRadius + 0.006, tireWidth * 0.78, 32, 2, true);
      treadRingGeo.rotateZ(Math.PI / 2);
      const treadMesh = new THREE.Mesh(treadRingGeo, new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.95, wireframe: true }));
      treadMesh.name = 'treadMesh';
      wheelGroup.add(treadMesh);

      // Velg Alloy Perak
      const rimGeo = new THREE.CylinderGeometry(tireRadius * 0.62, tireRadius * 0.62, tireWidth + 0.012, 24);
      rimGeo.rotateZ(Math.PI / 2);
      const rimMesh = new THREE.Mesh(rimGeo, rimAlloyMat.clone());
      rimMesh.name = 'rimMesh';
      rimMesh.userData = { wheelId: coord.id, isRim: true };
      wheelGroup.add(rimMesh);

      // Mur Roda Chrome 10-Lug
      const lugGroup = new THREE.Group();
      lugGroup.name = 'lugGroup';
      for (let b = 0; b < 10; b++) {
        const ang = (b / 10) * Math.PI * 2;
        const by = Math.sin(ang) * (tireRadius * 0.35);
        const bz = Math.cos(ang) * (tireRadius * 0.35);
        const lug = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, tireWidth + 0.035, 8),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.95, roughness: 0.1 })
        );
        lug.rotateZ(Math.PI / 2);
        lug.position.set(0, by, bz);
        lugGroup.add(lug);
      }
      wheelGroup.add(lugGroup);

      // Center Planetary Hubcap
      const hubGeo = new THREE.CylinderGeometry(0.14, 0.14, tireWidth + 0.038, 18);
      hubGeo.rotateZ(Math.PI / 2);
      const hubMesh = new THREE.Mesh(hubGeo, new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.9, roughness: 0.2 }));
      hubMesh.name = 'hubMesh';
      wheelGroup.add(hubMesh);

      // 2. KOMPONEN KETIKA BAN BELUM TERPASANG (DUDUKAN HUB / ROTOR REM)
      // Ghost Blueprint Hologram dengan warna Biru & Ungu yang Sangat Tegas & Menyala
      const ghostTireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 32);
      ghostTireGeo.rotateZ(Math.PI / 2);
      const ghostTireMesh = new THREE.Mesh(
        ghostTireGeo,
        new THREE.MeshStandardMaterial({
          color: coord.isInner ? 0x9333ea : 0x0284c7,
          emissive: coord.isInner ? 0xa855f7 : 0x0ea5e9,
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 0.28,
          roughness: 0.2,
          metalness: 0.2,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      ghostTireMesh.name = 'ghostTireMesh';
      ghostTireMesh.userData = { wheelId: coord.id };
      wheelGroup.add(ghostTireMesh);

      const ghostEdges = new THREE.EdgesGeometry(ghostTireGeo, 25);
      const ghostLine = new THREE.LineSegments(
        ghostEdges,
        new THREE.LineBasicMaterial({
          color: coord.isInner ? 0xd946ef : 0x00f0ff,
          transparent: true,
          opacity: 0.85
        })
      );
      ghostLine.name = 'ghostLine';
      ghostLine.userData = { wheelId: coord.id };
      wheelGroup.add(ghostLine);

      // Neon Torus Rings Tebal di Sisi Luar & Dalam Ban Kosong agar Siluet Biru/Ungu Sangat Tajam & Terbaca Jelas
      const ringGeo = new THREE.TorusGeometry(tireRadius, 0.016, 12, 36);
      ringGeo.rotateY(Math.PI / 2);

      const ringMat = new THREE.MeshStandardMaterial({
        color: coord.isInner ? 0xd946ef : 0x00f0ff,
        emissive: coord.isInner ? 0xa855f7 : 0x0284c7,
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.85,
        roughness: 0.15,
        metalness: 0.2,
        depthWrite: false
      });

      const ringOuter = new THREE.Mesh(ringGeo, ringMat);
      ringOuter.name = 'ghostRingOuter';
      ringOuter.position.x = tireWidth / 2;
      ringOuter.userData = { wheelId: coord.id };
      wheelGroup.add(ringOuter);

      const ringInner = new THREE.Mesh(ringGeo, ringMat.clone());
      ringInner.name = 'ghostRingInner';
      ringInner.position.x = -tireWidth / 2;
      ringInner.userData = { wheelId: coord.id };
      wheelGroup.add(ringInner);

      // Ventilated Brake Rotor & Caliper
      const drumGeo = new THREE.CylinderGeometry(tireRadius * 0.52, tireRadius * 0.52, tireWidth * 0.65, 28);
      drumGeo.rotateZ(Math.PI / 2);
      const brakeDrum = new THREE.Mesh(drumGeo, new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.88, roughness: 0.28 }));
      brakeDrum.name = 'brakeDrum';
      brakeDrum.castShadow = true;
      brakeDrum.userData = { wheelId: coord.id, isDrum: true };
      wheelGroup.add(brakeDrum);

      const caliperGeo = new THREE.BoxGeometry(tireWidth * 0.68, 0.18, 0.24);
      const caliperMesh = new THREE.Mesh(caliperGeo, new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.38, metalness: 0.65 }));
      caliperMesh.name = 'brakeCaliper';
      caliperMesh.position.set(0, tireRadius * 0.34, 0);
      wheelGroup.add(caliperMesh);

      const studsGeo = new THREE.CylinderGeometry(0.13, 0.13, tireWidth * 0.82, 16);
      studsGeo.rotateZ(Math.PI / 2);
      const studsMesh = new THREE.Mesh(studsGeo, new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 }));
      studsMesh.name = 'studsMesh';
      wheelGroup.add(studsMesh);

      // 3. SELECTION / DROP HALO
      const haloGeo = new THREE.RingGeometry(tireRadius * 1.06, tireRadius * 1.2, 32);
      haloGeo.rotateY(Math.PI / 2);
      const haloMesh = new THREE.Mesh(
        haloGeo,
        new THREE.MeshBasicMaterial({
          color: coord.isInner ? 0xa855f7 : 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85
        })
      );
      haloMesh.name = 'selectionHalo';
      haloMesh.userData = { wheelId: coord.id };
      haloMesh.visible = false;
      wheelGroup.add(haloMesh);

      // 4. HIT TARGET RAYCASTER PRESISI TINGGI
      // Roda luar dan roda dalam memiliki hit target terukur agar tidak bertubrukan
      const hitRadius = tireRadius * 1.15;
      const hitWidth = tireWidth * 1.05;
      const hitGeo = new THREE.CylinderGeometry(hitRadius, hitRadius, hitWidth, 16);
      hitGeo.rotateZ(Math.PI / 2);
      const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.name = 'hitMesh';
      hitMesh.userData = { wheelId: coord.id, isHitTarget: true, isInner: Boolean(coord.isInner), isOuter: Boolean(coord.isOuter) };
      wheelGroup.add(hitMesh);

      // Untuk Roda DALAM (Inner Wheel), pasang flange penangkap ekstra ke arah sasis & atas
      // sehingga pengguna sangat mudah mengklik atau drag ban ke posisi dalam tanpa terhalang roda luar
      if (coord.isInner) {
        const innerFlangeGeo = new THREE.CylinderGeometry(hitRadius * 1.15, hitRadius * 1.15, hitWidth * 1.35, 16);
        innerFlangeGeo.rotateZ(Math.PI / 2);
        const innerFlangeMesh = new THREE.Mesh(innerFlangeGeo, hitMat.clone());
        innerFlangeMesh.name = 'innerFlangeMesh';
        innerFlangeMesh.userData = { wheelId: coord.id, isHitTarget: true, isInnerCapture: true };
        innerFlangeMesh.position.x = coord.side === 'L' ? 0.08 : -0.08;
        wheelGroup.add(innerFlangeMesh);
      }

      vehicleGroup.add(wheelGroup);
      wheelsMeshMap.current.set(coord.id, wheelGroup);
    });

    // ── RAYCASTER UNTUK INTERAKSI KLIK & HOVER PADA BAN ──
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let pointerDownPos: { x: number; y: number } | null = null;
    let pointerDownTime = 0;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      pointerDownPos = { x: event.clientX, y: event.clientY };
      pointerDownTime = Date.now();
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!pointerDownPos) return;
      if (event.button !== 0 && event.pointerType === 'mouse') return;

      const dist = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
      const elapsed = Date.now() - pointerDownTime;
      pointerDownPos = null;

      if (dist > 8 || elapsed > 300) return;
      if (touchCoordsRef.current || dndHoverWheelIdRef.current) return;

      const hitWheelId = getWheelAtCoordsInternal(event.clientX, event.clientY);
      if (hitWheelId) {
        const tire = getTireForWheelRef.current(hitWheelId);
        onWheelClickRef.current?.(hitWheelId, tire);
        if (tire) {
          setDetailModalTire({ tire, wheelId: hitWheelId });
        }
      }
    };

    const handlePointerCancel = () => {
      pointerDownPos = null;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const hitWheelId = getWheelAtCoordsInternal(event.clientX, event.clientY);
      if (hitWheelId) {
        renderer.domElement.style.cursor = 'pointer';
      } else {
        renderer.domElement.style.cursor = 'default';
      }
    };

    // Smart Wheel Resolution Function
    const getWheelAtCoordsInternal = (clientX: number, clientY: number): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const targetMeshes: THREE.Object3D[] = [];
      wheelsMeshMap.current.forEach((grp) => {
        grp.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData.wheelId) {
            targetMeshes.push(child);
          }
        });
      });

      const intersects = raycaster.intersectObjects(targetMeshes, false);
      if (intersects.length > 0) {
        const hitWheelIds: string[] = [];
        for (const hit of intersects) {
          const wid = hit.object.userData.wheelId as string;
          if (wid && !hitWheelIds.includes(wid)) {
            hitWheelIds.push(wid);
          }
        }

        // Jika mengenai pasangan ganda (Roda Luar DAN Roda Dalam kena raycast sekaligus):
        for (const wid of hitWheelIds) {
          const info = wheelCoordsMapRef.current.get(wid);
          if (info?.isDual && info.partnerId && hitWheelIds.includes(info.partnerId)) {
            const outerId = info.isOuter ? wid : info.partnerId;
            const innerId = info.isInner ? wid : info.partnerId;
            const outerTire = getTireForWheelRef.current(outerId);
            const innerTire = getTireForWheelRef.current(innerId);

            // Jika sedang drag ban:
            if (isDraggingRef.current) {
              // Jika roda luar sudah terpasang & roda dalam kosong -> UTAMAKAN RODA DALAM!
              if (outerTire && !innerTire) return innerId;
              if (!outerTire && innerTire) return outerId;
            }

            // Bandingkan proyeksi posisi 2D kursor ke pusat roda di layar
            const sOuter = getWheelScreenPos(outerId);
            const sInner = getWheelScreenPos(innerId);
            const dOuter = Math.hypot(clientX - sOuter.x, clientY - sOuter.y);
            const dInner = Math.hypot(clientX - sInner.x, clientY - sInner.y);

            // Beri bobot +20px ke roda dalam agar sangat responsif dipilih
            return dInner <= dOuter + 20 ? innerId : outerId;
          }
        }

        return hitWheelIds[0];
      }

      // Fallback Proximity
      let closestWheelId: string | null = null;
      let minDistance = 140;
      for (const wId of wheelsMeshMap.current.keys()) {
        const sPos = getWheelScreenPos(wId);
        if (sPos.inFront) {
          let dist = Math.hypot(clientX - sPos.x, clientY - sPos.y);
          const info = wheelCoordsMapRef.current.get(wId);
          if (info?.isInner) dist -= 15;
          if (dist < minDistance) {
            minDistance = dist;
            closestWheelId = wId;
          }
        }
      }

      return closestWheelId;
    };

    const getWheelScreenPos = (wId: string) => {
      const grp = wheelsMeshMap.current.get(wId);
      if (!grp) return { x: -999, y: -999, inFront: false };
      const worldPos = new THREE.Vector3();
      grp.getWorldPosition(worldPos);
      worldPos.project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: ((worldPos.x + 1) * rect.width) / 2 + rect.left,
        y: ((-worldPos.y + 1) * rect.height) / 2 + rect.top,
        inFront: worldPos.z <= 1
      };
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointercancel', handlePointerCancel);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    // ── ANIMATION LOOP 60FPS ──
    let clock = new THREE.Clock();
    let currentSpeed = 0;

    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();

      // 1. Controls Update
      controls.update();

      if (camera.position.y > 10.2) camera.position.y = 10.2;
      if (camera.position.y < 0.25) camera.position.y = 0.25;

      const isViewingFromTop = camera.position.y > 4.5 && Math.abs(camera.position.x) < 2.5;
      ceilingGroup.visible = !isViewingFromTop;

      // 2. Smooth Cinematic Camera Transition Lerp
      if (cameraTransitionRef.current && cameraTransitionRef.current.active) {
        const t = cameraTransitionRef.current;
        t.progress += delta * 2.2;
        const p = Math.min(1, t.progress);
        const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        camera.position.lerpVectors(t.startPos, t.targetPos, ease);
        controls.target.lerpVectors(t.startTarget, t.targetTarget, ease);
        if (p >= 1) {
          t.active = false;
          cameraTransitionRef.current = null;
        }
      }

      // 3. Pemisahan Mekanikal Roda Ganda (Exploded Dual Separation)
      // Terjadi jika user menekan tombol Buka Roda Ganda, sedang drag ban, ATAU roda dalam sedang dipilih
      const isInnerSelected = selectedWheelIdRef.current
        ? wheelCoordsMapRef.current.get(selectedWheelIdRef.current)?.isInner
        : false;
      const shouldSeparate = isDualSeparatedRef.current || isDraggingRef.current || isInnerSelected;

      wheelsMeshMap.current.forEach((wheelGroup, wId) => {
        const coord = wheelCoordsMapRef.current.get(wId);
        if (coord && coord.isDual) {
          let targetX = coord.x;
          if (shouldSeparate) {
            if (coord.isOuter) {
              targetX += coord.side === 'L' ? -0.32 : 0.32;
            } else {
              targetX += coord.side === 'L' ? 0.08 : -0.08;
            }
          }
          wheelGroup.position.x = THREE.MathUtils.lerp(wheelGroup.position.x, targetX, delta * 12);
        }
      });

      // 4. Fisika Dinamis Mesin Diesel & Dyno Test Inertia
      const targetSpeed = isRollingRef.current ? 4.2 : 0.0;
      currentSpeed = THREE.MathUtils.damp(currentSpeed, targetSpeed, 3.5, delta);

      if (currentSpeed > 0.01) {
        const rollSpeed = (currentSpeed / tireRadius) * delta;

        // Putar roda
        wheelsMeshMap.current.forEach((wheelGroup) => {
          wheelGroup.children.forEach((child) => {
            if (
              child.name === 'tireMesh' ||
              child.name === 'treadMesh' ||
              child.name === 'rimMesh' ||
              child.name === 'lugGroup' ||
              child.name === 'hubMesh' ||
              child.name === 'brakeDrum' ||
              child.name === 'studsMesh'
            ) {
              child.rotation.x += rollSpeed;
            }
          });
        });

        // Putar dyno rollers
        dynoRollers.forEach((roller) => {
          roller.rotation.x += rollSpeed * 1.4;
        });

        // Putar driveshaft
        if (driveshaftMesh) {
          driveshaftMesh.rotation.z += rollSpeed * 2.2;
        }

        // Getaran dyno test & torsi mesin miring
        vehicleGroup.position.y = Math.sin(time * 18.0) * 0.008 + Math.cos(time * 26.0) * 0.004 - (currentSpeed / 4.2) * 0.006;
        vehicleGroup.rotation.z = (currentSpeed / 4.2) * 0.006 + Math.sin(time * 20.0) * 0.002;
      } else {
        // Idling Mesin Diesel Halus (Realistic Heavy Diesel Rumble Idle)
        vehicleGroup.position.y = Math.sin(time * 12.0) * 0.0022 + Math.cos(time * 6.0) * 0.0012;
        vehicleGroup.rotation.z = Math.sin(time * 14.0) * 0.0012;
      }

      // Ayunan mudflap
      if (mudflapLeft) mudflapLeft.rotation.x = -0.15 + Math.sin(time * 4.0) * 0.02;
      if (mudflapRight) mudflapRight.rotation.x = -0.15 + Math.sin(time * 4.0 + 1.0) * 0.02;

      // 5. Partikel Asap Knalpot Diesel (Rising Exhaust Smoke Puffs)
      const smokeSpeedMult = currentSpeed > 0.1 ? 1.8 + currentSpeed * 0.3 : 1.0;
      smokeParticles.forEach((p) => {
        p.life += delta * smokeSpeedMult;
        if (p.life >= p.maxLife) {
          p.life = 0;
          p.mesh.position.set(p.baseX, p.baseY, p.baseZ);
          p.mesh.scale.set(0.6, 0.6, 0.6);
        } else {
          const t = p.life / p.maxLife;
          p.mesh.position.x += p.vx * delta * smokeSpeedMult;
          p.mesh.position.y += p.vy * delta * smokeSpeedMult;
          p.mesh.position.z += p.vz * delta * smokeSpeedMult;
          const s = 0.6 + t * 2.2;
          p.mesh.scale.set(s, s, s);
          const pMat = p.mesh.material as THREE.MeshBasicMaterial;
          pMat.opacity = Math.sin(t * Math.PI) * (currentSpeed > 0.1 ? 0.35 : 0.16);
        }
      });

      // 6. Update Status Visual Roda & Animasi Pemasangan
      wheelsMeshMap.current.forEach((wheelGroup, wId) => {
        const halo = wheelGroup.getObjectByName('selectionHalo') as THREE.Mesh;
        const tireMesh = wheelGroup.getObjectByName('tireMesh') as THREE.Mesh;
        const treadMesh = wheelGroup.getObjectByName('treadMesh') as THREE.Mesh;
        const rimMesh = wheelGroup.getObjectByName('rimMesh') as THREE.Mesh;
        const lugGroup = wheelGroup.getObjectByName('lugGroup') as THREE.Group;
        const hubMesh = wheelGroup.getObjectByName('hubMesh') as THREE.Mesh;
        const brakeDrum = wheelGroup.getObjectByName('brakeDrum') as THREE.Mesh;
        const brakeCaliper = wheelGroup.getObjectByName('brakeCaliper') as THREE.Mesh;
        const studsMesh = wheelGroup.getObjectByName('studsMesh') as THREE.Mesh;
        const ghostTireMesh = wheelGroup.getObjectByName('ghostTireMesh') as THREE.Mesh;
        const ghostLine = wheelGroup.getObjectByName('ghostLine') as THREE.LineSegments;

        const isSelected = selectedWheelIdRef.current === wId;
        const isDndHover = dndHoverWheelIdRef.current === wId;
        const assignedTire = getTireForWheelRef.current(wId);
        const hasTire = Boolean(assignedTire);
        const coord = wheelCoordsMapRef.current.get(wId);

        // Animasi Slide-In saat Ban Dipasang
        const anim = mountingAnims.current.get(wId);
        let slideOffset = 0;
        if (anim) {
          const el = performance.now() - anim.startTime;
          if (el < anim.duration) {
            const prog = el / anim.duration;
            const ease = Math.sin((prog * Math.PI) / 2);
            slideOffset = (1 - ease) * (coord?.side === 'L' ? -0.7 : 0.7);
          } else {
            mountingAnims.current.delete(wId);
          }
        }

        const showPhysicalTire = hasTire || isDndHover;

        if (tireMesh) {
          tireMesh.visible = showPhysicalTire;
          tireMesh.position.x = slideOffset;
          const tMat = tireMesh.material as THREE.MeshStandardMaterial;
          if (isDndHover && !hasTire) {
            tMat.emissive.setHex(coord?.isInner ? 0x4a044e : 0x064e3b);
            tMat.emissiveIntensity = 0.45;
          } else {
            tMat.emissive.setHex(0x000000);
            tMat.emissiveIntensity = 0;
          }
        }

        if (treadMesh) {
          treadMesh.visible = showPhysicalTire;
          treadMesh.position.x = slideOffset;
        }

        if (rimMesh) {
          rimMesh.visible = showPhysicalTire;
          rimMesh.position.x = slideOffset;
          const mat = rimMesh.material as THREE.MeshStandardMaterial;
          if (isDndHover) {
            mat.color.setHex(coord?.isInner ? 0xc084fc : 0x10b981);
            mat.emissive.setHex(coord?.isInner ? 0x9333ea : 0x047857);
            mat.emissiveIntensity = 0.85;
          } else if (hasTire) {
            if (isSelected) {
              mat.color.setHex(coord?.isInner ? 0xa855f7 : 0x38bdf8);
              mat.emissive.setHex(coord?.isInner ? 0x7e22ce : 0x075985);
              mat.emissiveIntensity = 0.6;
            } else {
              mat.color.setHex(0xe2e8f0);
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
            }
          }
        }

        if (lugGroup) lugGroup.position.x = slideOffset;
        if (hubMesh) {
          hubMesh.visible = showPhysicalTire;
          hubMesh.position.x = slideOffset;
        }

        if (brakeDrum) brakeDrum.visible = !showPhysicalTire;
        if (brakeCaliper) brakeCaliper.visible = !showPhysicalTire;
        if (studsMesh) studsMesh.visible = !showPhysicalTire;

        const ringOuter = wheelGroup.getObjectByName('ghostRingOuter') as THREE.Mesh;
        const ringInner = wheelGroup.getObjectByName('ghostRingInner') as THREE.Mesh;
        const showGhost = !hasTire && !isDndHover;

        if (ghostTireMesh) {
          ghostTireMesh.visible = showGhost;
          const gtMat = ghostTireMesh.material as THREE.MeshStandardMaterial;
          if (isSelected) {
            gtMat.color.setHex(coord?.isInner ? 0xc084fc : 0x00f0ff);
            gtMat.emissive.setHex(coord?.isInner ? 0xa855f7 : 0x0284c7);
            gtMat.emissiveIntensity = 1.0;
            gtMat.opacity = 0.52;
          } else {
            gtMat.color.setHex(coord?.isInner ? 0x9333ea : 0x0284c7);
            gtMat.emissive.setHex(coord?.isInner ? 0x7e22ce : 0x0369a1);
            gtMat.emissiveIntensity = 0.75;
            gtMat.opacity = 0.28;
          }
        }

        if (ghostLine) {
          ghostLine.visible = showGhost;
          const glMat = ghostLine.material as THREE.LineBasicMaterial;
          glMat.color.setHex(isSelected ? (coord?.isInner ? 0xf0abfc : 0x7dd3fc) : (coord?.isInner ? 0xd946ef : 0x00e5ff));
          glMat.opacity = isSelected ? 0.95 : 0.85;
        }

        [ringOuter, ringInner].forEach((ring) => {
          if (ring) {
            ring.visible = showGhost;
            if (showGhost) {
              const rMat = ring.material as THREE.MeshStandardMaterial;
              if (isSelected) {
                rMat.emissiveIntensity = 1.5 + Math.sin(time * 6) * 0.3;
                rMat.opacity = 0.95;
              } else {
                rMat.emissiveIntensity = 1.1 + Math.sin(time * 3 + (coord?.isInner ? 1.5 : 0)) * 0.2;
                rMat.opacity = 0.85;
              }
            }
          }
        });

        if (halo) {
          halo.visible = isSelected || isDndHover;
          const hMat = halo.material as THREE.MeshBasicMaterial;
          if (isDndHover) {
            hMat.color.setHex(coord?.isInner ? 0xc084fc : 0x10b981);
            const pulseScale = 1.15 + Math.sin(time * 12) * 0.12;
            halo.scale.set(pulseScale, pulseScale, pulseScale);
            halo.rotation.x = time * 2;
          } else if (isSelected) {
            hMat.color.setHex(coord?.isInner ? 0xa855f7 : 0x38bdf8);
            const pulseScale = 1.0 + Math.sin(time * 6) * 0.08;
            halo.scale.set(pulseScale, pulseScale, pulseScale);
            halo.rotation.x = Math.sin(time * 3) * 0.1;
          }
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth || 360;
      const h = container.clientHeight || Math.min(Math.max(window.innerHeight * 0.54, 360), 500);
      const isMob = w < 500;
      cameraRef.current.fov = isMob ? 48 : 40;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointercancel', handlePointerCancel);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      floorTexture.dispose();
      if (treadTexture) treadTexture.dispose();
      renderer.dispose();
      controls.dispose();
    };
  }, [wheelCount, category, wheelCoords]);

  // Sync auto-rotate
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = isAutoRotate;
    }
  }, [isAutoRotate]);

  // Preset Sudut Kamera dengan Animasi Halus
  const handleSetCameraView = (view: 'perspective' | 'top' | 'side' | 'dualFocus') => {
    setCameraView(view);
    const presets = getVehicleCameraPreset(wheelCount);
    let targetPos = presets.perspective;
    let targetLook = presets.target;

    if (view === 'top') {
      targetPos = presets.top;
    } else if (view === 'side') {
      targetPos = presets.side;
    } else if (view === 'dualFocus') {
      targetPos = presets.dualFocus;
      targetLook = presets.dualTarget;
    }

    triggerCameraTransition(targetPos, targetLook);
  };

  const handleResetCamera = () => {
    handleSetCameraView('perspective');
    setIsAutoRotate(false);
    setIsRolling(false);
    setIsDualSeparated(false);
  };

  // Helper raycast global
  const getWheelAtCoords = (clientX: number, clientY: number): string | null => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const mx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((clientY - rect.top) / rect.height) * 2 + 1;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(mx, my), camera);

    const wheelMeshes: THREE.Object3D[] = [];
    wheelsMeshMap.current.forEach((grp) => {
      grp.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.wheelId) {
          wheelMeshes.push(child);
        }
      });
    });

    const intersects = ray.intersectObjects(wheelMeshes, false);
    if (intersects.length > 0) {
      const hitIds: string[] = [];
      intersects.forEach((h) => {
        const id = h.object.userData.wheelId as string;
        if (id && !hitIds.includes(id)) hitIds.push(id);
      });

      for (const wid of hitIds) {
        const info = wheelCoordsMapRef.current.get(wid);
        if (info?.isDual && info.partnerId && hitIds.includes(info.partnerId)) {
          const outerId = info.isOuter ? wid : info.partnerId;
          const innerId = info.isInner ? wid : info.partnerId;
          const outerTire = getTireForWheelRef.current(outerId);
          const innerTire = getTireForWheelRef.current(innerId);

          if (isDraggingRef.current) {
            if (outerTire && !innerTire) return innerId;
            if (!outerTire && innerTire) return outerId;
          }
          return innerId;
        }
      }
      return hitIds[0];
    }

    let closestWheelId: string | null = null;
    let minDistance = 140;
    wheelsMeshMap.current.forEach((grp, wId) => {
      const worldPos = new THREE.Vector3();
      grp.getWorldPosition(worldPos);
      worldPos.project(camera);
      if (worldPos.z <= 1) {
        const screenX = ((worldPos.x + 1) * rect.width) / 2 + rect.left;
        const screenY = ((-worldPos.y + 1) * rect.height) / 2 + rect.top;
        let dist = Math.hypot(clientX - screenX, clientY - screenY);
        const info = wheelCoordsMapRef.current.get(wId);
        if (info?.isInner) dist -= 15;
        if (dist < minDistance) {
          minDistance = dist;
          closestWheelId = wId;
        }
      }
    });

    return closestWheelId;
  };

  // Handler touch drag realtime
  useEffect(() => {
    if (!touchCoords) {
      if (dndHoverWheelIdRef.current) {
        setDndTarget(null);
        setIsCanvasDragOver(false);
        onTargetWheelChange?.(null);
      }
      return;
    }
    setIsCanvasDragOver(true);
    const targetId = getWheelAtCoords(touchCoords.x, touchCoords.y);
    if (targetId !== dndHoverWheelIdRef.current) {
      setDndTarget(targetId);
      onTargetWheelChange?.(targetId);
    }
  }, [touchCoords, onTargetWheelChange]);

  const handleCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isCanvasDragOver) setIsCanvasDragOver(true);
    const targetId = getWheelAtCoords(e.clientX, e.clientY);
    if (targetId !== dndHoverWheelIdRef.current) {
      setDndTarget(targetId);
    }
  };

  const handleCanvasDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsCanvasDragOver(false);
      setDndTarget(null);
    }
  };

  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsCanvasDragOver(false);
    const targetWheelId = dndHoverWheelIdRef.current || getWheelAtCoords(e.clientX, e.clientY);
    const banIdStr = e.dataTransfer.getData('text/plain');
    const banId = Number(banIdStr) || (draggedTireId ?? null) || globalActiveDraggedBanId;

    if (targetWheelId && banId) {
      mountingAnims.current.set(targetWheelId, { startTime: performance.now(), duration: 520 });
      onDropTireToWheelRef.current?.(targetWheelId, Number(banId));
    }
    setDndTarget(null);
  };

  // Langsung pilih roda dari tombol ribbon
  const handleSelectWheelDirect = (wId: string) => {
    const tire = getTireForWheel(wId);
    onWheelClick?.(wId, tire);
    const coord = wheelCoordsMapRef.current.get(wId);
    if (coord?.isInner) {
      setIsDualSeparated(true);
    }
  };

  const activeTargetCoord = dndHoverWheelId ? wheelCoordsMapRef.current.get(dndHoverWheelId) : null;

  return (
    <div className="vs-3d-suite">
      {/* ── 1. TOOLBAR ATAS (MINIMALIS & RINGKAS) ── */}
      <div className="vs-3d-toolbar">
        <div className="vs-3d-toolbar-top-row">
          <div className="vs-3d-badge-info">
            <span className="vs-3d-pulse-dot" />
            <span>{wheelCount} Roda</span>
          </div>

          <div className="vs-3d-btn-group">
            <button
              type="button"
              className={`vs-3d-tool-btn ${cameraView === 'perspective' ? 'active' : ''}`}
              onClick={() => handleSetCameraView('perspective')}
              title="Sudut Pandang 3D Isometrik"
            >
              📐 3D
            </button>

            <button
              type="button"
              className={`vs-3d-tool-btn ${cameraView === 'dualFocus' ? 'active' : ''}`}
              onClick={() => handleSetCameraView('dualFocus')}
              title="Fokus Roda Ganda"
            >
              👁️ Ganda
            </button>

            <button
              type="button"
              className={`vs-3d-tool-btn ${cameraView === 'top' ? 'active' : ''}`}
              onClick={() => handleSetCameraView('top')}
              title="Sudut Pandang Atas"
            >
              🔝 Atas
            </button>

            <button
              type="button"
              className={`vs-3d-tool-btn ${cameraView === 'side' ? 'active' : ''}`}
              onClick={() => handleSetCameraView('side')}
              title="Sudut Pandang Samping"
            >
              ↔️ Samping
            </button>

            <button
              type="button"
              className={`vs-3d-tool-btn ${isDualSeparated ? 'explode-active' : ''}`}
              onClick={() => setIsDualSeparated(!isDualSeparated)}
              title={isDualSeparated ? 'Rapatkan Roda' : 'Buka Roda Ganda (Akses Roda Dalam)'}
            >
              💥 {isDualSeparated ? 'Rapat' : 'Pisah'}
            </button>

            <button
              type="button"
              className={`vs-3d-tool-btn ${isAutoRotate ? 'active' : ''}`}
              onClick={() => setIsAutoRotate(!isAutoRotate)}
              title="Putar Otomatis 360°"
            >
              🔄 360°
            </button>

            <button
              type="button"
              className={`vs-3d-tool-btn ${isRolling ? 'active' : ''}`}
              onClick={() => setIsRolling(!isRolling)}
              title="Uji Putaran Roda di Bay"
            >
              🔧 {isRolling ? 'Tes Putar' : 'Diam'}
            </button>

            <button
              type="button"
              className="vs-3d-tool-btn vs-3d-reset-btn"
              onClick={handleResetCamera}
              title="Reset Sudut Pandang"
            >
              ↺ Reset
            </button>
          </div>
        </div>

        {/* ── BAR TOMBOL SLOT RODA CEPAT ── */}
        <div className="vs-3d-wheel-ribbon">
          {axleGroups.map((group, gIdx) => (
            <div key={gIdx} className="vs-3d-ribbon-group">
              <span className="vs-3d-ribbon-label">{group.label}:</span>
              {group.wheels.map((w) => {
                const isSel = selectedWheelId === w.id;
                const hasTire = Boolean(getTireForWheel(w.id));
                const meta = wheelConfig?.wheels.find((m) => m.id === w.id);
                const code = meta?.code || w.id.toUpperCase();
                return (
                  <button
                    key={w.id}
                    type="button"
                    className={`vs-3d-ribbon-btn ${isSel ? 'active' : ''} ${w.isInner ? 'vs-3d-ribbon-btn--inner' : ''} ${hasTire ? 'vs-3d-ribbon-btn--has-tire' : ''}`}
                    onClick={() => handleSelectWheelDirect(w.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDndTarget(w.id);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const banIdStr = e.dataTransfer.getData('text/plain');
                      const banId = Number(banIdStr) || (draggedTireId ?? null) || globalActiveDraggedBanId;
                      if (banId) {
                        mountingAnims.current.set(w.id, { startTime: performance.now(), duration: 520 });
                        onDropTireToWheelRef.current?.(w.id, Number(banId));
                      }
                      setDndTarget(null);
                    }}
                    title={`${meta?.name || `Roda ${code}`} (${w.isInner ? 'Posisi Dalam' : w.isOuter ? 'Posisi Luar' : 'Kemudi'})`}
                  >
                    <span>{code}</span>
                    {w.isInner && <span style={{ fontSize: '0.6rem', color: '#c084fc' }}>●</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. KANVAS 3D ── */}
      <div
        className={`vs-3d-canvas-wrapper ${isCanvasDragOver ? 'vs-3d-canvas-wrapper--dragover' : ''}`}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsCanvasDragOver(true);
        }}
        onDragOver={handleCanvasDragOver}
        onDragLeave={handleCanvasDragLeave}
        onDrop={handleCanvasDrop}
      >
        <div ref={containerRef} className="vs-3d-viewport" />

        {isCanvasDragOver && (
          <div className="vs-3d-dnd-overlay">
            {dndHoverWheelId ? (
              <div className={`vs-3d-dnd-target-pill vs-3d-dnd-target-pill--active ${activeTargetCoord?.isInner ? 'vs-3d-dnd-target-pill--inner' : ''}`}>
                <span className="vs-3d-pulse-dot" style={{ background: activeTargetCoord?.isInner ? '#c084fc' : '#10b981', boxShadow: `0 0 10px ${activeTargetCoord?.isInner ? '#c084fc' : '#10b981'}` }} />
                <span>
                  🎯 Pasang ke <strong>[{wheelConfig?.wheels.find((w) => w.id === dndHoverWheelId)?.code || dndHoverWheelId.toUpperCase()}]</strong>
                </span>
              </div>
            ) : (
              <div className="vs-3d-dnd-target-pill vs-3d-dnd-target-pill--waiting">
                <span className="vs-3d-dnd-target-icon">🛞</span>
                <span>Arahkan ke slot roda</span>
              </div>
            )}
          </div>
        )}
      </div>



      {/* ── 4. MODAL POPUP DETAIL LENGKAP DATA BAN ── */}
      {detailModalTire && (
        <TireDetailModal
          tire={detailModalTire.tire}
          wheelId={detailModalTire.wheelId}
          wheelMeta={wheelConfig?.wheels.find((w) => w.id === detailModalTire.wheelId) || null}
          onClose={() => setDetailModalTire(null)}
          onRemove={() => {
            if (detailModalTire.wheelId) {
              onRemoveTireFromWheel?.(detailModalTire.wheelId);
            }
          }}
          onReturn={() => {
            onReturnBorrowedTire?.(detailModalTire.tire.id);
            setDetailModalTire(null);
          }}
        />
      )}
    </div>
  );
}
