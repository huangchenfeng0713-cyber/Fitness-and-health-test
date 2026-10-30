import * as THREE from 'three';

// Angular velocity is measured in radians/second, never radians/frame. Integrating
// exponential drag analytically gives the same release at 30, 60 and 120 Hz.
export function createExhibitMotion(pivot) {
  const velocity = new THREE.Vector3(), delta = new THREE.Quaternion();
  const axis = new THREE.Vector3(), measured = new THREE.Vector3();
  let lastSample = 0, lastMove = -Infinity, damping = 5;
  function apply(x, y, z) {
    axis.set(x, y, z);
    const angle = axis.length();
    if (angle > 0) {
      delta.setFromAxisAngle(axis.multiplyScalar(1 / angle), angle);
      pivot.quaternion.premultiply(delta).normalize();
    }
  }
  return {
    velocity,
    begin(now = 0) { velocity.set(0, 0, 0); lastSample = now; lastMove = -Infinity; },
    drag(x, y, z, now) {
      apply(x, y, z);
      const elapsed = now - lastSample;
      const dt = THREE.MathUtils.clamp(elapsed, 1 / 240, .08);
      measured.set(x, y, z).multiplyScalar(1 / dt).clampLength(0, 7);
      velocity.lerp(measured, 1 - Math.exp(-32 * dt));
      lastSample = lastMove = now;
    },
    release(now, cancelled = false) {
      if (cancelled || now - lastMove > .10) velocity.set(0, 0, 0);
    },
    stop() { velocity.set(0, 0, 0); lastMove = -Infinity; },
    setMaterial(id) { damping = id === 'plush' ? 5.5 : 3.8; },
    update(dt) {
      if (!(dt > 0) || !Number.isFinite(dt)) return;
      const speed = velocity.length(), threshold = .012;
      if (speed <= threshold) { velocity.set(0, 0, 0); return; }
      const duration = Math.min(dt, Math.log(speed / threshold) / damping);
      const decay = Math.exp(-damping * duration), travel = (1 - decay) / damping;
      apply(velocity.x * travel, velocity.y * travel, velocity.z * travel);
      velocity.multiplyScalar(decay);
      if (duration < dt) velocity.set(0, 0, 0);
    },
  };
}
