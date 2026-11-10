import * as THREE from 'three';
import { videoTexture, updateVideo, updateScreenGlow } from './videoManager.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { buildRoom, buildScreen, buildCurtains, buildSeats, buildStage, buildLighting, updateBeam } from './sceneBuilder.js';
import { initPost, updatePost, resizePost } from './postprocessing.js';
import { initUI } from './ui.js?v=32';

const canvas = document.getElementById('theatre-canvas');
const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 900;
const maxDpr = isMobileDevice ? 1.15 : 1.25;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isMobileDevice,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.016);

function getDefaultFov() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  // Wider FOV in portrait mobile so the curved IMAX screen fits comfortably
  return aspect < 1.0 ? 78 : 58;
}

const camera = new THREE.PerspectiveCamera(
  getDefaultFov(),
  window.innerWidth / Math.max(1, window.innerHeight),
  0.1,
  120
);
camera.position.set(0, 2.43, 4.66);

buildRoom(scene);
buildScreen(scene, videoTexture);
buildCurtains(scene);
buildSeats(scene);
buildStage(scene);

RectAreaLightUniformsLib.init();
const lights = buildLighting(scene);

const post = initPost(renderer, scene, camera);

const uiDeps = { camera, renderer, lights, scene, getDefaultFov };
initUI(uiDeps);

function handleViewportResize() {
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  camera.aspect = w / h;
  if (uiDeps.onResizeFov) uiDeps.onResizeFov(getDefaultFov());
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.setSize(w, h);
  resizePost(w, h);
}

window.addEventListener('resize', handleViewportResize);
window.addEventListener('orientationchange', () => {
  setTimeout(handleViewportResize, 120);
});

let fpsF = 0, fpsL = 0;
const fpsEl = document.getElementById('fps-counter');

function animate(t) {
  fpsF++;
  if (t - fpsL > 1000) {
    if (fpsEl) fpsEl.textContent = fpsF + ' fps';
    fpsF = 0;
    fpsL = t;
  }

  updatePost(t);
  updateVideo();
  updateScreenGlow(lights.screenGlow);
  updateBeam(t);

  if (uiDeps.updateCamera) uiDeps.updateCamera();
  post.composer.render();
}

renderer.setAnimationLoop(animate);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) renderer.setAnimationLoop(null);
  else renderer.setAnimationLoop(animate);
});
