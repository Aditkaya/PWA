import * as THREE from 'three';

export interface VehiclePlateIdentity {
  label: string;
  value: string;
}

export function getVehiclePlateIdentity(
  plate?: string | null,
  code?: string | null,
  kir?: string | null,
): VehiclePlateIdentity {
  const clean = (value?: string | null) => {
    const text = value?.trim().replace(/\s+/g, ' ').toUpperCase() || '';
    return ['0', '-', 'NULL', 'N/A'].includes(text) ? '' : text;
  };
  if (clean(plate)) return { label: 'Nomor plat', value: clean(plate) };
  if (clean(code)) return { label: 'Kode unit · tanpa plat', value: clean(code) };
  if (clean(kir)) return { label: 'Nomor KIR · tanpa plat', value: clean(kir) };
  return { label: 'Nomor plat', value: '' };
}

/** One shared canvas texture for physical plates, disposed with the vehicle scene. */
export function addVehiclePlates(parent: THREE.Group, wheelCount: number, identity: VehiclePlateIdentity) {
  if (!identity.value) return;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#111820';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#dbe2e8';
  ctx.lineWidth = 6;
  ctx.strokeRect(15, 15, 994, 290);
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fontSize = 132;
  ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  while (ctx.measureText(identity.value).width > 900 && fontSize > 16) {
    fontSize -= 2;
    ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  }
  ctx.fillText(identity.value, 512, 137, 900);
  ctx.font = '600 34px Arial, sans-serif';
  ctx.fillStyle = '#bac7d3';
  ctx.fillText(identity.label.toUpperCase(), 512, 253, 900);
  // Fasteners are drawn into the texture to avoid extra geometry/draw calls.
  for (const x of [43, 981]) {
    ctx.beginPath();
    ctx.arc(x, 160, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const faceMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  const backingMaterial = new THREE.MeshStandardMaterial({ color: 0x27313b, metalness: 0.65, roughness: 0.45 });
  const width = wheelCount === 4 ? 0.56 : 0.72;
  const height = width * canvas.height / canvas.width;
  const backingGeometry = new THREE.BoxGeometry(width + 0.025, height + 0.025, 0.025);
  const faceGeometry = new THREE.PlaneGeometry(width, height);
  const place = (x: number, y: number, z: number, rotationY = 0) => {
    const plate = new THREE.Group();
    plate.name = 'vehicleNumberPlate';
    plate.position.set(x, y, z);
    plate.rotation.y = rotationY;
    const backing = new THREE.Mesh(backingGeometry, backingMaterial);
    const face = new THREE.Mesh(faceGeometry, faceMaterial);
    face.position.z = 0.014;
    plate.add(backing, face);
    parent.add(plate);
  };
  if (wheelCount === 4) {
    // Counterweight sides and rear keep the identity clear of the moving mast.
    place(0, 0.6, -1.51, Math.PI);
    place(-0.706, 0.93, -1.02, -Math.PI / 2);
    place(0.706, 0.93, -1.02, Math.PI / 2);
  } else if (wheelCount === 6) {
    place(0, 0.66, 3.035);
    place(0, 0.72, -2.98, Math.PI);
  } else if (wheelCount === 8 || wheelCount === 12) {
    const half = wheelCount === 8 ? 3.9 : 5.6;
    place(0, 1.18, half - 0.075);
    place(0, 0.94, -half - 0.09, Math.PI);
  }
}
