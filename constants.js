export const CONTAINER_W = 0.85;
export const CONTAINER_D = 0.55;
export const DVD_H = 0.72;
export const DVD_T = 0.03;
export const DVD_D = 0.52;

export const POOL_SHELVES = 3;

const DESKTOP = {
  dvdsPerView: 18,
  spacing: 0.04,
  dvdT: 0.03,
  cameraZ: 1.3,
  cameraFov: 60,
  maxPixelRatio: 2,
  shadowMapSize: 1024,
  popOutDistance: 0.8,
  popOutScale: 0.86,
  coverTexW: 1080,
  coverTexH: 780,
  fallbackCoverW: 360,
  fallbackCoverH: 260,
  synopsisTexW: 1080,
  synopsisTexH: 780,
};

const MOBILE = {
  dvdsPerView: 9,
  spacing: 0.066,
  dvdT: 0.06,
  cameraZ: 5.0,
  cameraFov: 16,
  maxPixelRatio: 1.0,
  shadowMapSize: 256,
  popOutDistance: 3.5,
  popOutScale: 0.95,
  coverTexW: 2160,
  coverTexH: 1560,
  fallbackCoverW: 800,
  fallbackCoverH: 578,
  synopsisTexW: 2160,
  synopsisTexH: 1560,
};

export function getLayout() {
  const isMobile = window.innerWidth <= 768;
  const cfg = isMobile ? MOBILE : DESKTOP;
  return {
    isMobile,
    containerW: CONTAINER_W,
    containerD: CONTAINER_D,
    dvdH: DVD_H,
    dvdT: cfg.dvdT,
    dvdD: DVD_D,
    dvdsPerView: cfg.dvdsPerView,
    spacing: cfg.spacing,
    cameraZ: cfg.cameraZ,
    cameraFov: cfg.cameraFov,
    maxPixelRatio: cfg.maxPixelRatio,
    shadowMapSize: cfg.shadowMapSize,
    popOutDistance: cfg.popOutDistance,
    popOutScale: cfg.popOutScale,
    coverTexW: cfg.coverTexW,
    coverTexH: cfg.coverTexH,
    fallbackCoverW: cfg.fallbackCoverW,
    fallbackCoverH: cfg.fallbackCoverH,
    synopsisTexW: cfg.synopsisTexW,
    synopsisTexH: cfg.synopsisTexH,
  };
}

export function computeTotalH(numShelves, spacingPerView) {
  return numShelves * spacingPerView;
}

export const HINT_EL = document.getElementById('hint');
export const PLAY_BTN = document.getElementById('play-btn');
export const RESET_BTN = document.getElementById('reset-dvd');
export const FLIP_BTN = document.getElementById('flip-dvd');
export const RETURN_BTN = document.getElementById('return-dvd');
export const DVD_ACTIONS = document.getElementById('dvd-actions');
