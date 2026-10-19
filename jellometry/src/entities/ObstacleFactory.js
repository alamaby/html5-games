import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ProceduralTextures } from '../core/ProceduralTextures.js';

let nextObstacleCounter = 1;

export const OBSTACLE_CATALOG = [
  {
    type: 'track_block',
    label: 'Track / Ramp',
    shortDesc: 'Modular floor & sloped ramp',
    defaultColor: '#e2e8f0',
    defaultParams: {
      width: 6,
      length: 10,
      height: 0.8,
      slopeAngle: 0,
      color: '#e2e8f0'
    }
  },
  {
    type: 'spinning_sweeper',
    label: 'Sweeper Bar',
    shortDesc: 'Rotating knockback cylinder',
    defaultColor: '#ff4d6d',
    defaultParams: {
      armLength: 5.4,
      speed: 2.4,
      barHeight: 0.9,
      color: '#ff4d6d'
    }
  },
  {
    type: 'moving_platform',
    label: 'Moving Platform',
    shortDesc: 'Oscillating waypoint bridge',
    defaultColor: '#3a86ff',
    defaultParams: {
      width: 4.5,
      length: 5.5,
      axis: 'x',
      distance: 4.5,
      speed: 1.6,
      color: '#3a86ff'
    }
  },
  {
    type: 'bouncy_pad',
    label: 'Slime Bounce',
    shortDesc: 'High-restitution launch pad',
    defaultColor: '#2ec4b6',
    defaultParams: {
      width: 3.4,
      length: 3.4,
      bounceForce: 19.5,
      color: '#2ec4b6'
    }
  },
  {
    type: 'shape_gate',
    label: 'Shape Gate',
    shortDesc: 'Morph cutout barrier wall',
    defaultColor: '#ff9f1c',
    defaultParams: {
      cutoutShape: 'flat_wide',
      wallWidth: 6.0,
      wallHeight: 3.4,
      color: '#ff9f1c'
    }
  },
  {
    type: 'checkpoint_finish',
    label: 'Checkpoint / Goal',
    shortDesc: 'Respawn pad or Finish Arch',
    defaultColor: '#2ec4b6',
    defaultParams: {
      variant: 'checkpoint',
      width: 5.5,
      color: '#2ec4b6'
    }
  }
];

export class ObstacleFactory {
  constructor(scene, physicsWorld, soundManager, particleSystem = null) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.sound = soundManager;
    this.particles = particleSystem;
    this.obstacles = new Map();
    this.onCheckpointActivated = null;
    this.onFinishReached = null;
  }

  createGateSignTexture(cutoutShape, accentColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#141821';
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 248, 88);

    ctx.fillStyle = '#f4f6fa';
    ctx.font = 'bold 24px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (cutoutShape === 'flat_wide') {
      ctx.fillText('FLAT MORPH [Q]', 128, 34);
      ctx.fillStyle = accentColor;
      ctx.fillRect(68, 56, 120, 18);
    } else {
      ctx.fillText('TALL MORPH [E]', 128, 34);
      ctx.fillStyle = accentColor;
      ctx.fillRect(114, 48, 28, 36);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  createObstacle(data) {
    const catalogEntry = OBSTACLE_CATALOG.find((c) => c.type === data.type) || OBSTACLE_CATALOG[0];
    const id = data.id || `obs_${nextObstacleCounter++}`;
    const numMatch = /^obs_(\d+)$/.exec(id);
    if (numMatch) {
      nextObstacleCounter = Math.max(nextObstacleCounter, Number(numMatch[1]) + 1);
    }

    const params = { ...catalogEntry.defaultParams, ...(data.params || {}) };
    const position = Array.isArray(data.position) ? data.position : [0, 0, 0];
    const rotation = Array.isArray(data.rotation) ? data.rotation : [0, 0, 0];
    const scale = Array.isArray(data.scale) ? data.scale : [1, 1, 1];

    const group = new THREE.Group();
    group.name = `${data.type}_${id}`;
    group.position.set(position[0], position[1], position[2]);
    group.rotation.set(
      THREE.MathUtils.degToRad(rotation[0]),
      THREE.MathUtils.degToRad(rotation[1]),
      THREE.MathUtils.degToRad(rotation[2])
    );
    group.scale.set(scale[0], scale[1], scale[2]);

    const obstacle = {
      id,
      type: catalogEntry.type,
      params,
      group,
      bodies: [],
      kinematicUpdate: null,
      visualUpdate: null,
      elapsed: 0,
      activated: false,
      bouncePulse: 0,
      currentFade: 1.0,
      initialPosition: group.position.clone(),
      initialQuaternion: group.quaternion.clone(),
      initialScale: group.scale.clone()
    };

    this.buildObstacleInternals(obstacle);
    this.tagMeshHierarchy(obstacle.group, obstacle.id);
    this.scene.add(obstacle.group);
    this.obstacles.set(obstacle.id, obstacle);
    return obstacle;
  }

  tagMeshHierarchy(root, obstacleId) {
    root.userData.obstacleId = obstacleId;
    root.traverse((child) => {
      child.userData.obstacleId = obstacleId;
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) {
          if (mat && mat.userData.baseOpacity === undefined) {
            mat.userData.baseOpacity = mat.opacity ?? 1.0;
            mat.userData.baseTransparent = Boolean(mat.transparent);
          }
        }
      }
    });
  }

  buildObstacleInternals(obstacle) {
    const { type, params } = obstacle;
    switch (type) {
      case 'track_block':
        this.buildTrackBlock(obstacle, params);
        break;
      case 'spinning_sweeper':
        this.buildSpinningSweeper(obstacle, params);
        break;
      case 'moving_platform':
        this.buildMovingPlatform(obstacle, params);
        break;
      case 'bouncy_pad':
        this.buildBouncyPad(obstacle, params);
        break;
      case 'shape_gate':
        this.buildShapeGate(obstacle, params);
        break;
      case 'checkpoint_finish':
        this.buildCheckpointFinish(obstacle, params);
        break;
      default:
        this.buildTrackBlock(obstacle, params);
        break;
    }
    this.syncBodiesToGroup(obstacle);
  }

  buildTrackBlock(obstacle, params) {
    const width = Math.max(1.5, Number(params.width) || 6);
    const length = Math.max(2, Number(params.length) || 10);
    const height = Math.max(0.3, Number(params.height) || 0.8);
    const slopeRad = THREE.MathUtils.degToRad(Number(params.slopeAngle) || 0);
    const baseColor = params.color || '#e2e8f0';

    const secondaryColor = new THREE.Color(baseColor).multiplyScalar(0.9).getStyle();
    const tex = ProceduralTextures.getTrackTexture(baseColor, secondaryColor).clone();
    tex.repeat.set(Math.max(1, width / 3), Math.max(1, length / 3));
    tex.needsUpdate = true;

    const innerTilt = new THREE.Group();
    innerTilt.rotation.x = slopeRad;
    obstacle.group.add(innerTilt);
    obstacle.innerTilt = innerTilt;

    const deckGeom = new THREE.BoxGeometry(width, height, length);
    const deckMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.45,
      metalness: 0.05
    });
    const deckMesh = new THREE.Mesh(deckGeom, deckMat);
    innerTilt.add(deckMesh);

    // Subtle colored side trim rails help players judge edge alignment during jumps.
    const railGeom = new THREE.BoxGeometry(0.18, height + 0.16, length);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x1e2432,
      roughness: 0.35
    });
    const leftRail = new THREE.Mesh(railGeom, railMat);
    leftRail.position.set(-width * 0.5 + 0.09, 0.06, 0);
    const rightRail = new THREE.Mesh(railGeom, railMat);
    rightRail.position.set(width * 0.5 - 0.09, 0.06, 0);
    innerTilt.add(leftRail, rightRail);

    const sx = obstacle.group.scale.x;
    const sy = obstacle.group.scale.y;
    const sz = obstacle.group.scale.z;

    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: this.physicsWorld.materials.track
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3((width * sx) / 2, (height * sy) / 2, (length * sz) / 2)));
    body.userData = { obstacleId: obstacle.id, obstacleType: obstacle.type };
    this.physicsWorld.addBody(body);
    obstacle.bodies.push(body);
  }

  buildSpinningSweeper(obstacle, params) {
    const armLength = Math.max(2.5, Number(params.armLength) || 5.4);
    const speed = Number(params.speed) ?? 2.4;
    const barHeight = Math.max(0.4, Number(params.barHeight) || 0.9);
    const color = params.color || '#ff4d6d';

    // Central hub. A duck-under bar sits at ~1.05 m, where the fat pedestal
    // used by standing bars would be a knee-height block the player visibly
    // walks through. Low bars get a base plate plus a thin spindle instead.
    const isDuckBar = barHeight <= 1.4;
    if (isDuckBar) {
      const plateGeom = new THREE.CylinderGeometry(0.7, 0.78, 0.12, 20);
      const plateMat = new THREE.MeshStandardMaterial({ color: 0x1e2432, roughness: 0.3 });
      const plateMesh = new THREE.Mesh(plateGeom, plateMat);
      plateMesh.position.y = 0.06;
      obstacle.group.add(plateMesh);

      const spindleGeom = new THREE.CylinderGeometry(0.1, 0.1, barHeight, 14);
      const spindleMesh = new THREE.Mesh(spindleGeom, plateMat);
      spindleMesh.position.y = barHeight * 0.5;
      obstacle.group.add(spindleMesh);

      const collarGeom = new THREE.CylinderGeometry(0.22, 0.22, 0.18, 16);
      const collarMesh = new THREE.Mesh(collarGeom, plateMat);
      collarMesh.position.y = barHeight;
      obstacle.group.add(collarMesh);
    } else {
      const hubGeom = new THREE.CylinderGeometry(0.55, 0.68, barHeight + 0.7, 20);
      const hubMat = new THREE.MeshStandardMaterial({ color: 0x1e2432, roughness: 0.3 });
      const hubMesh = new THREE.Mesh(hubGeom, hubMat);
      hubMesh.position.y = (barHeight + 0.7) * 0.5;
      obstacle.group.add(hubMesh);
    }

    // Rotating pivot holding the knockback cylinder bar.
    const rotorGroup = new THREE.Group();
    rotorGroup.position.y = barHeight;
    obstacle.group.add(rotorGroup);
    obstacle.rotorGroup = rotorGroup;

    const barRadius = 0.28;
    const barGeom = new THREE.CylinderGeometry(barRadius, barRadius, armLength, 18);
    barGeom.rotateZ(Math.PI / 2);
    const stripeTex = ProceduralTextures.getHazardStripeTexture(color, '#141821');
    const barMat = new THREE.MeshStandardMaterial({
      map: stripeTex,
      roughness: 0.25,
      metalness: 0.1
    });
    const barMesh = new THREE.Mesh(barGeom, barMat);
    rotorGroup.add(barMesh);

    const capGeom = new THREE.SphereGeometry(barRadius * 1.15, 14, 14);
    const capMat = new THREE.MeshStandardMaterial({ color, roughness: 0.2 });
    const leftCap = new THREE.Mesh(capGeom, capMat);
    leftCap.position.x = -armLength * 0.5;
    const rightCap = new THREE.Mesh(capGeom, capMat);
    rightCap.position.x = armLength * 0.5;
    rotorGroup.add(leftCap, rightCap);

    const sx = obstacle.group.scale.x;
    const sy = obstacle.group.scale.y;
    const sz = obstacle.group.scale.z;

    const barBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      material: this.physicsWorld.materials.sweeper
    });
    barBody.addShape(
      new CANNON.Box(new CANNON.Vec3((armLength * sx) * 0.5, barRadius * sy, barRadius * sz))
    );
    barBody.userData = { obstacleId: obstacle.id, obstacleType: obstacle.type };
    this.physicsWorld.addBody(barBody);
    obstacle.bodies.push(barBody);

    // Update kinematic orientation and angularVelocity so colliding transfers knockback momentum.
    obstacle.kinematicUpdate = (dt) => {
      obstacle.elapsed += dt;
      const angle = obstacle.elapsed * speed;
      rotorGroup.rotation.y = angle;

      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      rotorGroup.getWorldPosition(worldPos);
      rotorGroup.getWorldQuaternion(worldQuat);

      barBody.position.set(worldPos.x, worldPos.y, worldPos.z);
      barBody.quaternion.set(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);
      barBody.angularVelocity.set(0, speed, 0);
    };
  }

  buildMovingPlatform(obstacle, params) {
    const width = Math.max(2, Number(params.width) || 4.5);
    const length = Math.max(2, Number(params.length) || 5.5);
    const height = 0.65;
    const axis = ['x', 'y', 'z'].includes(params.axis) ? params.axis : 'x';
    const distance = Number(params.distance) ?? 4.5;
    const speed = Number(params.speed) ?? 1.6;
    const color = params.color || '#3a86ff';

    const moverGroup = new THREE.Group();
    obstacle.group.add(moverGroup);
    obstacle.moverGroup = moverGroup;

    const tex = ProceduralTextures.getTrackTexture(color, '#1e2432').clone();
    tex.repeat.set(Math.max(1, width / 2.5), Math.max(1, length / 2.5));
    tex.needsUpdate = true;

    const geom = new THREE.BoxGeometry(width, height, length);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.35,
      metalness: 0.1
    });
    const mesh = new THREE.Mesh(geom, mat);
    moverGroup.add(mesh);

    // Waypoint guide line visible in editor and play mode so the trajectory is readable.
    const guidePoints = [new THREE.Vector3(), new THREE.Vector3()];
    guidePoints[0][axis] = -distance;
    guidePoints[1][axis] = distance;
    const guideGeom = new THREE.BufferGeometry().setFromPoints(guidePoints);
    const guideMat = new THREE.LineBasicMaterial({ color: 0x3a86ff, transparent: true, opacity: 0.45 });
    const guideLine = new THREE.Line(guideGeom, guideMat);
    obstacle.group.add(guideLine);

    const sx = obstacle.group.scale.x;
    const sy = obstacle.group.scale.y;
    const sz = obstacle.group.scale.z;

    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      material: this.physicsWorld.materials.track
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3((width * sx) * 0.5, (height * sy) * 0.5, (length * sz) * 0.5)));
    body.userData = { obstacleId: obstacle.id, obstacleType: obstacle.type };
    this.physicsWorld.addBody(body);
    obstacle.bodies.push(body);

    const prevWorldPos = new THREE.Vector3();
    const currWorldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();

    obstacle.kinematicUpdate = (dt) => {
      moverGroup.getWorldPosition(prevWorldPos);
      obstacle.elapsed += dt;

      const offset = Math.sin(obstacle.elapsed * speed) * distance;
      moverGroup.position.set(
        axis === 'x' ? offset : 0,
        axis === 'y' ? offset : 0,
        axis === 'z' ? offset : 0
      );
      moverGroup.updateMatrixWorld(true);
      moverGroup.getWorldPosition(currWorldPos);
      moverGroup.getWorldQuaternion(worldQuat);

      body.position.set(currWorldPos.x, currWorldPos.y, currWorldPos.z);
      body.quaternion.set(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);

      if (dt > 0.0001) {
        body.velocity.set(
          (currWorldPos.x - prevWorldPos.x) / dt,
          (currWorldPos.y - prevWorldPos.y) / dt,
          (currWorldPos.z - prevWorldPos.z) / dt
        );
      }
    };
  }

  buildBouncyPad(obstacle, params) {
    const width = Math.max(1.5, Number(params.width) || 3.4);
    const length = Math.max(1.5, Number(params.length) || 3.4);
    const height = 0.45;
    const bounceForce = Math.max(8, Number(params.bounceForce) || 19.5);
    const color = params.color || '#2ec4b6';

    const baseGeom = new THREE.BoxGeometry(width + 0.25, 0.2, length + 0.25);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x141821, roughness: 0.4 });
    const baseMesh = new THREE.Mesh(baseGeom, baseMat);
    baseMesh.position.y = 0.1;
    obstacle.group.add(baseMesh);

    const slimeTex = ProceduralTextures.getSlimePadTexture(color);
    const padGeom = new THREE.BoxGeometry(width, height, length);
    const padMat = new THREE.MeshPhysicalMaterial({
      map: slimeTex,
      color: new THREE.Color(color),
      roughness: 0.15,
      clearcoat: 0.8,
      transmission: 0.35,
      transparent: true,
      opacity: 0.95
    });
    const padMesh = new THREE.Mesh(padGeom, padMat);
    padMesh.position.y = 0.2 + height * 0.5;
    obstacle.group.add(padMesh);
    obstacle.padMesh = padMesh;

    const sx = obstacle.group.scale.x;
    const sy = obstacle.group.scale.y;
    const sz = obstacle.group.scale.z;

    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: this.physicsWorld.materials.bouncy
    });
    const totalH = (0.2 + height) * sy;
    body.addShape(
      new CANNON.Box(new CANNON.Vec3((width * sx) * 0.5, totalH * 0.5, (length * sz) * 0.5)),
      new CANNON.Vec3(0, totalH * 0.5, 0)
    );
    body.userData = { obstacleId: obstacle.id, obstacleType: obstacle.type };

    // Apply guaranteed upward launch impulse when the player contacts the bouncy pad.
    body.addEventListener('collide', (event) => {
      const other = event.body;
      if (other?.userData?.type === 'player') {
        const player = other.userData.entity;
        other.velocity.y = Math.max(other.velocity.y, bounceForce);
        player.triggerWobble(0.55, 0.45);
        obstacle.bouncePulse = 1.0;
        this.sound?.playBounce();
        if (this.particles) {
          this.particles.emitBounceBurst(obstacle.group.position, color);
        }
      }
    });

    this.physicsWorld.addBody(body);
    obstacle.bodies.push(body);

    obstacle.visualUpdate = (dt) => {
      if (obstacle.bouncePulse > 0.001) {
        obstacle.bouncePulse = Math.max(0, obstacle.bouncePulse - dt * 4.5);
        const s = 1 + Math.sin(obstacle.bouncePulse * Math.PI * 3) * 0.24 * obstacle.bouncePulse;
        padMesh.scale.set(1 + (s - 1) * 0.5, s, 1 + (s - 1) * 0.5);
      } else {
        padMesh.scale.set(1, 1, 1);
      }
    };
  }

  buildShapeGate(obstacle, params) {
    const cutoutShape = params.cutoutShape === 'tall_narrow' ? 'tall_narrow' : 'flat_wide';
    const wallWidth = Math.max(4.5, Number(params.wallWidth) || 6.0);
    const wallHeight = Math.max(3.0, Number(params.wallHeight) || 3.4);
    const wallDepth = 0.65;
    const color = params.color || '#ff9f1c';

    // Standard player cube is 1.2m x 1.2m.
    // Flat-Wide opening (3.2m W x 0.90m H) blocks unmorphed height (1.2m > 0.90m).
    // Tall-Narrow opening (0.90m W x 2.65m H) blocks unmorphed width (1.2m > 0.90m).
    const holeWidth = cutoutShape === 'flat_wide' ? 3.2 : 0.9;
    const holeHeight = cutoutShape === 'flat_wide' ? 0.9 : 2.65;

    const sideWidth = Math.max(0.4, (wallWidth - holeWidth) * 0.5);
    const topHeight = Math.max(0.35, wallHeight - holeHeight);

    const wallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.3,
      metalness: 0.1
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x141821,
      roughness: 0.4
    });

    // Left pillar
    const leftGeom = new THREE.BoxGeometry(sideWidth, wallHeight, wallDepth);
    const leftMesh = new THREE.Mesh(leftGeom, wallMat);
    leftMesh.position.set(-(holeWidth * 0.5 + sideWidth * 0.5), wallHeight * 0.5, 0);

    // Right pillar
    const rightMesh = new THREE.Mesh(leftGeom, wallMat);
    rightMesh.position.set(holeWidth * 0.5 + sideWidth * 0.5, wallHeight * 0.5, 0);

    // Top lintel above cutout
    const topGeom = new THREE.BoxGeometry(holeWidth, topHeight, wallDepth);
    const topMesh = new THREE.Mesh(topGeom, wallMat);
    topMesh.position.set(0, holeHeight + topHeight * 0.5, 0);

    // Translucent guide silhouette inside the cutout so the target shape is unmistakable.
    const guideGeom = new THREE.BoxGeometry(holeWidth - 0.08, holeHeight - 0.06, 0.08);
    const guideMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.18
    });
    const guideMesh = new THREE.Mesh(guideGeom, guideMat);
    guideMesh.position.set(0, holeHeight * 0.5, 0);

    // Overhead instruction sign
    const signTex = this.createGateSignTexture(cutoutShape, color);
    const signGeom = new THREE.PlaneGeometry(2.5, 0.92);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });
    const signMesh = new THREE.Mesh(signGeom, signMat);
    signMesh.position.set(0, wallHeight + 0.55, 0);

    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(wallWidth + 0.15, 0.14, wallDepth + 0.1), trimMat);
    frameTop.position.set(0, wallHeight, 0);

    obstacle.group.add(leftMesh, rightMesh, topMesh, guideMesh, signMesh, frameTop);

    const sx = obstacle.group.scale.x;
    const sy = obstacle.group.scale.y;
    const sz = obstacle.group.scale.z;

    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: this.physicsWorld.materials.track
    });

    // Left pillar collider
    body.addShape(
      new CANNON.Box(new CANNON.Vec3((sideWidth * sx) * 0.5, (wallHeight * sy) * 0.5, (wallDepth * sz) * 0.5)),
      new CANNON.Vec3(-(holeWidth * 0.5 + sideWidth * 0.5) * sx, (wallHeight * 0.5) * sy, 0)
    );
    // Right pillar collider
    body.addShape(
      new CANNON.Box(new CANNON.Vec3((sideWidth * sx) * 0.5, (wallHeight * sy) * 0.5, (wallDepth * sz) * 0.5)),
      new CANNON.Vec3((holeWidth * 0.5 + sideWidth * 0.5) * sx, (wallHeight * 0.5) * sy, 0)
    );
    // Top lintel collider
    body.addShape(
      new CANNON.Box(new CANNON.Vec3((holeWidth * sx) * 0.5, (topHeight * sy) * 0.5, (wallDepth * sz) * 0.5)),
      new CANNON.Vec3(0, (holeHeight + topHeight * 0.5) * sy, 0)
    );

    body.userData = { obstacleId: obstacle.id, obstacleType: obstacle.type };
    this.physicsWorld.addBody(body);
    obstacle.bodies.push(body);
  }

  buildCheckpointFinish(obstacle, params) {
    const variant = params.variant === 'finish' ? 'finish' : 'checkpoint';
    const width = Math.max(3.5, Number(params.width) || 5.5);
    const color = params.color || '#2ec4b6';

    const padGeom = new THREE.BoxGeometry(width, 0.14, 2.2);
    const padMat = new THREE.MeshStandardMaterial({
      color: variant === 'finish' ? 0xff9f1c : 0x475569,
      emissive: variant === 'finish' ? new THREE.Color('#ff9f1c') : new THREE.Color('#1e293b'),
      emissiveIntensity: 0.35,
      roughness: 0.25
    });
    const padMesh = new THREE.Mesh(padGeom, padMat);
    padMesh.position.y = 0.07;
    obstacle.group.add(padMesh);
    obstacle.padMat = padMat;

    const pillarHeight = variant === 'finish' ? 4.2 : 2.2;
    const pillarGeom = new THREE.CylinderGeometry(0.18, 0.24, pillarHeight, 14);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x141821, roughness: 0.3 });

    const leftPillar = new THREE.Mesh(pillarGeom, pillarMat);
    leftPillar.position.set(-width * 0.5 + 0.25, pillarHeight * 0.5, 0);
    const rightPillar = new THREE.Mesh(pillarGeom, pillarMat);
    rightPillar.position.set(width * 0.5 - 0.25, pillarHeight * 0.5, 0);
    obstacle.group.add(leftPillar, rightPillar);

    if (variant === 'finish') {
      const checkeredTex = ProceduralTextures.getCheckeredTexture().clone();
      checkeredTex.repeat.set(Math.max(2, Math.floor(width)), 1);
      checkeredTex.needsUpdate = true;

      const archGeom = new THREE.BoxGeometry(width + 0.4, 0.95, 0.45);
      const archMat = new THREE.MeshStandardMaterial({ map: checkeredTex, roughness: 0.3 });
      const archMesh = new THREE.Mesh(archGeom, archMat);
      archMesh.position.set(0, pillarHeight + 0.35, 0);
      obstacle.group.add(archMesh);
    } else {
      const orbGeom = new THREE.SphereGeometry(0.28, 14, 14);
      const orbMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        emissive: new THREE.Color('#334155'),
        emissiveIntensity: 0.4
      });
      const leftOrb = new THREE.Mesh(orbGeom, orbMat);
      leftOrb.position.set(-width * 0.5 + 0.25, pillarHeight + 0.2, 0);
      const rightOrb = new THREE.Mesh(orbGeom, orbMat);
      rightOrb.position.set(width * 0.5 - 0.25, pillarHeight + 0.2, 0);
      obstacle.group.add(leftOrb, rightOrb);
      obstacle.orbMat = orbMat;
    }

    // Sensor check runs in visualUpdate against player distance so no physical snag occurs.
    obstacle.checkTrigger = (player) => {
      if (obstacle.activated) return;
      const worldPos = new THREE.Vector3();
      obstacle.group.getWorldPosition(worldPos);

      const dx = Math.abs(player.rootGroup.position.x - worldPos.x);
      const dy = player.rootGroup.position.y - worldPos.y;
      const dz = Math.abs(player.rootGroup.position.z - worldPos.z);

      const halfWidth = (width * obstacle.group.scale.x) * 0.52;
      if (dx <= halfWidth && dz <= 1.6 && dy >= -0.5 && dy <= 4.2) {
        obstacle.activated = true;
        if (variant === 'finish') {
          this.sound?.playVictory();
          if (this.particles) {
            this.particles.emitConfetti(worldPos);
          }
          if (this.onFinishReached) {
            this.onFinishReached(obstacle);
          }
        } else {
          padMat.color.set(color);
          padMat.emissive.set(color);
          padMat.emissiveIntensity = 0.65;
          if (obstacle.orbMat) {
            obstacle.orbMat.color.set(color);
            obstacle.orbMat.emissive.set(color);
            obstacle.orbMat.emissiveIntensity = 0.85;
          }
          const respawnPos = worldPos.clone().add(new THREE.Vector3(0, 1.8, 0));
          player.setSpawnPoint(respawnPos, obstacle.id);
          this.sound?.playCheckpoint();
          if (this.onCheckpointActivated) {
            this.onCheckpointActivated(obstacle);
          }
        }
      }
    };
  }

  syncBodiesToGroup(obstacle) {
    obstacle.group.updateMatrixWorld(true);
    const pos = obstacle.group.position;
    const quat = obstacle.group.quaternion;

    if (obstacle.type === 'track_block' && obstacle.innerTilt) {
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      obstacle.innerTilt.getWorldPosition(worldPos);
      obstacle.innerTilt.getWorldQuaternion(worldQuat);
      const body = obstacle.bodies[0];
      if (body) {
        body.position.set(worldPos.x, worldPos.y, worldPos.z);
        body.quaternion.set(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);
      }
      return;
    }

    if (obstacle.type === 'spinning_sweeper' && obstacle.kinematicUpdate) {
      obstacle.kinematicUpdate(0);
      return;
    }

    if (obstacle.type === 'moving_platform' && obstacle.kinematicUpdate) {
      obstacle.kinematicUpdate(0);
      return;
    }

    for (const body of obstacle.bodies) {
      body.position.set(pos.x, pos.y, pos.z);
      body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    }
  }

  rebuildObstacle(obstacle, newParams = {}) {
    obstacle.params = { ...obstacle.params, ...newParams };

    for (const body of obstacle.bodies) {
      this.physicsWorld.removeBody(body);
    }
    obstacle.bodies = [];
    obstacle.kinematicUpdate = null;
    obstacle.visualUpdate = null;
    obstacle.checkTrigger = null;

    while (obstacle.group.children.length > 0) {
      const child = obstacle.group.children[0];
      obstacle.group.remove(child);
    }

    this.buildObstacleInternals(obstacle);
    this.tagMeshHierarchy(obstacle.group, obstacle.id);
  }

  removeObstacle(id) {
    const obstacle = this.obstacles.get(id);
    if (!obstacle) return;

    for (const body of obstacle.bodies) {
      this.physicsWorld.removeBody(body);
    }
    this.scene.remove(obstacle.group);
    this.obstacles.delete(id);
  }

  clearAll() {
    for (const id of Array.from(this.obstacles.keys())) {
      this.removeObstacle(id);
    }
  }

  resetAllForModeSwitch() {
    for (const obstacle of this.obstacles.values()) {
      obstacle.elapsed = 0;
      obstacle.activated = false;
      obstacle.bouncePulse = 0;

      if (obstacle.type === 'checkpoint_finish' && obstacle.params.variant !== 'finish') {
        if (obstacle.padMat) {
          obstacle.padMat.color.set(0x475569);
          obstacle.padMat.emissive.set('#1e293b');
          obstacle.padMat.emissiveIntensity = 0.35;
        }
        if (obstacle.orbMat) {
          obstacle.orbMat.color.set(0x94a3b8);
          obstacle.orbMat.emissive.set('#334155');
          obstacle.orbMat.emissiveIntensity = 0.4;
        }
      }

      if (obstacle.moverGroup) {
        obstacle.moverGroup.position.set(0, 0, 0);
      }
      if (obstacle.rotorGroup) {
        obstacle.rotorGroup.rotation.set(0, 0, 0);
      }

      this.syncBodiesToGroup(obstacle);
      this.applyObstacleFade(obstacle, 1.0);
      for (const body of obstacle.bodies) {
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
      }
    }
  }

  /**
   * Fades obstacles to translucent once the jelly passes them along the -Z race axis
   * so tall gates, sweepers, arches, or rear platforms never block the third-person camera.
   */
  isObstaclePassedByPlayer(obstacle, player) {
    if (!player) return false;
    const worldPos = new THREE.Vector3();
    if (obstacle.moverGroup) {
      obstacle.moverGroup.getWorldPosition(worldPos);
    } else {
      obstacle.group.getWorldPosition(worldPos);
    }

    const playerPos = player.rootGroup.position;

    if (obstacle.type === 'track_block' || obstacle.type === 'moving_platform') {
      const len = (Number(obstacle.params.length) || 6) * obstacle.group.scale.z;
      const frontEdgeZ = worldPos.z - len * 0.5;
      const passedPlatform = playerPos.z < frontEdgeZ - 0.25;
      const occludingOverhead =
        worldPos.y > playerPos.y + 0.75 && worldPos.z > playerPos.z - 0.5;
      return passedPlatform || occludingOverhead;
    }

    return playerPos.z < worldPos.z - 0.15;
  }

  applyObstacleFade(obstacle, fadeValue) {
    obstacle.currentFade = fadeValue;
    const isFaded = fadeValue < 0.98;

    obstacle.group.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (!mat) continue;
        const baseOpacity = mat.userData.baseOpacity ?? 1.0;
        const baseTransparent = Boolean(mat.userData.baseTransparent);
        mat.opacity = baseOpacity * fadeValue;
        mat.transparent = isFaded ? true : baseTransparent;
        // Disable depthWrite while faded so the transmissive jelly renders cleanly behind passed gates.
        mat.depthWrite = fadeValue > 0.85 ? true : false;
      }
    });
  }

  updatePreStep(dt, playModeActive = true) {
    if (!playModeActive) return;
    for (const obstacle of this.obstacles.values()) {
      if (obstacle.kinematicUpdate) {
        obstacle.kinematicUpdate(dt);
      }
    }
  }

  updateVisuals(dt, player, playModeActive = true) {
    const safeDt = Math.min(dt, 0.05);
    const fadeSpeed = 1 - Math.exp(-10 * safeDt);

    for (const obstacle of this.obstacles.values()) {
      if (obstacle.visualUpdate) {
        obstacle.visualUpdate(dt);
      }
      if (playModeActive && obstacle.checkTrigger && player) {
        obstacle.checkTrigger(player);
      }

      const passed = playModeActive && this.isObstaclePassedByPlayer(obstacle, player);
      const targetFade = passed
        ? obstacle.type === 'track_block' || obstacle.type === 'moving_platform'
          ? 0.22
          : 0.18
        : 1.0;

      if (Math.abs(obstacle.currentFade - targetFade) > 0.004) {
        const nextFade = THREE.MathUtils.lerp(obstacle.currentFade, targetFade, fadeSpeed);
        this.applyObstacleFade(obstacle, nextFade);
      } else if (obstacle.currentFade !== targetFade) {
        this.applyObstacleFade(obstacle, targetFade);
      }
    }
  }

  serializeLevel(meta = {}) {
    const obstacles = [];
    for (const obs of this.obstacles.values()) {
      const euler = obs.group.rotation;
      obstacles.push({
        id: obs.id,
        type: obs.type,
        position: [
          Number(obs.group.position.x.toFixed(2)),
          Number(obs.group.position.y.toFixed(2)),
          Number(obs.group.position.z.toFixed(2))
        ],
        rotation: [
          Number(THREE.MathUtils.radToDeg(euler.x).toFixed(1)),
          Number(THREE.MathUtils.radToDeg(euler.y).toFixed(1)),
          Number(THREE.MathUtils.radToDeg(euler.z).toFixed(1))
        ],
        scale: [
          Number(obs.group.scale.x.toFixed(2)),
          Number(obs.group.scale.y.toFixed(2)),
          Number(obs.group.scale.z.toFixed(2))
        ],
        params: { ...obs.params }
      });
    }

    return {
      version: 1,
      name: meta.name || 'Custom Jelly Track',
      spawnPoint: meta.spawnPoint || [0, 2.2, 0],
      obstacles
    };
  }

  loadLevel(levelData) {
    this.clearAll();
    const list = Array.isArray(levelData?.obstacles) ? levelData.obstacles : [];
    for (const item of list) {
      this.createObstacle(item);
    }
  }
}
