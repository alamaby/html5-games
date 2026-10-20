import * as THREE from 'three';
import { SoundManager } from './audio/SoundManager.js';
import { ProceduralTextures } from './core/ProceduralTextures.js';
import { PhysicsWorld } from './core/PhysicsWorld.js';
import { ParticleSystem } from './core/ParticleSystem.js';
import { JellyPlayer, JELLY_PALETTES } from './entities/JellyPlayer.js';
import { ObstacleFactory } from './entities/ObstacleFactory.js';
import { LEVELS } from './entities/PresetLevels.js';
import { generateCourse } from './core/LevelGenerator.js';
import {
  normalizeOptions,
  decodeOptions,
  encodeOptions,
  randomSeedName,
  isDifficultyReachable,
  difficultyFor,
  lengthFor,
  DIFFICULTIES,
  LENGTHS,
  CHECKPOINTS,
  HAZARDS,
  PALETTES
} from './core/CourseOptions.js';

const STORAGE_BEST_TIMES_KEY = 'jellometry_best_times_v1';
const STORAGE_PROGRESS_KEY = 'jellometry_progress_v1';
const STORAGE_RANDOM_BESTS_KEY = 'jellometry_random_bests_v1';
const RANDOM_BEST_LIMIT = 50;

/** Query params that describe a random course, removed when a campaign run loads. */
const COURSE_URL_PARAMS = ['course', 'diff', 'len', 'haz', 'cp', 'pal'];

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
    this.randomBests = this.loadRandomBests();
    this.progress = this.loadProgress();

    this.initialRandomOptions = decodeOptions(window.location.search);
    this.currentCourse = null;
    this.randomOptions = null;
    this.randomPreviewTimer = null;
    this.activeTab = 'campaign';

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
    this.loadStartingCourse();

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  /** The level currently loaded, whichever mode produced it. */
  get currentLevel() {
    return this.currentCourse?.level ?? null;
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
      btnVictoryNewSeed: $('btn-victory-newseed'),
      btnVictoryReplay: $('btn-victory-replay'),
      btnVictoryLevels: $('btn-victory-levels'),
      tabCampaign: $('tab-campaign'),
      tabRandom: $('tab-random'),
      panelCampaign: $('panel-campaign'),
      panelRandom: $('panel-random'),
      randomSeed: $('random-seed'),
      btnRandomDice: $('btn-random-dice'),
      randomMetrics: $('random-metrics'),
      randomDifficulty: $('random-difficulty'),
      randomLength: $('random-length'),
      randomCheckpoints: $('random-checkpoints'),
      randomPalette: $('random-palette'),
      randomHazards: $('random-hazards'),
      btnRandomPlay: $('btn-random-play'),
      btnRandomCopy: $('btn-random-copy'),
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
    this.bindRandomPanel();
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
      if (this.currentCourse?.kind !== 'campaign') return;
      const next = this.currentCourse.index + 1;
      this.hideVictoryModal();
      if (next < LEVELS.length) this.loadCampaignLevel(next);
    });
    this.dom.btnVictoryReplay.addEventListener('click', () => {
      const course = this.currentCourse;
      if (!course) return;
      this.hideVictoryModal();
      if (course.kind === 'random') this.loadRandomCourse(course.options, { announce: false });
      else this.loadCampaignLevel(course.index, { announce: false });
    });
    this.dom.btnVictoryNewSeed.addEventListener('click', () => {
      const options = normalizeOptions({ ...(this.currentCourse?.options ?? {}), seed: randomSeedName() });
      this.hideVictoryModal();
      this.loadRandomCourse(options);
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
    if (this.activeTab === 'random') this.updateRandomPreview();
    const target =
      this.activeTab === 'random'
        ? this.dom.tabRandom
        : this.dom.levelGrid.querySelector('.level-card.is-current:not(:disabled)');
    target?.focus();
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
      if (this.currentCourse?.kind === 'campaign' && index === this.currentCourse.index) {
        card.classList.add('is-current');
      }
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
        this.loadCampaignLevel(index);
      });
      grid.appendChild(card);
    });
  }

  /* --- random course panel ----------------------------------------- */

  buildSegmented(container, items, { selected, isUnavailable, onSelect, multi = false }) {
    container.innerHTML = '';
    const buttons = [];

    const refresh = () => {
      buttons.forEach((button, index) => {
        const active = multi ? selected(index) : index === selected();
        if (multi) button.setAttribute('aria-pressed', String(active));
        else {
          button.setAttribute('aria-checked', String(active));
          button.tabIndex = active ? 0 : -1;
        }
        button.classList.toggle('is-unavailable', Boolean(isUnavailable?.(index)));
      });
    };

    items.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.label;
      if (!multi) button.setAttribute('role', 'radio');

      button.addEventListener('click', () => {
        onSelect(index);
        refresh();
      });

      if (!multi) {
        // Roving tabindex: arrows move the selection, matching a native radio group.
        button.addEventListener('keydown', (event) => {
          const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
          if (!step) return;
          const next = (selected() + step + items.length) % items.length;
          onSelect(next);
          refresh();
          buttons[next]?.focus();
          event.preventDefault();
        });
      }

      buttons.push(button);
      container.appendChild(button);
    });

    refresh();
    return { buttons, refresh };
  }

  bindRandomPanel() {
    this.randomTabs = { campaign: this.dom.tabCampaign, random: this.dom.tabRandom };
    this.randomPanels = { campaign: this.dom.panelCampaign, random: this.dom.panelRandom };

    for (const [name, tab] of Object.entries(this.randomTabs)) {
      tab.addEventListener('click', () => this.selectCourseTab(name));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
        const names = Object.keys(this.randomTabs);
        const index = names.indexOf(name);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? names.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + names.length) % names.length;
        this.selectCourseTab(names[next], { focusTab: true });
        event.preventDefault();
      });
    }

    this.randomOptions = this.initialRandomOptions ?? normalizeOptions({ seed: randomSeedName() });

    this.dom.randomSeed.value = this.randomOptions.seed;
    this.dom.randomSeed.addEventListener('input', () => {
      const typed = this.dom.randomSeed.value;
      this.randomOptions = normalizeOptions({ ...this.randomOptions, seed: typed });
      this.scheduleRandomPreview(this.dom.randomSeed.value.trim() ? null : 'Type a seed to generate a course.');
    });
    this.dom.randomSeed.addEventListener('blur', () => {
      // Snap the field back to the canonical seed (trimmed, length-capped) so the
      // text always matches the course that will actually be generated.
      const wasEmpty = !this.dom.randomSeed.value.trim();
      this.randomOptions = normalizeOptions(this.randomOptions);
      this.dom.randomSeed.value = this.randomOptions.seed;
      // An empty field leaves the preview showing its error and Play disabled.
      // Once the canonical seed is back in the box, that course has to appear.
      if (wasEmpty) this.scheduleRandomPreview();
    });

    this.dom.btnRandomDice.addEventListener('click', () => {
      this.randomOptions = normalizeOptions({ ...this.randomOptions, seed: randomSeedName() });
      this.dom.randomSeed.value = this.randomOptions.seed;
      this.scheduleRandomPreview();
    });

    this.randomDifficultyControl = this.buildSegmented(this.dom.randomDifficulty, DIFFICULTIES, {
      selected: () => this.randomOptions.difficulty,
      isUnavailable: (index) =>
        !isDifficultyReachable(index, {
          ...this.randomOptions,
          difficulty: index
        }),
      onSelect: (index) => {
        this.randomOptions = normalizeOptions({ ...this.randomOptions, difficulty: index });
        this.scheduleRandomPreview();
      }
    });

    this.randomLengthControl = this.buildSegmented(this.dom.randomLength, LENGTHS, {
      selected: () => this.randomOptions.length,
      onSelect: (index) => {
        this.randomOptions = normalizeOptions({ ...this.randomOptions, length: index });
        this.scheduleRandomPreview();
      }
    });

    this.randomCheckpointControl = this.buildSegmented(this.dom.randomCheckpoints, CHECKPOINTS, {
      selected: () => this.randomOptions.checkpoints,
      onSelect: (index) => {
        this.randomOptions = normalizeOptions({ ...this.randomOptions, checkpoints: index });
        this.scheduleRandomPreview();
      }
    });

    this.randomPaletteControl = this.buildSegmented(this.dom.randomPalette, PALETTES, {
      selected: () => this.randomOptions.palette,
      onSelect: (index) => {
        this.randomOptions = normalizeOptions({ ...this.randomOptions, palette: index });
        this.scheduleRandomPreview();
      }
    });

    this.randomHazardControl = this.buildSegmented(this.dom.randomHazards, HAZARDS, {
      multi: true,
      selected: (index) => Boolean(this.randomOptions.hazards[HAZARDS[index].key]),
      onSelect: (index) => {
        const key = HAZARDS[index].key;
        this.randomOptions = normalizeOptions({
          ...this.randomOptions,
          hazards: { ...this.randomOptions.hazards, [key]: !this.randomOptions.hazards[key] }
        });
        this.randomDifficultyControl.refresh();
        this.scheduleRandomPreview();
      }
    });

    this.dom.btnRandomPlay.addEventListener('click', () => this.playRandomCourse());
    this.dom.btnRandomCopy.addEventListener('click', () => this.copyRandomLink());

    this.selectCourseTab('campaign');
    this.updateRandomPreview();
  }

  selectCourseTab(name, { focusTab = false, preview = true } = {}) {
    this.activeTab = name;
    for (const [key, tab] of Object.entries(this.randomTabs)) {
      const active = key === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    for (const [key, panel] of Object.entries(this.randomPanels)) {
      panel.hidden = key !== name;
    }
    if (name === 'campaign') this.renderLevelGrid();
    // Regenerating here would duplicate the work `syncRandomPanel` just did on
    // load, and a worst-case attempt loop is long enough to be a visible hitch.
    else if (preview) this.updateRandomPreview();
    if (focusTab) this.randomTabs[name]?.focus();
  }

  scheduleRandomPreview(message = null) {
    window.clearTimeout(this.randomPreviewTimer);
    if (message) {
      this.dom.btnRandomPlay.disabled = true;
      this.dom.randomMetrics.className = 'random-metrics is-error';
      this.dom.randomMetrics.textContent = message;
      return;
    }
    this.randomPreviewTimer = window.setTimeout(() => this.updateRandomPreview(), 120);
  }

  updateRandomPreview() {
    const options = normalizeOptions(this.randomOptions);
    const difficulty = difficultyFor(options);
    const length = lengthFor(options);
    const reachable = isDifficultyReachable(options.difficulty, options);
    const result = generateCourse(options);

    if (!result) {
      this.dom.btnRandomPlay.disabled = true;
      this.dom.randomMetrics.className = 'random-metrics is-error';
      this.dom.randomMetrics.textContent =
        'No valid course for these settings. Try another seed or lower the difficulty.';
      return;
    }

    this.dom.btnRandomPlay.disabled = false;

    const m = result.metrics;
    const density = m.threat / Math.max(1, m.length);
    const summary = [
      `${m.length} m`,
      difficulty.label,
      length.label,
      `${m.checkpoints} checkpoint${m.checkpoints === 1 ? '' : 's'}`,
      `${m.sweepers} sweeper${m.sweepers === 1 ? '' : 's'}`,
      `${m.gates} gate${m.gates === 1 ? '' : 's'}`,
      `${m.platforms} bridge${m.platforms === 1 ? '' : 's'}`,
      `threat ${density.toFixed(3)}/m`
    ].join(' \u00B7 ');

    let note = '';
    if (!reachable) {
      note = ` These hazards top out below ${difficulty.label}, so the course lands easier than requested.`;
    } else if (!result.inBand) {
      note = ` Closest match to ${difficulty.label} (${difficulty.density[0]}\u2013${difficulty.density[1]}/m).`;
    }

    this.dom.randomMetrics.className = `random-metrics${note ? ' is-warning' : ''}`;
    this.dom.randomMetrics.textContent = `${summary}.${note}`;

    this.randomDifficultyControl.refresh();
  }

  playRandomCourse() {
    const options = normalizeOptions(this.randomOptions);
    if (!this.loadRandomCourse(options)) return;
    this.closeLevelModal();
  }

  copyRandomLink() {
    const url = new URL(window.location.href);
    // Replace the whole query: a share link should carry the six course params
    // and nothing else, so it cannot smuggle the sender's `unlockAll=1` into
    // someone else's session.
    url.search = encodeOptions(normalizeOptions(this.randomOptions));
    const link = url.toString();
    const onCopied = () => {
      this.dom.btnRandomCopy.textContent = 'Copied';
      window.setTimeout(() => {
        this.dom.btnRandomCopy.textContent = 'Copy Link';
      }, 1600);
    };
    const onFailed = () => {
      this.dom.btnRandomCopy.textContent = 'Copy failed';
      window.setTimeout(() => {
        this.dom.btnRandomCopy.textContent = 'Copy Link';
      }, 1600);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(onCopied, onFailed);
    } else {
      onFailed();
    }
  }

  syncRandomPanel() {
    if (!this.randomOptions) return;
    this.randomOptions = normalizeOptions(this.randomOptions);
    this.dom.randomSeed.value = this.randomOptions.seed;
    this.randomDifficultyControl?.refresh();
    this.randomLengthControl?.refresh();
    this.randomCheckpointControl?.refresh();
    this.randomPaletteControl?.refresh();
    this.randomHazardControl?.refresh();
    this.updateRandomPreview();
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
      // Escape is handled before the typing guard: a seed field must not trap
      // the player inside the dialog.
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

      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (event.code === 'KeyL') {
        // The victory dialog owns the screen. Opening Course Select behind it
        // would move focus into a panel the player cannot see.
        if (!this.dom.victoryModal.hidden) return;
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
          // A focused button already activates on Enter; only synthesize a
          // click when focus sits outside the dialog.
          const active = document.activeElement;
          if (active && active.tagName === 'BUTTON' && this.dom.victoryModal.contains(active)) {
            return;
          }
          if (!this.dom.btnVictoryNext.hidden) this.dom.btnVictoryNext.click();
          else if (!this.dom.btnVictoryNewSeed.hidden) this.dom.btnVictoryNewSeed.click();
          else this.dom.btnVictoryReplay.click();
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

  loadStartingCourse() {
    if (this.initialRandomOptions) {
      if (this.loadRandomCourse(this.initialRandomOptions, { announce: false })) return;
      // A link that cannot be generated falls back to the campaign rather than
      // leaving the player on an empty track.
      this.showToast('That course link could not be generated. Loading the campaign.');
    }
    this.loadCampaignLevel(this.resolveStartingLevelIndex(), { announce: false });
  }

  loadCampaignLevel(index, { announce = true } = {}) {
    const nextIndex = clamp(Math.round(index), 0, LEVELS.length - 1);
    this.currentCourse = {
      kind: 'campaign',
      index: nextIndex,
      id: LEVELS[nextIndex].id,
      level: LEVELS[nextIndex]
    };
    this.applyCourse({ announce });
  }

  loadRandomCourse(rawOptions, { announce = true } = {}) {
    const options = normalizeOptions(rawOptions);
    const generated = generateCourse(options);
    if (!generated) {
      this.showToast('Could not build that course. Try a different seed.');
      return false;
    }

    this.currentCourse = {
      kind: 'random',
      id: generated.id,
      level: generated.level,
      options,
      metrics: generated.metrics,
      inBand: generated.inBand,
      reachable: generated.reachable
    };
    // Keep the form showing the course that is actually loaded, so reopening
    // Course Select never lies about what the player is racing.
    this.randomOptions = options;
    this.syncRandomPanel();
    this.applyCourse({ announce });
    return true;
  }

  applyCourse({ announce = true } = {}) {
    const course = this.currentCourse;
    if (!course) return;
    this.factory.loadLevel(course.level);
    this.restartRace();
    this.updateLevelChip();
    this.updateBestTimeDisplay();
    if (course.kind === 'campaign') this.saveLastPlayed();
    // Course Select should open on the tab matching the run in progress.
    if (course.kind === 'random' && this.activeTab !== 'random') {
      this.selectCourseTab('random', { preview: false });
    }
    this.syncCourseParamsToUrl(course);
    if (announce) this.showLevelIntro(course.level);
  }

  /**
   * Keep the address bar in step with the loaded course.
   *
   * Without this, opening a shared `?course=` link and then picking a campaign
   * level leaves the stale params in the URL, so a refresh would silently drop
   * the player back into the old random course. `replaceState` (not `pushState`)
   * keeps the back button out of it, and unrelated params such as `unlockAll`
   * are preserved.
   */
  syncCourseParamsToUrl(course) {
    try {
      const url = new URL(window.location.href);
      if (course.kind === 'random') {
        const params = new URLSearchParams(encodeOptions(course.options));
        for (const [key, value] of params) url.searchParams.set(key, value);
      } else {
        const hadCourse = url.searchParams.has('course');
        if (!hadCourse) return;
        for (const key of COURSE_URL_PARAMS) url.searchParams.delete(key);
      }

      const next = `${url.pathname}${url.search}${url.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (next !== current) window.history.replaceState(null, '', next);
    } catch {
      // No History API (or a sandboxed frame): the link simply stays as it is.
    }
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

    if (this.currentCourse?.kind === 'random') {
      this.handleRandomVictory(this.currentCourse);
      return;
    }

    const level = this.currentLevel;
    const course = this.currentCourse;
    const previousBest = this.bestTimes[level.id];
    const isRecord = !previousBest || this.raceTime < previousBest;
    if (isRecord) {
      this.bestTimes[level.id] = this.raceTime;
      this.saveBestTimes();
    }

    const isFinal = course.index >= LEVELS.length - 1;
    let unlockedNewCourse = false;
    if (!isFinal && this.progress.unlocked < course.index + 2) {
      this.progress.unlocked = course.index + 2;
      this.saveProgress();
      unlockedNewCourse = true;
    }

    this.updateLevelChip();
    this.updateBestTimeDisplay();

    const courseNumber = String(course.index + 1).padStart(2, '0');
    this.dom.victoryEyebrow.textContent = isFinal
      ? `FINAL COURSE ${courseNumber} CLEARED`
      : `COURSE ${courseNumber} COMPLETE`;
    this.dom.victoryTitle.textContent = level.name;
    this.dom.victorySummary.textContent = isFinal
      ? `All ${LEVELS.length} courses cleared. That is every hazard in the game, beaten.`
      : unlockedNewCourse
        ? `Course ${String(course.index + 2).padStart(2, '0')} unlocked.`
        : 'You guided the jelly all the way to the finish arch.';
    this.dom.victoryRecord.hidden = !isRecord;
    this.dom.victoryRecord.textContent = 'NEW COURSE RECORD';
    this.dom.victoryTime.textContent = this.formatTime(this.raceTime);
    this.dom.victoryBest.textContent = this.formatTime(this.bestTimes[level.id]);

    const nextLevel = LEVELS[course.index + 1];
    this.dom.btnVictoryNext.hidden = !nextLevel;
    this.dom.btnVictoryNewSeed.hidden = true;
    this.dom.btnVictoryReplay.textContent = 'Race Again';
    if (nextLevel) this.dom.btnVictoryNext.textContent = `Next: ${nextLevel.name}`;

    this.sound.playVictory?.();
    this.dom.victoryModal.hidden = false;
    const focusTarget = nextLevel ? this.dom.btnVictoryNext : this.dom.btnVictoryReplay;
    focusTarget.focus?.();
  }

  handleRandomVictory(course) {
    const { isRecord, best } = this.recordRandomBest(course);
    this.updateLevelChip();
    this.updateBestTimeDisplay();

    const metrics = course.metrics;
    const density = metrics ? metrics.threat / Math.max(1, metrics.length) : 0;

    this.dom.victoryEyebrow.textContent = 'RANDOM COURSE CLEARED';
    this.dom.victoryTitle.textContent = course.level.name;
    this.dom.victorySummary.textContent =
      `${lengthFor(course.options).label} \u00B7 ${difficultyFor(course.options).label} \u00B7 ` +
      `${metrics?.length ?? 0} m \u00B7 threat ${density.toFixed(3)}/m. ` +
      'Random courses never advance the campaign.';
    this.dom.victoryRecord.hidden = !isRecord;
    this.dom.victoryRecord.textContent = 'NEW RANDOM RECORD';
    this.dom.victoryTime.textContent = this.formatTime(this.raceTime);
    this.dom.victoryBest.textContent = this.formatTime(best);

    this.dom.btnVictoryNext.hidden = true;
    this.dom.btnVictoryNewSeed.hidden = false;
    this.dom.btnVictoryReplay.textContent = 'Race Again';

    this.sound.playVictory?.();
    this.dom.victoryModal.hidden = false;
    this.dom.btnVictoryNewSeed.focus?.();
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

  /**
   * Random-course bests live under their own key so `jellometry_best_times_v1`
   * keeps meaning "campaign", and so a generated course disappearing from the
   * campaign list can never look like a deleted record.
   */
  loadRandomBests() {
    try {
      const raw = localStorage.getItem(STORAGE_RANDOM_BESTS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const valid = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (!value || !Number.isFinite(value.time)) continue;
        valid[key] = value;
      }
      return valid;
    } catch {
      return {};
    }
  }

  saveRandomBests() {
    try {
      // Least-recently-recorded entries fall off first, so the key cannot grow
      // without bound on a phone that never clears storage.
      const entries = Object.entries(this.randomBests).sort(
        (a, b) => (b[1].at ?? 0) - (a[1].at ?? 0)
      );
      if (entries.length > RANDOM_BEST_LIMIT) {
        this.randomBests = Object.fromEntries(entries.slice(0, RANDOM_BEST_LIMIT));
      }
      localStorage.setItem(STORAGE_RANDOM_BESTS_KEY, JSON.stringify(this.randomBests));
    } catch {
      // Private mode: random bests stay in memory for this session.
    }
  }

  recordRandomBest(course) {
    const existing = this.randomBests[course.id];
    const isRecord = !existing || this.raceTime < existing.time;
    if (isRecord) {
      this.randomBests[course.id] = {
        time: this.raceTime,
        name: course.level.name,
        options: course.options,
        at: Date.now()
      };
      this.saveRandomBests();
    }
    return { isRecord, best: this.randomBests[course.id]?.time };
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
    const course = this.currentCourse;
    if (!course) return;
    this.dom.hudLevelIndex.textContent =
      course.kind === 'random' ? 'RND' : String(course.index + 1).padStart(2, '0');
    this.dom.hudLevelName.textContent = course.level.name;
  }

  updateBestTimeDisplay() {
    const course = this.currentCourse;
    const best = !course
      ? undefined
      : course.kind === 'random'
        ? this.randomBests[course.id]?.time
        : this.bestTimes[course.level.id];
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
    const course = this.currentCourse;
    const isRandom = course?.kind === 'random';
    const best = isRandom ? this.randomBests[course.id]?.time : this.bestTimes[level.id];

    this.dom.levelIntroIndex.textContent = isRandom
      ? `RANDOM \u00B7 ${difficultyFor(course.options).label.toUpperCase()}`
      : `COURSE ${String(course.index + 1).padStart(2, '0')}`;
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
