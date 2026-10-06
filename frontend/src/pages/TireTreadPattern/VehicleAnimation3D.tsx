import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { globalActiveDraggedBanId, type StockBanItem, type WheelMeta } from './VehicleSchematic3D';

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
  draggedTireId?: number | null;
}

// Preset Sudut & Target Kamera yang dioptimasi untuk setiap jenis kendaraan (Framing Seimbang di HP & Desktop)
const getVehicleCameraPreset = (count: number) => {
  if (count === 4) {
    // Forklift: Sudut 3/4 depan-kiri
    return {
      target: new THREE.Vector3(0, 0.9, 0.1),
      perspective: new THREE.Vector3(-5.6, 3.4, 4.8),
      top: new THREE.Vector3(0.001, 9.5, 0.1),
      side: new THREE.Vector3(-7.2, 1.5, 0.1)
    };
  }
  if (count === 6) {
    // Tractor Head: Menampakkan kabin depan, grille, sasis, tapal kuda, dan seluruh gandar
    return {
      target: new THREE.Vector3(0, 1.25, 0.2),
      perspective: new THREE.Vector3(-8.2, 4.2, 7.2),
      top: new THREE.Vector3(0.001, 12.5, 0.2),
      side: new THREE.Vector3(-10.2, 1.8, 0.2)
    };
  }
  if (count === 8) {
    // Chassis Trailer 20ft (Panjang 7.8 unit)
    return {
      target: new THREE.Vector3(0, 0.8, -0.4),
      perspective: new THREE.Vector3(-10.5, 5.6, 8.4),
      top: new THREE.Vector3(0.001, 14.5, -0.4),
      side: new THREE.Vector3(-12.5, 1.8, -0.4)
    };
  }
  // 12 Roda (Chassis Trailer 40ft: Panjang 11.2 unit)
  // Target tepat di tengah sasis, jarak mundur kamera proporsional agar SELURUH trailer pas terlihat di layar HP
  return {
    target: new THREE.Vector3(0, 0.8, -0.6),
    perspective: new THREE.Vector3(-13.2, 7.2, 10.5),
    top: new THREE.Vector3(0.001, 18.5, -0.6),
    side: new THREE.Vector3(-15.5, 2.0, -0.6)
  };
};

export default function VehicleAnimation3D({
  wheelCount,
  selectedWheelId,
  onWheelClick,
  getTireForWheel,
  wheelConfig,
  category,
  onDropTireToWheel,
  draggedTireId
}: VehicleAnimation3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const wheelsMeshMap = useRef<Map<string, THREE.Group>>(new Map());
  const animationFrameId = useRef<number | null>(null);

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

  // Default awal: TIDAK BERPUTAR & BAN DIAM (sesuai permintaan user)
  const [isAutoRotate, setIsAutoRotate] = useState<boolean>(false);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const isRollingRef = useRef<boolean>(false);
  useEffect(() => {
    isRollingRef.current = isRolling;
  }, [isRolling]);

  const [cameraView, setCameraView] = useState<'perspective' | 'top' | 'side'>('perspective');
  const [hoveredWheelId, setHoveredWheelId] = useState<string | null>(null);

  // State & Ref untuk Drag and Drop langsung ke 3D canvas
  const [dndHoverWheelId, setDndHoverWheelId] = useState<string | null>(null);
  const dndHoverWheelIdRef = useRef<string | null>(null);
  const [isCanvasDragOver, setIsCanvasDragOver] = useState<boolean>(false);

  const setDndTarget = (id: string | null) => {
    dndHoverWheelIdRef.current = id;
    setDndHoverWheelId(id);
  };

  // Status roda aktif
  const activeMeta = useMemo(() => {
    if (!selectedWheelId || !wheelConfig?.wheels) return null;
    return wheelConfig.wheels.find((w) => w.id === selectedWheelId) || null;
  }, [selectedWheelId, wheelConfig]);

  const activeTire = useMemo(() => {
    if (!selectedWheelId) return null;
    return getTireForWheel(selectedWheelId);
  }, [selectedWheelId, getTireForWheel]);

  // Setup Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Bersihkan isi container sebelumnya jika ada
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const width = container.clientWidth || 360;
    const height = container.clientHeight || Math.min(Math.max(window.innerHeight * 0.44, 340), 440);

    // 1. Renderer (High Fidelity, Vivid Lighting)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 3. Camera & Preset Posisi
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
    controls.minDistance = 3.2;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI / 2 - 0.04; // Jangan tembus ke bawah lantai
    controls.target.copy(presets.target);
    controls.autoRotate = false; // TIDAK BERPUTAR saat awal
    controls.autoRotateSpeed = 1.2;
    controlsRef.current = controls;

    // 5. Pencahayaan Studio Mewah & Seimbang (High-End Automotive Showroom Lighting)
    // Ambient light seimbang agar sasis dan detail mekanikal jelas terlihat
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
    scene.add(ambientLight);

    // Skylight atas (soft sky to floor studio fill)
    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x0f172a, 1.15);
    hemiLight.position.set(0, 24, 0);
    scene.add(hemiLight);

    // Main Key Light (Cahaya Utama dari Depan-Atas-Kanan)
    const mainSun = new THREE.DirectionalLight(0xffffff, 2.4);
    mainSun.position.set(9, 18, 11);
    mainSun.castShadow = true;
    mainSun.shadow.mapSize.width = 2048;
    mainSun.shadow.mapSize.height = 2048;
    mainSun.shadow.bias = -0.0003;
    scene.add(mainSun);

    // Soft Rim Light dari Sisi Belakang-Kiri (Memberi definisi siluet bodi tanpa silau)
    const rimLight = new THREE.DirectionalLight(0x93c5fd, 1.4);
    rimLight.position.set(-11, 9, -7);
    scene.add(rimLight);

    // Front Fill Light Lembut (Menerangi fascia depan dan gandar)
    const frontFillLight = new THREE.DirectionalLight(0xffffff, 1.0);
    frontFillLight.position.set(0, 5, 12);
    scene.add(frontFillLight);

    // 6. Lantai Studio Showroom Mewah (Bukan Grid Neon Terang)
    // Grid halus warna slate netral
    const gridHelper = new THREE.GridHelper(30, 48, 0x334155, 0x1e293b);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // Cincin Platform Meja Putar Showroom (Subtle Turntable Ring)
    const ringGeo = new THREE.RingGeometry(6.4, 6.46, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
    const turntableRing = new THREE.Mesh(ringGeo, ringMat);
    turntableRing.rotation.x = -Math.PI / 2;
    turntableRing.position.y = -0.008;
    scene.add(turntableRing);

    // Soft Drop Shadow Floor (Menerima bayangan kontak realistis di bawah ban)
    const shadowGeo = new THREE.PlaneGeometry(30, 30);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.55 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.005;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Group Utama Truk / Kendaraan
    const vehicleGroup = new THREE.Group();
    scene.add(vehicleGroup);

    // ── MATERIAL RANGKA & BODI KENDARAAN (KONTRAST & JELAS DILIHAT) ──
    // Sasis utama: baja titanium industri (slate 600) jelas batasnya, tidak hitam kelam
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.72,
      roughness: 0.32
    });

    const crossmemberMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.35
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.95,
      roughness: 0.12
    });

    const twistlockMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.7,
      roughness: 0.28
    });

    const hazardMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      metalness: 0.5,
      roughness: 0.3
    });

    // Helper membuat Box
    const createBox = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, castShadow = true) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      vehicleGroup.add(mesh);
      return mesh;
    };

    // Helper membuat Cylinder
    const createCylinder = (rt: number, rb: number, h: number, seg: number, mat: THREE.Material, x: number, y: number, z: number, rx = 0, rz = 0) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
      mesh.position.set(x, y, z);
      mesh.rotation.x = rx;
      mesh.rotation.z = rz;
      mesh.castShadow = true;
      vehicleGroup.add(mesh);
      return mesh;
    };

    // ── BANGUN MODEL FISIK KENDARAAN SESUAI TIPE (4, 6, 8, 12 RODA) ──
    if (wheelCount === 4) {
      // ── FORKLIFT MODEL (4 RODA) ──
      const forkliftBodyMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.5, roughness: 0.3 });
      // Bodi Utama
      createBox(1.5, 0.9, 2.2, forkliftBodyMat, 0, 0.8, 0);
      // Counterweight belakang
      createBox(1.5, 0.8, 0.7, new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.4 }), 0, 0.75, -1.2);
      // Kabin / Rollcage
      createBox(1.3, 1.4, 1.3, frameMat, 0, 1.9, -0.2);
      // Tiang Mast Depan
      createBox(0.12, 2.6, 0.12, chromeMat, -0.55, 1.5, 1.25);
      createBox(0.12, 2.6, 0.12, chromeMat, 0.55, 1.5, 1.25);
      createBox(1.2, 0.15, 0.1, chromeMat, 0, 0.8, 1.25);
      // Garpu Forks
      createBox(0.14, 0.05, 1.4, chromeMat, -0.35, 0.2, 1.9);
      createBox(0.14, 0.05, 1.4, chromeMat, 0.35, 0.2, 1.9);
    } else if (wheelCount === 6) {
      // ═════════════════════════════════════════════════════════════════════════════
      // ── TRACTOR HEAD PRIME MOVER HEAVY-DUTY (6 RODA: LIVERY PUTIH - BIRU) ──
      // ═════════════════════════════════════════════════════════════════════════════

      // 1. Warna Bodi Utama Kabin: Putih Bersih Mengkilap (Pure High-Gloss Fleet White)
      const thCabWhiteMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.15,
        roughness: 0.22,
      });

      // 2. Warna Bodi Bawah & Bumper: Biru Fleet Modern (Vibrant Royal Fleet Blue)
      const thCabBlueMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7, // Biru Fleet Cerah & Tegas
        metalness: 0.35,
        roughness: 0.24,
      });

      // 3. Garis Striping Livery: Biru Elektrik Kontras (Deep Electric Blue Stripe)
      const thNavyStripeMat = new THREE.MeshStandardMaterial({
        color: 0x1d4ed8,
        metalness: 0.45,
        roughness: 0.2,
      });

      // Bumper & Trim: Dark Slate Trim & Segel Karet
      const thTrimMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.55,
        roughness: 0.45
      });

      // Grille Louvers: Polished Chrome Radiator
      const thGrilleMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.85,
        roughness: 0.25
      });

      // Kaca Kabin: Clear Tinted Blue Glass
      const thGlassMat = new THREE.MeshStandardMaterial({
        color: 0x1e3a5f,
        metalness: 0.9,
        roughness: 0.08,
        transparent: true,
        opacity: 0.8
      });

      // Sadel Fifth Wheel Tapal Kuda: Cast Steel Grease Plate
      const thFifthWheelMat = new THREE.MeshStandardMaterial({
        color: 0x111827,
        metalness: 0.92,
        roughness: 0.2
      });

      // Catwalk Pelat Sasis: Diamond Plate Silver
      const thDeckMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.9,
        roughness: 0.25
      });

      // ── 1. SASIS I-BEAM & CROSSMEMBERS UTAMA ──
      // Sasis Utama Kiri & Kanan (Baja Industrial Slate Kokoh)
      createBox(0.18, 0.34, 6.2, frameMat, -0.48, 0.75, 0);
      createBox(0.18, 0.34, 6.2, frameMat, 0.48, 0.75, 0);
      // Balok Crossmembers Penghubung Sasis
      for (let z = -2.4; z <= 2.4; z += 1.2) {
        createBox(0.9, 0.14, 0.14, crossmemberMat, 0, 0.75, z);
      }
      // Bumper Sasis Belakang (Biru Fleet) & Lampu Truk LED Multi-Chamber
      createBox(2.14, 0.18, 0.12, thCabBlueMat, 0, 0.65, -2.95);
      createBox(0.44, 0.12, 0.04, new THREE.MeshBasicMaterial({ color: 0xef4444 }), -0.76, 0.66, -3.02); // Lampu rem kiri
      createBox(0.44, 0.12, 0.04, new THREE.MeshBasicMaterial({ color: 0xef4444 }), 0.76, 0.66, -3.02);  // Lampu rem kanan
      createBox(0.12, 0.12, 0.04, new THREE.MeshBasicMaterial({ color: 0xf59e0b }), -0.46, 0.66, -3.02); // Sein mundur
      createBox(0.12, 0.12, 0.04, new THREE.MeshBasicMaterial({ color: 0xf59e0b }), 0.46, 0.66, -3.02);  // Sein mundur

      // ── 2. KABIN DEPAN (SCULPTED AERODYNAMIC EUROPEAN PRIME MOVER - PUTIH & BIRU) ──
      // A. Lantai Bawah & Fascia Pijakan Kabin
      createBox(2.26, 0.42, 2.15, thCabBlueMat, 0, 1.12, 1.78);

      // B. Bodi Bawah Kabin & Spakbor Depan Terintegrasi (Biru Fleet Elegan)
      createBox(2.24, 0.62, 2.05, thCabBlueMat, 0, 1.58, 1.74);

      // C. Bodi Tengah Kabin (Pintu & Pilar Kabin Utama - Putih Bersih)
      createBox(2.18, 0.88, 1.95, thCabWhiteMat, 0, 2.18, 1.68);

      // Garis Aksen Samping Livery (Two-Tone Accent Stripe Biru Elektrik)
      createBox(2.20, 0.08, 1.96, thNavyStripeMat, 0, 1.88, 1.68);
      createBox(2.20, 0.04, 1.82, thCabBlueMat, 0, 1.98, 1.68);

      // D. High-Roof Aerodynamic Cap (Atap Aerodinamis Putih)
      const roofFairing = createBox(2.12, 0.52, 1.84, thCabWhiteMat, 0, 2.76, 1.62);
      roofFairing.rotation.x = -0.07;

      // Sayap Deflektor Samping Atap (Putih)
      createBox(0.05, 0.64, 0.68, thCabWhiteMat, -1.07, 2.72, 0.95);
      createBox(0.05, 0.64, 0.68, thCabWhiteMat, 1.07, 2.72, 0.95);

      // Lampu Penanda Atap LED (Roof Clearance Marker Lamps)
      for (let lx = -0.75; lx <= 0.75; lx += 0.38) {
        createBox(0.08, 0.03, 0.06, new THREE.MeshBasicMaterial({ color: 0xfbbf24 }), lx, 3.02, 2.38);
      }

      // E. Sayap Aerodinamis Sudut Depan (Corner Aero Vanes - Biru Fleet)
      const leftVane = createBox(0.06, 1.12, 0.28, thCabBlueMat, -1.14, 1.72, 2.65);
      leftVane.rotation.y = 0.18;
      const rightVane = createBox(0.06, 1.12, 0.28, thCabBlueMat, 1.14, 1.72, 2.65);
      rightVane.rotation.y = -0.18;

      // Sayap Samping Belakang Kabin (Cab Rear Aero Wings - Biru Fleet)
      createBox(0.05, 1.75, 0.48, thCabBlueMat, -1.10, 2.12, 0.64);
      createBox(0.05, 1.75, 0.48, thCabBlueMat, 1.10, 2.12, 0.64);

      // F. Kaca Depan Miring Aerodinamis (Raked Panoramic Windshield)
      const windshield = createBox(2.04, 0.98, 0.08, thGlassMat, 0, 2.26, 2.68);
      windshield.rotation.x = -0.18;

      // Karet Bezel / Frame Kaca Depan
      const windshieldFrame = createBox(2.08, 0.04, 0.10, thTrimMat, 0, 1.78, 2.78);
      windshieldFrame.rotation.x = -0.18;

      // Sunvisor Depan Aerodinamis di Atas Kaca (Biru Fleet)
      const sunvisor = createBox(2.16, 0.18, 0.32, thCabBlueMat, 0, 2.74, 2.74);
      sunvisor.rotation.x = -0.22;
      // Garis LED Sunvisor
      createBox(1.65, 0.02, 0.04, new THREE.MeshBasicMaterial({ color: 0xe0f2fe }), 0, 2.76, 2.88);

      // Wiper Kaca Depan Kembar
      createBox(0.62, 0.03, 0.02, thTrimMat, -0.42, 1.84, 2.72);
      createBox(0.62, 0.03, 0.02, thTrimMat, 0.42, 1.84, 2.72);

      // G. Kaca Jendela Pintu Samping (Side Cab Windows)
      createBox(0.06, 0.68, 1.05, thGlassMat, -1.10, 2.22, 1.86);
      createBox(0.06, 0.68, 1.05, thGlassMat, 1.10, 2.22, 1.86);

      // Gagang Pintu Horizontal Chrome
      createBox(0.03, 0.04, 0.16, chromeMat, -1.11, 1.78, 1.72);
      createBox(0.03, 0.04, 0.16, chromeMat, 1.11, 1.78, 1.72);

      // H. Spion West-Coast Aerodinamis Heavy-Duty (Housing Biru Fleet)
      // Spion Kiri (Driver)
      createBox(0.10, 0.58, 0.16, thCabBlueMat, -1.32, 2.22, 2.48);
      createBox(0.02, 0.52, 0.12, chromeMat, -1.27, 2.22, 2.46); // Cermin utama
      createBox(0.02, 0.14, 0.12, chromeMat, -1.27, 1.88, 2.46); // Cermin cembung spotter bawah
      createCylinder(0.015, 0.015, 0.24, 8, chromeMat, -1.21, 2.44, 2.48, 0, Math.PI / 2);
      createCylinder(0.015, 0.015, 0.24, 8, chromeMat, -1.21, 1.95, 2.48, 0, Math.PI / 2);

      // Spion Kanan (Passenger)
      createBox(0.10, 0.58, 0.16, thCabBlueMat, 1.32, 2.22, 2.48);
      createBox(0.02, 0.52, 0.12, chromeMat, 1.27, 2.22, 2.46);
      createBox(0.02, 0.14, 0.12, chromeMat, 1.27, 1.88, 2.46);
      createCylinder(0.015, 0.015, 0.24, 8, chromeMat, 1.21, 2.44, 2.48, 0, Math.PI / 2);
      createCylinder(0.015, 0.015, 0.24, 8, chromeMat, 1.21, 1.95, 2.48, 0, Math.PI / 2);

      // I. Grille Radiator Bertingkat Chrome Mewah (Multi-Tier Front Grille)
      // Panel Hitam Honeycomb Grille
      createBox(1.72, 0.74, 0.08, thGrilleMat, 0, 1.48, 2.76);
      // Bilah Chrome Horizontal Bertingkat
      createBox(1.52, 0.09, 0.05, chromeMat, 0, 1.72, 2.80);
      createBox(1.62, 0.09, 0.05, chromeMat, 0, 1.52, 2.81);
      createBox(1.68, 0.09, 0.05, chromeMat, 0, 1.32, 2.82);
      // Emblem Truck Prime Mover Chrome di Tengah
      createBox(0.24, 0.20, 0.07, chromeMat, 0, 1.52, 2.84);

      // J. Bumper Depan Heavy-Duty & Cluster Lampu LED (Bumper Biru Fleet)
      // Bumper Utama Biru
      createBox(2.34, 0.44, 0.34, thCabBlueMat, 0, 0.72, 2.86);
      // Skid Plate Bawah Perak Brushed
      createBox(1.62, 0.11, 0.26, chromeMat, 0, 0.46, 2.88);
      // Lampu Depan LED Kiri (Projector Lens + DRL Strip)
      createBox(0.36, 0.20, 0.08, chromeMat, -0.92, 0.74, 3.02);
      createBox(0.30, 0.04, 0.02, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }), -0.92, 0.81, 3.07); // DRL Brow
      createBox(0.12, 0.12, 0.02, new THREE.MeshBasicMaterial({ color: 0xffffff }), -0.96, 0.72, 3.07); // Main Projector
      createBox(0.08, 0.08, 0.02, new THREE.MeshBasicMaterial({ color: 0xf59e0b }), -0.82, 0.72, 3.07); // Turn Signal
      createBox(0.12, 0.07, 0.04, new THREE.MeshBasicMaterial({ color: 0xffffff }), -0.92, 0.56, 3.02); // Fog lamp

      // Lampu Depan LED Kanan
      createBox(0.36, 0.20, 0.08, chromeMat, 0.92, 0.74, 3.02);
      createBox(0.30, 0.04, 0.02, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }), 0.92, 0.81, 3.07); // DRL Brow
      createBox(0.12, 0.12, 0.02, new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.96, 0.72, 3.07); // Main Projector
      createBox(0.08, 0.08, 0.02, new THREE.MeshBasicMaterial({ color: 0xf59e0b }), 0.82, 0.72, 3.07); // Turn Signal
      createBox(0.12, 0.07, 0.04, new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.92, 0.56, 3.02); // Fog lamp

      // K. Tangga Pijakan Pintu Kabin (Aluminium Boarding Steps Kiri & Kanan)
      createBox(0.24, 0.05, 0.36, chromeMat, -1.16, 0.70, 1.92);
      createBox(0.24, 0.05, 0.36, chromeMat, -1.16, 0.50, 1.92);
      createBox(0.24, 0.05, 0.36, chromeMat, 1.16, 0.70, 1.92);
      createBox(0.24, 0.05, 0.36, chromeMat, 1.16, 0.50, 1.92);

      // L. Twin Vertical Chrome Exhaust Stacks di Belakang Kabin
      createCylinder(0.065, 0.065, 2.5, 16, chromeMat, 0.84, 2.45, 0.58);
      createCylinder(0.11, 0.11, 1.2, 16, chromeMat, 0.84, 1.85, 0.58); // Pelindung Panas Perforated Heat Shield
      createCylinder(0.065, 0.065, 2.5, 16, chromeMat, -0.84, 2.45, 0.58);
      createCylinder(0.11, 0.11, 1.2, 16, chromeMat, -0.84, 1.85, 0.58);

      // Snorkel Air Intake Belakang
      createCylinder(0.075, 0.075, 2.0, 16, thTrimMat, -0.62, 2.22, 0.58);
      createCylinder(0.12, 0.12, 0.14, 16, thTrimMat, -0.62, 3.25, 0.58);

      // ── 3. AREA DEK & BELAKANG KABIN ──
      // Catwalk Pelat Logam (Diamond Plate Platform di Atas Sasis)
      createBox(1.72, 0.04, 1.25, thDeckMat, 0, 0.93, 0.25);

      // Selang Suzi Coils Sambungan Trailer (Red Emergency, Yellow Service, Blue Aux)
      createCylinder(0.035, 0.035, 0.55, 12, new THREE.MeshStandardMaterial({ color: 0xef4444 }), -0.25, 1.25, 0.62);
      createCylinder(0.035, 0.035, 0.55, 12, new THREE.MeshStandardMaterial({ color: 0xf59e0b }), 0, 1.25, 0.62);
      createCylinder(0.035, 0.035, 0.55, 12, new THREE.MeshStandardMaterial({ color: 0x38bdf8 }), 0.25, 1.25, 0.62);

      // ── 4. FIFTH WHEEL (SADEL GANDENG JOST CAST-STEEL COUPLING) ──
      // Dudukan Rangka Sadel (Pedestal Mounting Brackets)
      createBox(1.20, 0.16, 0.62, thTrimMat, 0, 0.93, -1.6);
      // Pelat Sadel Tapal Kuda (Fifth Wheel Plate)
      const fifthWheelPlate = createCylinder(0.58, 0.58, 0.10, 28, thFifthWheelMat, 0, 1.05, -1.6);
      fifthWheelPlate.rotation.x = 0.08;
      // Celah Masuk Kingpin V-Opening Belakang
      createBox(0.18, 0.12, 0.35, new THREE.MeshStandardMaterial({ color: 0x030712 }), 0, 1.06, -1.82);
      // Tuas Rilis Kunci Sadel Chrome
      createBox(0.42, 0.03, 0.03, chromeMat, -0.68, 1.05, -1.6);

      // ── 5. TANGKI BAHAN BAKAR & ALAT KELENGKAPAN SASIS ──
      // Tangki Solar Aluminium Chrome Kiri
      createCylinder(0.36, 0.36, 1.75, 24, chromeMat, -0.98, 0.68, 0.25, Math.PI / 2);
      createCylinder(0.38, 0.38, 0.06, 24, thTrimMat, -0.98, 0.68, -0.35, Math.PI / 2); // Rubber strap 1
      createCylinder(0.38, 0.38, 0.06, 24, thTrimMat, -0.98, 0.68, 0.85, Math.PI / 2);  // Rubber strap 2
      createCylinder(0.08, 0.08, 0.06, 16, chromeMat, -0.98, 1.06, 0.75); // Fuel cap

      // Tangki Solar Aluminium Chrome Kanan
      createCylinder(0.36, 0.36, 1.75, 24, chromeMat, 0.98, 0.68, 0.25, Math.PI / 2);
      createCylinder(0.38, 0.38, 0.06, 24, thTrimMat, 0.98, 0.68, -0.35, Math.PI / 2);  // Rubber strap 1
      createCylinder(0.38, 0.38, 0.06, 24, thTrimMat, 0.98, 0.68, 0.85, Math.PI / 2);   // Rubber strap 2
      createCylinder(0.08, 0.08, 0.06, 16, chromeMat, 0.98, 1.06, 0.75); // Fuel cap

      // Kotak Baterai & Tabung Angin Rem
      createBox(0.46, 0.32, 0.46, thTrimMat, -0.98, 0.68, -0.85);

      // ── 6. SPAKBOR BELAKANG (CURVED REAR MUDGUARDS - BIRU FLEET) ──
      // Spakbor Kiri
      createBox(0.74, 0.06, 1.35, thCabBlueMat, -1.36, 1.14, -1.7);
      const leftMudflap = createBox(0.70, 0.36, 0.04, new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 }), -1.36, 0.78, -2.35);
      leftMudflap.rotation.x = -0.15;

      // Spakbor Kanan
      createBox(0.74, 0.06, 1.35, thCabBlueMat, 1.36, 1.14, -1.7);
      const rightMudflap = createBox(0.70, 0.36, 0.04, new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 }), 1.36, 0.78, -2.35);
      rightMudflap.rotation.x = -0.15;
    } else if (wheelCount === 8) {
      // ── CHASSIS TRAILER 20 FEET (8 RODA: Gandar 1 & 2) ──
      // Sasis Utama Trailer (Baja Industrial Slate 600 - Sangat Jelas)
      createBox(0.18, 0.36, 7.8, frameMat, -0.65, 0.82, 0);
      createBox(0.18, 0.36, 7.8, frameMat, 0.65, 0.82, 0);
      // Crossmembers trailer
      for (let z = -3.2; z <= 3.2; z += 1.4) {
        createBox(1.4, 0.16, 0.16, crossmemberMat, 0, 0.82, z);
      }
      // Twistlocks Kuning Safety di 4 Sudut
      createBox(0.26, 0.22, 0.26, twistlockMat, -1.15, 0.98, 3.7);
      createBox(0.26, 0.22, 0.26, twistlockMat, 1.15, 0.98, 3.7);
      createBox(0.26, 0.22, 0.26, twistlockMat, -1.15, 0.98, -3.7);
      createBox(0.26, 0.22, 0.26, twistlockMat, 1.15, 0.98, -3.7);
      // Kingpin depan
      createCylinder(0.08, 0.08, 0.3, 16, chromeMat, 0, 0.5, 3.2);
      // Kaki Penyangga (Landing Gear)
      createBox(0.14, 0.8, 0.14, frameMat, -0.65, 0.42, 1.2);
      createBox(0.14, 0.8, 0.14, frameMat, 0.65, 0.42, 1.2);
      // Bumper Belakang + Hazard Red Bar
      createBox(2.2, 0.22, 0.12, hazardMat, 0, 0.65, -3.85);
    } else if (wheelCount === 12) {
      // ── CHASSIS TRAILER 40 FEET (12 RODA: Tri-Axle Gandar 1, 2, 3) ──
      // Sasis Utama Panjang Trailer 40ft (Baja Titanium Slate 600 - Jelas & Kokoh)
      createBox(0.18, 0.36, 11.2, frameMat, -0.65, 0.82, 0);
      createBox(0.18, 0.36, 11.2, frameMat, 0.65, 0.82, 0);
      // Balok Crossmembers Penghubung
      for (let z = -4.8; z <= 4.8; z += 1.5) {
        createBox(1.4, 0.16, 0.16, crossmemberMat, 0, 0.82, z);
      }
      // Twistlocks Kuning Safety di 4 Sudut Kontainer
      createBox(0.26, 0.22, 0.26, twistlockMat, -1.15, 0.98, 5.4);
      createBox(0.26, 0.22, 0.26, twistlockMat, 1.15, 0.98, 5.4);
      createBox(0.26, 0.22, 0.26, twistlockMat, -1.15, 0.98, -5.4);
      createBox(0.26, 0.22, 0.26, twistlockMat, 1.15, 0.98, -5.4);
      // Kingpin depan
      createCylinder(0.08, 0.08, 0.3, 16, chromeMat, 0, 0.5, 4.8);
      // Kaki Penyangga Depan (Landing Gear)
      createBox(0.14, 0.8, 0.14, frameMat, -0.65, 0.42, 2.2);
      createBox(0.14, 0.8, 0.14, frameMat, 0.65, 0.42, 2.2);
      // Bumper Belakang + Hazard Red Bar
      createBox(2.2, 0.22, 0.12, hazardMat, 0, 0.65, -5.55);
    }

    // ── BANGUN GEOMETRI BAN 3D & POSISI RODA ──
    wheelsMeshMap.current.clear();

    // Koordinat Posisi 3D untuk Roda (X: kiri/kanan, Y: ketinggian, Z: gandar depan/belakang)
    type WheelCoord = { id: string; x: number; y: number; z: number; isDual?: boolean; side: 'L' | 'R' };
    let wheelCoords: WheelCoord[] = [];

    if (wheelCount === 4) {
      wheelCoords = [
        { id: 'w1', x: -0.9, y: 0.45, z: 1.1, side: 'L' },
        { id: 'w2', x: 0.9, y: 0.45, z: 1.1, side: 'R' },
        { id: 'w3', x: -0.85, y: 0.4, z: -1.0, side: 'L' },
        { id: 'w4', x: 0.85, y: 0.4, z: -1.0, side: 'R' }
      ];
    } else if (wheelCount === 6) {
      // 6 Roda (1 Kemudi Depan + 2 Pasang Dual Drive Belakang)
      wheelCoords = [
        { id: 'w1', x: -1.15, y: 0.52, z: 2.1, side: 'L' }, // Kemudi Kiri
        { id: 'w2', x: 1.15, y: 0.52, z: 2.1, side: 'R' },  // Kemudi Kanan
        { id: 'w3', x: -1.36, y: 0.52, z: -1.7, side: 'L', isDual: true }, // Kiri Luar
        { id: 'w4', x: -1.04, y: 0.52, z: -1.7, side: 'L', isDual: true }, // Kiri Dalam
        { id: 'w5', x: 1.04, y: 0.52, z: -1.7, side: 'R', isDual: true },  // Kanan Dalam
        { id: 'w6', x: 1.36, y: 0.52, z: -1.7, side: 'R', isDual: true }   // Kanan Luar
      ];
    } else if (wheelCount === 8) {
      // 8 Roda (Chassis 20ft: Gandar 1 & Gandar 2)
      wheelCoords = [
        { id: 'w1', x: -1.36, y: 0.52, z: -1.4, side: 'L', isDual: true },
        { id: 'w2', x: -1.04, y: 0.52, z: -1.4, side: 'L', isDual: true },
        { id: 'w3', x: 1.04, y: 0.52, z: -1.4, side: 'R', isDual: true },
        { id: 'w4', x: 1.36, y: 0.52, z: -1.4, side: 'R', isDual: true },

        { id: 'w5', x: -1.36, y: 0.52, z: -2.8, side: 'L', isDual: true },
        { id: 'w6', x: -1.04, y: 0.52, z: -2.8, side: 'L', isDual: true },
        { id: 'w7', x: 1.04, y: 0.52, z: -2.8, side: 'R', isDual: true },
        { id: 'w8', x: 1.36, y: 0.52, z: -2.8, side: 'R', isDual: true }
      ];
    } else if (wheelCount === 12) {
      // 12 Roda (Chassis 40ft: Gandar 1, 2, 3)
      wheelCoords = [
        { id: 'w1', x: -1.36, y: 0.52, z: -1.9, side: 'L', isDual: true },
        { id: 'w2', x: -1.04, y: 0.52, z: -1.9, side: 'L', isDual: true },
        { id: 'w3', x: 1.04, y: 0.52, z: -1.9, side: 'R', isDual: true },
        { id: 'w4', x: 1.36, y: 0.52, z: -1.9, side: 'R', isDual: true },

        { id: 'w5', x: -1.36, y: 0.52, z: -3.3, side: 'L', isDual: true },
        { id: 'w6', x: -1.04, y: 0.52, z: -3.3, side: 'L', isDual: true },
        { id: 'w7', x: 1.04, y: 0.52, z: -3.3, side: 'R', isDual: true },
        { id: 'w8', x: 1.36, y: 0.52, z: -3.3, side: 'R', isDual: true },

        { id: 'w9', x: -1.36, y: 0.52, z: -4.7, side: 'L', isDual: true },
        { id: 'w10', x: -1.04, y: 0.52, z: -4.7, side: 'L', isDual: true },
        { id: 'w11', x: 1.04, y: 0.52, z: -4.7, side: 'R', isDual: true },
        { id: 'w12', x: 1.36, y: 0.52, z: -4.7, side: 'R', isDual: true }
      ];
    }

    // Material Karet Ban Hitam Pekat dengan Guratan Realistis
    const tireRubberMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.88,
      metalness: 0.12
    });

    // Material Velg Roda (Alloy Velg Perak Aluminium Terang Berkilau)
    const rimAlloyMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.18
    });

    const tireRadius = 0.52;
    const tireWidth = 0.26;

    // Pasang Poros Gandar (Axle Tubes)
    const distinctAxleZ = Array.from(new Set(wheelCoords.map((c) => c.z)));
    distinctAxleZ.forEach((zVal) => {
      createCylinder(0.08, 0.08, 2.6, 16, frameMat, 0, 0.52, zVal, 0, Math.PI / 2);
      // Differential Pumpkin (Gardan Tengah)
      if (wheelCount === 6 && zVal < 0) {
        createCylinder(0.24, 0.24, 0.35, 16, new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 }), 0, 0.52, zVal, Math.PI / 2);
      }
    });

    // Buat Mesh untuk Setiap Roda
    wheelCoords.forEach((coord) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(coord.x, coord.y, coord.z);
      wheelGroup.userData = { wheelId: coord.id };

      // ── 1. KOMPONEN BAN TERPASANG (Hanya muncul jika ban terpasang) ──
      // Karet Luar Ban
      const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 32);
      tireGeo.rotateZ(Math.PI / 2);
      const tireMesh = new THREE.Mesh(tireGeo, tireRubberMat.clone());
      tireMesh.name = 'tireMesh';
      tireMesh.castShadow = true;
      tireMesh.userData = { wheelId: coord.id, isTire: true };
      wheelGroup.add(tireMesh);

      // Alur Tread Tapak Ban (Wireframe Ring Alur Tapak)
      const treadRingGeo = new THREE.CylinderGeometry(tireRadius + 0.006, tireRadius + 0.006, tireWidth * 0.78, 32, 2, true);
      treadRingGeo.rotateZ(Math.PI / 2);
      const treadRingMat = new THREE.MeshStandardMaterial({
        color: 0x09090b,
        roughness: 0.95,
        wireframe: true
      });
      const treadMesh = new THREE.Mesh(treadRingGeo, treadRingMat);
      treadMesh.name = 'treadMesh';
      wheelGroup.add(treadMesh);

      // Velg Alloy Perak Mengkilap
      const rimGeo = new THREE.CylinderGeometry(tireRadius * 0.62, tireRadius * 0.62, tireWidth + 0.012, 24);
      rimGeo.rotateZ(Math.PI / 2);
      const rimMesh = new THREE.Mesh(rimGeo, rimAlloyMat.clone());
      rimMesh.name = 'rimMesh';
      rimMesh.userData = { wheelId: coord.id, isRim: true };
      wheelGroup.add(rimMesh);

      // Center Hubcap & Mur Roda
      const hubGeo = new THREE.CylinderGeometry(0.14, 0.14, tireWidth + 0.03, 16);
      hubGeo.rotateZ(Math.PI / 2);
      const hubMesh = new THREE.Mesh(hubGeo, new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.9, roughness: 0.2 }));
      hubMesh.name = 'hubMesh';
      wheelGroup.add(hubMesh);

      // ── 2. KOMPONEN KETIKA BAN BELUM DIPASANG (DUDUKAN HUBSPOROS & ROTOR REM) ──
      // A. Ghost Silhouette: Panduan Hologram Halus & Elegan (Transparan Halus, Bukan Tabung Tebal)
      const ghostTireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 32);
      ghostTireGeo.rotateZ(Math.PI / 2);
      const ghostTireMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.08,
        roughness: 0.4,
        metalness: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const ghostTireMesh = new THREE.Mesh(ghostTireGeo, ghostTireMat);
      ghostTireMesh.name = 'ghostTireMesh';
      ghostTireMesh.userData = { wheelId: coord.id };
      wheelGroup.add(ghostTireMesh);

      // B. Ghost Line Edges: Garis Outline CAD Halus
      const ghostEdges = new THREE.EdgesGeometry(ghostTireGeo, 25);
      const ghostLineMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35,
        linewidth: 1.0
      });
      const ghostLine = new THREE.LineSegments(ghostEdges, ghostLineMat);
      ghostLine.name = 'ghostLine';
      ghostLine.userData = { wheelId: coord.id };
      wheelGroup.add(ghostLine);

      // C. Piringan Rem Cakram Berventilasi (Ventilated Disc Brake Rotor Logam)
      const drumGeo = new THREE.CylinderGeometry(tireRadius * 0.52, tireRadius * 0.52, tireWidth * 0.65, 28);
      drumGeo.rotateZ(Math.PI / 2);
      const drumMat = new THREE.MeshStandardMaterial({
        color: 0x64748b, // Titanium Grey Metal
        metalness: 0.88,
        roughness: 0.28
      });
      const brakeDrum = new THREE.Mesh(drumGeo, drumMat);
      brakeDrum.name = 'brakeDrum';
      brakeDrum.castShadow = true;
      brakeDrum.userData = { wheelId: coord.id, isDrum: true };
      wheelGroup.add(brakeDrum);

      // D. Kaliper Rem Industri Satin Charcoal
      const caliperGeo = new THREE.BoxGeometry(tireWidth * 0.68, 0.18, 0.24);
      const caliperMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.38,
        metalness: 0.65
      });
      const caliperMesh = new THREE.Mesh(caliperGeo, caliperMat);
      caliperMesh.name = 'brakeCaliper';
      caliperMesh.position.set(0, tireRadius * 0.34, 0);
      wheelGroup.add(caliperMesh);

      // E. Poros Hub Spindle & Baut Roda Studs Perak
      const studsGeo = new THREE.CylinderGeometry(0.13, 0.13, tireWidth * 0.82, 16);
      studsGeo.rotateZ(Math.PI / 2);
      const studsMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.95,
        roughness: 0.15
      });
      const studsMesh = new THREE.Mesh(studsGeo, studsMat);
      studsMesh.name = 'studsMesh';
      wheelGroup.add(studsMesh);

      // ── 3. INDIKATOR SELEKSI & TARGET DROP (HALO RING) ──
      const haloGeo = new THREE.RingGeometry(tireRadius * 1.06, tireRadius * 1.18, 32);
      haloGeo.rotateY(Math.PI / 2);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.name = 'selectionHalo';
      haloMesh.userData = { wheelId: coord.id };
      haloMesh.visible = false;
      wheelGroup.add(haloMesh);

      // ── 4. HIT TARGET (RAYCASTER DETEKSI KLIK & DND) ──
      const hitGeo = new THREE.CylinderGeometry(tireRadius * 1.35, tireRadius * 1.35, tireWidth * 1.6, 16);
      hitGeo.rotateZ(Math.PI / 2);
      const hitMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.name = 'hitMesh';
      hitMesh.userData = { wheelId: coord.id, isHitTarget: true };
      wheelGroup.add(hitMesh);

      vehicleGroup.add(wheelGroup);
      wheelsMeshMap.current.set(coord.id, wheelGroup);
    });

    // ── RAYCASTER UNTUK INTERAKSI KLIK & HOVER PADA BAN ──
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const wheelMeshes: THREE.Object3D[] = [];
      wheelsMeshMap.current.forEach((grp) => {
        grp.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData.wheelId) {
            wheelMeshes.push(child);
          }
        });
      });

      const intersects = raycaster.intersectObjects(wheelMeshes, false);
      if (intersects.length > 0) {
        const hitWheelId = intersects[0].object.userData.wheelId;
        if (hitWheelId) {
          const tire = getTireForWheelRef.current(hitWheelId);
          onWheelClickRef.current?.(hitWheelId, tire);
        }
      }
    };

    const handlePointerMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const wheelMeshes: THREE.Object3D[] = [];
      wheelsMeshMap.current.forEach((grp) => {
        grp.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData.wheelId) {
            wheelMeshes.push(child);
          }
        });
      });

      const intersects = raycaster.intersectObjects(wheelMeshes, false);
      if (intersects.length > 0) {
        const hitWheelId = intersects[0].object.userData.wheelId;
        renderer.domElement.style.cursor = 'pointer';
        setHoveredWheelId(hitWheelId || null);
      } else {
        renderer.domElement.style.cursor = 'default';
        setHoveredWheelId(null);
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    // ── ANIMATION LOOP ──
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // 1. Controls Update
      controls.update();

      // 2. Animasi Putar Ban (Rolling Tires) - Hanya aktif jika user menekan tombol jalan
      if (isRollingRef.current) {
        const rollSpeed = 1.4 * delta;
        wheelsMeshMap.current.forEach((wheelGroup, wId) => {
          const assignedTire = getTireForWheelRef.current(wId);
          if (assignedTire) {
            wheelGroup.children.forEach((child) => {
              if (
                child.name === 'tireMesh' ||
                child.name === 'treadMesh' ||
                child.name === 'rimMesh' ||
                child.name === 'hubMesh'
              ) {
                child.rotation.x += rollSpeed;
              }
            });
          }
        });
      }

      // 3. Efek Suspensi Berayun Lembut (Idling Realistis)
      vehicleGroup.position.y = Math.sin(time * 2.2) * 0.02;

      // 4. Update Visual Status Roda Terpasang / Seleksi Aktif / Drag Target
      wheelsMeshMap.current.forEach((wheelGroup, wId) => {
        const halo = wheelGroup.getObjectByName('selectionHalo') as THREE.Mesh;
        const tireMesh = wheelGroup.getObjectByName('tireMesh') as THREE.Mesh;
        const treadMesh = wheelGroup.getObjectByName('treadMesh') as THREE.Mesh;
        const rimMesh = wheelGroup.getObjectByName('rimMesh') as THREE.Mesh;
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

        // ── ATURAN UTAMA: Jika ban belum terpakai / terpasang, sembunyikan ban fisik ──
        if (tireMesh) tireMesh.visible = hasTire;
        if (treadMesh) treadMesh.visible = hasTire;
        if (rimMesh) rimMesh.visible = hasTire;
        if (hubMesh) hubMesh.visible = hasTire;

        // Tromol, kaliper rem, dan siluet ghost tire hanya muncul jika ban BELUM dipasang (atau sedang disasar DnD)
        if (brakeDrum) brakeDrum.visible = !hasTire;
        if (brakeCaliper) brakeCaliper.visible = !hasTire;
        if (studsMesh) studsMesh.visible = !hasTire;

        if (ghostTireMesh) {
          ghostTireMesh.visible = !hasTire || isDndHover;
          const gtMat = ghostTireMesh.material as THREE.MeshStandardMaterial;
          if (isDndHover) {
            gtMat.color.setHex(0x10b981); // Emerald glow saat drag over
            gtMat.opacity = 0.35;
          } else if (isSelected) {
            gtMat.color.setHex(0x38bdf8);
            gtMat.opacity = 0.16;
          } else {
            gtMat.color.setHex(0x38bdf8);
            gtMat.opacity = 0.06;
          }
        }

        if (ghostLine) {
          ghostLine.visible = !hasTire || isDndHover;
          const glMat = ghostLine.material as THREE.LineBasicMaterial;
          if (isDndHover) {
            glMat.color.setHex(0x34d399);
            glMat.opacity = 0.85;
          } else if (isSelected) {
            glMat.color.setHex(0x7dd3fc);
            glMat.opacity = 0.55;
          } else {
            glMat.color.setHex(0x38bdf8);
            glMat.opacity = 0.25;
          }
        }

        // Halo Target Denyut Interaktif
        if (halo) {
          halo.visible = isSelected || isDndHover;
          const hMat = halo.material as THREE.MeshBasicMaterial;
          if (isDndHover) {
            hMat.color.setHex(0x10b981);
            const pulseScale = 1.15 + Math.sin(time * 12) * 0.12;
            halo.scale.set(pulseScale, pulseScale, pulseScale);
            halo.rotation.x = time * 2;
          } else if (isSelected) {
            hMat.color.setHex(0x38bdf8);
            const pulseScale = 1.0 + Math.sin(time * 6) * 0.08;
            halo.scale.set(pulseScale, pulseScale, pulseScale);
            halo.rotation.x = Math.sin(time * 3) * 0.1;
          }
        }

        // Velg / Rim warna saat terpasang & terpilih
        if (hasTire && rimMesh) {
          const mat = rimMesh.material as THREE.MeshStandardMaterial;
          if (isDndHover) {
            mat.color.setHex(0x10b981);
            mat.emissive.setHex(0x064e3b);
            mat.emissiveIntensity = 0.8;
          } else if (isSelected) {
            mat.color.setHex(0x38bdf8);
            mat.emissive.setHex(0x075985);
            mat.emissiveIntensity = 0.6;
          } else {
            mat.color.setHex(0xe2e8f0);
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
          }
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // ── RESIZE LISTENER ──
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth || 360;
      const h = container.clientHeight || Math.min(Math.max(window.innerHeight * 0.44, 340), 440);
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
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      renderer.dispose();
      controls.dispose();
    };
  }, [wheelCount, category]);

  // Sync state auto-rotate ke OrbitControls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = isAutoRotate;
    }
  }, [isAutoRotate]);

  // Preset Sudut Kamera
  const handleSetCameraView = (view: 'perspective' | 'top' | 'side') => {
    setCameraView(view);
    if (!cameraRef.current || !controlsRef.current) return;

    setIsAutoRotate(false);
    const presets = getVehicleCameraPreset(wheelCount);
    controlsRef.current.target.copy(presets.target);

    if (view === 'perspective') {
      cameraRef.current.position.copy(presets.perspective);
    } else if (view === 'top') {
      cameraRef.current.position.copy(presets.top);
    } else if (view === 'side') {
      cameraRef.current.position.copy(presets.side);
    }
    controlsRef.current.update();
  };

  const handleResetCamera = () => {
    handleSetCameraView('perspective');
    setIsAutoRotate(false); // Pastikan TETAP TIDAK BERPUTAR saat reset
    setIsRolling(false); // Pastikan BAN TETAP DIAM saat reset
  };

  // Helper raycasting untuk menghitung posisi roda di bawah koordinat layar/kursor
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
      for (const hit of intersects) {
        if (hit.object.userData.wheelId) {
          return hit.object.userData.wheelId as string;
        }
      }
    }

    // Proximity fallback: jika kursor berada dalam radius ~150px dari proyeksi layar roda
    let closestWheelId: string | null = null;
    let minDistance = 150;
    wheelsMeshMap.current.forEach((grp, wId) => {
      const worldPos = new THREE.Vector3();
      grp.getWorldPosition(worldPos);
      worldPos.project(camera);
      if (worldPos.z <= 1) {
        const screenX = ((worldPos.x + 1) * rect.width) / 2 + rect.left;
        const screenY = ((-worldPos.y + 1) * rect.height) / 2 + rect.top;
        const dist = Math.hypot(clientX - screenX, clientY - screenY);
        if (dist < minDistance) {
          minDistance = dist;
          closestWheelId = wId;
        }
      }
    });

    return closestWheelId;
  };

  // Drag over ke area kanvas 3D
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
      onDropTireToWheelRef.current?.(targetWheelId, Number(banId));
    }
    setDndTarget(null);
  };

  return (
    <div className="vs-3d-suite">
      {/* ── 1. KONTROL & TOOLS DI LUAR KANVAS 3D (BAGIAN ATAS - MOBILE RESPONSIVE) ── */}
      <div className="vs-3d-toolbar">
        <div className="vs-3d-toolbar-top-row">
          <div className="vs-3d-badge-info">
            <span className="vs-3d-pulse-dot" />
            <span>3D ({wheelCount} RODA)</span>
          </div>

          <button
            type="button"
            className="vs-3d-tool-btn vs-3d-reset-btn"
            onClick={handleResetCamera}
            title="Reset Sudut Pandang Awal"
          >
            ↺ Reset
          </button>
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
            className={`vs-3d-tool-btn ${cameraView === 'top' ? 'active' : ''}`}
            onClick={() => handleSetCameraView('top')}
            title="Sudut Pandang Atas (Denah Gandar)"
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
            className={`vs-3d-tool-btn ${isAutoRotate ? 'active' : ''}`}
            onClick={() => setIsAutoRotate(!isAutoRotate)}
            title={isAutoRotate ? 'Hentikan Putaran 360°' : 'Mulai Putar Otomatis 360°'}
          >
            🔄 {isAutoRotate ? 'Berputar' : 'Putar 360°'}
          </button>

          <button
            type="button"
            className={`vs-3d-tool-btn ${isRolling ? 'active' : ''}`}
            onClick={() => setIsRolling(!isRolling)}
            title={isRolling ? 'Jeda Animasi Ban Berjalan' : 'Jalankan Ban'}
          >
            🚗 {isRolling ? 'Ban Jalan' : 'Ban Diam'}
          </button>
        </div>
      </div>

      {/* ── 2. KANVAS 3D BERSIH (HANYA MODEL 3D TANPA OVERLAY YANG MENUTUPI) ── */}
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
        {/* Container WebGL Tiga Dimensi */}
        <div ref={containerRef} className="vs-3d-viewport" />

        {/* Overlay Banner Interaktif Saat Drag Tire Masuk ke Kanvas 3D */}
        {isCanvasDragOver && (
          <div className="vs-3d-dnd-overlay">
            {dndHoverWheelId ? (
              <div className="vs-3d-dnd-target-pill vs-3d-dnd-target-pill--active">
                <span className="vs-3d-pulse-dot" style={{ background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                <span>
                  🎯 Lepaskan untuk memasang ke{' '}
                  <strong>
                    [{wheelConfig?.wheels.find((w) => w.id === dndHoverWheelId)?.code || dndHoverWheelId.toUpperCase()}]{' '}
                    {wheelConfig?.wheels.find((w) => w.id === dndHoverWheelId)?.name || `Roda ${dndHoverWheelId}`}
                  </strong>
                </span>
              </div>
            ) : (
              <div className="vs-3d-dnd-target-pill vs-3d-dnd-target-pill--waiting">
                <span className="vs-3d-dnd-target-icon">🛞</span>
                <span>Arahkan kursor ke salah satu slot roda di atas untuk memasang</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 3. DETAIL RODA TERPILIH DI LUAR KANVAS 3D (BAGIAN BAWAH) ── */}
      <div className="vs-3d-status-bar">
        {selectedWheelId ? (
          <div className="vs-3d-wheel-tag">
            <div className="vs-3d-tag-left">
              <span className="vs-3d-code-pill">
                [{activeMeta?.code || selectedWheelId.toUpperCase()}]
              </span>
              <span className="vs-3d-wheel-title">
                {activeMeta?.name || `Roda ${selectedWheelId}`}
              </span>
            </div>

            <div className="vs-3d-tag-right">
              {activeTire ? (
                <span className="vs-3d-tire-pill vs-3d-tire-pill--ok">
                  ✓ #{activeTire.nomor_seri} • {activeTire.merk}
                </span>
              ) : (
                <span className="vs-3d-tire-pill vs-3d-tire-pill--empty">
                  ⚪ Dudukan Kosong (Belum Terpasang)
                </span>
              )}
            </div>
          </div>
        ) : hoveredWheelId ? (
          <div className="vs-3d-wheel-tag vs-3d-wheel-tag--hover">
            <span>👆 Klik Slot {hoveredWheelId.toUpperCase()} untuk memilih</span>
          </div>
        ) : (
          <div className="vs-3d-hint-text">
            <span>👆 Geser untuk memutar • Klik roda untuk detail • Tarik kartu ban ke roda untuk memasang</span>
          </div>
        )}
      </div>
    </div>
  );
}

