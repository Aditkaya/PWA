import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Skeletal container trailer; existing axle/tyre coordinates remain authoritative. */
export function buildChassisModel(parent: THREE.Group, wheelCount: 8 | 12) {
  const length = wheelCount === 8 ? 7.8 : 11.2;
  const half = length / 2;
  const axlePositions = wheelCount === 8 ? [-1.4, -2.8] : [-1.9, -3.3, -4.7];
  const landingZ = half - 1.7;
  const frame = new THREE.Group();
  frame.name = 'containerChassis';
  parent.add(frame);
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x294b61, metalness: 0.4, roughness: 0.43, clearcoat: 0.32, clearcoatRoughness: 0.38 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x535d64, metalness: 0.85, roughness: 0.4 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x292f34, metalness: 0.65, roughness: 0.53 });
  const zinc = new THREE.MeshStandardMaterial({ color: 0xacb5b9, metalness: 0.88, roughness: 0.32 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x191e22, roughness: 0.91 });
  const lockPaint = new THREE.MeshStandardMaterial({ color: 0xc59632, metalness: 0.6, roughness: 0.4 });
  const white = new THREE.MeshStandardMaterial({ color: 0xd8ded9, roughness: 0.4, metalness: 0.25 });
  const red = new THREE.MeshPhysicalMaterial({ color: 0xb62320, roughness: 0.27, clearcoat: 0.85, emissive: 0x740e08, emissiveIntensity: 0.12 });
  const amber = new THREE.MeshPhysicalMaterial({ color: 0xe39623, roughness: 0.28, clearcoat: 0.8, emissive: 0x9d580a, emissiveIntensity: 0.12 });
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z);
    part.castShadow = true;
    part.receiveShadow = true;
    frame.add(part);
    return part;
  };
  const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, radius = 0.012) =>
    mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)), material, x, y, z);
  const cylinder = (radius: number, height: number, material: THREE.Material, x: number, y: number, z: number, axis: 'x' | 'y' | 'z' = 'y') => {
    const part = mesh(new THREE.CylinderGeometry(radius, radius, height, 20), material, x, y, z);
    if (axis === 'x') part.rotation.z = Math.PI / 2;
    if (axis === 'z') part.rotation.x = Math.PI / 2;
    return part;
  };
  const beam = (a: THREE.Vector3, b: THREE.Vector3, width: number, material: THREE.Material) => {
    const part = box(width, a.distanceTo(b), width, material, 0, 0, 0);
    part.position.copy(a.clone().add(b).multiplyScalar(0.5));
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return part;
  };
  const hose = (points: number[][]) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))), 20, 0.016, 6, false), rubber, 0, 0, 0);

  // Built-up I beams: thin webs, wide flanges and a shallow front coupling section.
  for (const x of [-0.62, 0.62]) {
    box(0.065, 0.29, length - 1.55, paint, x, 1.13, -0.705);
    box(0.25, 0.045, length - 0.14, paint, x, 1.295, 0);
    box(0.25, 0.045, length - 1.55, steel, x, 0.97, -0.705);
    box(0.065, 0.16, 1.41, paint, x, 1.195, half - 0.775);
    box(0.25, 0.04, 1.41, steel, x, 1.095, half - 0.775);
    // The neck transition is a sloping reinforcement, not a disconnected floating rail.
    beam(new THREE.Vector3(x, 0.98, half - 1.78), new THREE.Vector3(x, 1.11, half - 1.43), 0.12, paint);
    for (let z = -half + 0.4; z < half - 0.2; z += 0.7) {
      box(0.14, 0.22, 0.025, steel, x, 1.13, z);
      for (const y of [1.05, 1.22]) cylinder(0.021, 0.02, zinc, x + Math.sign(x) * 0.08, y, z, 'x');
    }
  }
  for (let z = -half + 0.35; z < half - 0.15; z += 0.78) {
    box(1.26, 0.13, 0.05, paint, 0, 1.19, z);
    box(1.38, 0.035, 0.14, steel, 0, 1.275, z);
  }
  // Front and rear transverse bolsters support the actual corner twistlocks.
  for (const z of [-half + 0.22, half - 0.22]) {
    box(2.48, 0.23, 0.25, paint, 0, 1.18, z, 0.02);
    box(2.5, 0.045, 0.32, steel, 0, 1.315, z);
    for (const sign of [-1, 1]) {
      beam(new THREE.Vector3(sign * 0.62, 1.14, z + (z > 0 ? -0.53 : 0.53)), new THREE.Vector3(sign * 1.1, 1.14, z), 0.09, paint);
      box(0.27, 0.1, 0.25, darkSteel, sign * 1.1, 1.385, z, 0.025);
      cylinder(0.038, 0.1, zinc, sign * 1.1, 1.46, z);
      box(0.17, 0.06, 0.085, lockPaint, sign * 1.1, 1.51, z, 0.025).rotation.y = Math.PI / 2;
      cylinder(0.026, 0.21, steel, sign * 1.1, 1.2, z - 0.16, 'x');
      box(0.06, 0.1, 0.055, lockPaint, sign * 1.22, 1.2, z - 0.16);
    }
  }

  // Fifth-wheel rubbing plate and kingpin underneath the trailer nose.
  box(1.3, 0.065, 1.12, steel, 0, 1.065, half - 0.76);
  cylinder(0.072, 0.055, zinc, 0, 1.012, half - 0.8);
  cylinder(0.046, 0.16, darkSteel, 0, 0.925, half - 0.8);
  // Coupling panel with separate air-line/electrical sockets.
  box(0.7, 0.22, 0.055, darkSteel, 0, 1.27, half - 0.03);
  for (let i = 0; i < 3; i++) cylinder(0.037, 0.04, i === 0 ? red : i === 1 ? lockPaint : rubber, -0.2 + i * 0.2, 1.29, half + 0.015, 'z');
  hose([[-0.2, 1.23, half - 0.05], [-0.28, 1.03, half - 0.5], [-0.45, 1.04, landingZ], [-0.45, 0.88, axlePositions[0] + 0.55]]);

  // Extended landing gear grounds the uncoupled trailer at the front.
  for (const sign of [-1, 1]) {
    const x = sign * 0.83;
    box(0.2, 0.66, 0.21, paint, x, 0.77, landingZ);
    box(0.14, 0.51, 0.15, zinc, x, 0.3, landingZ);
    box(0.4, 0.06, 0.35, steel, x, 0.035, landingZ, 0.025);
    cylinder(0.055, 0.29, darkSteel, x, 0.12, landingZ, 'x');
    box(0.31, 0.12, 0.32, paint, x, 1.06, landingZ);
    box(0.13, 0.24, 0.23, darkSteel, x + sign * 0.14, 0.83, landingZ);
    beam(new THREE.Vector3(x, 0.48, landingZ), new THREE.Vector3(sign * 0.62, 1.08, landingZ + 0.78), 0.055, steel);
  }
  cylinder(0.022, 1.75, steel, 0, 0.83, landingZ, 'x');
  beam(new THREE.Vector3(-1.05, 0.83, landingZ), new THREE.Vector3(-1.05, 0.64, landingZ + 0.2), 0.025, zinc);
  cylinder(0.035, 0.15, rubber, -1.13, 0.64, landingZ + 0.2, 'x');

  // Side protection rails and amber markers, stopping before the tandem/tridem tyres.
  const guardStart = axlePositions[0] + 0.69;
  const guardEnd = landingZ - 0.35;
  const guardLength = guardEnd - guardStart;
  for (const sign of [-1, 1]) {
    for (const y of [0.53, 0.72]) box(0.055, 0.075, guardLength, zinc, sign * 1.1, y, (guardStart + guardEnd) / 2);
    for (let z = guardStart + 0.12; z < guardEnd; z += 0.8) {
      box(0.05, 0.53, 0.045, steel, sign * 1.07, 0.79, z);
      beam(new THREE.Vector3(sign * 0.65, 1.12, z), new THREE.Vector3(sign * 1.1, 0.98, z), 0.04, steel);
      box(0.02, 0.06, 0.15, amber, sign * 1.139, 0.72, z);
      box(0.022, 0.045, 0.22, white, sign * 1.139, 0.53, z + 0.25);
    }
  }

  // Leaf packs, hangers, brake chambers and axle plumbing.
  for (const z of axlePositions) {
    for (const sign of [-1, 1]) {
      for (let layer = 0; layer < 4; layer++) box(0.13, 0.024, 0.92 - layer * 0.12, darkSteel, sign * 0.62, 0.62 + layer * 0.028, z);
      for (const dz of [-0.46, 0.46]) {
        box(0.14, 0.23, 0.1, paint, sign * 0.62, 0.85, z + dz);
        cylinder(0.038, 0.17, zinc, sign * 0.62, 0.76, z + dz, 'x');
      }
      cylinder(0.16, 0.19, darkSteel, sign * 0.8, 0.52, z, 'x');
      cylinder(0.095, 0.16, steel, sign * 0.68, 0.58, z + 0.25, 'z');
      hose([[sign * 0.45, 0.94, z + 0.45], [sign * 0.78, 0.77, z + 0.42], [sign * 0.68, 0.61, z + 0.31]]);
      // Curved thermoplastic fender over both tyres; outer sidewalls remain accessible.
      const arch = new THREE.Shape();
      arch.absarc(-z, 0.52, 0.63, 0.15, Math.PI - 0.15, false);
      arch.absarc(-z, 0.52, 0.592, Math.PI - 0.15, 0.15, true);
      arch.closePath();
      const geo = new THREE.ExtrudeGeometry(arch, { depth: 0.72, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 24 });
      geo.translate(0, 0, -0.36);
      geo.rotateY(Math.PI / 2);
      mesh(geo, rubber, sign * 1.22, 0, 0);
      beam(new THREE.Vector3(sign * 0.65, 1.1, z), new THREE.Vector3(sign * 1.25, 1.13, z), 0.035, zinc);
    }
  }
  cylinder(0.17, 0.95, darkSteel, 0, 0.79, axlePositions[0] + 0.83, 'x');
  for (const x of [-0.32, 0.32]) cylinder(0.177, 0.04, zinc, x, 0.79, axlePositions[0] + 0.83, 'x');

  // Rear underrun bar, light clusters, reflective tape and articulated mud flaps.
  const rear = -half + 0.02;
  box(2.34, 0.21, 0.14, paint, 0, 0.94, rear, 0.025);
  box(2.3, 0.13, 0.14, steel, 0, 0.43, rear - 0.035, 0.025);
  const mudflaps: THREE.Mesh[] = [];
  for (const sign of [-1, 1]) {
    box(0.09, 0.44, 0.085, steel, sign * 0.81, 0.67, rear);
    box(0.67, 0.16, 0.075, rubber, sign * 0.75, 0.95, rear - 0.09, 0.025);
    for (let i = 0; i < 3; i++) cylinder(0.054, 0.025, i === 0 ? amber : i === 1 ? red : white, sign * (0.5 + i * 0.22), 0.95, rear - 0.14, 'z');
    box(0.21, 0.055, 0.012, red, sign * 0.93, 0.43, rear - 0.111);
    box(0.21, 0.055, 0.012, white, sign * 0.69, 0.43, rear - 0.111);
    const flapZ = axlePositions[axlePositions.length - 1] - 0.66;
    const flap = box(0.7, 0.57, 0.035, rubber, sign * 1.22, 0.85, flapZ, 0.01);
    flap.geometry.translate(0, -0.285, 0);
    mudflaps.push(flap);
    box(0.71, 0.035, 0.045, zinc, sign * 1.22, 0.87, flapZ);
  }
  box(0.38, 0.13, 0.018, rubber, 0, 0.93, rear - 0.085);

  for (const flap of mudflaps) parent.attach(flap);
  frame.updateMatrixWorld(true);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const child of [...frame.children]) {
    if (!(child instanceof THREE.Mesh)) continue;
    const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    geometry.applyMatrix4(child.matrix);
    const material = child.material as THREE.Material;
    const batch = batches.get(material) ?? [];
    batch.push(geometry);
    batches.set(material, batch);
    child.geometry.dispose();
    frame.remove(child);
  }
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries, false);
    geometries.forEach(geometry => geometry.dispose());
    if (merged) mesh(merged, material, 0, 0, 0);
  }
  return { mudflapLeft: mudflaps[0], mudflapRight: mudflaps[1], axlePositions, length };
}
