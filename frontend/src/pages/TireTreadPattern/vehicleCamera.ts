import * as THREE from 'three';

/** Fit every corner in the viewport, including the narrower horizontal FOV on phones. */
export function fitVehicleCamera(position: THREE.Vector3, target: THREE.Vector3, camera: THREE.PerspectiveCamera, bounds: THREE.Box3) {
  const direction = position.clone().sub(target).normalize();
  const view = new THREE.Matrix4().lookAt(position, target, camera.up).invert();
  const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / 1.12;
  const horizontal = vertical * camera.aspect;
  let distance = 0;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const corner = new THREE.Vector3(x, y, z).sub(target).applyMatrix4(view);
        distance = Math.max(distance, corner.z + Math.abs(corner.x) / horizontal, corner.z + Math.abs(corner.y) / vertical);
      }
    }
  }
  return target.clone().addScaledVector(direction, Math.max(distance, camera.near + 1));
}
