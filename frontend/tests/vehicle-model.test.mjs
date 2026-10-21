import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildTractorModel } from '../src/pages/TireTreadPattern/tractorModel.ts';
import { fitVehicleCamera } from '../src/pages/TireTreadPattern/vehicleCamera.ts';
import { buildForkliftModel, FORKLIFT_MAX_LIFT } from '../src/pages/TireTreadPattern/forkliftModel.ts';
import { buildChassisModel } from '../src/pages/TireTreadPattern/chassisModel.ts';

for (const wheelCount of [8, 12]) {
  test(`${wheelCount}-wheel trailer has grounded supports and clear tyre faces`, () => {
    const vehicle = new THREE.Group();
    const chassis = buildChassisModel(vehicle, wheelCount);
    vehicle.updateMatrixWorld(true);
    const surfaces = [];
    let triangles = 0;
    vehicle.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      surfaces.push(object);
      for (const attribute of Object.values(object.geometry.attributes)) {
        assert.ok(Array.from(attribute.array).every(Number.isFinite));
      }
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    });
    assert.ok(surfaces.length < 20, 'Chassis details must be batched for mobile');
    assert.ok(triangles < 180_000, 'Trailer exceeds the geometry budget');
    const bounds = new THREE.Box3().setFromObject(vehicle);
    assert.ok(bounds.min.y >= 0 && bounds.min.y < 0.015, 'Landing feet should rest at floor level');
    for (const z of chassis.axlePositions) {
      for (const side of [-1, 1]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(side * 2, 0.52, z), new THREE.Vector3(-side, 0, 0), 0, 0.95);
        assert.equal(ray.intersectObjects(surfaces, false).length, 0, 'Body panels obstruct the outer tyre face');
      }
    }
    for (const aspect of [0.64, 0.86, 1.78]) {
      for (const position of [new THREE.Vector3(-9, 5.3, 6.5), new THREE.Vector3(-8, 0.95, 0), new THREE.Vector3(0.001, 9, 0)]) {
        const camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 100);
        const target = new THREE.Vector3(0, 0.78, 0);
        camera.position.copy(fitVehicleCamera(position, target, camera, bounds));
        camera.lookAt(target);
        camera.updateMatrixWorld(true);
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
          const point = new THREE.Vector3(x, y, z).project(camera);
          assert.ok(Math.abs(point.x) < 0.9 && Math.abs(point.y) < 0.9, 'Trailer cropped by camera');
        }
      }
    }
  });
}

test('forklift has an open operator space and mobile-sized geometry', () => {
  const vehicle = new THREE.Group();
  buildForkliftModel(vehicle);
  vehicle.updateMatrixWorld(true);
  const surfaces = [];
  let triangles = 0;
  vehicle.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    surfaces.push(object);
    for (const attribute of Object.values(object.geometry.attributes)) {
      assert.ok(Array.from(attribute.array).every(Number.isFinite));
    }
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  });
  assert.ok(surfaces.length < 25, 'Forklift details must be batched');
  assert.ok(triangles < 150_000, 'Forklift exceeds the geometry budget');
  const ray = new THREE.Raycaster(new THREE.Vector3(-2, 2.05, 0), new THREE.Vector3(1, 0, 0), 0, 4);
  assert.equal(ray.intersectObjects(surfaces, false).length, 0, 'Operator space must be open');
  ray.set(new THREE.Vector3(-2, 2.54, -0.95), new THREE.Vector3(1, 0, 0));
  assert.ok(ray.intersectObjects(surfaces, false).length > 0, 'Overhead guard must remain present');
});

test('forklift forks lift together, stay above ground and fit the camera at both limits', () => {
  const vehicle = new THREE.Group();
  const forklift = buildForkliftModel(vehicle);
  const lowered = new THREE.Box3().setFromObject(forklift.carriage);
  for (const height of [0, 0.5, FORKLIFT_MAX_LIFT, 100, -100, NaN]) {
    forklift.setLift(height);
    vehicle.updateMatrixWorld(true);
    const expected = Number.isFinite(height) ? Math.max(0, Math.min(FORKLIFT_MAX_LIFT, height)) : 0;
    const raised = new THREE.Box3().setFromObject(forklift.carriage);
    assert.ok(Math.abs(raised.min.y - lowered.min.y - expected) < 1e-6);
    assert.ok(raised.min.y > 0, 'Forks penetrate the floor');
    assert.ok(Math.abs(raised.max.x - lowered.max.x) < 1e-6, 'Fork spacing changed during lift');
    assert.ok(forklift.piston.scale.y > 0);
    const bounds = new THREE.Box3().setFromObject(vehicle);
    const target = new THREE.Vector3(0, 1.3, 0.65);
    const camera = new THREE.PerspectiveCamera(48, 0.64, 0.1, 100);
    camera.position.copy(fitVehicleCamera(new THREE.Vector3(-4.8, 3.2, 5.5), target, camera, bounds));
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const projected = new THREE.Vector3(x, y, z).project(camera);
      assert.ok(Math.abs(projected.x) < 0.9 && Math.abs(projected.y) < 0.9);
    }
  }
});

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
