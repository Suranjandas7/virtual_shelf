import * as THREE from 'three';
import { g } from './state.js';
import { HINT_EL, PLAY_BTN, RESET_BTN, FLIP_BTN, RETURN_BTN, DVD_ACTIONS } from './constants.js';
import { repositionPool } from './dvd.js';

function updateCameraTarget() {
  const L = g.appLayout;
  const spacingPerView = L.dvdsPerView * L.spacing;
  const totalH = g.numShelves * spacingPerView;
  const topY = totalH / 2 - L.spacing / 2;
  g.cameraTargetY = topY - g.currentShelfIndex * spacingPerView;
}

let hoverSkipCounter = 0;
export function updateHover() {
  if (Math.abs(g.cameraTargetY - g.camera.position.y) > 0.01) return;
  if (g.mouse.x < -1 || g.mouse.x > 1 || g.mouse.y < -1 || g.mouse.y > 1) return;
  hoverSkipCounter++;
  if (hoverSkipCounter % 5 !== 0) return;
  g.raycaster.setFromCamera(g.mouse, g.camera);
  const hits = g._raycastTargets.length > 0 ? g.raycaster.intersectObjects(g._raycastTargets, false) : [];
  g.hoveredDvd = null;
  if (hits.length > 0) {
    let obj = hits[0].object;
    while (obj && !obj.userData?.isDvd) obj = obj.parent;
    if (obj && obj !== g.state.examinedDvd) g.hoveredDvd = obj;
  }
}

export function examineDvd(mesh) {
  if (g.state.mode !== 'browse') return;
  HINT_EL.style.opacity = '0';
  g.hoveredDvd = null;

  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  mesh.getWorldPosition(worldPos);
  mesh.getWorldQuaternion(worldQuat);

  g.state.savedState = {
    mesh,
    parent: mesh.parent,
    pos: mesh.position.clone(),
    quat: mesh.quaternion.clone(),
    scale: mesh.scale.clone(),
    worldPos: worldPos.clone(),
    worldQuat: worldQuat.clone(),
  };

  mesh.parent.remove(mesh);
  mesh.position.copy(worldPos);
  mesh.quaternion.copy(worldQuat);
  g.scene.add(mesh);

  g.state.examinedDvd = mesh;
  g.state.mode = 'popping';
  g.state.animStartTime = performance.now();
  g.state.animDuration = 400;
  g.state.dvdDistance = g.appLayout.popOutDistance;
  g.state.targetDistance = g.appLayout.popOutDistance;

  g.state.animStartPos.copy(worldPos);
  g.state.animStartQuat.copy(worldQuat);
  g.state.animStartScale = 1;

  g.state.animEndPos.set(0, g.camera.position.y, g.camera.position.z - g.state.dvdDistance);
  const rotX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const rotZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
  g.state.animEndQuat.copy(flip.clone().multiply(rotZ).multiply(rotX));
  g.state.animEndScale = g.appLayout.popOutScale;
}

export function returnDvd() {
  if (!g.state.examinedDvd || g.state.mode === 'browse' || g.state.mode === 'returning') return;
  PLAY_BTN.style.display = 'none';
  DVD_ACTIONS.style.display = 'none';
  g.hoveredDvd = null;

  g.state.mode = 'returning';
  g.state.animStartTime = performance.now();
  g.state.animDuration = 350;
  g.state.isDragging = false;

  g.state.animStartPos.copy(g.state.examinedDvd.position);
  g.state.animStartQuat.copy(g.state.examinedDvd.quaternion);
  g.state.animStartScale = g.state.examinedDvd.scale.x;

  g.state.animEndPos.copy(g.state.savedState.worldPos);
  g.state.animEndQuat.copy(g.state.savedState.worldQuat);
  g.state.animEndScale = 1;

  HINT_EL.style.opacity = '1';
}

export function resetDvdOrientation() {
  if (!g.state.examinedDvd || g.state.mode !== 'examining') return;

  g.state.mode = 'popping';
  g.state.animStartTime = performance.now();
  g.state.animDuration = 350;

  g.state.animStartPos.copy(g.state.examinedDvd.position);
  g.state.animStartQuat.copy(g.state.examinedDvd.quaternion);
  g.state.animStartScale = g.state.examinedDvd.scale.x;

  g.state.animEndPos.set(0, g.camera.position.y, g.camera.position.z - g.state.dvdDistance);

  const rotX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const rotZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const worldFlip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
  g.state.animEndQuat.copy(worldFlip.clone().multiply(rotZ).multiply(rotX));
  g.state.animEndScale = g.appLayout.popOutScale;
}

export function flipDvd() {
  if (!g.state.examinedDvd || g.state.mode !== 'examining') return;

  g.state.mode = 'popping';
  g.state.animStartTime = performance.now();
  g.state.animDuration = 350;

  g.state.animStartPos.copy(g.state.examinedDvd.position);
  g.state.animStartQuat.copy(g.state.examinedDvd.quaternion);
  g.state.animStartScale = g.state.examinedDvd.scale.x;

  g.state.animEndPos.copy(g.state.examinedDvd.position);

  const yFlip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  g.state.animEndQuat.copy(yFlip.clone().multiply(g.state.examinedDvd.quaternion));
  g.state.animEndScale = g.state.examinedDvd.scale.x;
}

export function bindEvents() {
  const appEl = document.getElementById('app');

  window.addEventListener('mousemove', (e) => {
    if (!e.target.closest('#bottom-bar')) {
      g.mouse.x = (e.clientX / appEl.clientWidth) * 2 - 1;
      g.mouse.y = -(e.clientY / appEl.clientHeight) * 2 + 1;
    }
    if (g.state.mode === 'examining' && g.state.isDragging) {
      const dx = e.clientX - g.state.prevMouse.x;
      const dy = e.clientY - g.state.prevMouse.y;
      g.state.examinedDvd.rotateOnWorldAxis(g.axisY, dx * 0.008);
      g.state.examinedDvd.rotateOnWorldAxis(g.axisX, dy * 0.008);
      g.state.prevMouse.set(e.clientX, e.clientY);
      g._needsRender = true;
    }
  });

  window.addEventListener('mousedown', (e) => {
    if (e.target.closest('#bottom-bar')) return;
    if (g.state.mode === 'examining' && e.button === 0) {
      g.state.isDragging = true;
      g.state.prevMouse.set(e.clientX, e.clientY);
    }
  });

  window.addEventListener('mouseup', () => { g.state.isDragging = false; });

  window.addEventListener('click', (e) => {
    if (e.target.closest('#bottom-bar')) return;
    if (g.state.mode === 'popping' || g.state.mode === 'returning') return;
    if (g.state.mode === 'examining') return;
    g.mouse.x = (e.clientX / appEl.clientWidth) * 2 - 1;
    g.mouse.y = -(e.clientY / appEl.clientHeight) * 2 + 1;

    g.raycaster.setFromCamera(g.mouse, g.camera);
    const hits = g._raycastTargets.length > 0 ? g.raycaster.intersectObjects(g._raycastTargets, false) : [];
    let dvd = null;
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !obj.userData?.isDvd) obj = obj.parent;
      if (obj && obj !== g.state.examinedDvd) dvd = obj;
    }
    if (dvd && g.state.mode === 'browse') examineDvd(dvd);
  });

  window.addEventListener('wheel', (e) => {
    if (g.state.mode === 'examining') {
      e.preventDefault();
      g.state.targetDistance += e.deltaY * 0.008;
      g.state.targetDistance = Math.max(0.8, Math.min(4.5, g.state.targetDistance));
      g._needsRender = true;
    }
  }, { passive: false });

  document.getElementById('nav-up').addEventListener('click', () => {
    if (g.state.mode !== 'browse') return;
    if (g.currentShelfIndex <= 0) return;
    g.currentShelfIndex--;
    updateCameraTarget();
    repositionPool();
  });
  document.getElementById('nav-down').addEventListener('click', () => {
    if (g.state.mode !== 'browse') return;
    if (g.currentShelfIndex >= g.numShelves - 1) return;
    g.currentShelfIndex++;
    updateCameraTarget();
    repositionPool();
  });

  RETURN_BTN.addEventListener('click', () => {
    if (g.state.mode === 'examining' || g.state.mode === 'popping') returnDvd();
  });

  RESET_BTN.addEventListener('click', () => {
    if (g.state.mode === 'examining') resetDvdOrientation();
  });
  FLIP_BTN.addEventListener('click', () => {
    if (g.state.mode === 'examining') flipDvd();
  });

  window.addEventListener('resize', () => {
    g.camera.aspect = appEl.clientWidth / appEl.clientHeight;
    g.camera.updateProjectionMatrix();
    g.renderer.setSize(appEl.clientWidth, appEl.clientHeight);
    g.renderer.setPixelRatio(Math.min(window.devicePixelRatio, g.appLayout.maxPixelRatio));
    g._needsRender = true;
  });

  window.addEventListener('touchmove', (e) => {
    if (g.state.mode === 'examining' && g.state.isDragging && e.touches.length === 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - g.state.prevMouse.x;
      const dy = e.touches[0].clientY - g.state.prevMouse.y;
      g.state.examinedDvd.rotateOnWorldAxis(g.axisY, dx * 0.008);
      g.state.examinedDvd.rotateOnWorldAxis(g.axisX, dy * 0.008);
      g.state.prevMouse.set(e.touches[0].clientX, e.touches[0].clientY);
      g._needsRender = true;
    }
  }, { passive: false });

  window.addEventListener('touchstart', (e) => {
    if (e.target.closest('#bottom-bar')) return;
    g.mouse.x = (e.touches[0].clientX / appEl.clientWidth) * 2 - 1;
    g.mouse.y = -(e.touches[0].clientY / appEl.clientHeight) * 2 + 1;
    if (g.state.mode === 'examining' && e.touches.length === 1) {
      e.preventDefault();
      g.state.isDragging = true;
      g.state.prevMouse.set(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  window.addEventListener('touchend', () => { g.state.isDragging = false; });
}
