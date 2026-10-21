import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const FORKLIFT_MAX_LIFT = 1.05;

/** Counterbalanced forklift; wheel slots remain separate for inventory interaction. */
export function buildForkliftModel(parent: THREE.Group) {
  const body = new THREE.Group();
  body.name = 'forkliftBody';
  parent.add(body);
  const carriage = new THREE.Group();
  carriage.name = 'forkliftCarriage';
  parent.add(carriage);
  const orange = new THREE.MeshPhysicalMaterial({ color: 0xd97518, roughness: 0.34, metalness: 0.22, clearcoat: 0.65, clearcoatRoughness: 0.24 });
  const darkPaint = new THREE.MeshStandardMaterial({ color: 0x252c30, roughness: 0.43, metalness: 0.45 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x465058, roughness: 0.38, metalness: 0.85 });
  const polished = new THREE.MeshStandardMaterial({ color: 0xc7d1d5, roughness: 0.2, metalness: 1 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x151b1e, roughness: 0.91 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x282c2e, roughness: 0.85 });
  const amber = new THREE.MeshPhysicalMaterial({ color: 0xffad26, roughness: 0.24, clearcoat: 1, emissive: 0xe77b14, emissiveIntensity: 0.18 });
  const red = new THREE.MeshStandardMaterial({ color: 0xa71c17, roughness: 0.25, emissive: 0x5b0805, emissiveIntensity: 0.15 });
  const lens = new THREE.MeshPhysicalMaterial({ color: 0xc6dce5, roughness: 0.15, metalness: 0.3, clearcoat: 1, emissive: 0xb0c5ce, emissiveIntensity: 0.16 });
  const label = new THREE.MeshStandardMaterial({ color: 0xdedbc7, roughness: 0.6 });

  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, group = body) => {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z);
    part.castShadow = true;
    part.receiveShadow = true;
    group.add(part);
    return part;
  };
  const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, radius = 0.025, group = body) =>
    mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)), material, x, y, z, group);
  const cylinder = (r: number, h: number, material: THREE.Material, x: number, y: number, z: number, group = body) =>
    mesh(new THREE.CylinderGeometry(r, r, h, 24), material, x, y, z, group);
  const tube = (points: number[][], r: number, material: THREE.Material) =>
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number]))), 20, r, 6, false), material, 0, 0, 0);
  const beam = (a: THREE.Vector3, b: THREE.Vector3, width: number, material: THREE.Material) => {
    const part = box(width, a.distanceTo(b), width, material, 0, 0, 0, 0.015);
    part.position.copy(a.clone().add(b).multiplyScalar(0.5));
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return part;
  };

  // Low chassis and rounded cast counterweight, clear of all four tyre envelopes.
  box(1.35, 0.26, 2.4, darkPaint, 0, 0.51, 0.02, 0.07);
  box(1.36, 0.55, 0.86, orange, 0, 0.87, -1.02, 0.18);
  box(1.32, 0.23, 0.88, darkPaint, 0, 0.45, -1.05, 0.1);
  box(1.19, 0.31, 0.95, orange, 0, 1.04, -0.49, 0.09).rotation.x = -0.055;
  box(1.28, 0.16, 1.12, orange, 0, 0.73, 0.33, 0.05);
  box(1.04, 0.028, 0.93, rubber, 0, 0.825, 0.35);
  for (let z = -0.04; z < 0.79; z += 0.08) box(0.96, 0.012, 0.014, darkPaint, 0, 0.845, z);
  // Rear cooling grille, tow pin, lights and side service panels.
  box(0.83, 0.27, 0.025, rubber, 0, 0.87, -1.458, 0.045);
  for (let y = 0.77; y < 0.99; y += 0.045) box(0.74, 0.014, 0.025, steel, 0, y, -1.477);
  box(0.22, 0.13, 0.15, steel, 0, 0.42, -1.5);
  cylinder(0.027, 0.22, polished, 0, 0.47, -1.53);
  for (const sign of [-1, 1]) {
    box(0.21, 0.12, 0.033, darkPaint, sign * 0.51, 1.035, -1.438);
    box(0.12, 0.075, 0.018, red, sign * 0.54, 1.04, -1.46);
    box(0.05, 0.075, 0.018, amber, sign * 0.45, 1.04, -1.46);
    box(0.023, 0.25, 0.55, darkPaint, sign * 0.674, 0.91, -0.44);
    for (let z = -0.65; z < -0.2; z += 0.065) box(0.03, 0.18, 0.02, rubber, sign * 0.69, 0.92, z);
    box(0.028, 0.12, 0.19, label, sign * 0.69, 0.95, -1.05);
    // Two anti-slip entry steps and a grab handle.
    for (const y of [0.35, 0.56]) {
      box(0.26, 0.045, 0.46, darkPaint, sign * 0.74, y, 0.19);
      for (let z = 0.01; z < 0.4; z += 0.07) box(0.22, 0.009, 0.02, steel, sign * 0.74, y + 0.026, z);
    }
    tube([[sign * 0.64, 1.18, 0.68], [sign * 0.76, 1.29, 0.65], [sign * 0.76, 1.65, 0.63], [sign * 0.64, 1.73, 0.64]], 0.025, rubber);
    // Pressed arches cover the front tyres without hiding their outer faces.
    const arch = new THREE.Shape();
    arch.absarc(-1.1, 0.45, 0.55, 0.1, Math.PI - 0.1, false);
    arch.absarc(-1.1, 0.45, 0.505, Math.PI - 0.1, 0.1, true);
    arch.closePath();
    const geo = new THREE.ExtrudeGeometry(arch, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 20 });
    geo.translate(0, 0, -0.16);
    geo.rotateY(Math.PI / 2);
    mesh(geo, orange, sign * 0.83, 0, 0);
  }

  // Open overhead guard: separate pillars and roof slats, with a visible operator area.
  for (const sign of [-1, 1]) {
    beam(new THREE.Vector3(sign * 0.64, 1.08, -0.79), new THREE.Vector3(sign * 0.65, 2.5, -0.89), 0.075, darkPaint);
    beam(new THREE.Vector3(sign * 0.64, 0.84, 0.69), new THREE.Vector3(sign * 0.65, 2.5, 0.58), 0.075, darkPaint);
    box(0.095, 0.09, 1.66, darkPaint, sign * 0.67, 2.54, -0.15);
    box(0.2, 0.14, 0.14, darkPaint, sign * 0.56, 2.47, 0.75, 0.035);
    box(0.145, 0.09, 0.02, lens, sign * 0.56, 2.47, 0.831);
  }
  for (const z of [-0.95, 0.65]) box(1.39, 0.09, 0.1, darkPaint, 0, 2.54, z);
  for (let z = -0.75; z <= 0.45; z += 0.24) box(1.29, 0.035, 0.09, steel, 0, 2.55, z);
  // Beacon on its rubber base; no intrusive flashing while inspecting tyre data.
  cylinder(0.09, 0.04, rubber, 0.48, 2.61, -0.76);
  cylinder(0.07, 0.13, amber, 0.48, 2.695, -0.76);
  mesh(new THREE.SphereGeometry(0.07, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), amber, 0.48, 2.76, -0.76);

  // Sprung vinyl seat, backrest, armrest, belt buckle and steering controls.
  box(0.38, 0.12, 0.42, steel, 0, 1.19, -0.4);
  box(0.58, 0.14, 0.57, seatMat, 0, 1.31, -0.35, 0.055);
  const seatBack = box(0.58, 0.55, 0.13, seatMat, 0, 1.62, -0.63, 0.055);
  seatBack.rotation.x = -0.1;
  for (const x of [-0.25, 0.25]) box(0.04, 0.1, 0.48, rubber, x, 1.38, -0.34);
  box(0.08, 0.08, 0.055, red, 0.34, 1.34, -0.44);
  box(0.09, 0.07, 0.37, seatMat, 0.38, 1.54, -0.36);
  beam(new THREE.Vector3(0, 0.88, 0.59), new THREE.Vector3(0, 1.5, 0.4), 0.065, darkPaint);
  const steering = new THREE.Group();
  steering.position.set(0, 1.54, 0.39);
  steering.rotation.x = -Math.PI / 2 + 0.4;
  body.add(steering);
  mesh(new THREE.TorusGeometry(0.19, 0.02, 8, 32), rubber, 0, 0, 0, steering);
  mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.04, 16).rotateX(Math.PI / 2), darkPaint, 0, 0, 0, steering);
  for (let i = 0; i < 3; i++) box(0.02, 0.18, 0.018, steel, Math.sin(i * Math.PI * 2 / 3) * 0.085, Math.cos(i * Math.PI * 2 / 3) * 0.085, 0, 0.005, steering).rotation.z = -i * Math.PI * 2 / 3;
  box(0.36, 0.16, 0.18, darkPaint, 0, 1.31, 0.64, 0.035);
  box(0.17, 0.065, 0.02, lens, 0, 1.35, 0.542);
  for (let i = 0; i < 3; i++) {
    cylinder(0.015, 0.23, steel, 0.35 + i * 0.085, 1.1, 0.32);
    mesh(new THREE.SphereGeometry(0.035, 12, 8), rubber, 0.35 + i * 0.085, 1.23, 0.32);
  }
  for (const x of [-0.17, 0.17]) box(0.12, 0.035, 0.2, rubber, x, 0.89, 0.59).rotation.x = -0.3;

  // Twin channel mast, exposed inner tracks, tilt cylinders and hydraulic hoses.
  for (const sign of [-1, 1]) {
    box(0.11, 2.65, 0.2, darkPaint, sign * 0.52, 1.59, 1.47);
    for (const z of [1.36, 1.58]) box(0.2, 2.65, 0.035, steel, sign * 0.52, 1.59, z);
    box(0.055, 2.47, 0.1, polished, sign * 0.427, 1.61, 1.53);
    cylinder(0.065, 0.48, darkPaint, sign * 0.54, 0.74, 1.08).rotation.x = 0.48;
    cylinder(0.029, 0.32, polished, sign * 0.54, 1.07, 1.24).rotation.x = 0.48;
    tube([[sign * 0.59, 0.66, 0.75], [sign * 0.65, 0.92, 1.07], [sign * 0.59, 1.25, 1.3]], 0.018, rubber);
    for (const y of [0.37, 2.82]) cylinder(0.055, 0.025, polished, sign * 0.52, y, 1.614).rotation.x = Math.PI / 2;
  }
  box(1.17, 0.11, 0.25, darkPaint, 0, 2.89, 1.47);
  box(1.17, 0.14, 0.23, darkPaint, 0, 0.32, 1.47);
  cylinder(0.08, 1.18, darkPaint, 0, 0.86, 1.47);
  const piston = cylinder(0.037, 1, polished, 0, 0, 1.47);
  parent.attach(piston);
  const chains = [-0.32, 0.32].map(x => {
    const chain = box(0.028, 1, 0.035, steel, x, 0, 1.61, 0.004);
    parent.attach(chain);
    return chain;
  });

  // Carriage/load backrest and two forged forks with tapered blade tips.
  box(1.25, 0.12, 0.15, steel, 0, 0.57, 1.69, 0.015, carriage);
  box(1.25, 0.1, 0.15, steel, 0, 1.27, 1.69, 0.015, carriage);
  box(1.32, 0.06, 0.065, darkPaint, 0, 1.56, 1.72, 0.015, carriage);
  for (let x = -0.6; x <= 0.61; x += 0.2) box(0.035, 0.98, 0.055, darkPaint, x, 1.08, 1.72, 0.009, carriage);
  box(0.7, 0.07, 0.12, steel, 0, 1.6, 1.47, 0.015, carriage);
  for (const x of [-0.36, 0.36]) {
    const profile = new THREE.Shape();
    profile.moveTo(-1.72, 1.27);
    profile.lineTo(-1.84, 1.27);
    profile.lineTo(-1.84, 0.3);
    profile.quadraticCurveTo(-1.84, 0.25, -1.91, 0.25);
    profile.lineTo(-3.04, 0.205);
    profile.lineTo(-3.11, 0.16);
    profile.lineTo(-1.83, 0.16);
    profile.quadraticCurveTo(-1.72, 0.16, -1.72, 0.3);
    profile.closePath();
    const geo = new THREE.ExtrudeGeometry(profile, { depth: 0.15, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 });
    geo.translate(0, 0, -0.075);
    geo.rotateY(Math.PI / 2);
    mesh(geo, steel, x, 0, 0, carriage);
    box(0.13, 0.05, 0.19, polished, x, 1.315, 1.73, 0.01, carriage);
  }

  // Merge each rigid assembly independently so lift movement costs only a few draw calls.
  for (const assembly of [body, carriage]) {
    assembly.updateMatrixWorld(true);
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const originals: THREE.Mesh[] = [];
    assembly.traverse(object => { if (object instanceof THREE.Mesh) originals.push(object); });
    for (const part of originals) {
      const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().copy(assembly.matrixWorld).invert().multiply(part.matrixWorld));
      const material = part.material as THREE.Material;
      const batch = batches.get(material) ?? [];
      batch.push(geometry);
      batches.set(material, batch);
      part.geometry.dispose();
    }
    assembly.clear();
    for (const [material, geometries] of batches) {
      const merged = mergeGeometries(geometries, false);
      geometries.forEach(geometry => geometry.dispose());
      if (merged) mesh(merged, material, 0, 0, 0, assembly);
    }
  }
  const setLift = (height: number) => {
    const lift = THREE.MathUtils.clamp(Number.isFinite(height) ? height : 0, 0, FORKLIFT_MAX_LIFT);
    carriage.position.y = lift;
    piston.scale.y = 0.15 + lift;
    piston.position.y = 1.45 + (0.15 + lift) / 2;
    for (const chain of chains) {
      chain.scale.y = 2.84 - (1.6 + lift);
      chain.position.y = (2.84 + 1.6 + lift) / 2;
    }
  };
  setLift(0);
  return { carriage, piston, setLift };
}
