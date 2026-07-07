import * as THREE from 'three';
import { g } from './state.js';
import { edgeCaseTex, createSpineTexture, createSynopsisTexture, createFallbackCover, loadCoverTexture, loadImage, createTextureFromImage, extractDominantColor } from './textures.js';
import { DVD_H, DVD_D, POOL_SHELVES } from './constants.js';

const gradientMap = (() => {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 1;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(50,50,50)';   ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = 'rgb(140,140,140)'; ctx.fillRect(1, 0, 1, 1);
  ctx.fillStyle = 'rgb(200,200,200)'; ctx.fillRect(2, 0, 1, 1);
  ctx.fillStyle = 'rgb(255,255,255)'; ctx.fillRect(3, 0, 1, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
})();

let _outlineGeo = null;
const _outlineMat = new THREE.LineBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.85,
});

function _ensureOutline(dvd) {
  if (!_outlineGeo) return;
  const existing = dvd.children.find((c) => c.userData?.isOutline);
  if (existing) return existing;
  const outline = new THREE.LineSegments(_outlineGeo, _outlineMat);
  outline.renderOrder = 1;
  outline.userData = { isOutline: true };
  outline.raycast = () => {};
  dvd.add(outline);
  return outline;
}

function _removeOutline(dvd) {
  const outline = dvd.children.find((c) => c.userData?.isOutline);
  if (outline) dvd.remove(outline);
}

export function dvdBody(dvd) {
  if (dvd.userData?.body) return dvd.userData.body;
  if (dvd.isMesh) return dvd;
  return dvd.children.find((c) => c.userData?.isBody);
}

export async function loadMovieAssets(idx) {
  if (g.loadingSet.has(idx) || g.textureCache.has(idx) || g.textureCache.get(idx) === g.FAILED) return;
  g.loadingSet.add(idx);
  const item = g.allItems[idx];
  const coverUrl = item.coverUrl;
  const logoUrl = item.logoUrl;
  try {
    let coverTex = null, dominant = null, logoTex = null;

    if (coverUrl) {
      const L = g.appLayout;
      const coverImg = await loadImage(coverUrl);
      coverTex = createTextureFromImage(coverImg, { fitW: L.coverTexW, fitH: L.coverTexH });
      dominant = extractDominantColor(coverImg);
    }
    if (logoUrl) {
      try { logoTex = await loadCoverTexture(logoUrl); } catch { /* spine will use text fallback */ }
    }

    g.textureCache.set(idx, {
      _gen: ++g._cacheGeneration,
      coverTex,
      dominantColor: dominant || { r: 80, g: 80, b: 80, hex: '#505050' },
      logoTex,
    });
    g.dirtyItemIndices.add(idx);
  } catch (e) {
    console.warn(`[load] fallback cover for "${item.title}": ${coverUrl || '(no cover URL)'} — ${e.message || e}`);
    const L = g.appLayout;
    const fb = createFallbackCover(item.title, '#505050', L.fallbackCoverW, L.fallbackCoverH);
    g.textureCache.set(idx, {
      _gen: ++g._cacheGeneration,
      coverTex: null,
      dominantColor: { r: 80, g: 80, b: 80, hex: '#505050' },
      logoTex: null,
      fallbackCover: fb,
    });
    g.dirtyItemIndices.add(idx);
  }
  g.loadingSet.delete(idx);
}

function _genSpineTex(cached, item, dominant, logoTex) {
  if (cached.spineTex && (!logoTex || cached._spineHadLogo)) return;
  if (cached.spineTex) _releaseTex(cached.spineTex);
  cached.spineTex = createSpineTexture(item.title, dominant, logoTex, item.subtitle);
  cached._spineHadLogo = !!logoTex;
}

function _genSynopsisTex(cached, item, coverTex, L) {
  if (cached.synopsisTex && (!coverTex || cached._synopsisHadCover)) return;
  if (cached.synopsisTex) _releaseTex(cached.synopsisTex);
  cached.synopsisTex = createSynopsisTexture(item.title, item.description, coverTex, item.subtitle, L.synopsisTexW, L.synopsisTexH);
  cached._synopsisHadCover = !!coverTex;
}

function _genFallbackCover(cached, item, dominant, L) {
  if (cached.fallbackCover) return;
  cached.fallbackCover = createFallbackCover(item.title, dominant.hex, L.fallbackCoverW, L.fallbackCoverH);
}

export function applyPlaceholderToDvd(dvd, movieIdx) {
  const body = dvdBody(dvd);
  if (!body) return;
  const item = g.allItems[movieIdx];
  let cached = g.textureCache.get(movieIdx);
  const dominant = (cached && cached !== g.FAILED) ? cached.dominantColor : { r: 80, g: 80, b: 80, hex: '#505050' };

  const edgeColor = new THREE.Color(dominant.hex).multiplyScalar(0.08);
  for (const ei of [0, 1, 5]) {
    body.material[ei].color.copy(edgeColor);
  }

  dvd.userData.title = item.title;
  dvd.userData.item = item;
  dvd.userData.itemIndex = movieIdx;
  dvd.userData._cacheGen = 0;
}

export function applyMovieToDvd(dvd, movieIdx) {
  const body = dvdBody(dvd);
  if (!body) return;

  const item = g.allItems[movieIdx];
  let cached = g.textureCache.get(movieIdx);
  const isNew = !cached || cached === g.FAILED;
  if (isNew) {
    cached = { dominantColor: { r: 80, g: 80, b: 80, hex: '#505050' } };
  }

  const dominant = cached.dominantColor;
  const coverTex = cached.coverTex || null;
  const logoTex = cached.logoTex || null;
  const L = g.appLayout;

  _genSpineTex(cached, item, dominant, logoTex);
  if (!body.material[4].map) {
    body.material[4].dispose?.();
    body.material[4] = new THREE.MeshToonMaterial({
      map: cached.spineTex, gradientMap,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnit: 1,
    });
  } else {
    body.material[4].map = cached.spineTex;
  }
  body.material[4].needsUpdate = true;

  _genSynopsisTex(cached, item, coverTex, L);

  const frontTex = coverTex || (_genFallbackCover(cached, item, dominant, L), cached.fallbackCover);
  if (!body.material[2].map) {
    body.material[2].dispose?.();
    body.material[2] = new THREE.MeshToonMaterial({
      map: frontTex, gradientMap,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnit: 1,
    });
  } else {
    body.material[2].map = frontTex;
  }
  body.material[2].needsUpdate = true;

  if (!body.material[3].map) {
    body.material[3].dispose?.();
    body.material[3] = new THREE.MeshToonMaterial({
      map: cached.synopsisTex, gradientMap,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnit: 1,
    });
  } else {
    body.material[3].map = cached.synopsisTex;
  }
  body.material[3].needsUpdate = true;

  const edgeColor = new THREE.Color(dominant.hex).multiplyScalar(0.08);
  for (const ei of [0, 1, 5]) {
    body.material[ei].color.copy(edgeColor);
    body.material[ei].map = edgeCaseTex;
    body.material[ei].polygonOffset = true;
    body.material[ei].polygonOffsetFactor = 1;
    body.material[ei].polygonOffsetUnit = 1;
    body.material[ei].needsUpdate = true;
  }

  for (const mi of [2, 3]) {
    if (body.material[mi].map) {
      body.material[mi].map.rotation = Math.PI / 2;
      body.material[mi].map.center.set(0.5, 0.5);
    }
  }

  _ensureOutline(dvd);

  dvd.userData.title = item.title;
  dvd.userData.item = item;
  dvd.userData.itemIndex = movieIdx;
  dvd.userData._cacheGen = cached._gen || 0;

  if (isNew) g.textureCache.set(movieIdx, cached);
}

export function createPlaceholderDvd(sharedGeo) {
  const group = new THREE.Group();

  const geo = sharedGeo;
  const edgeDummy = new THREE.MeshToonMaterial({
    color: 0x1a1a1c, map: edgeCaseTex, gradientMap,
  });
  const faceDummy = new THREE.MeshToonMaterial({
    color: 0x2a2a2a, gradientMap,
  });
  const spineDummy = new THREE.MeshToonMaterial({
    color: 0x858590, gradientMap,
  });
  const materials = [
    edgeDummy.clone(), edgeDummy.clone(), faceDummy,
    faceDummy.clone(), spineDummy, edgeDummy.clone(),
  ];
  const body = new THREE.Mesh(geo, materials);
  body.castShadow = false;
  body.receiveShadow = true;
  body.userData = { isBody: true };
  group.add(body);

  group.userData = { title: '', isDvd: true, body };

  return group;
}

export function createPool(container) {
  const L = g.appLayout;
  const totalItems = g.allItems.length;
  const poolSize = Math.min(POOL_SHELVES * L.dvdsPerView, totalItems);

  g.allDvdMeshes = [];
  g.shelfData = [];
  g.poolBaseItem = 0;

  const sharedGeo = new THREE.BoxGeometry(DVD_H, L.dvdT, DVD_D);
  _outlineGeo = new THREE.EdgesGeometry(sharedGeo);
  g._sharedGeo = sharedGeo;

  const spacingPerView = L.dvdsPerView * L.spacing;
  const totalH = g.numShelves * spacingPerView;
  const topY = totalH / 2 - L.spacing / 2;

  for (let slot = 0; slot < poolSize; slot++) {
    const itemIndex = slot;
    const shelfIndex = Math.floor(itemIndex / L.dvdsPerView);
    const posInShelf = itemIndex % L.dvdsPerView;
    const y = topY - shelfIndex * spacingPerView - posInShelf * L.spacing;

    const mesh = createPlaceholderDvd(sharedGeo);
    mesh.userData.viewIndex = shelfIndex;
    mesh.userData.itemIndex = itemIndex;
    container.add(mesh);
    mesh.position.set(0, y, -L.containerD / 2 + L.dvdD / 2 + 0.04);
    applyPlaceholderToDvd(mesh, itemIndex);

    g.allDvdMeshes.push(mesh);

    if (!g.shelfData[shelfIndex]) g.shelfData[shelfIndex] = { dvds: [] };
    g.shelfData[shelfIndex].dvds.push({ mesh });
  }

  g.currentShelfIndex = 0;
  g.cameraTargetY = topY;
  g.camera.position.y = topY;
  g.camera.lookAt(0, topY, 0);

  for (let slot = 0; slot < poolSize; slot++) {
    if (!g.textureCache.has(slot) && !g.loadingSet.has(slot)) {
      loadMovieAssets(slot);
    }
  }
}

export function repositionPool() {
  const L = g.appLayout;
  const totalItems = g.allItems.length;
  const poolSize = g.allDvdMeshes.length;
  if (poolSize === 0) return;

  const currentPoolBaseShelf = Math.floor(g.poolBaseItem / L.dvdsPerView);
  const poolEndShelf = currentPoolBaseShelf + POOL_SHELVES - 1;

  let targetBaseShelf = currentPoolBaseShelf;

  if (g.currentShelfIndex >= poolEndShelf) {
    targetBaseShelf = Math.min(g.numShelves - POOL_SHELVES, currentPoolBaseShelf + 1);
  } else if (g.currentShelfIndex < currentPoolBaseShelf + 1 && currentPoolBaseShelf > 0) {
    targetBaseShelf = Math.max(0, currentPoolBaseShelf - 1);
  }

  const maxBase = Math.max(0, totalItems - poolSize);
  const newBase = Math.min(targetBaseShelf * L.dvdsPerView, maxBase);

  if (newBase === g.poolBaseItem) return;
  g.poolBaseItem = newBase;

  const spacingPerView = L.dvdsPerView * L.spacing;
  const totalH = g.numShelves * spacingPerView;
  const topY = totalH / 2 - L.spacing / 2;

  g.shelfData = [];

  for (let slot = 0; slot < poolSize; slot++) {
    const itemIndex = newBase + slot;
    const mesh = g.allDvdMeshes[slot];
    const body = dvdBody(mesh);

    if (itemIndex >= totalItems) {
      mesh.visible = false;
      continue;
    }
    mesh.visible = true;

    for (const mi of [2, 3, 4]) {
      if (body.material[mi].map) {
        body.material[mi].map = null;
        body.material[mi].needsUpdate = true;
      }
    }

    const shelfIndex = Math.floor(itemIndex / L.dvdsPerView);
    const posInShelf = itemIndex % L.dvdsPerView;
    const y = topY - shelfIndex * spacingPerView - posInShelf * L.spacing;

    mesh.userData.viewIndex = shelfIndex;
    mesh.userData.itemIndex = itemIndex;
    mesh.position.set(0, y, -L.containerD / 2 + L.dvdD / 2 + 0.04);

    const cached = g.textureCache.get(itemIndex);
    if (cached && cached !== g.FAILED) {
      applyMovieToDvd(mesh, itemIndex);
    } else {
      applyPlaceholderToDvd(mesh, itemIndex);
      if (!g.loadingSet.has(itemIndex)) loadMovieAssets(itemIndex);
    }

    if (!g.shelfData[shelfIndex]) g.shelfData[shelfIndex] = { dvds: [] };
    g.shelfData[shelfIndex].dvds.push({ mesh });
  }
}

function _releaseTex(tex) {
  if (!tex) return;
  tex.dispose();
  const img = tex.image || tex.source?.data;
  if (img && typeof img.width === 'number') {
    img.width = 0;
    img.height = 0;
  }
}

export function evictDistantTextures() {
  const L = g.appLayout;
  const totalItems = g.allItems.length;
  if (totalItems === 0) return;

  const poolEnd = g.poolBaseItem + g.allDvdMeshes.length;
  const poolCenter = g.poolBaseItem + Math.floor(g.allDvdMeshes.length / 2);

  if (g._lastTextureWindowCenter === poolCenter) return;

  const keepSet = new Set();
  for (let i = g.poolBaseItem; i < poolEnd && i < totalItems; i++) {
    keepSet.add(i);
  }

  for (const [idx, cached] of g.textureCache) {
    if (keepSet.has(idx)) continue;
    if (cached === g.FAILED) { g.textureCache.delete(idx); continue; }
    _releaseTex(cached.coverTex);
    _releaseTex(cached.spineTex);
    _releaseTex(cached.synopsisTex);
    _releaseTex(cached.fallbackCover);
    _releaseTex(cached.logoTex);
    g.textureCache.delete(idx);
  }

  for (const dvd of g.allDvdMeshes) {
    if (!keepSet.has(dvd.userData.itemIndex)) _removeOutline(dvd);
  }

  let loaded = 0;
  const maxLoads = L.dvdsPerView * 2;
  for (const idx of keepSet) {
    if (loaded >= maxLoads) break;
    if (!g.textureCache.has(idx) && !g.loadingSet.has(idx)) { loadMovieAssets(idx); loaded++; }
  }

  g._lastTextureWindowCenter = poolCenter;
}
