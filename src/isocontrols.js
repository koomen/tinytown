// IsoControls: a diorama camera with a fixed downward tilt.
//
//   wheel up / down          zoom (dolly along the view axis)
//   wheel left / right       rotate around the point you're looking at
//   drag                     grab the ground: the point under the cursor stays
//                            under the cursor, so pulling down brings the
//                            landscape toward you (camera forward), pulling
//                            right moves the camera left
//   two fingers              pinch zooms, twist rotates, and the ground point
//                            under the midpoint stays under the fingers
//   pan(vector)              slide the view (used by the up/down arrow keys)
//   rotate(radians)          turn around the point you're looking at (left/right arrows)
//
// State is (target on the ground, azimuth, distance); the elevation never
// changes. Motion is smoothed toward goal values each frame.

import * as THREE from 'three';

export class IsoControls extends THREE.EventDispatcher {
  constructor(camera, dom, { azimuth = Math.PI / 4, elevation = THREE.MathUtils.degToRad(35.264) } = {}) {
    super();
    this.camera = camera;
    this.dom = dom;
    this.elevation = elevation;
    this.target = new THREE.Vector3();
    this.theta = azimuth;
    this.distance = 100;
    this.minDistance = 5;
    this.maxDistance = 5000;
    this.rotateSpeed = 0.004;   // radians per horizontal wheel unit
    this.zoomSpeed = 0.0012;    // log-distance per wheel unit
    this.damping = 0.18;
    this.enabled = true;
    this.groundHeight = null; // optional terrain sampler, installed by the viewer
    this._goal = { theta: this.theta, distance: this.distance, target: this.target.clone() };
    this._pointers = new Map();
    this._pinch = 0;
    this._endTimer = null;
    this._grab = null; // world point under the cursor when the drag began
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._lastPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
    this._lastQuaternion = new THREE.Quaternion();
    // Open hand over the diorama; closed hand on the whole page while dragging
    // (pointer capture keeps the drag alive over the UI card, so the cursor
    // must follow it there too).
    dom.style.cursor = 'grab';

    this._onDown = (e) => {
      if (!this.enabled) return;
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { dom.setPointerCapture?.(e.pointerId); } catch { /* synthetic or already-released pointer */ }
      if (this._pointers.size === 2) this._beginPinch();
      else if (this._pointers.size === 1) { this._grab = this._groundPoint(e.clientX, e.clientY); this._setGrabbing(true); }
      this.dispatchEvent({ type: 'start' });
    };
    this._onMove = (e) => {
      const p = this._pointers.get(e.pointerId);
      if (!p || !this.enabled) return;
      p.x = e.clientX; p.y = e.clientY;
      if (this._pointers.size >= 2) { this._pinchMove(); return; }
      // Keep the grabbed ground point under the cursor: the camera translates
      // with the target, so the shift that re-pins the point is exact.
      if (!this._grab) return;
      this._pinTo(this._grab, e.clientX, e.clientY);
    };
    this._onUp = (e) => {
      this._pointers.delete(e.pointerId);
      try { dom.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
      if (this._pointers.size === 1) {
        // Back to one finger: re-grab under the finger that stayed, or the view
        // would snap to wherever the first finger originally landed
        const [q] = this._pointers.values();
        this._grab = this._groundPoint(q.x, q.y);
      } else if (this._pointers.size === 2) this._beginPinch();
      if (this._pointers.size === 0) { this._grab = null; this._setGrabbing(false); this.dispatchEvent({ type: 'end' }); }
    };
    this._onWheel = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      // vertical wheel zooms, horizontal wheel (trackpad swipe) rotates
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) this._goal.theta -= e.deltaX * this.rotateSpeed;
      else this._zoomBy(e.deltaY * this.zoomSpeed);
      clearTimeout(this._endTimer);
      this._endTimer = setTimeout(() => this.dispatchEvent({ type: 'end' }), 250);
    };
    dom.addEventListener('pointerdown', this._onDown);
    dom.addEventListener('pointermove', this._onMove);
    dom.addEventListener('pointerup', this._onUp);
    dom.addEventListener('pointercancel', this._onUp);
    dom.addEventListener('wheel', this._onWheel, { passive: false });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.style.touchAction = 'none';
  }

  _setGrabbing(on) {
    this.dom.style.cursor = on ? 'grabbing' : 'grab';
    document.documentElement.classList.toggle('grabbing', on);
  }

  // Where a screen point hits the ground plane (at the target's height)
  _groundPoint(cx, cy) {
    this.camera.updateMatrixWorld(true); // several drag events can land between renders
    const r = this.dom.getBoundingClientRect();
    this._ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.camera);
    this._plane.constant = -this.target.y;
    const hit = new THREE.Vector3();
    return this._ray.ray.intersectPlane(this._plane, hit) ? hit : null;
  }

  // Two fingers: remember their spacing, their angle, and the ground point
  // under their midpoint; every move re-derives zoom and rotation from the
  // change in spacing and angle, then re-pins that ground point under the
  // (moved) midpoint, so pinch, twist and two-finger drag all compose.
  _fingers() {
    const [a, b] = [...this._pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), angle: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  _beginPinch() {
    const f = this._fingers();
    this._pinch = f.dist;
    this._pinchAngle = f.angle;
    this._grab = this._groundPoint(f.mx, f.my);
    this._setGrabbing(true);
  }

  _pinchMove() {
    const f = this._fingers();
    if (this._pinch > 0) {
      // Snap distance and azimuth (no smoothing lag) so the ground under the
      // fingers stays exactly under them; the goal follows for the settle
      const d = THREE.MathUtils.clamp(this.distance * (this._pinch / f.dist), this.minDistance, this.maxDistance);
      this.distance = this._goal.distance = d;
      let da = f.angle - this._pinchAngle;
      if (da > Math.PI) da -= 2 * Math.PI; else if (da < -Math.PI) da += 2 * Math.PI;
      this.theta = this._goal.theta = this.theta + da;
    }
    this._pinch = f.dist;
    this._pinchAngle = f.angle;
    this._apply();
    if (this._grab) this._pinTo(this._grab, f.mx, f.my);
  }

  // Shift the view so world point `pt` sits under screen point (cx, cy)
  _pinTo(pt, cx, cy) {
    const now = this._groundPoint(cx, cy);
    if (!now) return;
    const delta = new THREE.Vector3().subVectors(pt, now);
    delta.y = 0;
    this.pan(delta);
    this._apply();
  }

  _zoomBy(logDelta) {
    this._goal.distance = THREE.MathUtils.clamp(this._goal.distance * Math.exp(logDelta), this.minDistance, this.maxDistance);
  }

  // Ground-plane direction from camera toward target for the goal azimuth
  _forward() {
    return new THREE.Vector3(-Math.sin(this._goal.theta), 0, -Math.cos(this._goal.theta));
  }

  // Slide the view (e.g. arrow keys); instant, no smoothing lag for the goal
  // Turn around the look-at point; eased like the wheel and twist gestures.
  rotate(radians) {
    this._goal.theta += radians;
  }

  pan(v) {
    // Preserve height above the ground when moving down a hill. Keeping a
    // constant world Y leaves the camera orbiting the air above lower streets.
    const lift = p => this.groundHeight
      ? this.groundHeight(p.x + v.x, p.z + v.z) - this.groundHeight(p.x, p.z) : 0;
    const targetLift = lift(this.target), goalLift = lift(this._goal.target);
    this._goal.target.add(v);
    this.target.add(v);
    this.target.y += targetLift;
    this._goal.target.y += goalLift;
  }

  // Snap to a state without smoothing
  set({ target, theta, distance }) {
    if (target) { this.target.copy(target); this._goal.target.copy(target); }
    if (theta !== undefined) { this.theta = theta; this._goal.theta = theta; }
    if (distance !== undefined) { this.distance = this._goal.distance = THREE.MathUtils.clamp(distance, this.minDistance, this.maxDistance); }
    this._apply();
  }

  // Derive azimuth/distance from the camera's current position (e.g. after a restore)
  setFromCamera() {
    const d = new THREE.Vector3().subVectors(this.camera.position, this.target);
    this.set({ theta: Math.atan2(d.x, d.z), distance: d.length() });
  }

  getAzimuthalAngle() { return this.theta; }
  getPolarAngle() { return Math.PI / 2 - this.elevation; }

  _apply() {
    const c = Math.cos(this.elevation), s = Math.sin(this.elevation);
    this.camera.position.set(
      this.target.x + Math.sin(this.theta) * c * this.distance,
      this.target.y + s * this.distance,
      this.target.z + Math.cos(this.theta) * c * this.distance
    );
    this.camera.lookAt(this.target);
    const changed = this._lastPosition.distanceToSquared(this.camera.position) > 1e-10
      || 8 * (1 - this._lastQuaternion.dot(this.camera.quaternion)) > 1e-10;
    if (changed) {
      this._lastPosition.copy(this.camera.position);
      this._lastQuaternion.copy(this.camera.quaternion);
      this.dispatchEvent({ type: 'change' });
    }
    return changed;
  }

  update() {
    const k = this.damping;
    this.theta += (this._goal.theta - this.theta) * k;
    this.distance += (this._goal.distance - this.distance) * k;
    this.target.lerp(this._goal.target, k);
    return this._apply();
  }

  dispose() {
    this._setGrabbing(false);
    this.dom.style.cursor = '';
    const d = this.dom;
    d.removeEventListener('pointerdown', this._onDown);
    d.removeEventListener('pointermove', this._onMove);
    d.removeEventListener('pointerup', this._onUp);
    d.removeEventListener('pointercancel', this._onUp);
    d.removeEventListener('wheel', this._onWheel);
  }
}
