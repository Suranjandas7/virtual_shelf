import { g } from './state.js';
import { fetchItems } from './datasource.js';
import { buildScene } from './scene.js';
import { populateShelves, applyMovieToDvd, evictDistantTextures } from './dvd.js';
import { bindEvents, updateHover } from './interaction.js';
import { HINT_EL, PLAY_BTN, DVD_ACTIONS, getLayout } from './constants.js';
import * as THREE from 'three';

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

let _lastVisShelf = -1;
function updateDVDVisibility() {
  const shelf = g.currentShelfIndex;
  if (shelf === _lastVisShelf) return;
  _lastVisShelf = shelf;
  const range = g.appLayout.dvdsPerView * 3 * g.appLayout.spacing;
  const camY = g.camera.position.y;
  for (const mesh of g.allDvdMeshes) {
    mesh.visible = Math.abs(mesh.position.y - camY) < range;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(g.clock.getDelta(), 0.1);

  const camDiff = g.cameraTargetY - g.camera.position.y;
  if (Math.abs(camDiff) > 0.001) {
    g.camera.position.y += camDiff * Math.min(dt * 8, 1);
    g.camera.lookAt(0, g.camera.position.y, 0);
  }

  updateDVDVisibility();

  evictDistantTextures();

  if (g.dirtyItemIndices.size > 0) {
    const dirty = new Set(g.dirtyItemIndices);
    g.dirtyItemIndices.clear();
    for (const shelf of g.shelfData) {
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
    g.state.dvdDistance += (g.state.targetDistance - g.state.dvdDistance) * 0.1;
    g.scratchVec.set(0, g.camera.position.y, g.camera.position.z - g.state.dvdDistance);
    g.state.examinedDvd.position.lerp(g.scratchVec, 0.15);
  }

  if (g.state.mode === 'browse' || (g.state.mode === 'examining' && !g.state.isDragging)) {
    updateHover();
  }

  g.renderer.render(g.scene, g.camera);
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

async function init() {
  g.appLayout = getLayout();

  const isBooks = location.pathname.startsWith('/books');
  const isGames = location.pathname.startsWith('/games');
  HINT_EL.textContent = isBooks ? 'Loading books from OPDS...' : isGames ? 'Loading games from Steam...' : 'Loading movies from Jellyfin...';

  let items;
  try {
    items = await fetchItems();
  } catch (e) {
    console.error('Failed to fetch items:', e);
    HINT_EL.textContent = isBooks ? 'Failed to load books. Is the OPDS server reachable?' : isGames ? 'Failed to load games. Is Steam reachable?' : 'Failed to load movies. Is Jellyfin reachable?';
    return;
  }

  if (items.length === 0) {
    HINT_EL.textContent = isBooks ? 'No books found in OPDS library.' : isGames ? 'No games found in Steam library.' : 'No movies found in Jellyfin library.';
    return;
  }

  if (isBooks) {
    const totalDvds = g.appLayout.numViews * g.appLayout.dvdsPerView;
    const n = items.length;
    const transformed = new Array(n);
    for (let i = 0; i < n; i++) {
      transformed[i] = items[(totalDvds - 1 - i) % n];
    }
    items = transformed;
  } else {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }

  g.allItems = items;

  HINT_EL.textContent = 'Building container...';
  const container = buildScene();
  populateShelves(container);
  HINT_EL.textContent = '';
  bindEvents();
  animate();
}

init();
