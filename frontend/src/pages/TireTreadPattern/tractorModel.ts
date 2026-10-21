import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Cab-over tractor in metres. Axle centres match the interactive wheel slots. */
export function buildTractorModel(parent: THREE.Group) {
  const body = new THREE.Group();
  parent.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x087caa, metalness: 0.3, roughness: 0.29, clearcoat: 0.85, clearcoatRoughness: 0.2 });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xe6e9e7, metalness: 0.12, roughness: 0.32, clearcoat: 0.65 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x30383d, metalness: 0.72, roughness: 0.46 });
  const alloy = new THREE.MeshStandardMaterial({ color: 0xb7c1c5, metalness: 0.92, roughness: 0.29 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdbe1e3, metalness: 1, roughness: 0.17 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x181d21, roughness: 0.87 });
  const grille = new THREE.MeshStandardMaterial({ color: 0x10191e, metalness: 0.3, roughness: 0.57 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x183540, metalness: 0.28, roughness: 0.09, clearcoat: 1, clearcoatRoughness: 0.03 });
  const lens = new THREE.MeshPhysicalMaterial({ color: 0xd7e8ee, metalness: 0.25, roughness: 0.16, clearcoat: 1, emissive: 0xc4deeb, emissiveIntensity: 0.18 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xe89628, metalness: 0.1, roughness: 0.3, emissive: 0xc76b13, emissiveIntensity: 0.12 });
  const red = new THREE.MeshStandardMaterial({ color: 0x8e1619, roughness: 0.26, emissive: 0x901012, emissiveIntensity: 0.18 });

  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z);
    part.castShadow = true;
    part.receiveShadow = true;
    body.add(part);
    return part;
  };
  const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, radius = 0.025) =>
    mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)), material, x, y, z);
  const cylinder = (radius: number, length: number, material: THREE.Material, x: number, y: number, z: number) =>
    mesh(new THREE.CylinderGeometry(radius, radius, length, 32), material, x, y, z);
  const tube = (points: THREE.Vector3[], radius: number, material: THREE.Material) =>
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, radius, 6, false), material, 0, 0, 0);
  const sidePanel = (shape: THREE.Shape, width: number, material: THREE.Material, x = 0) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2, steps: 1, curveSegments: 24 });
    geo.translate(0, 0, -width / 2);
    geo.rotateY(Math.PI / 2);
    return mesh(geo, material, x, 0, 0);
  };

  // Ladder frame, crossmembers, suspension and a visible propeller shaft.
  for (const x of [-0.48, 0.48]) {
    box(0.14, 0.28, 5.9, steel, x, 0.77, 0);
    for (const z of [-1.7, 2.1]) {
      for (let i = 0; i < 4; i++) box(0.1, 0.023, 0.9 - i * 0.13, steel, x, 0.62 + i * 0.028, z);
      cylinder(0.13, 0.22, rubber, x, 0.88, z - 0.22);
    }
  }
  for (let z = -2.65; z < 2.6; z += 0.7) box(0.95, 0.12, 0.11, steel, 0, 0.76, z);
  const driveshaft = cylinder(0.055, 2.8, steel, 0, 0.55, -0.3);
  driveshaft.rotation.x = Math.PI / 2;

  // Lower cab is a continuous pressed panel with a real opening over the steer axle.
  const lower = new THREE.Shape();
  lower.moveTo(-0.68, 1.72);
  lower.lineTo(-2.74, 1.72);
  lower.quadraticCurveTo(-2.88, 1.7, -2.88, 1.55);
  lower.lineTo(-2.88, 0.58);
  lower.lineTo(-2.737, 0.584);
  lower.absarc(-2.1, 0.52, 0.64, Math.PI - 0.1, 0.1, true);
  lower.lineTo(-0.68, 0.58);
  lower.closePath();
  sidePanel(lower, 2.13, paint);

  // Sculpted upper cab and a gently raked roof, rather than stacked cubes.
  const upper = new THREE.Shape();
  upper.moveTo(-0.68, 1.7);
  upper.lineTo(-2.82, 1.7);
  upper.lineTo(-2.67, 2.65);
  upper.quadraticCurveTo(-2.65, 2.86, -2.43, 2.88);
  upper.lineTo(-0.92, 2.98);
  upper.quadraticCurveTo(-0.67, 2.98, -0.67, 2.75);
  upper.closePath();
  sidePanel(upper, 2.1, white);
  box(2.12, 0.055, 2.04, paint, 0, 1.77, 1.75);
  const roof = box(2.04, 0.19, 1.82, white, 0, 2.95, 1.67, 0.085);
  roof.rotation.x = 0.035;

  // Flush glazing with rubber seals and windscreen wipers.
  const seal = box(1.94, 0.84, 0.048, rubber, 0, 2.29, 2.76, 0.07);
  seal.rotation.x = -0.155;
  const windshield = box(1.84, 0.73, 0.027, glass, 0, 2.3, 2.79, 0.06);
  windshield.rotation.x = -0.155;
  box(0.025, 0.73, 0.03, rubber, 0, 2.3, 2.81).rotation.x = -0.155;
  const visor = box(2.16, 0.1, 0.29, paint, 0, 2.79, 2.7, 0.04);
  visor.rotation.x = -0.12;
  for (const x of [-0.48, 0.48]) {
    tube([new THREE.Vector3(x - 0.2, 1.91, 2.88), new THREE.Vector3(x, 2.06, 2.86), new THREE.Vector3(x + 0.26, 2.1, 2.85)], 0.012, rubber);
    box(0.48, 0.024, 0.023, rubber, x + 0.03, 2.09, 2.87).rotation.z = 0.08;
  }

  for (const sign of [-1, 1]) {
    const x = sign * 1.084;
    box(0.028, 0.78, 1.32, rubber, x, 2.26, 1.77, 0.06);
    box(0.032, 0.68, 1.2, glass, x + sign * 0.018, 2.28, 1.77, 0.055);
    box(0.041, 0.72, 0.032, rubber, x + sign * 0.023, 2.26, 2.09);
    // Door perimeter, handle, tread plates and side markers.
    tube([new THREE.Vector3(x, 1.24, 1.07), new THREE.Vector3(x, 1.81, 0.91), new THREE.Vector3(x, 2.68, 0.98)], 0.008, rubber);
    box(0.035, 0.047, 0.18, rubber, x + sign * 0.025, 1.82, 1.14);
    box(0.043, 0.025, 0.13, chrome, x + sign * 0.04, 1.84, 1.14);
    for (const y of [0.54, 0.76]) {
      box(0.23, 0.055, 0.38, alloy, sign * 1.1, y, 0.7);
      for (let z = 0.56; z < 0.88; z += 0.065) box(0.18, 0.008, 0.018, rubber, sign * 1.11, y + 0.029, z);
    }
    box(0.04, 0.065, 0.15, amber, sign * 1.1, 1.27, 2.55);
    // Mirrors on articulated brackets; reflective face points back at the driver.
    tube([new THREE.Vector3(sign * 1.05, 2.54, 2.34), new THREE.Vector3(sign * 1.32, 2.54, 2.47), new THREE.Vector3(sign * 1.36, 2.2, 2.47)], 0.022, steel);
    box(0.15, 0.44, 0.2, rubber, sign * 1.37, 2.27, 2.49, 0.06);
    box(0.12, 0.36, 0.018, chrome, sign * 1.37, 2.27, 2.382, 0.025);
    box(0.14, 0.17, 0.18, rubber, sign * 1.37, 1.96, 2.49, 0.04);
    box(0.115, 0.12, 0.015, chrome, sign * 1.37, 1.96, 2.393, 0.02);
  }

  // Radiator slats, stamped bumper and separate lamp lenses.
  box(1.74, 0.54, 0.08, grille, 0, 1.39, 2.9, 0.07);
  for (let y = 1.18; y < 1.65; y += 0.075) box(1.61, 0.024, 0.035, steel, 0, y, 2.95);
  box(1.75, 0.035, 0.045, chrome, 0, 1.69, 2.91);
  box(0.21, 0.09, 0.035, chrome, 0, 1.55, 2.973);
  box(2.22, 0.36, 0.31, paint, 0, 0.68, 2.83, 0.09);
  box(1.17, 0.16, 0.028, grille, 0, 0.65, 3.0, 0.025);
  box(2.04, 0.07, 0.22, steel, 0, 0.46, 2.8);
  for (const sign of [-1, 1]) {
    box(0.4, 0.23, 0.06, rubber, sign * 0.83, 0.72, 2.999, 0.04);
    box(0.31, 0.16, 0.025, lens, sign * 0.81, 0.74, 3.036, 0.03);
    box(0.05, 0.16, 0.026, amber, sign * 1, 0.74, 3.036);
    for (let i = 0; i < 4; i++) box(0.015, 0.12, 0.008, alloy, sign * 0.81 - 0.09 + i * 0.06, 0.74, 3.053);
    box(0.16, 0.045, 0.018, lens, sign * 0.86, 0.55, 3.01);
  }
  for (const x of [-0.78, 0, 0.78]) box(0.12, 0.045, 0.075, amber, x, 2.925, 2.52);

  // Brushed aluminium tanks, retaining straps and filler caps.
  for (const sign of [-1, 1]) {
    cylinder(0.29, 1.24, alloy, sign * 0.95, 0.69, -0.15).rotation.x = Math.PI / 2;
    for (const z of [-0.58, 0.28]) {
      cylinder(0.299, 0.055, steel, sign * 0.95, 0.69, z).rotation.x = Math.PI / 2;
    }
    cylinder(0.07, 0.032, chrome, sign * 1.05, 0.977, -0.36);
  }
  box(1.27, 0.055, 0.83, alloy, 0, 0.95, 0.08);
  for (let z = -0.28; z < 0.5; z += 0.07) box(1.22, 0.008, 0.012, steel, 0, 0.982, z);

  // Fifth-wheel saddle has an open kingpin throat.
  box(0.9, 0.14, 0.82, steel, 0, 0.98, -1.65);
  const saddle = new THREE.Shape();
  saddle.moveTo(-0.13, -0.59);
  saddle.lineTo(-0.53, -0.42);
  saddle.absarc(0, 0, 0.59, -2.47, -0.67, true);
  saddle.lineTo(0.13, -0.59);
  saddle.lineTo(0.075, 0.05);
  saddle.quadraticCurveTo(0, 0.16, -0.075, 0.05);
  saddle.closePath();
  const saddleGeo = new THREE.ExtrudeGeometry(saddle, { depth: 0.075, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 32 });
  saddleGeo.rotateX(-Math.PI / 2);
  mesh(saddleGeo, steel, 0, 1.08, -1.65);

  // Arched rear fenders, tail lights and hinged rubber mud flaps.
  const mudflaps: THREE.Mesh[] = [];
  for (const sign of [-1, 1]) {
    const arch = new THREE.Shape();
    arch.absarc(1.7, 0.52, 0.65, 0.1, Math.PI - 0.1, false);
    arch.absarc(1.7, 0.52, 0.6, Math.PI - 0.1, 0.1, true);
    arch.closePath();
    sidePanel(arch, 0.72, rubber, sign * 1.25);
    const flap = box(0.69, 0.4, 0.035, rubber, sign * 1.25, 0.56, -2.34);
    flap.geometry.translate(0, -0.2, 0);
    flap.position.y += 0.2;
    mudflaps.push(flap);
    box(0.69, 0.035, 0.045, alloy, sign * 1.25, 0.76, -2.34);
    box(0.43, 0.17, 0.12, rubber, sign * 0.78, 0.67, -2.88);
    box(0.26, 0.11, 0.018, red, sign * 0.83, 0.68, -2.95);
    box(0.1, 0.11, 0.018, amber, sign * 0.64, 0.68, -2.95);
  }
  box(2.06, 0.13, 0.13, steel, 0, 0.5, -2.9);

  // One exhaust with heat shield, open tip, clamps and subtle perforations.
  cylinder(0.052, 2.22, chrome, 0.88, 2.04, 0.51);
  cylinder(0.085, 0.94, alloy, 0.88, 1.58, 0.51);
  cylinder(0.04, 0.004, grille, 0.88, 3.153, 0.51);
  for (const y of [1.18, 1.98]) cylinder(0.09, 0.025, steel, 0.88, y, 0.51);
  for (let y = 1.25; y < 1.95; y += 0.09) {
    for (const dx of [-0.035, 0.035]) box(0.019, 0.03, 0.008, grille, 0.88 + dx, y, 0.596);
  }
  // Air/electrical lines behind the cab.
  for (let i = 0; i < 3; i++) {
    const points = Array.from({ length: 65 }, (_, j) => new THREE.Vector3(-0.35 + i * 0.25 + Math.cos(j * 0.7) * 0.045, 1.55 - j * 0.007, 0.56 - j * 0.016 + Math.sin(j * 0.7) * 0.045));
    tube(points, 0.015, i === 0 ? red : rubber);
  }

  // Keep moving parts separate; merge static surfaces by material to limit draw calls.
  for (const moving of [driveshaft, ...mudflaps]) parent.attach(moving);
  body.updateMatrixWorld(true);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const child of [...body.children]) {
    if (!(child instanceof THREE.Mesh)) continue;
    const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    geometry.applyMatrix4(child.matrix);
    const material = child.material as THREE.Material;
    const batch = batches.get(material) ?? [];
    batch.push(geometry);
    batches.set(material, batch);
    child.geometry.dispose();
    body.remove(child);
  }
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries, false);
    geometries.forEach(geometry => geometry.dispose());
    if (merged) mesh(merged, material, 0, 0, 0);
  }
  return { driveshaft, mudflapLeft: mudflaps[0], mudflapRight: mudflaps[1] };
}
