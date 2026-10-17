import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { OBSTACLE_CATALOG } from '../entities/ObstacleFactory.js';

export class LevelEditor {
  constructor({ scene, camera, renderer, factory, sound, onSelectChange, onStatusMessage }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.factory = factory;
    this.sound = sound;
    this.onSelectChange = onSelectChange;
    this.onStatusMessage = onStatusMessage;

    this.enabled = false;
    this.gridSnap = 1; // 1-unit or 2-unit grid snapping
    this.placementType = null;
    this.selectedObstacle = null;
    this.isDraggingGizmo = false;
    this.pointerDownPos = new THREE.Vector2();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.setupControls();
    this.setupGridAndHelpers();
    this.bindEvents();
  }

  setupControls() {
    const dom = this.renderer.domElement;

    this.orbitControls = new OrbitControls(this.camera, dom);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.08;
    this.orbitControls.maxPolarAngle = Math.PI * 0.49;
    this.orbitControls.minDistance = 4;
    this.orbitControls.maxDistance = 120;
    this.orbitControls.target.set(0, 1.5, -18);
    this.orbitControls.enabled = false;

    this.transformControls = new TransformControls(this.camera, dom);
    this.transformControls.setSize(0.95);
    this.transformControls.setTranslationSnap(this.gridSnap);
    this.transformControls.setRotationSnap(THREE.MathUtils.degToRad(15));
    this.transformControls.setScaleSnap(0.1);
    this.transformControls.enabled = false;

    const gizmoHelper = this.transformControls.getHelper
      ? this.transformControls.getHelper()
      : this.transformControls;
    this.gizmoHelper = gizmoHelper;
    this.gizmoHelper.visible = false;
    this.scene.add(this.gizmoHelper);

    // Disable OrbitControls while dragging a TransformControls handle to prevent camera spin.
    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.isDraggingGizmo = event.value;
      if (this.enabled) {
        this.orbitControls.enabled = !event.value;
      }
    });

    this.transformControls.addEventListener('objectChange', () => {
      if (!this.selectedObstacle) return;
      if (this.selectedObstacle.type === 'shape_gate' || this.selectedObstacle.type === 'track_block') {
        this.factory.rebuildObstacle(this.selectedObstacle);
      } else {
        this.factory.syncBodiesToGroup(this.selectedObstacle);
      }
      if (this.selectionBox) {
        this.selectionBox.update();
      }
      this.onSelectChange?.(this.selectedObstacle);
    });
  }

  setupGridAndHelpers() {
    this.gridHelper = new THREE.GridHelper(180, 180, 0x3a86ff, 0x334155);
    this.gridHelper.position.set(0, -0.02, -30);
    this.gridHelper.material.transparent = true;
    this.gridHelper.material.opacity = 0.45;
    this.gridHelper.visible = false;
    this.scene.add(this.gridHelper);

    // Placement ghost mesh shows where a new obstacle will land before clicking.
    const ghostGeom = new THREE.BoxGeometry(4, 1, 4);
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x2ec4b6,
      wireframe: false,
      transparent: true,
      opacity: 0.38
    });
    this.placementGhost = new THREE.Mesh(ghostGeom, ghostMat);
    this.placementGhost.visible = false;
    this.scene.add(this.placementGhost);

    this.selectionBox = new THREE.BoxHelper(new THREE.Mesh(), 0xff9f1c);
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);
  }

  bindEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      this.pointerDownPos.set(e.clientX, e.clientY);
    });

    dom.addEventListener('pointermove', (e) => {
      if (!this.enabled) return;
      this.updatePointer(e);
      if (this.placementType) {
        this.updatePlacementPreview();
      }
    });

    dom.addEventListener('pointerup', (e) => {
      if (!this.enabled || e.button !== 0) return;
      if (this.isDraggingGizmo) return;

      const moveDist = Math.hypot(
        e.clientX - this.pointerDownPos.x,
        e.clientY - this.pointerDownPos.y
      );
      // Ignore pointerup if the user was orbiting/panning the camera.
      if (moveDist > 6) return;

      this.updatePointer(e);

      if (this.placementType) {
        this.placeActiveObstacleAtCursor(e.shiftKey);
      } else {
        this.pickObstacleAtCursor();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'd') {
        e.preventDefault();
        this.duplicateSelected();
        return;
      }

      if (key === 'g') {
        this.setTransformMode('translate');
      } else if (key === 'r') {
        this.setTransformMode('rotate');
      } else if (key === 's') {
        this.setTransformMode('scale');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.deleteSelected();
      } else if (e.key === 'Escape') {
        if (this.placementType) {
          this.setPlacementTool(null);
        } else {
          this.selectObstacle(null);
        }
      }
    });
  }

  setEnabled(active) {
    this.enabled = Boolean(active);
    this.orbitControls.enabled = this.enabled;
    this.transformControls.enabled = this.enabled && Boolean(this.selectedObstacle);
    this.gizmoHelper.visible = this.enabled && Boolean(this.selectedObstacle);
    this.gridHelper.visible = this.enabled;

    if (!this.enabled) {
      this.setPlacementTool(null);
      this.selectionBox.visible = false;
      this.transformControls.detach();
    } else if (this.selectedObstacle) {
      this.selectObstacle(this.selectedObstacle);
    }
  }

  setGridSnap(snapUnits) {
    this.gridSnap = snapUnits === 2 ? 2 : 1;
    this.transformControls.setTranslationSnap(this.gridSnap);
    this.onStatusMessage?.(`Grid snap set to ${this.gridSnap}m`);
  }

  setTransformMode(mode) {
    if (!['translate', 'rotate', 'scale'].includes(mode)) return;
    this.transformControls.setMode(mode);
    this.sound?.playUiTick(560);
    this.onSelectChange?.(this.selectedObstacle);
  }

  getTransformMode() {
    return this.transformControls.getMode();
  }

  setPlacementTool(type) {
    if (this.placementType === type) {
      this.placementType = null;
    } else {
      this.placementType = type;
    }

    if (!this.placementType) {
      this.placementGhost.visible = false;
      this.onStatusMessage?.('Select tool active: click any obstacle to inspect or transform.');
      return;
    }

    const entry = OBSTACLE_CATALOG.find((c) => c.type === this.placementType);
    const w = entry?.defaultParams?.width || entry?.defaultParams?.wallWidth || entry?.defaultParams?.armLength || 4;
    const h = entry?.defaultParams?.height || entry?.defaultParams?.wallHeight || 1.2;
    const l = entry?.defaultParams?.length || 3;

    this.placementGhost.geometry.dispose();
    this.placementGhost.geometry = new THREE.BoxGeometry(w, h, l);
    this.placementGhost.visible = true;
    this.sound?.playUiTick(680);
    this.onStatusMessage?.(`Placing ${entry?.label || type}: click on track or grid to place (hold Shift for multiple).`);
  }

  updatePointer(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  snapValue(val) {
    return Math.round(val / this.gridSnap) * this.gridSnap;
  }

  computePlacementPoint() {
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const meshList = [];
    for (const obs of this.factory.obstacles.values()) {
      if (obs.type === 'track_block') {
        obs.group.traverse((c) => {
          if (c.isMesh) meshList.push(c);
        });
      }
    }

    const hits = this.raycaster.intersectObjects(meshList, false);
    if (hits.length > 0) {
      const pt = hits[0].point;
      return new THREE.Vector3(
        this.snapValue(pt.x),
        Math.round(pt.y * 2) / 2,
        this.snapValue(pt.z)
      );
    }

    const groundTarget = new THREE.Vector3();
    const hitGround = this.raycaster.ray.intersectPlane(this.groundPlane, groundTarget);
    if (hitGround) {
      return new THREE.Vector3(
        this.snapValue(groundTarget.x),
        0,
        this.snapValue(groundTarget.z)
      );
    }

    return new THREE.Vector3(
      this.snapValue(this.orbitControls.target.x),
      0,
      this.snapValue(this.orbitControls.target.z)
    );
  }

  updatePlacementPreview() {
    const pt = this.computePlacementPoint();
    this.placementGhost.position.copy(pt);
    this.placementGhost.position.y += 0.5;
  }

  placeActiveObstacleAtCursor(keepToolActive = false) {
    if (!this.placementType) return;
    const pt = this.computePlacementPoint();
    const created = this.factory.createObstacle({
      type: this.placementType,
      position: [pt.x, pt.y, pt.z],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    });

    this.sound?.playUiTick(780);
    this.selectObstacle(created);

    if (!keepToolActive) {
      this.setPlacementTool(null);
    }
  }

  spawnObstacleAtTarget(type) {
    const entry = OBSTACLE_CATALOG.find((c) => c.type === type);
    if (!entry) return null;

    const basePos = this.selectedObstacle
      ? this.selectedObstacle.group.position.clone().add(new THREE.Vector3(0, 0, -6))
      : new THREE.Vector3(
          this.snapValue(this.orbitControls.target.x),
          Math.max(0, Math.round(this.orbitControls.target.y)),
          this.snapValue(this.orbitControls.target.z)
        );

    const created = this.factory.createObstacle({
      type,
      position: [basePos.x, basePos.y, basePos.z],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    });
    this.sound?.playUiTick(780);
    this.selectObstacle(created);
    return created;
  }

  pickObstacleAtCursor() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = [];
    for (const obs of this.factory.obstacles.values()) {
      obs.group.traverse((child) => {
        if (child.isMesh) meshes.push(child);
      });
    }

    const intersects = this.raycaster.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      const hitObj = intersects[0].object;
      const obsId = hitObj.userData?.obstacleId;
      const obstacle = this.factory.obstacles.get(obsId);
      if (obstacle) {
        this.sound?.playUiTick(520);
        this.selectObstacle(obstacle);
        return;
      }
    }

    this.selectObstacle(null);
  }

  selectObstacle(obstacle) {
    this.selectedObstacle = obstacle || null;

    if (this.selectedObstacle && this.enabled) {
      this.transformControls.attach(this.selectedObstacle.group);
      this.transformControls.enabled = true;
      this.gizmoHelper.visible = true;
      this.selectionBox.setFromObject(this.selectedObstacle.group);
      this.selectionBox.visible = true;
    } else {
      this.transformControls.detach();
      this.transformControls.enabled = false;
      this.gizmoHelper.visible = false;
      this.selectionBox.visible = false;
    }

    this.onSelectChange?.(this.selectedObstacle);
  }

  deleteSelected() {
    if (!this.selectedObstacle) return;
    const id = this.selectedObstacle.id;
    this.selectObstacle(null);
    this.factory.removeObstacle(id);
    this.sound?.playUiTick(320);
    this.onStatusMessage?.(`Deleted obstacle ${id}.`);
  }

  duplicateSelected() {
    if (!this.selectedObstacle) return;
    const src = this.selectedObstacle;
    const euler = src.group.rotation;

    const copy = this.factory.createObstacle({
      type: src.type,
      position: [
        src.group.position.x + this.gridSnap * 2,
        src.group.position.y,
        src.group.position.z - this.gridSnap * 2
      ],
      rotation: [
        THREE.MathUtils.radToDeg(euler.x),
        THREE.MathUtils.radToDeg(euler.y),
        THREE.MathUtils.radToDeg(euler.z)
      ],
      scale: [src.group.scale.x, src.group.scale.y, src.group.scale.z],
      params: { ...src.params }
    });

    this.sound?.playUiTick(740);
    this.selectObstacle(copy);
    this.onStatusMessage?.(`Duplicated ${src.type} (${copy.id}).`);
  }

  update() {
    if (!this.enabled) return;
    this.orbitControls.update();
    if (this.selectedObstacle && this.selectionBox.visible) {
      this.selectionBox.update();
    }
  }
}
