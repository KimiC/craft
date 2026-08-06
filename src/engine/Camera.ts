import * as THREE from 'three';

export class FPCamera {
  yaw = 0;
  pitch = 0;
  readonly sensitivity = 0.002;

  applyMouseDelta(dx: number, dy: number): void {
    this.yaw -= dx * this.sensitivity;
    this.pitch -= dy * this.sensitivity;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
  }

  applyToCamera(camera: THREE.PerspectiveCamera, position: THREE.Vector3): void {
    camera.position.copy(position);
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  getForward(): THREE.Vector3 {
    const v = new THREE.Vector3(0, 0, -1);
    v.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    return v;
  }

  getForwardXZ(): THREE.Vector3 {
    const v = this.getForward();
    v.y = 0;
    return v.normalize();
  }

  getRight(): THREE.Vector3 {
    const v = new THREE.Vector3(1, 0, 0);
    v.applyEuler(new THREE.Euler(0, this.yaw, 0, 'YXZ'));
    return v;
  }
}
