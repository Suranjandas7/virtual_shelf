import { g } from './state.js';
import { fetchItems } from './datasource.js';
import { buildScene } from './scene.js';
import { createPool, applyMovieToDvd } from './dvd.js';
import { bindEvents, updateHover } from './interaction.js';
import { HINT_EL, PLAY_BTN, DVD_ACTIONS, getLayout, computeTotalH } from './constants.js';
import * as THREE from 'three';

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(g.clock.getDelta(), 0.1);

  const camDiff = g.cameraTargetY - g.camera.position.y;
  if (Math.abs(camDiff) > 0.001) {
    g.camera.position.y += camDiff * Math.min(dt * 8, 1);
    g.camera.lookAt(0, g.camera.position.y, 0);
    g._needsRender = true;
  }

  if (g.dirtyItemIndices.size > 0) {
    g._needsRender = true;
    const dirty = new Set(g.dirtyItemIndices);
    g.dirtyItemIndices.clear();
    for (const shelf of g.shelfData) {
      if (!shelf) continue;
      for (const dvd of shelf.dvds) {
        if (dvd.mesh === g.state.examinedDvd) continue;
        const idx = dvd.mesh.userData.itemIndex;
        if (!dirty.has(idx)) continue;
        const cached = g.textureCache.get(idx);
        if (cached && cached._gen !== dvd.mesh.userData._cacheGen) {
          applyMovieToDvd(dvd.mesh, idx);
        }
      }
    }
  }

  if ((g.state.mode === 'popping' || g.state.mode === 'returning') && g.state.examinedDvd) {
    g._needsRender = true;
    const elapsed = performance.now() - g.state.animStartTime;
    const raw = Math.min(elapsed / g.state.animDuration, 1.0);
    const t = easeInOutCubic(raw);
    g.state.examinedDvd.position.lerpVectors(g.state.animStartPos, g.state.animEndPos, t);
    g.state.examinedDvd.quaternion.slerpQuaternions(g.state.animStartQuat, g.state.animEndQuat, t);
    g.state.examinedDvd.scale.setScalar(THREE.MathUtils.lerp(g.state.animStartScale, g.state.animEndScale, t));
    if (raw >= 1.0) {
      if (g.state.mode === 'returning') {
        finishReturn();
        PLAY_BTN.style.display = 'none';
        DVD_ACTIONS.style.display = 'none';
      } else {
        g.state.mode = 'examining';
        const item = g.state.examinedDvd?.userData?.item;
        if (item?.linkUrl) {
          PLAY_BTN.href = item.linkUrl;
          PLAY_BTN.style.display = 'flex';
        }
        DVD_ACTIONS.style.display = 'flex';
      }
    }
  }

  if (g.state.mode === 'examining' && g.state.examinedDvd) {
    g._needsRender = true;
    const rotSpeed = 0.04;
    if (g.state.keys.left) g.state.examinedDvd.rotateOnWorldAxis(g.axisY, -rotSpeed);
    if (g.state.keys.right) g.state.examinedDvd.rotateOnWorldAxis(g.axisY, rotSpeed);
    if (g.state.keys.up) g.state.examinedDvd.rotateOnWorldAxis(g.axisX, -rotSpeed);
    if (g.state.keys.down) g.state.examinedDvd.rotateOnWorldAxis(g.axisX, rotSpeed);
    g.state.dvdDistance += (g.state.targetDistance - g.state.dvdDistance) * 0.1;
    g.scratchVec.set(0, g.camera.position.y, g.camera.position.z - g.state.dvdDistance);
    g.state.examinedDvd.position.lerp(g.scratchVec, 0.15);
  }

  if (g.state.mode === 'browse' || (g.state.mode === 'examining' && !g.state.isDragging)) {
    updateHover();
    g._needsRender = true;
  }

  if (g._needsRender) {
    g.renderer.render(g.scene, g.camera);
    g._needsRender = false;
  }
}

function finishReturn() {
  const { mesh, parent, pos, scale, worldPos, worldQuat } = g.state.savedState;

  mesh.position.copy(worldPos);
  mesh.quaternion.copy(worldQuat);
  mesh.scale.set(1, 1, 1);
  g.scene.remove(mesh);
  parent.add(mesh);

  mesh.position.x = pos.x;
  mesh.position.y = pos.y;
  mesh.position.z = pos.z;
  mesh.scale.copy(scale);

  g.hoveredDvd = null;
  g.state.examinedDvd = null;
  g.state.savedState = null;
  g.state.mode = 'browse';
}

function getRoute() {
  const path = location.pathname.replace(/\/$/, '') || '/';
  if (path === '/') return { source: 'home', search: null };
  const parts = path.split('/').filter(Boolean);
  const src = parts[0];
  let source;
  if (src === 'jellyfin') source = 'jellyfin';
  else if (src === 'steam' || src === 'games') source = 'steam';
  else if (src === 'opds' || src === 'books') source = 'opds';
  else source = 'jellyfin';
  const search = parts.length >= 2 ? decodeURIComponent(parts.slice(1).join('/')) : null;
  return { source, search };
}

function showHomepage() {
  document.getElementById('homepage').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('bottom-bar').style.display = 'none';
  HINT_EL.style.display = 'none';
}

async function init() {
  g.appLayout = getLayout();

  const route = getRoute();

  if (route.source === 'home') {
    showHomepage();
    return;
  }

  const sourceLabel = route.source === 'opds' ? 'OPDS' : route.source === 'steam' ? 'Steam' : 'Jellyfin';
  HINT_EL.textContent = `Loading from ${sourceLabel}...`;

  let items;
  try {
    items = await fetchItems(route.search);
  } catch (e) {
    console.error('Failed to fetch items:', e);
    HINT_EL.textContent = `Failed to load. Is ${sourceLabel} reachable?`;
    return;
  }

  if (items.length === 0) {
    HINT_EL.textContent = route.search
      ? `No results found for "${route.search}".`
      : `No items found in ${sourceLabel} library.`;
    return;
  }

  if (route.source === 'opds') {
    items.sort((a, b) => {
      const da = a._date || '';
      const db = b._date || '';
      if (da > db) return -1;
      if (da < db) return 1;
      return 0;
    });
  } else if (route.source === 'jellyfin') {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }

  g.allItems = items;
  g.numShelves = Math.max(1, Math.ceil(items.length / g.appLayout.dvdsPerView));

  const totalH = computeTotalH(g.numShelves, g.appLayout.dvdsPerView * g.appLayout.spacing);

  HINT_EL.textContent = 'Building container...';
  const container = buildScene(totalH);
  createPool(container);
  HINT_EL.textContent = '';
  bindEvents();
  animate();
}

init();
