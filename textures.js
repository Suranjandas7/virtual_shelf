import * as THREE from 'three';
import { getCachedBlob, cacheBlob } from './imageCache.js';

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

export async function loadImage(url) {
  try {
    const blob = await getCachedBlob(url);
    if (blob) {
      const objUrl = URL.createObjectURL(blob);
      try { return await loadImg(objUrl); } finally { URL.revokeObjectURL(objUrl); }
    }
  } catch { /* IndexedDB unavailable, fall through to network */ }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    cacheBlob(url, blob).catch(() => {});
    const objUrl = URL.createObjectURL(blob);
    try { return await loadImg(objUrl); } finally { URL.revokeObjectURL(objUrl); }
  } catch {
    return loadImg(url);
  }
}

export function createTextureFromImage(img, { fitW = 0, fitH = 0 } = {}) {
  const canvas = document.createElement('canvas');
  if (fitW > 0 && fitH > 0) {
    canvas.width = fitW;
    canvas.height = fitH;
  } else {
    const maxSize = 512;
    const scale = Math.min(maxSize / img.width, maxSize / img.height);
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
  }
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  return tex;
}

export function createEdgeTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1a1e';
  ctx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 256, 3, 1);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const edgeCaseTex = createEdgeTexture();

export function createSpineTexture(title, dominantColor, logoTex, subtitle = '') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const ctx = c.getContext('2d');

  const baseRgb = `rgb(${dominantColor.r},${dominantColor.g},${dominantColor.b})`;
  ctx.fillStyle = baseRgb;
  ctx.fillRect(0, 0, 512, 64);

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, 512, 64);

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, 512, 1);
  ctx.fillRect(0, 63, 512, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 1, 512, 1);
  ctx.fillRect(0, 62, 512, 1);

  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 64, 1 + Math.random() * 2, 1);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, 13, 64);
  ctx.fillRect(499, 0, 13, 64);

  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 32); ctx.lineTo(512, 32); ctx.stroke();

  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath(); ctx.moveTo(14, 2); ctx.lineTo(14, 62); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(498, 2); ctx.lineTo(498, 62); ctx.stroke();

  if (logoTex && logoTex.image) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 8;

    const img = logoTex.image;
    const maxW = 400;
    const maxH = 42;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, 256 - dw / 2, 32 - dh / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (subtitle) {
      ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
      let display = title;
      const maxWidth = 475;
      while (ctx.measureText(display).width > maxWidth) {
        display = display.slice(0, -1);
        if (display.length === 0) break;
      }
      if (display !== title) display += '\u2026';
      ctx.fillText(display, 256, 24);

      ctx.font = '10px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#999999';
      let subDisplay = subtitle;
      while (ctx.measureText(subDisplay).width > maxWidth) {
        subDisplay = subDisplay.slice(0, -1);
        if (subDisplay.length === 0) break;
      }
      if (subDisplay !== subtitle) subDisplay += '\u2026';
      ctx.fillText(subDisplay, 256, 42);
    } else {
      ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
      let display = title;
      const maxWidth = 475;
      while (ctx.measureText(display).width > maxWidth) {
        display = display.slice(0, -1);
        if (display.length === 0) break;
      }
      if (display !== title) display += '\u2026';
      ctx.fillText(display, 256, 32);
    }
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

export function createSynopsisTexture(title, overview, coverTex, subtitle = '', cw = 540, ch = 390) {
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d');
  const s = cw / 540;

  if (coverTex && coverTex.image) {
    ctx.drawImage(coverTex.image, 0, 0, cw, ch);
  } else {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, cw, ch);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.50)';
  ctx.fillRect(0, 0, cw, ch);

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2 * s;
  ctx.strokeRect(15 * s, 12 * s, cw - 30 * s, ch - 24 * s);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(18 * s)}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  const words = title.split(' ');
  const titleLines = [];
  const maxTitleW = cw - 75 * s;
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxTitleW) {
      titleLines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) titleLines.push(line);
  let ty = 48 * s;
  const titleLH = 24 * s;
  for (const tl of titleLines) {
    ctx.fillText(tl, cw / 2, ty);
    ty += titleLH;
  }

  if (subtitle) {
    ctx.font = `${Math.round(13 * s)}px "Segoe UI", Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(subtitle, cw / 2, ty);
    ty += 20 * s;
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(42 * s, ty + 6 * s); ctx.lineTo(cw - 42 * s, ty + 6 * s); ctx.stroke();

  const synopsis = overview || 'No description available.';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `${Math.round(13 * s)}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'left';
  const maxBodyW = cw - 75 * s;
  const bodyLH = 18 * s;
  const words2 = synopsis.split(' ');
  let sx = 38 * s, sy = ty + 32 * s;
  const maxY = ch - 15 * s;
  let currentLine = '';
  for (const w of words2) {
    const test = currentLine ? currentLine + ' ' + w : w;
    if (ctx.measureText(test).width > maxBodyW) {
      ctx.fillText(currentLine, sx, sy);
      sy += bodyLH;
      currentLine = w;
      if (sy > maxY) break;
    } else {
      currentLine = test;
    }
  }
  if (currentLine && sy < maxY) {
    ctx.fillText(currentLine, sx, sy);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  return tex;
}

export function createFallbackCover(title, tint, cw = 180, ch = 130) {
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d');
  const base = new THREE.Color(tint).multiplyScalar(0.5);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, cw, ch);

  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch);

  ctx.fillStyle = '#ffffff';
  const fontSize = Math.round(ch * 0.062);
  ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  const words = title.split(' ');
  let y = Math.round(ch * 0.42);
  const lineH = Math.round(ch * 0.09);
  for (const w of words) {
    ctx.fillText(w, cw / 2, y);
    y += lineH;
    if (y > ch - 10) break;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  return tex;
}

export function extractDominantColor(image) {
  if (image instanceof HTMLImageElement) {
    return extractColorFromImg(image);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(extractColorFromImg(img));
    img.onerror = () => resolve({ r: 80, g: 80, b: 80, hex: '#505050' });
    img.src = image;
  });
}

let _sharedCanvas;
let _sharedCtx;

function _getSharedCtx(w, h) {
  if (!_sharedCanvas) {
    _sharedCanvas = document.createElement('canvas');
    _sharedCtx = _sharedCanvas.getContext('2d');
  }
  _sharedCanvas.width = w;
  _sharedCanvas.height = h;
  return _sharedCtx;
}

function extractColorFromImg(img) {
  const size = 8;
  const ctx = _getSharedCtx(size, size);
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  let r = 0, g = 0, b = 0, count = 0;
  const start = Math.floor(size * 0.15);
  const end = size - start;
  for (let y = start; y < end; y++) {
    for (let x = start; x < end; x++) {
      const i = (y * size + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
  }
  r = Math.round(r / count);
  g = Math.round(g / count);
  b = Math.round(b / count);
  return {
    r, g, b,
    hex: '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join(''),
  };
}

export function loadCoverTexture(url, maxSize = 512, fitW = 0, fitH = 0) {
  return loadImage(url).then((img) => {
    const canvas = document.createElement('canvas');
    if (fitW > 0 && fitH > 0) {
      canvas.width = fitW;
      canvas.height = fitH;
    } else {
      const scale = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
    }
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    return tex;
  });
}
