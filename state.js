import * as THREE from 'three';

export const g = {
  scene: null,
  camera: null,
  renderer: null,

  shelfData: [],
  allDvdMeshes: [],
  mouse: new THREE.Vector2(),
  raycaster: (() => { const r = new THREE.Raycaster(); r.far = 8; return r; })(),
  hoveredDvd: null,

  state: {
    mode: 'browse',
    examinedDvd: null,
    savedState: null,
    animStartTime: 0,
    animDuration: 500,
    animStartPos: new THREE.Vector3(),
    animEndPos: new THREE.Vector3(),
    animStartQuat: new THREE.Quaternion(),
    animEndQuat: new THREE.Quaternion(),
    animStartScale: 1,
    animEndScale: 1,
    isDragging: false,
    prevMouse: new THREE.Vector2(),
    dvdDistance: 0.8,
    targetDistance: 0.8,
  },

  allItems: [],
  textureCache: new Map(),
  loadingSet: new Set(),
  FAILED: Symbol('failed'),
  dirtyItemIndices: new Set(),
  _cacheGeneration: 0,

  cameraTargetY: 0,
  currentShelfIndex: 0,
  numShelves: 0,
  poolBaseItem: 0,
  clock: new THREE.Clock(),

  scratchVec: new THREE.Vector3(),
  axisY: new THREE.Vector3(0, 1, 0),
  axisX: new THREE.Vector3(1, 0, 0),
};
