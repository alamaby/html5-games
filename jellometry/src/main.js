import * as THREE from 'three';
import { SoundManager } from './audio/SoundManager.js';
import { ProceduralTextures } from './core/ProceduralTextures.js';
import { PhysicsWorld } from './core/PhysicsWorld.js';
import { ParticleSystem } from './core/ParticleSystem.js';
import { JellyPlayer, JELLY_PALETTES } from './entities/JellyPlayer.js';
import { ObstacleFactory } from './entities/ObstacleFactory.js';
import { LEVELS } from './entities/PresetLevels.js';

const STORAGE_BEST_TIMES_KEY = 'jellometry_best_times_v1';
const STORAGE_PROGRESS_KEY = 'jellometry_progress_v1';

// DOM writes are the cheapest thing to cut on a phone: the hundredths column
// reads fine at 16 Hz and the frame budget stays free.
const HUD_REFRESH_INTERVAL = 1 / 16;
const FALL_LIMIT_Y = -10;

// Adaptive quality guard.
const PERF_SAMPLE_SIZE = 45;
const PERF_BUDGET_MS = 22;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

class JellometryGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.app = document.getElementById('app');

    this.raceTime = 0;
    this.raceCompleted = false;
    this.bestTimes = this.loadBestTimes();
    this.progress = this.loadProgress();
    this.levelIndex = this.resolveStartingLevelIndex();

    this.toastTimeout = null;
    this.introTimeout = null;
    this.hudAccumulator = 0;
    this.hudCache = {};
    this.resizeFrame = null;
    this.modalReturnFocus = null;

    this.frameSamples = [];
    this.frameAccum = 0;
    this.qualityDegraded = false;

    this.sound = new SoundManager();
    this.physicsWorld = new PhysicsWorld();

    this.initScene();
    this.particles = new ParticleSystem(this.scene);
    this.player = new JellyPlayer(this.scene, this.physicsWorld, this.sound, this.particles);

    this.factory = new ObstacleFactory(this.scene, this.physicsWorld, this.sound, this.particles);
    this.factory.onCheckpointActivated = () => {
      this.showToast('Checkpoint reached. Respawn point updated.');
    };
    this.factory.onFinishReached = () => this.handleRaceVictory();

    // Advance kinematic obstacles inside the physics preStep so velocity transfer is accurate.
    this.physicsWorld.onPreStep((dt) => this.factory.updatePreStep(dt, true));

    this.initUI();
    this.bindGameplayControls();
    this.loadLevel(this.levelIndex, { announce: false, focusModal: false });

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  /* ---------------------------------------------------------------- *
   * Scene & viewport
   * ---------------------------------------------------------------- */

  initScene() {
    const coarse =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches ||
        window.matchMedia?.('(hover: none)').matches);
    this.isCoarsePointer = Boolean(coarse);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.isCoarsePointer,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(this.targetPixelRatio());
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.scene.environment = ProceduralTextures.getStudioEnvironment();
    this.scene.background = new THREE.Color('#dbeafe');
    this.scene.fog = new THREE.FogExp2('#dbeafe', 0.0065);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 260);
    this.camera.position.set(0, 6.2, 8.8);
    this.cameraLookTarget = new THREE.Vector3(0, 1.8, -6);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x64748b, 0.9);
    hemiLight.position.set(0, 40, 0);
    this.scene.add(hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.35);
    this.dirLight.position.set(18, 34, 22);
    this.dirLight.castShadow = true;
    const shadowRes = this.isCoarsePointer ? 1024 : 2048;
    this.dirLight.shadow.mapSize.set(shadowRes, shadowRes);
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 140;
    const d = 48;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    this.initViewportHandling();
  }

  targetPixelRatio() {
    const cap = this.isCoarsePointer ? 1.6 : 2;
    const native = window.devicePixelRatio || 1;
    const cap2 = this.qualityDegraded ? Math.min(cap, 1.15) : cap;
    return Math.min(native, cap2);
  }

  /**
   * The canvas must be sized from its own layout box, never from
   * `window.innerHeight`. On iOS the browser toolbar collapsing makes
   * innerHeight disagree with the visual viewport, and the renderer then writes
   * an inline style that beats the `100dvh` layout and overflows the page.
   */
  initViewportHandling() {
    this.applyViewportSize();

    if (typeof ResizeObserver !== 'undefined') {
      this.viewportObserver = new ResizeObserver(() => this.scheduleViewportResize());
      this.viewportObserver.observe(this.app);
    }
    window.addEventListener('resize', () => this.scheduleViewportResize());
    window.addEventListener('orientationchange', () => {
      // iOS reports the old metrics for a frame or two after rotation.
      window.setTimeout(() => this.scheduleViewportResize(), 140);
      window.setTimeout(() => this.scheduleViewportResize(), 420);
    });
    window.visualViewport?.addEventListener('resize', () => this.scheduleViewportResize());
  }

  scheduleViewportResize() {
    if (this.resizeFrame !== null) return;
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = null;
      this.applyViewportSize();
    });
  }

  applyViewportSize() {
    const width = Math.max(1, Math.round(this.canvas.clientWidth));
    const height = Math.max(1, Math.round(this.canvas.clientHeight));
    if (width === this.viewportWidth && height === this.viewportHeight) return;
    this.viewportWidth = width;
    this.viewportHeight = height;

    // updateStyle = false: CSS owns the element box, so no inline size is written
    // and the ResizeObserver cannot feed back into itself.
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /* ---------------------------------------------------------------- *
   * UI
   * ---------------------------------------------------------------- */

  initUI() {
    const $ = (id) => document.getElementById(id);

    this.dom = {
      hudTimer: $('hud-timer'),
      hudBest: $('hud-best'),
      hudSpeed: $('hud-speed'),
      hudMorphName: $('hud-morph-name'),
      hudMorphDims: $('hud-morph-dims'),
      hudLevelIndex: $('hud-level-index'),
      hudLevelName: $('hud-level-name'),
      levelIntro: $('level-intro'),
      levelIntroIndex: $('level-intro-index'),
      levelIntroName: $('level-intro-name'),
      levelIntroDiff: $('level-intro-diff'),
      levelIntroObjective: $('level-intro-objective'),
      levelIntroRecord: $('level-intro-record'),
      toast: $('toast-banner'),
      btnMute: $('btn-mute'),
      muteGlyph: $('mute-glyph'),
      btnJellyColor: $('btn-jelly-color'),
      colorSwatch: $('jelly-color-swatch'),
      btnLevels: $('btn-levels'),
      levelModal: $('level-modal'),
      levelGrid: $('level-grid'),
      levelModalProgress: $('level-modal-progress'),
      btnLevelClose: $('btn-level-close'),
      victoryModal: $('victory-modal'),
      victoryEyebrow: $('victory-eyebrow'),
      victoryTitle: $('victory-title'),
      victorySummary: $('victory-summary'),
      victoryRecord: $('victory-record'),
      victoryTime: $('victory-time'),
      victoryBest: $('victory-best'),
      btnVictoryNext: $('btn-victory-next'),
      btnVictoryReplay: $('btn-victory-replay'),
      btnVictoryLevels: $('btn-victory-levels'),
      morphSlider: $('morph-slider'),
      btnMorphFlat: $('btn-morph-flat'),
      btnMorphTall: $('btn-morph-tall'),
      btnRespawn: $('btn-respawn'),
      btnTouchRespawn: $('btn-touch-respawn'),
      btnTouchJump: $('btn-touch-jump'),
      morphButtons: Array.from(document.querySelectorAll('.touch-morph-btn')),
      joystickZone: $('joystick-zone'),
      joystickBase: $('joystick-base'),
      joystickKnob: $('joystick-knob')
    };

    this.bindLevelSelectUI();
    this.bindMobileActionUI();
    this.syncColorUI();
    this.syncMuteUI();
  }

  /* --- level select modal ------------------------------------------ */

  bindLevelSelectUI() {
    this.dom.btnLevels.addEventListener('click', () => this.openLevelModal());
    this.dom.btnLevelClose.addEventListener('click', () => this.closeLevelModal());
    this.dom.levelModal.addEventListener('pointerdown', (event) => {
      if (event.target === this.dom.levelModal) this.closeLevelModal();
    });

    // Arrow keys move between cards; the grid is a single logical list.
    this.dom.levelGrid.addEventListener('keydown', (event) => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const cards = Array.from(this.dom.levelGrid.querySelectorAll('.level-card:not(:disabled)'));
      const current = cards.indexOf(document.activeElement);
      if (current === -1) return;
      const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
      const next = clamp(current + step, 0, cards.length - 1);
      cards[next]?.focus();
      event.preventDefault();
    });

    this.dom.btnVictoryNext.addEventListener('click', () => {
      const next = this.levelIndex + 1;
      this.hideVictoryModal();
      if (next < LEVELS.length) this.loadLevel(next);
    });
    this.dom.btnVictoryReplay.addEventListener('click', () => {
      this.hideVictoryModal();
      this.loadLevel(this.levelIndex, { announce: false });
    });
    this.dom.btnVictoryLevels.addEventListener('click', () => {
      this.hideVictoryModal();
      this.openLevelModal();
    });
  }

  openLevelModal() {
    this.modalReturnFocus = document.activeElement;
    this.renderLevelGrid();
    this.dom.levelModal.hidden = false;
    this.dom.levelGrid.querySelector('.level-card.is-current:not(:disabled)')?.focus();
  }

  closeLevelModal() {
    this.dom.levelModal.hidden = true;
    this.modalReturnFocus?.focus?.();
    this.modalReturnFocus = null;
  }

  renderLevelGrid() {
    const grid = this.dom.levelGrid;
    grid.innerHTML = '';

    const unlockedCount = this.unlockedCount();
    this.dom.levelModalProgress.textContent = this.unlockAll
      ? `${LEVELS.length} of ${LEVELS.length} unlocked (unlockAll override)`
      : `${unlockedCount} of ${LEVELS.length} unlocked`;

    LEVELS.forEach((level, index) => {
      const unlocked = index < unlockedCount;
      const best = this.bestTimes[level.id];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'level-card';
      card.dataset.levelIndex = String(index);
      if (index === this.levelIndex) card.classList.add('is-current');
      if (!unlocked) {
        card.classList.add('is-locked');
        card.disabled = true;
      }

      const stars = '\u2605'.repeat(level.difficulty) + '\u2606'.repeat(5 - level.difficulty);
      const bestText = unlocked
        ? best
          ? `BEST ${this.formatTime(best)}`
          : 'BEST --:--.--'
        : 'LOCKED';

      card.innerHTML = `
        <span class="level-card-top">
          <span class="level-card-index">${String(index + 1).padStart(2, '0')}</span>
          <span class="level-card-stars" aria-hidden="true">${stars}</span>
        </span>
        <span class="level-card-name">${unlocked ? level.name : 'Locked'}</span>
        <span class="level-card-objective">${
          unlocked ? level.objective : `Clear course ${String(index).padStart(2, '0')} to unlock.`
        }</span>
        <span class="level-card-best">${bestText}</span>
      `;
      card.setAttribute(
        'aria-label',
        unlocked
          ? `Course ${index + 1}, ${level.name}, difficulty ${level.difficulty} of 5. ${bestText}.`
          : `Course ${index + 1} locked`
      );

      card.addEventListener('click', () => {
        this.closeLevelModal();
        this.loadLevel(index);
      });
      grid.appendChild(card);
    });
  }

  /* --- mobile action cluster & colour/audio toggles ---------------- */

  bindMobileActionUI() {
    this.dom.btnMute.addEventListener('click', () => {
      const nextMuted = !this.sound.isMuted;
      if (typeof this.sound.setMuted === 'function') this.sound.setMuted(nextMuted);
      else this.sound.muted = nextMuted;
      this.syncMuteUI();
    });

    this.dom.btnJellyColor.addEventListener('click', () => {
      const next = (this.player.paletteIndex + 1) % JELLY_PALETTES.length;
      this.player.setPalette(next);
      this.syncColorUI();
      this.sound.playUiTick?.(660);
    });

    this.dom.morphButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.player.setMorphValue(Number(btn.dataset.morph));
        this.dom.morphSlider.value = String(Number(btn.dataset.morph).toFixed(2));
        this.syncTouchMorphButtons();
      });
    });

    if (this.dom.btnMorphFlat) {
      this.dom.btnMorphFlat.addEventListener('click', () => {
        this.player.adjustMorph(-0.34);
        this.dom.morphSlider.value = String(this.player.morphValue.toFixed(2));
        this.syncTouchMorphButtons();
      });
    }
    if (this.dom.btnMorphTall) {
      this.dom.btnMorphTall.addEventListener('click', () => {
        this.player.adjustMorph(0.34);
        this.dom.morphSlider.value = String(this.player.morphValue.toFixed(2));
        this.syncTouchMorphButtons();
      });
    }

    this.dom.morphSlider.addEventListener('input', () => {
      this.player.setMorphValue(Number(this.dom.morphSlider.value), false);
      this.syncTouchMorphButtons();
    });

    const respawn = () => this.resetPlayerToCheckpoint('Respawned at the last checkpoint.');
    this.dom.btnRespawn?.addEventListener('click', respawn);
    this.dom.btnTouchRespawn?.addEventListener('click', respawn);

    // A latched tap survives the gap between touch events and the fixed physics
    // step, which is what makes JUMP reliable on a phone.
    const jump = (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.player.queueJump();
    };
    this.dom.btnTouchJump?.addEventListener('pointerdown', jump);
  }

  syncColorUI() {
    const palette = this.player.getPalette();
    if (this.dom.colorSwatch) this.dom.colorSwatch.style.background = palette.hex;
    if (this.dom.btnJellyColor) {
      this.dom.btnJellyColor.title = `Jelly colour: ${palette.name}`;
      this.dom.btnJellyColor.setAttribute('aria-label', `Cycle jelly colour, current: ${palette.name}`);
    }
  }

  syncMuteUI() {
    const muted = Boolean(this.sound.isMuted ?? this.sound.muted);
    if (this.dom.muteGlyph) this.dom.muteGlyph.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
    if (this.dom.btnMute) {
      this.dom.btnMute.setAttribute('aria-pressed', String(muted));
      this.dom.btnMute.setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio');
    }
  }

  syncTouchMorphButtons() {
    const value = this.player.morphValue;
    const active = this.dom.morphButtons.find((btn) => Math.abs(value - Number(btn.dataset.morph)) < 0.16);
    this.dom.morphButtons.forEach((btn) => btn.classList.toggle('is-active', btn === active));
  }

  /* ---------------------------------------------------------------- *
   * Input
   * ---------------------------------------------------------------- */

  bindGameplayControls() {
    window.addEventListener('keydown', (event) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (event.key === 'Escape') {
        if (!this.dom.levelModal.hidden) {
          this.closeLevelModal();
          return;
        }
        if (!this.dom.victoryModal.hidden) {
          this.hideVictoryModal();
        }
        return;
      }

      if (event.code === 'KeyL') {
        if (this.dom.levelModal.hidden) this.openLevelModal();
        else this.closeLevelModal();
        return;
      }
      if (event.code === 'KeyM') {
        this.dom.btnMute.click();
        return;
      }

      // Freeze the jelly while a dialog owns the screen.
      if (!this.dom.levelModal.hidden || !this.dom.victoryModal.hidden) {
        if (event.code === 'Enter' && !this.dom.victoryModal.hidden) {
          this.dom.btnVictoryNext.hidden
            ? this.dom.btnVictoryReplay.click()
            : this.dom.btnVictoryNext.click();
        }
        return;
      }

      switch (event.code) {
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
          event.preventDefault();
          this.player.keys.jump = true;
          break;
        case 'KeyQ':
          this.player.keys.morphFlat = true;
          break;
        case 'KeyE':
          this.player.keys.morphTall = true;
          break;
        case 'KeyR':
          this.resetPlayerToCheckpoint('Respawned at the last checkpoint.');
          break;
        default:
          break;
      }
    });

    window.addEventListener('keyup', (event) => {
      switch (event.code) {
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

    // Mouse wheel smoothly morphs the jelly.
    this.canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        this.player.adjustMorph(event.deltaY > 0 ? -0.14 : 0.14);
        this.dom.morphSlider.value = String(this.player.morphValue.toFixed(2));
        this.syncTouchMorphButtons();
      },
      { passive: false }
    );

    this.bindVirtualJoystick();
  }

  /**
   * Thumbstick mapping derived from the live DOM box rather than a hardcoded
   * radius, with a floating recentre so the ring meets the thumb wherever it
   * lands. A fixed radius that disagreed with the CSS base size used to make
   * the knob punch through its own ring.
   */
  bindVirtualJoystick() {
    const { joystickZone: zone, joystickBase: base, joystickKnob: knob } = this.dom;
    if (!zone || !base || !knob) return;

    this.joystickPointerId = null;
    this.joystickHome = null;

    const readGeometry = () => {
      const baseRect = base.getBoundingClientRect();
      const knobRect = knob.getBoundingClientRect();
      return {
        radius: Math.max(16, baseRect.width * 0.5 - knobRect.width * 0.5 - 2),
        centerX: baseRect.left + baseRect.width * 0.5,
        centerY: baseRect.top + baseRect.height * 0.5,
        baseRadius: baseRect.width * 0.5
      };
    };

    const release = () => {
      if (this.joystickPointerId === null && !this.joystickHome) return;
      this.joystickPointerId = null;
      this.joystickHome = null;
      base.style.transform = '';
      base.classList.remove('is-floating');
      knob.style.transform = 'translate3d(0, 0, 0)';
      this.player.analogInput.set(0, 0);
    };

    const track = (clientX, clientY) => {
      const home = this.joystickHome;
      if (!home) return;
      let dx = clientX - home.x;
      let dy = clientY - home.y;
      const distance = Math.hypot(dx, dy);
      if (distance > home.radius) {
        const scale = home.radius / (distance || 1);
        dx *= scale;
        dy *= scale;
      }
      knob.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      this.player.analogInput.set(dx / home.radius, -dy / home.radius);
    };

    zone.addEventListener('pointerdown', (event) => {
      if (this.joystickPointerId !== null) return;
      event.preventDefault();

      const geometry = readGeometry();
      const offsetX = event.clientX - geometry.centerX;
      const offsetY = event.clientY - geometry.centerY;
      const drifted = Math.hypot(offsetX, offsetY) > geometry.baseRadius * 0.72;

      if (drifted) {
        base.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
        base.classList.add('is-floating');
        this.joystickHome = { x: event.clientX, y: event.clientY, radius: geometry.radius };
      } else {
        this.joystickHome = { x: geometry.centerX, y: geometry.centerY, radius: geometry.radius };
      }

      this.joystickPointerId = event.pointerId;
      zone.setPointerCapture?.(event.pointerId);
      track(event.clientX, event.clientY);
    });

    zone.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.joystickPointerId) return;
      event.preventDefault();
      track(event.clientX, event.clientY);
    });

    const end = (event) => {
      if (event.pointerId !== this.joystickPointerId) return;
      release();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    window.addEventListener('blur', release);

    // A rotation invalidates the cached ring geometry.
    window.addEventListener('orientationchange', () => {
      release();
      this.scheduleViewportResize();
    });
  }

  /* ---------------------------------------------------------------- *
   * Course lifecycle
   * ---------------------------------------------------------------- */

  loadLevel(index, { announce = true } = {}) {
    const nextIndex = clamp(Math.round(index), 0, LEVELS.length - 1);
    this.levelIndex = nextIndex;
    this.currentLevel = LEVELS[nextIndex];

    this.factory.loadLevel(this.currentLevel);
    this.restartRace();
    this.updateLevelChip();
    this.updateBestTimeDisplay();
    this.saveLastPlayed();

    if (announce) this.showLevelIntro(this.currentLevel);
  }

  restartRace() {
    this.raceTime = 0;
    this.raceCompleted = false;
    this.hudCache = {};
    this.hudAccumulator = HUD_REFRESH_INTERVAL;
    this.frameSamples.length = 0;
    this.particles.clear();
    this.factory.resetAllForModeSwitch();

    const spawn = this.currentLevel?.spawnPoint ?? [0, 2.2, 0];
    this.player.setSpawnPoint(new THREE.Vector3(spawn[0], spawn[1], spawn[2]), null);
    this.player.respawn(false);
    this.player.analogInput.set(0, 0);
    this.dom.morphSlider.value = '0';
    this.syncTouchMorphButtons();
  }

  resetPlayerToCheckpoint(message) {
    this.particles.emitDroplets(this.player.rootGroup.position, this.player.getPalette().hex, 12);
    this.player.respawn(false);
    this.dom.morphSlider.value = '0';
    this.syncTouchMorphButtons();
    if (message) this.showToast(message);
  }

  handleRaceVictory() {
    if (this.raceCompleted) return;
    this.raceCompleted = true;

    const level = this.currentLevel;
    const previousBest = this.bestTimes[level.id];
    const isRecord = !previousBest || this.raceTime < previousBest;
    if (isRecord) {
      this.bestTimes[level.id] = this.raceTime;
      this.saveBestTimes();
    }

    const isFinal = this.levelIndex >= LEVELS.length - 1;
    let unlockedNewCourse = false;
    if (!isFinal && this.progress.unlocked < this.levelIndex + 2) {
      this.progress.unlocked = this.levelIndex + 2;
      this.saveProgress();
      unlockedNewCourse = true;
    }

    this.updateLevelChip();
    this.updateBestTimeDisplay();

    const courseNumber = String(this.levelIndex + 1).padStart(2, '0');
    this.dom.victoryEyebrow.textContent = isFinal
      ? `FINAL COURSE ${courseNumber} CLEARED`
      : `COURSE ${courseNumber} COMPLETE`;
    this.dom.victoryTitle.textContent = level.name;
    this.dom.victorySummary.textContent = isFinal
      ? `All ${LEVELS.length} courses cleared. That is every hazard in the game, beaten.`
      : unlockedNewCourse
        ? `Course ${String(this.levelIndex + 2).padStart(2, '0')} unlocked.`
        : 'You guided the jelly all the way to the finish arch.';
    this.dom.victoryRecord.hidden = !isRecord;
    this.dom.victoryTime.textContent = this.formatTime(this.raceTime);
    this.dom.victoryBest.textContent = this.formatTime(this.bestTimes[level.id]);

    const nextLevel = LEVELS[this.levelIndex + 1];
    this.dom.btnVictoryNext.hidden = !nextLevel;
    if (nextLevel) this.dom.btnVictoryNext.textContent = `Next: ${nextLevel.name}`;

    this.sound.playVictory?.();
    this.dom.victoryModal.hidden = false;
    const focusTarget = nextLevel ? this.dom.btnVictoryNext : this.dom.btnVictoryReplay;
    focusTarget.focus?.();
  }

  hideVictoryModal() {
    this.dom.victoryModal.hidden = true;
  }

  /* ---------------------------------------------------------------- *
   * Progress persistence
   *
   * `jellometry_best_times_v1` is deliberately untouched so personal bests
   * recorded before the campaign existed still count.
   * ---------------------------------------------------------------- */

  loadBestTimes() {
    try {
      const raw = localStorage.getItem(STORAGE_BEST_TIMES_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  saveBestTimes() {
    try {
      localStorage.setItem(STORAGE_BEST_TIMES_KEY, JSON.stringify(this.bestTimes));
    } catch {
      // Private mode: personal bests stay in memory for this session.
    }
  }

  loadProgress() {
    this.unlockAll = /[?&]unlockAll=1/.test(window.location.search);

    try {
      const raw = localStorage.getItem(STORAGE_PROGRESS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Number.isFinite(parsed.unlocked)) {
          return {
            unlocked: clamp(Math.floor(parsed.unlocked), 1, LEVELS.length),
            lastPlayed: typeof parsed.lastPlayed === 'string' ? parsed.lastPlayed : null
          };
        }
      }
    } catch {
      // Fall through to the migration below.
    }

    // One-time migration: a recorded time on course N implies course N + 1 was
    // already reachable, so veteran saves keep their run.
    let unlocked = 1;
    LEVELS.forEach((level, index) => {
      if (this.bestTimes[level.id]) unlocked = Math.max(unlocked, index + 2);
    });
    return { unlocked: clamp(unlocked, 1, LEVELS.length), lastPlayed: null };
  }

  saveProgress() {
    try {
      localStorage.setItem(
        STORAGE_PROGRESS_KEY,
        JSON.stringify({
          version: 1,
          unlocked: this.progress.unlocked,
          lastPlayed: this.progress.lastPlayed
        })
      );
    } catch {
      // Private mode: progression silently resets next session.
    }
  }

  saveLastPlayed() {
    const id = this.currentLevel?.id;
    if (!id || this.progress.lastPlayed === id) return;
    this.progress.lastPlayed = id;
    this.saveProgress();
  }

  unlockedCount() {
    if (this.unlockAll) return LEVELS.length;
    return clamp(this.progress.unlocked, 1, LEVELS.length);
  }

  resolveStartingLevelIndex() {
    const count = this.unlockedCount();
    const lastIndex = LEVELS.findIndex((level) => level.id === this.progress.lastPlayed);
    if (lastIndex >= 0 && lastIndex < count) return lastIndex;
    return clamp(count - 1, 0, LEVELS.length - 1);
  }

  /* ---------------------------------------------------------------- *
   * HUD
   * ---------------------------------------------------------------- */

  updateLevelChip() {
    const level = this.currentLevel;
    if (!level) return;
    this.dom.hudLevelIndex.textContent = String(this.levelIndex + 1).padStart(2, '0');
    this.dom.hudLevelName.textContent = level.name;
  }

  updateBestTimeDisplay() {
    const best = this.bestTimes[this.currentLevel?.id];
    this.dom.hudBest.textContent = best ? this.formatTime(best) : '--:--.--';
  }

  showToast(message) {
    if (!this.dom.toast) return;
    this.dom.toast.textContent = message;
    this.dom.toast.hidden = false;
    window.clearTimeout(this.toastTimeout);
    this.toastTimeout = window.setTimeout(() => {
      this.dom.toast.hidden = true;
    }, 3200);
  }

  showLevelIntro(level) {
    const best = this.bestTimes[level.id];
    this.dom.levelIntroIndex.textContent = `COURSE ${String(this.levelIndex + 1).padStart(2, '0')}`;
    this.dom.levelIntroName.textContent = level.name;
    const stars = '\u2605'.repeat(level.difficulty) + '\u2606'.repeat(5 - level.difficulty);
    this.dom.levelIntroDiff.textContent = stars;
    this.dom.levelIntroDiff.setAttribute('aria-label', `Difficulty ${level.difficulty} of 5`);
    this.dom.levelIntroObjective.textContent = level.objective;
    this.dom.levelIntroRecord.hidden = !best;
    if (best) this.dom.levelIntroRecord.textContent = `YOUR RECORD ${this.formatTime(best)}`;

    this.dom.levelIntro.hidden = false;
    window.clearTimeout(this.introTimeout);
    this.introTimeout = window.setTimeout(() => {
      this.dom.levelIntro.hidden = true;
    }, 5200);
  }

  formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '--:--.--';
    const total = Math.max(0, seconds);
    const minutes = Math.floor(total / 60);
    const secs = Math.floor(total % 60);
    const hundredths = Math.floor((total * 100) % 100);
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(
      hundredths
    ).padStart(2, '0')}`;
  }

  updateHUD(dt) {
    this.hudAccumulator += dt;
    if (this.hudAccumulator < HUD_REFRESH_INTERVAL) return;
    this.hudAccumulator = 0;

    const timeText = this.formatTime(this.raceTime);
    if (this.hudCache.time !== timeText) {
      this.dom.hudTimer.textContent = timeText;
      this.hudCache.time = timeText;
    }

    const speedText = `${this.player.getSpeed().toFixed(1)} m/s`;
    if (this.hudCache.speed !== speedText) {
      this.dom.hudSpeed.textContent = speedText;
      this.hudCache.speed = speedText;
    }

    const dims = this.player.currentDims;
    const volume = dims.x * dims.y * dims.z;
    const dimsText = `${dims.x.toFixed(2)}W x ${dims.y.toFixed(2)}H x ${dims.z.toFixed(
      2
    )}D (${volume.toFixed(2)}m\u00B3)`;
    if (this.hudCache.dims !== dimsText) {
      this.dom.hudMorphDims.textContent = dimsText;
      this.hudCache.dims = dimsText;
    }

    const morphName = this.player.getMorphProfileName();
    if (this.hudCache.morphName !== morphName) {
      this.dom.hudMorphName.textContent = morphName;
      this.hudCache.morphName = morphName;
    }

    const sliderValue = this.player.morphValue;
    if (Math.abs((this.hudCache.slider ?? 99) - sliderValue) > 0.02) {
      this.hudCache.slider = sliderValue;
      this.dom.morphSlider.value = String(sliderValue.toFixed(2));
      this.syncTouchMorphButtons();
    }
  }

  /**
   * Mobile safety valve: once the rolling average frame time blows the budget,
   * drop the pixel ratio (and shadows on desktop) exactly once.
   */
  checkAdaptiveQuality(dt) {
    if (this.qualityDegraded) return;

    this.frameSamples.push(dt * 1000);
    if (this.frameSamples.length < PERF_SAMPLE_SIZE) return;

    const average = this.frameSamples.reduce((sum, value) => sum + value, 0) / this.frameSamples.length;
    this.frameSamples.length = 0;
    if (average <= PERF_BUDGET_MS) return;

    this.qualityDegraded = true;
    this.renderer.setPixelRatio(this.targetPixelRatio());
    this.viewportWidth = null;
    this.applyViewportSize();
    this.renderer.shadowMap.enabled = false;
    if (this.dirLight) this.dirLight.castShadow = false;
    this.showToast('Performance mode on: resolution reduced to keep the frame rate smooth.');
  }

  /* ---------------------------------------------------------------- *
   * Frame loop
   * ---------------------------------------------------------------- */

  updatePlayCamera(dt) {
    const playerPos = this.player.rootGroup.position;
    const speed = this.player.getSpeed();

    // Hor+ compensation keeps the full track width visible on a portrait phone.
    const aspect = this.camera.aspect || 1;
    const portraitRatio = aspect < 1 ? 1 - aspect : 0;
    const portraitFovBoost = portraitRatio * 18;
    const camHeight = 4.4 + portraitRatio * 1.8;
    const camDistZ = 8.6 + portraitRatio * 5.2;

    const targetFov = THREE.MathUtils.clamp(
      58 + portraitFovBoost + Math.max(0, speed - 3) * 1.35,
      58,
      82
    );
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.exp(-6 * dt));
      this.camera.updateProjectionMatrix();
    }

    const desiredPos = new THREE.Vector3(
      playerPos.x * 0.75,
      playerPos.y + camHeight,
      playerPos.z + camDistZ
    );
    this.camera.position.lerp(desiredPos, 1 - Math.exp(-8.5 * dt));

    const desiredLook = new THREE.Vector3(playerPos.x * 0.85, playerPos.y + 0.8, playerPos.z - 5.2);
    this.cameraLookTarget.lerp(desiredLook, 1 - Math.exp(-12 * dt));
    this.camera.lookAt(this.cameraLookTarget);

    this.dirLight.position.set(playerPos.x + 18, playerPos.y + 34, playerPos.z + 22);
    this.dirLight.target.position.copy(playerPos);
    this.dirLight.target.updateMatrixWorld();
  }

  animate() {
    requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const simulating = this.dom.levelModal.hidden && this.dom.victoryModal.hidden;

    if (simulating) {
      if (!this.raceCompleted) this.raceTime += dt;

      this.physicsWorld.step(dt);
      this.player.update(dt, !this.raceCompleted);
      this.factory.updateVisuals(dt, this.player, !this.raceCompleted);

      if (this.player.body.position.y < FALL_LIMIT_Y) {
        this.particles.emitDroplets(this.player.rootGroup.position, this.player.getPalette().hex, 18);
        this.player.respawn(true);
        this.dom.morphSlider.value = '0';
        this.syncTouchMorphButtons();
        this.showToast('Splash! Back to the last checkpoint.');
      }

      this.updateHUD(dt);
      this.checkAdaptiveQuality(dt);
    }

    this.updatePlayCamera(dt);
    this.particles.update(simulating ? dt : 0);
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.jellometryApp = new JellometryGame();
});
