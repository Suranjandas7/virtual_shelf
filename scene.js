import * as THREE from 'three';
import { g } from './state.js';
import { CONTAINER_W, CONTAINER_D } from './constants.js';

export function buildScene() {
  const L = g.appLayout;
  const app = document.getElementById('app');

  g.scene = new THREE.Scene();
  g.scene.background = new THREE.Color(0x1a1520);
  g.scene.fog = new THREE.Fog(0x1a1520, 7, 18);

  g.camera = new THREE.PerspectiveCamera(L.cameraFov, app.clientWidth / app.clientHeight, 0.1, 100);
  g.camera.position.set(0, 0, L.cameraZ);
  g.camera.lookAt(0, 0, 0);

  g.renderer = new THREE.WebGLRenderer({ antialias: true });
  g.renderer.setSize(app.clientWidth, app.clientHeight);
  g.renderer.setPixelRatio(Math.min(window.devicePixelRatio, L.maxPixelRatio));
  g.renderer.shadowMap.enabled = true;
  g.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  g.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  g.renderer.toneMappingExposure = 1.1;
  document.getElementById('app').appendChild(g.renderer.domElement);

  g.scene.add(new THREE.AmbientLight(0x504060, 0.6));
  const key = new THREE.DirectionalLight(0xffeedd, 5.5);
  key.position.set(0, 2.5, 3);
  key.castShadow = true;
  key.shadow.mapSize.width = L.shadowMapSize;
  key.shadow.mapSize.height = L.shadowMapSize;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 25;
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -16;
  key.shadow.bias = -0.0002;
  g.scene.add(key);
  const fillLight = new THREE.DirectionalLight(0x8899cc, 2.8);
  fillLight.position.set(-4, 3, -2);
  g.scene.add(fillLight);
  const warmLight = new THREE.PointLight(0xcc9966, 3, 8);
  warmLight.position.set(0, 1.5, 3);
  g.scene.add(warmLight);
  const bottomLight = new THREE.PointLight(0x665544, 2, 6);
  bottomLight.position.set(0, -0.2, 4);
  g.scene.add(bottomLight);

  const boxMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.45, metalness: 0.05 });
  const backMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0 });

  const container = new THREE.Group();
  g.scene.add(container);

  const totalH = L.totalH;
  const sideGeo = new THREE.BoxGeometry(0.04, totalH, CONTAINER_D);
  for (const sx of [-CONTAINER_W / 2 + 0.02, CONTAINER_W / 2 - 0.02]) {
    const panel = new THREE.Mesh(sideGeo, boxMat);
    panel.position.set(sx, 0, 0);
    panel.castShadow = true; panel.receiveShadow = true;
    container.add(panel);
  }

  const topPanel = new THREE.Mesh(new THREE.BoxGeometry(CONTAINER_W, 0.04, CONTAINER_D), boxMat);
  topPanel.position.set(0, totalH / 2 + 0.02, 0);
  topPanel.castShadow = true; topPanel.receiveShadow = true;
  container.add(topPanel);

  const bottomPanel = new THREE.Mesh(new THREE.BoxGeometry(CONTAINER_W, 0.04, CONTAINER_D), boxMat);
  bottomPanel.position.set(0, -totalH / 2 - 0.02, 0);
  bottomPanel.castShadow = true; bottomPanel.receiveShadow = true;
  container.add(bottomPanel);

  const backPanel = new THREE.Mesh(
    new THREE.BoxGeometry(CONTAINER_W - 0.08, totalH, 0.02), backMat,
  );
  backPanel.position.set(0, 0, -CONTAINER_D / 2 + 0.01);
  backPanel.receiveShadow = true;
  container.add(backPanel);

  return container;
}
