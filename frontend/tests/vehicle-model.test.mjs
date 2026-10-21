import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildTractorModel } from '../src/pages/TireTreadPattern/tractorModel.ts';
import { fitVehicleCamera } from '../src/pages/TireTreadPattern/vehicleCamera.ts';

test('tractor has clear steer-wheel arches and valid batched surfaces', () => {
  const vehicle = new THREE.Group();
  buildTractorModel(vehicle);
  vehicle.updateMatrixWorld(true);
  const surfaces = [];
  let triangles = 0;
  vehicle.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    surfaces.push(object);
    for (const attribute of Object.values(object.geometry.attributes)) {
      assert.ok(Array.from(attribute.array).every(Number.isFinite), 'Geometry contains invalid coordinates');
    }
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  });
  assert.ok(surfaces.length < 25, 'Static detail should be batched for mobile');
  assert.ok(triangles < 150_000, 'Tractor geometry exceeds the mobile budget');
  // The tyre must sit in an open arch, not intersect a solid lower cabin panel.
  const ray = new THREE.Raycaster(new THREE.Vector3(-3, 0.65, 2.1), new THREE.Vector3(1, 0, 0), 0, 1.95);
  assert.equal(ray.intersectObjects(surfaces, false).length, 0);
  ray.set(new THREE.Vector3(-3, 1.5, 2.1), new THREE.Vector3(1, 0, 0));
  assert.ok(ray.intersectObjects(surfaces, false).length > 0, 'Cabin panel should exist above the arch');
});

test('camera fits complete vehicles in portrait, square and landscape views', () => {
  for (const length of [3.4, 6.4, 8.2, 11.6]) {
    const bounds = new THREE.Box3(new THREE.Vector3(-1.65, 0, -length / 2), new THREE.Vector3(1.65, 3.2, length / 2));
    const target = bounds.getCenter(new THREE.Vector3());
    for (const aspect of [0.64, 0.86, 1, 1.78]) {
      for (const position of [new THREE.Vector3(-7, 4, 7), new THREE.Vector3(-6, 1.6, 0), new THREE.Vector3(0.001, 12, 0)]) {
        const camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 100);
        camera.position.copy(fitVehicleCamera(position, target, camera, bounds));
        camera.lookAt(target);
        camera.updateMatrixWorld(true);
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
          const projected = new THREE.Vector3(x, y, z).project(camera);
          assert.ok(Math.abs(projected.x) <= 0.9 && Math.abs(projected.y) <= 0.9 && Math.abs(projected.z) <= 1, 'Vehicle cropped by camera');
        }
      }
    }
  }
});
