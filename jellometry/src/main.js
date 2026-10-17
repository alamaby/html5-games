import * as THREE from 'three';
import { SoundManager } from './audio/SoundManager.js';
import { ProceduralTextures } from './core/ProceduralTextures.js';
import { PhysicsWorld } from './core/PhysicsWorld.js';
import { ParticleSystem } from './core/ParticleSystem.js';
import { JellyPlayer } from './entities/JellyPlayer.js';
import { ObstacleFactory, OBSTACLE_CATALOG } from './entities/ObstacleFactory.js';
import { PRESET_LEVELS } from './entities/PresetLevels.js';
import { LevelEditor } from './editor/LevelEditor.js';

const STORAGE_CUSTOM_LEVEL_KEY = 'jellometry_custom_level_v1';
const STORAGE_BEST_TIMES_KEY = 'jellometry_best_times_v1';

class JellometryGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.mode = 'PLAY_MODE'; // 'PLAY_MODE' | 'EDITOR_MODE'
    this.currentPresetId = 'beginner_bounce';
    this.editorSnapshot = null;

    this.raceTime = 0;
    this.raceCompleted = false;
    this.bestTimes = this.loadBestTimes();
    this.toastTimeout = null;

    this.sound = new SoundManager();
    this.physicsWorld = new PhysicsWorld();

    this.initScene();
    this.particles = new ParticleSystem(this.scene);
    this.player = new JellyPlayer(this.scene, this.physicsWorld, this.sound, this.particles);

    this.factory = new ObstacleFactory(this.scene, this.physicsWorld, this.sound, this.particles);
    this.factory.onCheckpointActivated = () => {
      this.showToast('Checkpoint activated! Respawn point updated.');
    };
    this.factory.onFinishReached = () => {
      this.handleRaceVictory();
    };

    this.editor = new LevelEditor({
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      factory: this.factory,
      sound: this.sound,
      onSelectChange: (obs) => this.renderInspector(obs),
      onStatusMessage: (msg) => this.setEditorStatus(msg)
    });

    // Advance kinematic obstacles inside the physics preStep so velocity transfer is accurate.
    this.physicsWorld.onPreStep((dt) => {
      this.factory.updatePreStep(dt, this.mode === 'PLAY_MODE');
    });

    this.initUI();
    this.bindGameplayControls();
    this.loadPresetCourse(this.currentPresetId);

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initScene() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    const envTex = ProceduralTextures.getStudioEnvironment();
    this.scene.environment = envTex;
    this.scene.background = new THREE.Color('#dbeafe');
    this.scene.fog = new THREE.FogExp2('#dbeafe', 0.0065);

    this.camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / window.innerHeight,
      0.1,
      260
    );
    this.camera.position.set(0, 6.2, 8.8);
    this.cameraLookTarget = new THREE.Vector3(0, 1.8, -6);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x64748b, 0.9);
    hemiLight.position.set(0, 40, 0);
    this.scene.add(hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.35);
    this.dirLight.position.set(18, 34, 22);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 140;
    const d = 48;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initUI() {
    this.dom = {
      modeIndicator: document.getElementById('mode-indicator'),
      playTelemetry: document.getElementById('play-telemetry'),
      hudTimer: document.getElementById('hud-timer'),
      hudBest: document.getElementById('hud-best'),
      hudSpeed: document.getElementById('hud-speed'),
      hudMorphName: document.getElementById('hud-morph-name'),
      hudMorphDims: document.getElementById('hud-morph-dims'),
      presetSelect: document.getElementById('preset-select'),
      jellyColorSelect: document.getElementById('jelly-color-select'),
      btnMute: document.getElementById('btn-mute'),
      btnToggleMode: document.getElementById('btn-toggle-mode'),
      playControlsBar: document.getElementById('play-controls-bar'),
      touchControls: document.getElementById('touch-controls'),
      morphSlider: document.getElementById('morph-slider'),
      btnMorphFlat: document.getElementById('btn-morph-flat'),
      btnMorphTall: document.getElementById('btn-morph-tall'),
      btnRespawn: document.getElementById('btn-respawn'),
      toastBanner: document.getElementById('toast-banner'),
      editorInspector: document.getElementById('editor-inspector'),
      editorDock: document.getElementById('editor-dock'),
      catalogButtons: document.getElementById('catalog-buttons'),
      inspectorEmpty: document.getElementById('inspector-empty'),
      inspectorForm: document.getElementById('inspector-form'),
      inspId: document.getElementById('insp-id'),
      inspType: document.getElementById('insp-type'),
      inspPosX: document.getElementById('insp-pos-x'),
      inspPosY: document.getElementById('insp-pos-y'),
      inspPosZ: document.getElementById('insp-pos-z'),
      inspRotX: document.getElementById('insp-rot-x'),
      inspRotY: document.getElementById('insp-rot-y'),
      inspRotZ: document.getElementById('insp-rot-z'),
      inspScaleX: document.getElementById('insp-scale-x'),
      inspScaleY: document.getElementById('insp-scale-y'),
      inspScaleZ: document.getElementById('insp-scale-z'),
      inspParamsContainer: document.getElementById('insp-params-container'),
      btnDuplicateObs: document.getElementById('btn-duplicate-obs'),
      btnDeleteObs: document.getElementById('btn-delete-obs'),
      btnSnap1: document.getElementById('btn-snap-1'),
      btnSnap2: document.getElementById('btn-snap-2'),
      btnSaveLocal: document.getElementById('btn-save-local'),
      btnExportJson: document.getElementById('btn-export-json'),
      btnImportJson: document.getElementById('btn-import-json'),
      btnClearTrack: document.getElementById('btn-clear-track'),
      editorStatusLine: document.getElementById('editor-status-line'),
      victoryModal: document.getElementById('victory-modal'),
      victoryTime: document.getElementById('victory-time'),
      victoryBest: document.getElementById('victory-best'),
      btnVictoryReplay: document.getElementById('btn-victory-replay'),
      btnVictoryNext: document.getElementById('btn-victory-next'),
      btnVictoryEdit: document.getElementById('btn-victory-edit'),
      jsonModal: document.getElementById('json-modal'),
      jsonTextarea: document.getElementById('json-textarea'),
      jsonFeedback: document.getElementById('json-feedback'),
      btnJsonCopy: document.getElementById('btn-json-copy'),
      btnJsonDownload: document.getElementById('btn-json-download'),
      btnJsonApply: document.getElementById('btn-json-apply'),
      btnJsonClose: document.getElementById('btn-json-close')
    };

    // Populate obstacle catalog buttons in the bottom editor dock.
    OBSTACLE_CATALOG.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'catalog-tile';
      btn.dataset.obstacleType = item.type;
      btn.innerHTML = `
        <span class="catalog-tile-title">+ ${item.label}</span>
        <span class="catalog-tile-desc">${item.shortDesc}</span>
      `;
      btn.addEventListener('click', () => {
        const created = this.editor.spawnObstacleAtTarget(item.type);
        this.editor.setPlacementTool(item.type);
        this.syncCatalogHighlight();
        if (created) {
          this.showToast(`Added ${item.label} (${created.id}). Drag gizmo or click grid to place more.`);
        }
      });
      this.dom.catalogButtons.appendChild(btn);
    });

    this.dom.presetSelect.addEventListener('change', (e) => {
      this.loadPresetCourse(e.target.value);
    });

    this.dom.jellyColorSelect.addEventListener('change', (e) => {
      this.player.setPalette(e.target.value);
      this.sound.playUiTick(660);
    });

    this.dom.btnMute.addEventListener('click', () => {
      const muted = this.sound.toggleMute();
      this.dom.btnMute.textContent = muted ? 'Audio: OFF' : 'Audio: ON';
      this.dom.btnMute.setAttribute('aria-pressed', String(muted));
    });

    this.dom.btnToggleMode.addEventListener('click', () => {
      this.toggleMode();
    });

    this.dom.morphSlider.addEventListener('input', (e) => {
      this.player.setMorphValue( parseFloat(e.target.value), true );
    });

    this.dom.btnMorphFlat.addEventListener('click', () => {
      this.player.setMorphValue(Math.max(-1, this.player.morphValue - 0.35), true);
      this.dom.morphSlider.value = String(this.player.morphValue);
    });

    this.dom.btnMorphTall.addEventListener('click', () => {
      this.player.setMorphValue(Math.min(1, this.player.morphValue + 0.35), true);
      this.dom.morphSlider.value = String(this.player.morphValue);
    });

    this.dom.btnRespawn.addEventListener('click', () => {
      this.player.respawn(false);
      this.dom.morphSlider.value = '0';
      this.showToast('Respawned at active checkpoint.');
    });

    // Gizmo mode buttons in Property Inspector.
    document.querySelectorAll('[data-gizmo]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.editor.setTransformMode(btn.dataset.gizmo);
        this.syncGizmoButtons();
      });
    });

    this.dom.btnSnap1.addEventListener('click', () => {
      this.editor.setGridSnap(1);
      this.dom.btnSnap1.classList.add('is-active');
      this.dom.btnSnap2.classList.remove('is-active');
    });

    this.dom.btnSnap2.addEventListener('click', () => {
      this.editor.setGridSnap(2);
      this.dom.btnSnap2.classList.add('is-active');
      this.dom.btnSnap1.classList.remove('is-active');
    });

    // Transform numeric inputs.
    const transformInputs = [
      this.dom.inspPosX,
      this.dom.inspPosY,
      this.dom.inspPosZ,
      this.dom.inspRotX,
      this.dom.inspRotY,
      this.dom.inspRotZ,
      this.dom.inspScaleX,
      this.dom.inspScaleY,
      this.dom.inspScaleZ
    ];
    transformInputs.forEach((input) => {
      input.addEventListener('change', () => this.applyInspectorTransform());
    });

    this.dom.btnDuplicateObs.addEventListener('click', () => this.editor.duplicateSelected());
    this.dom.btnDeleteObs.addEventListener('click', () => this.editor.deleteSelected());

    // Persistence buttons.
    this.dom.btnSaveLocal.addEventListener('click', () => this.saveToLocalStorage());
    this.dom.btnExportJson.addEventListener('click', () => this.openJsonModal('export'));
    this.dom.btnImportJson.addEventListener('click', () => this.openJsonModal('import'));
    this.dom.btnClearTrack.addEventListener('click', () => {
      this.loadPresetCourse(this.currentPresetId, true);
      this.showToast('Reset course to original preset layout.');
    });

    // Victory modal buttons.
    this.dom.btnVictoryReplay.addEventListener('click', () => {
      this.dom.victoryModal.hidden = true;
      this.restartRace();
    });

    this.dom.btnVictoryNext.addEventListener('click', () => {
      this.dom.victoryModal.hidden = true;
      const nextId =
        this.currentPresetId === 'beginner_bounce' ? 'morph_madness' : 'beginner_bounce';
      this.dom.presetSelect.value = nextId;
      this.loadPresetCourse(nextId);
    });

    this.dom.btnVictoryEdit.addEventListener('click', () => {
      this.dom.victoryModal.hidden = true;
      if (this.mode !== 'EDITOR_MODE') {
        this.setMode('EDITOR_MODE');
      }
    });

    // JSON modal buttons.
    this.dom.btnJsonCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.dom.jsonTextarea.value);
        this.setJsonFeedback('Copied level JSON to clipboard.', false);
      } catch {
        this.dom.jsonTextarea.select();
        this.setJsonFeedback('Selected JSON text. Press Ctrl+C to copy.', false);
      }
    });

    this.dom.btnJsonDownload.addEventListener('click', () => {
      const payload = this.dom.jsonTextarea.value.trim();
      if (!payload) {
        this.setJsonFeedback('JSON textarea is empty.', true);
        return;
      }
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jellometry-${this.currentPresetId || 'track'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.setJsonFeedback('Downloaded .json level file.', false);
    });

    this.dom.btnJsonApply.addEventListener('click', () => {
      this.applyImportedJson(this.dom.jsonTextarea.value);
    });

    this.dom.btnJsonClose.addEventListener('click', () => {
      this.dom.jsonModal.hidden = true;
    });
  }

  bindGameplayControls() {
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'Escape') {
        if (!this.dom.jsonModal.hidden) {
          this.dom.jsonModal.hidden = true;
          return;
        }
        if (!this.dom.victoryModal.hidden) {
          this.dom.victoryModal.hidden = true;
          return;
        }
        if (this.mode === 'PLAY_MODE') {
          this.toggleMode();
          return;
        }
      }

      if (this.mode !== 'PLAY_MODE') return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.player.keys.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.player.keys.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.player.keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.player.keys.right = true;
          break;
        case 'Space':
          e.preventDefault();
          this.player.keys.jump = true;
          break;
        case 'KeyQ':
          this.player.keys.morphFlat = true;
          break;
        case 'KeyE':
          this.player.keys.morphTall = true;
          break;
        case 'KeyR':
          this.player.respawn(false);
          this.dom.morphSlider.value = '0';
          break;
        default:
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.player.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.player.keys.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.player.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.player.keys.right = false;
          break;
        case 'Space':
          this.player.keys.jump = false;
          break;
        case 'KeyQ':
          this.player.keys.morphFlat = false;
          break;
        case 'KeyE':
          this.player.keys.morphTall = false;
          break;
        default:
          break;
      }
    });

    // Mouse wheel in PLAY_MODE smoothly morphs the jelly dimensions.
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        if (this.mode !== 'PLAY_MODE') return;
        e.preventDefault();
        const dir = e.deltaY > 0 ? -0.14 : 0.14;
        this.player.adjustMorph(dir);
        this.dom.morphSlider.value = String(this.player.morphValue.toFixed(2));
      },
      { passive: false }
    );

    // Touch controls for mobile devices.
    document.querySelectorAll('.touch-btn').forEach((btn) => {
      const key = btn.dataset.key;
      if (!key) return;
      const setKey = (val) => {
        this.player.keys[key] = val;
      };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        setKey(true);
      });
      btn.addEventListener('pointerup', () => setKey(false));
      btn.addEventListener('pointerleave', () => setKey(false));
      btn.addEventListener('pointercancel', () => setKey(false));
    });
  }

  toggleMode() {
    this.setMode(this.mode === 'PLAY_MODE' ? 'EDITOR_MODE' : 'PLAY_MODE');
  }

  /**
   * Enforces strict state separation between PLAY_MODE and EDITOR_MODE.
   * Entering PLAY_MODE snapshots the editor level so returning to EDITOR_MODE
   * restores all obstacles and the player to their exact edited transforms.
   */
  setMode(targetMode) {
    if (targetMode === this.mode) return;
    this.sound.playUiTick(targetMode === 'EDITOR_MODE' ? 520 : 720);

    if (targetMode === 'EDITOR_MODE') {
      this.mode = 'EDITOR_MODE';
      this.clearPlayerInputs();

      if (this.editorSnapshot) {
        this.factory.loadLevel(this.editorSnapshot);
      } else {
        this.factory.resetAllForModeSwitch();
      }

      const sp = this.editorSnapshot?.spawnPoint || [0, 2.2, 0];
      this.player.setSpawnPoint(new THREE.Vector3(sp[0], sp[1], sp[2]), null);
      this.player.respawn(false);
      this.dom.morphSlider.value = '0';

      // Position OrbitControls around the player's current region for immediate editing.
      const focusZ = Math.min(-8, this.player.rootGroup.position.z - 6);
      this.editor.orbitControls.target.set(0, 2.0, focusZ);
      this.camera.fov = 58;
      this.camera.updateProjectionMatrix();
      this.camera.position.set(16, 15, focusZ + 18);
      this.editor.orbitControls.update();

      this.editor.setEnabled(true);
      this.dom.modeIndicator.textContent = 'EDITOR MODE';
      this.dom.modeIndicator.classList.add('is-editor');
      this.dom.btnToggleMode.textContent = 'Play Track [ESC]';
      this.dom.playControlsBar.hidden = true;
      this.dom.touchControls.hidden = true;
      this.dom.editorInspector.hidden = false;
      this.dom.editorDock.hidden = false;
      this.renderInspector(this.editor.selectedObstacle);
      this.showToast('Editor Mode: Click obstacles to transform or choose a tool below.');
    } else {
      // Serialize the exact edited state before starting physics simulation.
      this.editorSnapshot = this.factory.serializeLevel({
        name: this.currentPresetId,
        spawnPoint: [0, 2.2, 0]
      });

      this.mode = 'PLAY_MODE';
      this.editor.setEnabled(false);
      this.dom.modeIndicator.textContent = 'PLAY MODE';
      this.dom.modeIndicator.classList.remove('is-editor');
      this.dom.btnToggleMode.textContent = 'Edit Track [ESC]';
      this.dom.playControlsBar.hidden = false;
      this.dom.touchControls.hidden = false;
      this.dom.editorInspector.hidden = true;
      this.dom.editorDock.hidden = true;

      this.restartRace();
      this.showToast('Play Mode: Race to the checkered Finish Arch!');
    }
  }

  clearPlayerInputs() {
    Object.keys(this.player.keys).forEach((k) => {
      this.player.keys[k] = false;
    });
  }

  loadPresetCourse(presetId, forceReset = false) {
    this.currentPresetId = presetId;
    let levelData = PRESET_LEVELS[presetId];

    if (presetId === 'custom_saved') {
      const savedRaw = localStorage.getItem(STORAGE_CUSTOM_LEVEL_KEY);
      if (savedRaw) {
        try {
          levelData = JSON.parse(savedRaw);
        } catch {
          levelData = PRESET_LEVELS.beginner_bounce;
        }
      } else {
        levelData = PRESET_LEVELS.beginner_bounce;
        this.showToast('No saved custom track yet. Loaded Beginner Bounce as starting template.');
      }
    }

    if (!levelData) {
      levelData = PRESET_LEVELS.beginner_bounce;
    }

    this.editor.selectObstacle(null);
    this.factory.loadLevel(levelData);
    this.editorSnapshot = this.factory.serializeLevel({
      name: levelData.name || presetId,
      spawnPoint: levelData.spawnPoint || [0, 2.2, 0]
    });

    this.restartRace();
    this.updateBestTimeDisplay();

    if (!forceReset) {
      this.showToast(`Loaded course: ${levelData.name || presetId}`);
    }
  }

  restartRace() {
    this.raceTime = 0;
    this.raceCompleted = false;
    this.particles.clear();
    this.factory.resetAllForModeSwitch();

    const sp = this.editorSnapshot?.spawnPoint || [0, 2.2, 0];
    this.player.setSpawnPoint(new THREE.Vector3(sp[0], sp[1], sp[2]), null);
    this.player.respawn(false);
    this.dom.morphSlider.value = '0';
  }

  handleRaceVictory() {
    if (this.raceCompleted) return;
    this.raceCompleted = true;

    const prevBest = this.bestTimes[this.currentPresetId];
    if (!prevBest || this.raceTime < prevBest) {
      this.bestTimes[this.currentPresetId] = this.raceTime;
      this.saveBestTimes();
    }

    this.updateBestTimeDisplay();
    this.dom.victoryTime.textContent = this.formatTime(this.raceTime);
    this.dom.victoryBest.textContent = this.formatTime(this.bestTimes[this.currentPresetId]);
    this.dom.victoryModal.hidden = false;
  }

  renderInspector(obstacle) {
    this.syncGizmoButtons();
    this.syncCatalogHighlight();

    if (!obstacle) {
      this.dom.inspectorEmpty.hidden = false;
      this.dom.inspectorForm.hidden = true;
      return;
    }

    this.dom.inspectorEmpty.hidden = true;
    this.dom.inspectorForm.hidden = false;

    this.dom.inspId.textContent = obstacle.id;
    this.dom.inspType.textContent = obstacle.type;

    this.dom.inspPosX.value = obstacle.group.position.x.toFixed(2);
    this.dom.inspPosY.value = obstacle.group.position.y.toFixed(2);
    this.dom.inspPosZ.value = obstacle.group.position.z.toFixed(2);

    this.dom.inspRotX.value = THREE.MathUtils.radToDeg(obstacle.group.rotation.x).toFixed(0);
    this.dom.inspRotY.value = THREE.MathUtils.radToDeg(obstacle.group.rotation.y).toFixed(0);
    this.dom.inspRotZ.value = THREE.MathUtils.radToDeg(obstacle.group.rotation.z).toFixed(0);

    this.dom.inspScaleX.value = obstacle.group.scale.x.toFixed(2);
    this.dom.inspScaleY.value = obstacle.group.scale.y.toFixed(2);
    this.dom.inspScaleZ.value = obstacle.group.scale.z.toFixed(2);

    this.renderDynamicObstacleParams(obstacle);
  }

  renderDynamicObstacleParams(obstacle) {
    const container = this.dom.inspParamsContainer;
    container.innerHTML = '';

    const params = obstacle.params;
    const addNumberField = (key, label, step = 0.5, min = -90, max = 100) => {
      const wrap = document.createElement('label');
      wrap.className = 'param-field';
      wrap.innerHTML = `<span>${label}</span>`;
      const input = document.createElement('input');
      input.type = 'number';
      input.step = String(step);
      input.min = String(min);
      input.max = String(max);
      input.value = String(params[key] ?? 0);
      input.addEventListener('change', () => {
        const val = parseFloat(input.value);
        if (!Number.isNaN(val)) {
          this.factory.rebuildObstacle(obstacle, { [key]: val });
          this.editor.selectObstacle(obstacle);
        }
      });
      wrap.appendChild(input);
      container.appendChild(wrap);
    };

    const addSelectField = (key, label, options) => {
      const wrap = document.createElement('label');
      wrap.className = 'param-field';
      wrap.innerHTML = `<span>${label}</span>`;
      const select = document.createElement('select');
      options.forEach(([val, text]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = text;
        if (params[key] === val) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener('change', () => {
        this.factory.rebuildObstacle(obstacle, { [key]: select.value });
        this.editor.selectObstacle(obstacle);
      });
      wrap.appendChild(select);
      container.appendChild(wrap);
    };

    const addColorField = (key, label) => {
      const wrap = document.createElement('label');
      wrap.className = 'param-field';
      wrap.innerHTML = `<span>${label}</span>`;
      const input = document.createElement('input');
      input.type = 'color';
      input.value = params[key] || '#ff4d6d';
      input.addEventListener('input', () => {
        this.factory.rebuildObstacle(obstacle, { [key]: input.value });
      });
      wrap.appendChild(input);
      container.appendChild(wrap);
    };

    switch (obstacle.type) {
      case 'track_block':
        addNumberField('width', 'Width (m)', 0.5, 1.5, 40);
        addNumberField('length', 'Length (m)', 1, 2, 80);
        addNumberField('height', 'Thickness (m)', 0.2, 0.3, 10);
        addNumberField('slopeAngle', 'Slope Angle (°)', 5, -45, 45);
        addColorField('color', 'Surface Color');
        break;
      case 'spinning_sweeper':
        addNumberField('armLength', 'Bar Length (m)', 0.5, 2.5, 20);
        addNumberField('speed', 'Spin Speed (rad/s)', 0.2, -10, 10);
        addNumberField('barHeight', 'Bar Height (m)', 0.1, 0.4, 4);
        addColorField('color', 'Stripe Color');
        break;
      case 'moving_platform':
        addNumberField('width', 'Width (m)', 0.5, 2, 20);
        addNumberField('length', 'Length (m)', 0.5, 2, 25);
        addSelectField('axis', 'Travel Axis', [
          ['x', 'Horizontal (X)'],
          ['y', 'Vertical Lift (Y)'],
          ['z', 'Forward/Back (Z)']
        ]);
        addNumberField('distance', 'Travel Dist (m)', 0.5, 0.5, 25);
        addNumberField('speed', 'Oscillation Speed', 0.2, 0.2, 8);
        addColorField('color', 'Platform Color');
        break;
      case 'bouncy_pad':
        addNumberField('width', 'Width (m)', 0.5, 1.5, 16);
        addNumberField('length', 'Length (m)', 0.5, 1.5, 16);
        addNumberField('bounceForce', 'Launch Impulse', 1, 8, 40);
        addColorField('color', 'Slime Color');
        break;
      case 'shape_gate':
        addSelectField('cutoutShape', 'Gate Cutout', [
          ['flat_wide', 'Flat & Wide [Q]'],
          ['tall_narrow', 'Tall & Narrow [E]']
        ]);
        addNumberField('wallWidth', 'Wall Width (m)', 0.5, 4.5, 20);
        addNumberField('wallHeight', 'Wall Height (m)', 0.5, 3.0, 12);
        addColorField('color', 'Gate Color');
        break;
      case 'checkpoint_finish':
        addSelectField('variant', 'Gate Role', [
          ['checkpoint', 'Checkpoint Pad'],
          ['finish', 'Finish Line Arch']
        ]);
        addNumberField('width', 'Arch Width (m)', 0.5, 3.5, 20);
        addColorField('color', 'Beacon Color');
        break;
      default:
        break;
    }
  }

  applyInspectorTransform() {
    const obs = this.editor.selectedObstacle;
    if (!obs) return;

    const px = parseFloat(this.dom.inspPosX.value) || 0;
    const py = parseFloat(this.dom.inspPosY.value) || 0;
    const pz = parseFloat(this.dom.inspPosZ.value) || 0;

    const rx = THREE.MathUtils.degToRad(parseFloat(this.dom.inspRotX.value) || 0);
    const ry = THREE.MathUtils.degToRad(parseFloat(this.dom.inspRotY.value) || 0);
    const rz = THREE.MathUtils.degToRad(parseFloat(this.dom.inspRotZ.value) || 0);

    const sx = Math.max(0.2, parseFloat(this.dom.inspScaleX.value) || 1);
    const sy = Math.max(0.2, parseFloat(this.dom.inspScaleY.value) || 1);
    const sz = Math.max(0.2, parseFloat(this.dom.inspScaleZ.value) || 1);

    obs.group.position.set(px, py, pz);
    obs.group.rotation.set(rx, ry, rz);
    obs.group.scale.set(sx, sy, sz);

    this.factory.rebuildObstacle(obs);
    this.editor.selectObstacle(obs);
  }

  syncGizmoButtons() {
    const mode = this.editor.getTransformMode();
    document.querySelectorAll('[data-gizmo]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.gizmo === mode);
    });
  }

  syncCatalogHighlight() {
    const activeType = this.editor.placementType;
    document.querySelectorAll('.catalog-tile').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.obstacleType === activeType);
    });
  }

  saveToLocalStorage() {
    const payload = this.factory.serializeLevel({
      name: 'Saved Custom Track',
      spawnPoint: [0, 2.2, 0]
    });
    localStorage.setItem(STORAGE_CUSTOM_LEVEL_KEY, JSON.stringify(payload));
    this.editorSnapshot = payload;
    this.currentPresetId = 'custom_saved';
    this.dom.presetSelect.value = 'custom_saved';
    this.sound.playCheckpoint();
    this.showToast('Saved custom track to browser LocalStorage.');
  }

  openJsonModal(mode = 'export') {
    this.dom.jsonFeedback.hidden = true;
    if (mode === 'export') {
      const serialized = this.factory.serializeLevel({
        name: this.currentPresetId === 'custom_saved' ? 'Saved Custom Track' : this.currentPresetId,
        spawnPoint: [0, 2.2, 0]
      });
      this.dom.jsonTextarea.value = JSON.stringify(serialized, null, 2);
    } else {
      this.dom.jsonTextarea.value = '';
      this.dom.jsonTextarea.placeholder =
        'Paste level JSON here, e.g. {"version": 1, "name": "My Track", "obstacles": [...]}';
    }
    this.dom.jsonModal.hidden = false;
    this.dom.jsonTextarea.focus();
  }

  applyImportedJson(rawText) {
    if (!rawText || !rawText.trim()) {
      this.setJsonFeedback('Please paste a valid JSON level object before loading.', true);
      return;
    }

    try {
      const parsed = JSON.parse(rawText);
      if (!parsed || !Array.isArray(parsed.obstacles)) {
        this.setJsonFeedback('Invalid format: JSON must contain an "obstacles" array.', true);
        return;
      }

      this.editor.selectObstacle(null);
      this.factory.loadLevel(parsed);
      this.editorSnapshot = this.factory.serializeLevel({
        name: parsed.name || 'Imported Track',
        spawnPoint: parsed.spawnPoint || [0, 2.2, 0]
      });
      localStorage.setItem(STORAGE_CUSTOM_LEVEL_KEY, JSON.stringify(this.editorSnapshot));
      this.currentPresetId = 'custom_saved';
      this.dom.presetSelect.value = 'custom_saved';

      this.setJsonFeedback(`Loaded ${parsed.obstacles.length} obstacles into track.`, false);
      this.sound.playCheckpoint();
      setTimeout(() => {
        this.dom.jsonModal.hidden = true;
      }, 550);
    } catch (err) {
      this.setJsonFeedback(`JSON parse error: ${err.message}`, true);
    }
  }

  setJsonFeedback(message, isError = false) {
    this.dom.jsonFeedback.hidden = false;
    this.dom.jsonFeedback.textContent = message;
    this.dom.jsonFeedback.classList.toggle('is-error', isError);
  }

  setEditorStatus(msg) {
    if (this.dom.editorStatusLine) {
      this.dom.editorStatusLine.textContent = msg;
    }
    this.syncCatalogHighlight();
  }

  showToast(message) {
    this.dom.toastBanner.textContent = message;
    this.dom.toastBanner.hidden = false;
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = setTimeout(() => {
      this.dom.toastBanner.hidden = true;
    }, 2800);
  }

  loadBestTimes() {
    try {
      const raw = localStorage.getItem(STORAGE_BEST_TIMES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  saveBestTimes() {
    try {
      localStorage.setItem(STORAGE_BEST_TIMES_KEY, JSON.stringify(this.bestTimes));
    } catch {
      // Ignore storage quota errors in private browsing.
    }
  }

  updateBestTimeDisplay() {
    const best = this.bestTimes[this.currentPresetId];
    this.dom.hudBest.textContent = best ? this.formatTime(best) : '--:--.--';
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hundredths = Math.floor((seconds % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
  }

  updatePlayCamera(dt) {
    const playerPos = this.player.rootGroup.position;
    const speed = this.player.getSpeed();

    // Boost FOV dynamically when accelerating or launching off slime pads.
    const targetFov = THREE.MathUtils.clamp(58 + Math.max(0, speed - 3) * 1.35, 58, 72);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.exp(-6 * dt));
      this.camera.updateProjectionMatrix();
    }

    const desiredPos = new THREE.Vector3(
      playerPos.x * 0.75,
      playerPos.y + 4.4,
      playerPos.z + 8.6
    );
    const posBlend = 1 - Math.exp(-8.5 * dt);
    this.camera.position.lerp(desiredPos, posBlend);

    const desiredLook = new THREE.Vector3(
      playerPos.x * 0.85,
      playerPos.y + 0.8,
      playerPos.z - 5.2
    );
    this.cameraLookTarget.lerp(desiredLook, 1 - Math.exp(-12 * dt));
    this.camera.lookAt(this.cameraLookTarget);

    // Keep directional shadow frustum centered around the player along the course.
    this.dirLight.position.set(playerPos.x + 18, playerPos.y + 34, playerPos.z + 22);
    this.dirLight.target.position.copy(playerPos);
    this.dirLight.target.updateMatrixWorld();
  }

  updateHUD() {
    this.dom.hudTimer.textContent = this.formatTime(this.raceTime);
    const speed = this.player.getSpeed();
    this.dom.hudSpeed.textContent = `${speed.toFixed(1)} m/s`;

    const dims = this.player.currentDims;
    const vol = dims.x * dims.y * dims.z;
    this.dom.hudMorphName.textContent = this.player.getMorphProfileName();
    this.dom.hudMorphDims.textContent = `${dims.x.toFixed(2)}W x ${dims.y.toFixed(2)}H x ${dims.z.toFixed(2)}D (${vol.toFixed(2)}m³)`;

    if (this.player.keys.morphFlat || this.player.keys.morphTall) {
      this.dom.morphSlider.value = String(this.player.morphValue.toFixed(2));
    }
  }

  animate() {
    requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const isPlay = this.mode === 'PLAY_MODE';

    if (isPlay) {
      if (!this.raceCompleted) {
        this.raceTime += dt;
      }
      this.physicsWorld.step(dt);
      this.player.update(dt, !this.raceCompleted);
      this.factory.updateVisuals(dt, this.player, !this.raceCompleted);

      // Out-of-bounds respawn rule when the jelly falls below Y = -10.
      if (this.player.body.position.y < -10) {
        this.particles.emitDroplets(
          this.player.rootGroup.position,
          this.player.getPalette().hex,
          18
        );
        this.player.respawn(true);
        this.dom.morphSlider.value = '0';
        this.showToast('Splash! Respawned at last activated checkpoint.');
      }

      this.updatePlayCamera(dt);
      this.updateHUD();
    } else {
      this.player.update(dt, false);
      this.factory.updateVisuals(dt, this.player, false);
      this.editor.update();
    }

    this.particles.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.jellometryApp = new JellometryGame();
});
