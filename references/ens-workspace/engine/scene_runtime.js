import { updateDoors } from '/static/js/room_render_core.js?v=20260413-room-grid-fix-5';

const THREE_REF = () => window.THREE;

function disposeMaterial(material) {
  if (!material) return;
  Object.keys(material).forEach((key) => {
    const value = material[key];
    if (value && value.isTexture && typeof value.dispose === 'function') {
      value.dispose();
    }
  });
  material.dispose?.();
}

function disposeObject3D(object) {
  if (!object) return;
  object.traverse?.((child) => {
    if (child.geometry) child.geometry.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => {
        disposeMaterial(material);
      });
    } else if (child.material) {
      disposeMaterial(child.material);
    }
  });
}

function createMeasurementLabel(text) {
  const THREE = THREE_REF();
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  const radius = 18;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(canvas.width - radius, 0);
  ctx.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
  ctx.lineTo(canvas.width, canvas.height - radius);
  ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height);
  ctx.lineTo(radius, canvas.height);
  ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 54px "Segoe UI", Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.8, 0.5, 1);
  return sprite;
}

function setStatus(container, message, tone = 'info') {
  let status = container.querySelector('.three-status');
  if (!status) {
    status = document.createElement('div');
    status.className = 'three-status';
    container.appendChild(status);
  }
  status.dataset.tone = tone;
  status.textContent = message;
  status.hidden = !message;
}

const LIGHTING_PRESETS = {
  neutral: {
    ambient: 0.52,
    hemi: 0.74,
    key: 0.82,
    fill: 0.28,
    rim: 0.12,
    keyPosition: [6, 8, 5],
    fillPosition: [-4, 3, -3],
    rimPosition: [-6, 5, 6],
  },
  exhibition: {
    ambient: 0.22,
    hemi: 0.45,
    key: 1.55,
    fill: 0.18,
    rim: 0.55,
    keyPosition: [7, 9, 5],
    fillPosition: [-4, 3, -3],
    rimPosition: [-6, 5, 6],
  },
  accent: {
    ambient: 0.46,
    hemi: 0.68,
    key: 1.08,
    fill: 0.24,
    rim: 0.3,
    keyPosition: [5.5, 9.5, 4.5],
    fillPosition: [-3.5, 2.5, -2.5],
    rimPosition: [-5.5, 5.5, 5.5],
  },
  spotlight: {
    ambient: 0.38,
    hemi: 0.56,
    key: 1.32,
    fill: 0.18,
    rim: 0.34,
    keyPosition: [4.5, 11, 4.5],
    fillPosition: [-2.8, 2.4, -2.8],
    rimPosition: [-5.5, 6, 5.5],
  },
  ambient: {
    ambient: 0.74,
    hemi: 0.96,
    key: 0.74,
    fill: 0.22,
    rim: 0.08,
    keyPosition: [6, 8, 6],
    fillPosition: [-3.2, 2.8, -3.2],
    rimPosition: [-4.5, 4.6, 4.5],
  },
  led: {
    ambient: 0.58,
    hemi: 0.84,
    key: 1.16,
    fill: 0.28,
    rim: 0.22,
    keyPosition: [7.2, 9.5, 7.2],
    fillPosition: [-4, 2.8, -3.8],
    rimPosition: [-6.4, 5.6, 6.2],
  },
  pendant: {
    ambient: 0.5,
    hemi: 0.7,
    key: 1.24,
    fill: 0.2,
    rim: 0.18,
    keyPosition: [0, 11, 4.8],
    fillPosition: [-2.5, 2.2, -2.5],
    rimPosition: [-4.8, 5.2, 5],
  },
};

function resolveLightingPreset(name = 'exhibition') {
  const key = String(name || '').toLowerCase();
  return LIGHTING_PRESETS[key] ? key : 'exhibition';
}

function getGridAlignmentOffset(span) {
  const halfSpan = Math.max(0, Number(span) || 0) / 2;
  const fractional = ((halfSpan % 1) + 1) % 1;
  if (fractional < 0.0001 || fractional > 0.9999) return 0;
  if (Math.abs(fractional - 0.5) < 0.0001) return 0.5;
  return fractional <= 0.5 ? fractional : fractional - 1;
}

function buildWorldFloorTexture() {
  const THREE = THREE_REF();
  if (!THREE) return null;
  try {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#1e2124';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const vary = (Math.random() - 0.5) * 14;
      const v = Math.max(0, Math.min(255, 36 + vary));
      ctx.fillStyle = `rgba(${v},${v},${v},0.3)`;
      ctx.fillRect(x, y, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
    }
    const tileSize = size / 4;
    ctx.strokeStyle = 'rgba(80,88,96,0.6)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= size; x += tileSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
    }
    for (let y = 0; y <= size; y += tileSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(80,88,96,0.22)';
    ctx.lineWidth = 1;
    for (let x = tileSize / 2; x < size; x += tileSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
    }
    for (let y = tileSize / 2; y < size; y += tileSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  } catch (_) {
    return null;
  }
}

function buildProceduralEnvMap(renderer) {
  const THREE = THREE_REF();
  if (!THREE?.PMREMGenerator) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0.0,  '#7aaac8');
    grad.addColorStop(0.22, '#a8c8de');
    grad.addColorStop(0.46, '#d4e4ef');
    grad.addColorStop(0.58, '#ede8e0');
    grad.addColorStop(0.68, '#e4ddd4');
    grad.addColorStop(1.0,  '#d8d0c4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const hGrad = ctx.createLinearGradient(0, canvas.height * 0.46, 0, canvas.height * 0.70);
    hGrad.addColorStop(0,   'rgba(255,248,236,0)');
    hGrad.addColorStop(0.42, 'rgba(255,248,236,0.38)');
    hGrad.addColorStop(1,   'rgba(255,248,236,0)');
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tex = new THREE.CanvasTexture(canvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envRT = pmrem.fromEquirectangular(tex);
    pmrem.dispose();
    tex.dispose();
    return envRT;
  } catch (_) {
    return null;
  }
}

export function createSceneRuntime(container) {
  const THREE = THREE_REF();
  if (!container || !THREE) {
    if (container) setStatus(container, 'Three.js failed to load.', 'error');
    return null;
  }

  const width = Math.max(1, container.clientWidth || container.offsetWidth || 1);
  const height = Math.max(1, container.clientHeight || container.offsetHeight || 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1c1f);

  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 200);
  camera.position.set(6, 6, 10);
  camera.lookAt(0, 1, 0);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (error) {
    setStatus(container, 'WebGL renderer failed to start.', 'error');
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  if (THREE.ACESFilmicToneMapping) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.94;
  }
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  container.innerHTML = '';
  container.appendChild(renderer.domElement);
  setStatus(container, '', 'info');

  let envRT = buildProceduralEnvMap(renderer);
  if (envRT) {
    scene.environment = envRT.texture;
  }
  scene.fog = new THREE.Fog(0x1a1c1f, 20, 40);

  const controls = THREE.OrbitControls ? new THREE.OrbitControls(camera, renderer.domElement) : null;
  if (controls) {
    controls.enableDamping = true;
    controls.target.set(0, 1.05, 0);
    controls.update();
  }

  const ambient = new THREE.AmbientLight(0xffffff, 0.22);
  const hemi = new THREE.HemisphereLight(0xe8f0ff, 0x1a1c1f, 0.45);
  const directional = new THREE.DirectionalLight(0xfffcf0, 1.55);
  directional.position.set(7, 9, 5);
  directional.castShadow = true;
  directional.shadow.mapSize.width = 2048;
  directional.shadow.mapSize.height = 2048;
  directional.shadow.bias = -0.0002;
  directional.shadow.normalBias = 0.02;
  directional.shadow.radius = 2;
  directional.shadow.camera.near = 0.5;
  directional.shadow.camera.far = 30;
  directional.shadow.camera.left = -14;
  directional.shadow.camera.right = 14;
  directional.shadow.camera.top = 14;
  directional.shadow.camera.bottom = -14;
  directional.shadow.camera.updateProjectionMatrix();
  const fill = new THREE.DirectionalLight(0xaaccff, 0.18);
  fill.position.set(-4, 3, -3);
  fill.castShadow = false;
  const rim = new THREE.DirectionalLight(0x88bbff, 0.55);
  rim.position.set(-6, 5, 6);
  rim.castShadow = false;
  scene.add(ambient);
  scene.add(hemi);
  scene.add(directional);
  scene.add(fill);
  scene.add(rim);

  const worldFloorTex = buildWorldFloorTexture();
  const worldFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 28),
    new THREE.MeshStandardMaterial({
      color: worldFloorTex ? 0xffffff : 0x1e2124,
      map: worldFloorTex || null,
      roughness: 0.62,
      metalness: 0.08,
      side: THREE.DoubleSide,
    })
  );
  worldFloor.rotation.x = -Math.PI / 2;
  worldFloor.receiveShadow = true;
  scene.add(worldFloor);

  const gridHelper = new THREE.GridHelper(20, 20, 0x3a4048, 0x2e3540);
  gridHelper.material.opacity = 0.7;
  gridHelper.material.transparent = true;
  gridHelper.material.depthWrite = false;
  gridHelper.position.y = 0.006;
  scene.add(gridHelper);

  const boothRoot = new THREE.Group();
  boothRoot.name = 'BoothRoot';
  scene.add(boothRoot);

  const furnitureRoot = new THREE.Group();
  furnitureRoot.name = 'FurnitureRoot';
  scene.add(furnitureRoot);

  const roomRoot = new THREE.Group();
  roomRoot.name = 'RoomRoot';
  scene.add(roomRoot);

  const siteObjectRoot = new THREE.Group();
  siteObjectRoot.name = 'SiteObjectRoot';
  scene.add(siteObjectRoot);

  const helperRoot = new THREE.Group();
  helperRoot.name = 'WorkspaceHelperRoot';
  scene.add(helperRoot);

  let measurementGroup = null;

  let transformControls = null;
  if (THREE.TransformControls) {
    transformControls = new THREE.TransformControls(camera, renderer.domElement);
    transformControls.setMode('translate');
    scene.add(transformControls);
  }

  let destroyed = false;
  const resize = () => {
    if (destroyed) return;
    const nextWidth = Math.max(1, container.clientWidth || container.offsetWidth || 1);
    const nextHeight = Math.max(1, container.clientHeight || container.offsetHeight || 1);
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight);
  };

  const onWindowResize = () => resize();
  window.addEventListener('resize', onWindowResize);

  let resizeObserver = null;
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);
  }

  let activeLightingPreset = 'exhibition';
  const setLightingPreset = (name = 'exhibition') => {
    activeLightingPreset = resolveLightingPreset(name);
    const preset = LIGHTING_PRESETS[activeLightingPreset];
    ambient.intensity = preset.ambient;
    hemi.intensity = preset.hemi;
    directional.intensity = preset.key;
    directional.position.set(...preset.keyPosition);
    fill.intensity = preset.fill;
    fill.position.set(...preset.fillPosition);
    rim.intensity = preset.rim;
    rim.position.set(...preset.rimPosition);
  };
  setLightingPreset(activeLightingPreset);

  const clearMeasurement = () => {
    if (!measurementGroup) return;
    helperRoot.remove(measurementGroup);
    disposeObject3D(measurementGroup);
    measurementGroup = null;
  };

  const setMeasurement = (points = []) => {
    clearMeasurement();
    if (!Array.isArray(points) || !points.length) return;
    measurementGroup = new THREE.Group();
    points.forEach((point) => {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35, metalness: 0.18 })
      );
      marker.position.copy(point);
      measurementGroup.add(marker);
    });
    if (points.length >= 2) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0x2563eb })
      );
      measurementGroup.add(line);
      const midpoint = new THREE.Vector3().addVectors(points[0], points[1]).multiplyScalar(0.5);
      midpoint.y += 0.18;
      const distance = points[0].distanceTo(points[1]);
      const label = createMeasurementLabel(`${distance.toFixed(2)} m`);
      if (label) {
        label.position.copy(midpoint);
        measurementGroup.add(label);
      }
    }
    helperRoot.add(measurementGroup);
  };

  const pickGroundPoint = (clientX, clientY) => {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObject(worldFloor, false)[0];
    return hit?.point ? hit.point.clone() : null;
  };

  const setTransformSnap = (enabled = true, translationStep = 0.5, rotationDegrees = 90) => {
    if (!transformControls) return;
    transformControls.setTranslationSnap(enabled ? Math.max(0.1, Number(translationStep) || 0.5) : null);
    transformControls.setRotationSnap(
      enabled ? THREE.MathUtils.degToRad(Math.max(1, Number(rotationDegrees) || 90)) : null
    );
  };

  let highlightedBoothPanel = null;

  const pickBoothPanel = (clientX, clientY) => {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const meshes = [];
    boothRoot.traverse((c) => { if (c.isMesh && c.userData?.isBoothPanel) meshes.push(c); });
    const hits = raycaster.intersectObjects(meshes, false);
    return hits.length ? hits[0].object : null;
  };

  const highlightBoothPanel = (mesh) => {
    if (highlightedBoothPanel?.material) {
      highlightedBoothPanel.material.emissiveIntensity = 0;
    }
    highlightedBoothPanel = mesh || null;
    if (mesh?.material) {
      if (!mesh.material.emissive) mesh.material.emissive = new THREE.Color(0x3388ff);
      else mesh.material.emissive.set(0x3388ff);
      mesh.material.emissiveIntensity = 0.18;
    }
  };

  const clearBoothPanelHighlight = () => {
    if (highlightedBoothPanel?.material) {
      highlightedBoothPanel.material.emissiveIntensity = 0;
    }
    highlightedBoothPanel = null;
  };

  let animationFrameId = 0;
  const animate = () => {
    if (destroyed) return;
    animationFrameId = window.requestAnimationFrame(animate);
    if (controls) controls.update();
    updateDoors(scene);
    renderer.render(scene, camera);
  };
  animate();

  return {
    container,
    scene,
    camera,
    renderer,
    controls,
    boothRoot,
    furnitureRoot,
    roomRoot,
    siteObjectRoot,
    helperRoot,
    gridHelper,
    worldFloor,
    transformControls,
    resize,
    pickBoothPanel,
    highlightBoothPanel,
    clearBoothPanelHighlight,
    getHighlightedBoothPanel() { return highlightedBoothPanel; },
    setLightingPreset,
    setTransformSnap,
    pickGroundPoint,
    setMeasurement,
    clearMeasurement,
    getLightingPreset() {
      return activeLightingPreset;
    },
    setGridVisible(visible) {
      gridHelper.visible = Boolean(visible);
    },
    setCameraView(view = 'perspective', dims = {}) {
      const w = Number(dims?.width) || 6;
      const d = Number(dims?.depth) || 3;
      const h = Number(dims?.height) || 2.48;
      const target = controls?.target || new THREE.Vector3(0, h * 0.45, 0);
      if (view === 'top') {
        camera.position.set(0, Math.max(w, d) * 1.6 + h, 0.001);
        if (controls) { controls.target.set(0, 0, 0); controls.update(); }
      } else if (view === 'front') {
        camera.position.set(0, h * 0.55, Math.max(w, d) * 1.4 + h * 0.6);
        if (controls) { controls.target.set(0, h * 0.45, 0); controls.update(); }
      } else if (view === 'side') {
        camera.position.set(Math.max(w, d) * 1.4 + h * 0.6, h * 0.55, 0);
        if (controls) { controls.target.set(0, h * 0.45, 0); controls.update(); }
      } else {
        camera.position.set(w * 1.1, h * 2.0, d * 1.45 + w * 0.35);
        if (controls) { controls.target.set(0, h * 0.45, 0); controls.update(); }
      }
      camera.lookAt(target);
    },
    focusOnBooth(dims, preview = false) {
      const maxFootprint = Math.max(Number(dims?.width) || 6, Number(dims?.depth) || 3);
      const targetHeight = Number(dims?.height) || 2.48;
      gridHelper.position.set(
        getGridAlignmentOffset(dims?.width),
        0.006,
        getGridAlignmentOffset(dims?.depth)
      );
      if (preview) {
        camera.position.set(maxFootprint * 0.85, targetHeight * 1.6, maxFootprint * 0.95);
      } else {
        camera.position.set(maxFootprint * 1.1, targetHeight * 2.0, maxFootprint * 1.45);
      }
      if (controls) {
        controls.target.set(0, targetHeight * 0.45, 0);
        controls.update();
      } else {
        camera.lookAt(0, targetHeight * 0.45, 0);
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
      window.removeEventListener('resize', onWindowResize);
      scene.environment = null;
      if (envRT) { envRT.dispose(); envRT = null; }
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      controls?.dispose?.();
      if (transformControls) {
        transformControls.detach();
        transformControls.dispose?.();
        scene.remove(transformControls);
        transformControls = null;
      }
      clearMeasurement();
      [boothRoot, furnitureRoot, roomRoot, siteObjectRoot, helperRoot].forEach((root) => {
        disposeObject3D(root);
        scene.remove(root);
      });
      disposeObject3D(worldFloor);
      disposeObject3D(gridHelper);
      scene.remove(worldFloor);
      scene.remove(gridHelper);
      renderer.renderLists?.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
      container.innerHTML = '';
    },
  };
}
