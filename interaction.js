import * as THREE from 'three';
import { g } from './state.js';
import { HINT_EL, PLAY_BTN, RESET_BTN, FLIP_BTN, RETURN_BTN, DVD_ACTIONS, SHELF_BTN, getLayout } from './constants.js';
import { repositionPool } from './dvd.js';

function updateCameraTarget() {
  const L = g.appLayout;
  const spacingPerView = L.dvdsPerView * L.spacing;
  const totalH = g.numShelves * spacingPerView;
  const topY = totalH / 2 - L.spacing / 2;
  g.cameraTargetY = topY - g.currentShelfIndex * spacingPerView;
}

function getViewportSize() {
  const appEl = document.getElementById('app');
  return { width: appEl.clientWidth, height: appEl.clientHeight };
}

function _trySelect(x, y) {
  if (g.state.mode !== 'browse') return;
  const vs = getViewportSize();
  g.mouse.x = (x / vs.width) * 2 - 1;
  g.mouse.y = -(y / vs.height) * 2 + 1;

  g.raycaster.setFromCamera(g.mouse, g.camera);
  const hits = g._raycastTargets.length > 0 ? g.raycaster.intersectObjects(g._raycastTargets, false) : [];
  if (hits.length > 0) {
    let obj = hits[0].object;
    while (obj && !obj.userData?.isDvd) obj = obj.parent;
    if (obj && obj !== g.state.examinedDvd) examineDvd(obj);
  }
}

function handleViewportResize() {
  const appEl = document.getElementById('app');
  const L = getLayout();
  const layoutChanged = !g.appLayout || L.isMobile !== g.appLayout.isMobile;

  g.appLayout = L;

  g.camera.fov = L.cameraFov;
  g.camera.aspect = appEl.clientWidth / appEl.clientHeight;
  g.camera.position.z = L.cameraZ;
  g.camera.updateProjectionMatrix();

  g.renderer.setSize(appEl.clientWidth, appEl.clientHeight);
  g.renderer.setPixelRatio(Math.min(window.devicePixelRatio, L.maxPixelRatio));

  if (layoutChanged && g.allItems.length > 0) {
    g.numShelves = Math.max(1, Math.ceil(g.allItems.length / L.dvdsPerView));
    updateCameraTarget();
    repositionPool();
  }

  g._needsRender = true;
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
  g.state.keys.left = false;
  g.state.keys.right = false;
  g.state.keys.up = false;
  g.state.keys.down = false;

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
  SHELF_BTN.style.display = 'none';
  g.hoveredDvd = null;

  g.state.mode = 'returning';
  g.state.animStartTime = performance.now();
  g.state.animDuration = 350;
  g.state.isDragging = false;
  g.state.keys.left = false;
  g.state.keys.right = false;
  g.state.keys.up = false;
  g.state.keys.down = false;

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
      const vs = getViewportSize();
      g.mouse.x = (e.clientX / vs.width) * 2 - 1;
      g.mouse.y = -(e.clientY / vs.height) * 2 + 1;
    }
    if (g.state.mode === 'examining' && g.state.isDragging) {
      const dx = e.clientX - g.state.prevMouse.x;
      const dy = e.clientY - g.state.prevMouse.y;
      g.state.examinedDvd.rotateOnWorldAxis(g.axisY, dx * 0.004);
      g.state.examinedDvd.rotateOnWorldAxis(g.axisX, dy * 0.004);
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
    _trySelect(e.clientX, e.clientY);
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

  SHELF_BTN.addEventListener('click', async () => {
    if (!g.state.examinedDvd) return;
    const item = g.state.examinedDvd.userData.item;
    const { showShelfPicker } = await import('./shelves.js');
    showShelfPicker(item);
  });

  window.addEventListener('resize', handleViewportResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportResize);
    window.visualViewport.addEventListener('scroll', handleViewportResize);
  }

  window.addEventListener('touchmove', (e) => {
    if (e.target.closest('#shelf-picker')) return;
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
    if (e.target.closest('#bottom-bar') || e.target.closest('#shelf-picker')) return;
    const vs = getViewportSize();
    g.mouse.x = (e.touches[0].clientX / vs.width) * 2 - 1;
    g.mouse.y = -(e.touches[0].clientY / vs.height) * 2 + 1;
    if (g.state.mode === 'examining' && e.touches.length === 1) {
      e.preventDefault();
      g.state.isDragging = true;
      g.state.prevMouse.set(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  window.addEventListener('touchend', (e) => {
    g.state.isDragging = false;
    if (e.target.closest('#bottom-bar') || e.target.closest('#shelf-picker')) return;
    if (g.state.mode !== 'browse') return;
    const touch = e.changedTouches[0];
    _trySelect(touch.clientX, touch.clientY);
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.closest('#shelf-picker') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const key = (e.key || '').toLowerCase();
    let handled = true;

    if (g.state.mode === 'browse') {
      switch (key) {
        case 'arrowup': case 'w':
          if (g.currentShelfIndex > 0) { g.currentShelfIndex--; updateCameraTarget(); repositionPool(); }
          break;
        case 'arrowdown': case 's':
          if (g.currentShelfIndex < g.numShelves - 1) { g.currentShelfIndex++; updateCameraTarget(); repositionPool(); }
          break;
        default: handled = false;
      }
    } else if (g.state.mode === 'examining') {
      switch (key) {
        case 'arrowleft': case 'a': g.state.keys.left = true; break;
        case 'arrowright': case 'd': g.state.keys.right = true; break;
        case 'arrowup': case 'w': g.state.keys.up = true; break;
        case 'arrowdown': case 's': g.state.keys.down = true; break;
        case 'r': resetDvdOrientation(); break;
        case 'f': flipDvd(); break;
        case 'p': { const url = g.state.examinedDvd?.userData?.item?.linkUrl; if (url) window.open(url, '_blank'); } break;
        case 'escape': case ' ': returnDvd(); break;
        default: handled = false;
      }
    } else {
      handled = false;
    }

    if (handled) e.preventDefault();
  });

  window.addEventListener('keyup', (e) => {
    if (e.target.closest('#shelf-picker') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const key = (e.key || '').toLowerCase();
    switch (key) {
      case 'arrowleft': case 'a': g.state.keys.left = false; break;
      case 'arrowright': case 'd': g.state.keys.right = false; break;
      case 'arrowup': case 'w': g.state.keys.up = false; break;
      case 'arrowdown': case 's': g.state.keys.down = false; break;
    }
  });
}
