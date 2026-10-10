import * as THREE from '/vendor/three.module.js';

let renderer;
let animationFrame;
let activeModel;

function stopViewer() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
    renderer = null;
  }
  activeModel = null;
}

function createPlate(container, dish) {
  stopViewer();
  const width = Math.max(container.clientWidth, 280);
  const height = 360;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f1eb);
  const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
  camera.position.set(0, 4.3, 8.8);
  camera.lookAt(0, 0, 0);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.replaceChildren(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x56504a, 2.1));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3);
  keyLight.position.set(4, 8, 5);
  scene.add(keyLight);

  activeModel = new THREE.Group();
  scene.add(activeModel);
  const plateMaterial = new THREE.MeshStandardMaterial({ color: 0xfaf9f6, roughness: 0.2, metalness: 0.04 });
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.2, 0.22, 96), plateMaterial);
  plate.position.y = -0.2;
  activeModel.add(plate);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(2.8, 0.025, 10, 96),
    new THREE.MeshStandardMaterial({ color: 0xc9c1b5, metalness: 0.35, roughness: 0.25 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.065;
  activeModel.add(rim);

  let hue = 0.1;
  for (const character of dish.name) hue = (hue * 31 + character.codePointAt(0)) % 360;
  const foodMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(`hsl(${hue}, 64%, 48%)`),
    roughness: 0.42,
  });
  for (let index = 0; index < 7; index++) {
    const angle = index * Math.PI * 2 / 7;
    const size = 0.34 + (index % 3) * 0.12;
    const piece = new THREE.Mesh(new THREE.SphereGeometry(size, 32, 24), foodMaterial);
    piece.position.set(Math.cos(angle) * 1.25, 0.15 + (index % 2) * 0.12, Math.sin(angle) * 1.25);
    piece.scale.y = 0.62;
    activeModel.add(piece);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 24), foodMaterial);
  center.position.y = 0.26;
  center.scale.y = 0.5;
  activeModel.add(center);

  let pointerDown = false;
  let pointerX = 0;
  let pointerY = 0;
  renderer.domElement.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    pointerX = event.clientX;
    pointerY = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener('pointerup', () => { pointerDown = false; });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!pointerDown) return;
    activeModel.rotation.y += (event.clientX - pointerX) * 0.012;
    activeModel.rotation.x = THREE.MathUtils.clamp(
      activeModel.rotation.x + (event.clientY - pointerY) * 0.008,
      -0.6,
      0.6
    );
    pointerX = event.clientX;
    pointerY = event.clientY;
  });
  renderer.domElement.addEventListener('wheel', (event) => {
    camera.position.z = THREE.MathUtils.clamp(camera.position.z + event.deltaY * 0.008, 5.5, 12);
  }, { passive: true });

  const render = () => {
    if (!renderer) return;
    renderer.render(scene, camera);
    animationFrame = requestAnimationFrame(render);
  };
  render();
}

window.addEventListener('foodexpress:3d-view', (event) => {
  const dialog = document.getElementById('dish-3d-dialog');
  const { dish } = event.detail;
  document.getElementById('dish-3d-title').textContent = dish.name;
  document.getElementById('dish-3d-caption').textContent =
    dish.story || dish.description || 'Концептуальная 3D-визуализация без фотографии блюда.';
  if (!dialog.open) dialog.showModal();
  try {
    createPlate(document.getElementById('dish-3d-viewer'), dish);
  } catch (error) {
    document.getElementById('dish-3d-viewer').textContent =
      `3D-просмотр недоступен в этом браузере: ${error.message}`;
  }
});

document.getElementById('dish-3d-dialog').addEventListener('close', stopViewer);
window.addEventListener('resize', () => {
  const canvas = renderer?.domElement;
  if (!canvas) return;
  const width = Math.max(canvas.parentElement.clientWidth, 280);
  const height = 360;
  renderer.setSize(width, height);
  renderer.domElement.parentElement.querySelector('canvas').style.width = '100%';
});
