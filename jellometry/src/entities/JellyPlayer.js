import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const BASE_SIZE = 1.2;
const CONSTANT_VOLUME = BASE_SIZE * BASE_SIZE * BASE_SIZE; // 1.728 m^3

export const JELLY_PALETTES = [
  { id: 'coral', name: 'Coral Berry', hex: '#ff4d6d', attenuation: '#c9184a' },
  { id: 'mint', name: 'Mint Lime', hex: '#2ec4b6', attenuation: '#0f766e' },
  { id: 'mango', name: 'Mango Tang', hex: '#ff9f1c', attenuation: '#c2410c' },
  { id: 'berry', name: 'Electric Berry', hex: '#3a86ff', attenuation: '#1d4ed8' }
];

export class JellyPlayer {
  constructor(scene, physicsWorld, soundManager, particleSystem = null) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.sound = soundManager;
    this.particles = particleSystem;

    this.paletteIndex = 0;
    this.morphValue = 0; // -1 = Flat & Wide, 0 = Balanced Cube, +1 = Tall & Narrow
    this.baseSize = BASE_SIZE;
    this.constantVolume = CONSTANT_VOLUME;

    this.currentDims = new THREE.Vector3(BASE_SIZE, BASE_SIZE, BASE_SIZE);
    this.targetDims = new THREE.Vector3(BASE_SIZE, BASE_SIZE, BASE_SIZE);

    // Spring-damper state for vertical squash/stretch and collision vertex ripples.
    this.squashStretch = 0;
    this.squashVelocity = 0;
    this.wobbleAmplitude = 0;
    this.wobblePhase = 0;
    this.reformTimer = 0;
    this.blinkTimer = 2.4;
    this.isBlinking = false;

    // Movement and grounding state.
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      morphFlat: false,
      morphTall: false
    };
    this.isGrounded = false;
    this.coyoteTimer = 0;
    this.jumpCooldown = 0;
    this.lastVelY = 0;
    this.groundPlatformBody = null;

    this.spawnPoint = new THREE.Vector3(0, 2.2, 0);
    this. activeCheckpointId = null;

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'JellyPlayer';
    this.scene.add(this.rootGroup);

    this.buildVisualMesh();
    this.buildPhysicsBody();
  }

  createRoundedBoxGeometry(segments = 12) {
    const geom = new THREE.BoxGeometry(1, 1, 1, segments, segments, segments);
    const pos = geom.attributes.position;
    const v = new THREE.Vector3();
    const clamped = new THREE.Vector3();
    const bevel = 0.34;
    const inner = 0.5 - bevel;

    // Chamfer box vertices into a soft pillowed cube so refraction and wobble normals stay smooth.
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      clamped.set(
        Math.max(-inner, Math.min(inner, v.x)),
        Math.max(-inner, Math.min(inner, v.y)),
        Math.max(-inner, Math.min(inner, v.z))
      );
      const diff = v.clone().sub(clamped);
      if (diff.lengthSq() > 0) {
        diff.normalize().multiplyScalar(bevel);
        v.copy(clamped).add(diff);
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }

    geom.computeVertexNormals();
    return geom;
  }

  buildVisualMesh() {
    this.geometry = this.createRoundedBoxGeometry(12);
    const posAttr = this.geometry.attributes.position;
    this.basePositions = new Float32Array(posAttr.array.length);
    this.basePositions.set(posAttr.array);

    const palette = JELLY_PALETTES[this.paletteIndex];
    this.material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(palette.hex),
      transmission: 0.85,
      opacity: 1,
      transparent: true,
      roughness: 0.15,
      ior: 1.4,
      thickness: 1.35,
      attenuationColor: new THREE.Color(palette.attenuation),
      attenuationDistance: 2.2,
      clearcoat: 0.65,
      clearcoatRoughness: 0.1
    });

    this.jellyMesh = new THREE.Mesh(this.geometry, this.material);
    this.jellyMesh.castShadow = true;
    this.jellyMesh.receiveShadow = true;
    this.rootGroup.add(this.jellyMesh);

    // Suspended nucleus gives depth inside the transmissive shader.
    const coreGeom = new THREE.SphereGeometry(0.24, 16, 16);
    this.coreMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.hex).lerp(new THREE.Color('#ffffff'), 0.35),
      roughness: 0.3,
      transparent: true,
      opacity: 0.55
    });
    this.coreMesh = new THREE.Mesh(coreGeom, this.coreMat);
    this.jellyMesh.add(this.coreMesh);

    // Playful face group attached to the jelly mesh so eyes squash and stretch with the body.
    this.faceGroup = new THREE.Group();
    this.faceGroup.position.set(0, 0.06, -0.49);
    this.jellyMesh.add(this.faceGroup);

    const eyeWhiteGeom = new THREE.SphereGeometry(0.105, 16, 16);
    eyeWhiteGeom.scale(1, 1.08, 0.45);
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.15
    });

    const pupilGeom = new THREE.SphereGeometry(0.058, 14, 14);
    pupilGeom.scale(1, 1.05, 0.45);
    const pupilMat = new THREE.MeshStandardMaterial({
      color: 0x141821,
      roughness: 0.1
    });

    const catchlightGeom = new THREE.SphereGeometry(0.022, 10, 10);
    const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    this.leftEye = new THREE.Group();
    this.leftEye.position.set(-0.18, 0.04, 0);
    const leftWhite = new THREE.Mesh(eyeWhiteGeom, eyeWhiteMat);
    const leftPupil = new THREE.Mesh(pupilGeom, pupilMat);
    leftPupil.position.set(0, 0, -0.032);
    const leftShine = new THREE.Mesh(catchlightGeom, catchlightMat);
    leftShine.position.set(0.022, 0.025, -0.052);
    this.leftEye.add(leftWhite, leftPupil, leftShine);

    this.rightEye = this.leftEye.clone();
    this.rightEye.position.set(0.18, 0.04, 0);

    // Curved smile using a torus arc segment.
    const smileGeom = new THREE.TorusGeometry(0.075, 0.018, 8, 16, Math.PI);
    const smileMat = new THREE.MeshStandardMaterial({
      color: 0x141821,
      roughness: 0.2
    });
    this.smileMesh = new THREE.Mesh(smileGeom, smileMat);
    this.smileMesh.position.set(0, -0.05, -0.02);
    this.smileMesh.rotation.x = Math.PI;

    this.faceGroup.add(this.leftEye, this.rightEye, this.smileMesh);
  }

  buildPhysicsBody() {
    const halfExtents = new CANNON.Vec3(BASE_SIZE / 2, BASE_SIZE / 2, BASE_SIZE / 2);
    this.boxShape = new CANNON.Box(halfExtents);

    this.body = new CANNON.Body({
      mass: 4.0,
      material: this.physicsWorld.materials.jelly,
      position: new CANNON.Vec3(this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z),
      fixedRotation: true,
      linearDamping: 0.15
    });
    this.body.addShape(this.boxShape);
    this.body.updateMassProperties();
    this.body.userData = { type: 'player', entity: this };

    this.body.addEventListener('collide', (event) => this.handleCollision(event));
    this.physicsWorld.addBody(this.body);
  }

  handleCollision(event) {
    const contact = event.contact;
    const impactSpeed = Math.abs(contact.getImpactVelocityAlongNormal());

    if (impactSpeed > 2.2) {
      const normalized = Math.min(1.4, impactSpeed / 16);
      this.triggerWobble(normalized * 0.55, -normalized * 0.38);

      const otherBody = event.body;
      const obstacleType = otherBody?.userData?.obstacleType;

      if (obstacleType !== 'bouncy_pad') {
        this.sound?.playImpact(normalized * 0.8);
      }

      if (this.particles && impactSpeed > 5.0) {
        const palette = JELLY_PALETTES[this.paletteIndex];
        this.particles.emitDroplets(
          this.rootGroup.position,
          palette.hex,
          Math.min(14, Math.floor(impactSpeed * 0.8))
        );
      }
    }
  }

  setPalette(indexOrId) {
    const idx =
      typeof indexOrId === 'number'
        ? indexOrId % JELLY_PALETTES.length
        : JELLY_PALETTES.findIndex((p) => p.id === indexOrId);
    this.paletteIndex = idx >= 0 ? idx : 0;
    const palette = JELLY_PALETTES[this.paletteIndex];
    this.material.color.set(palette.hex);
    this.material.attenuationColor.set(palette.attenuation);
    this.coreMat.color.set(palette.hex).lerp(new THREE.Color('#ffffff'), 0.35);
    return palette;
  }

  getPalette() {
    return JELLY_PALETTES[this.paletteIndex];
  }

  /**
   * Adjusts morph ratio in [-1, 1] while preserving exact volume (W * H * D = 1.728 m^3).
   * Negative morph flattens the jelly wide & short to clear low barriers;
   * positive morph squeezes the jelly tall & thin to pass narrow vertical gates.
   */
  setMorphValue(value, playSound = true) {
    const clamped = Math.max(-1, Math.min(1, value));
    const delta = Math.abs(clamped - this.morphValue);
    this.morphValue = clamped;

    const width = this.baseSize * Math.pow(2, -0.95 * this.morphValue);
    const height = this.baseSize * Math.pow(2, 0.9 * this.morphValue);
    const depth = this.constantVolume / (width * height);

    this.targetDims.set(width, height, depth);

    if (playSound && delta > 0.015) {
      this.sound?.playMorph(this.morphValue);
    }
  }

  adjustMorph(delta) {
    this.setMorphValue(this.morphValue + delta, true);
  }

  triggerWobble(amplitude = 0.35, squashImpulse = -0.25) {
    this.wobbleAmplitude = Math.min(0.65, this.wobbleAmplitude + amplitude);
    this.squashVelocity += squashImpulse * 14;
  }

  setSpawnPoint(position, checkpointId = null) {
    this.spawnPoint.copy(position);
    this.activeCheckpointId = checkpointId;
  }

  respawn(playSplashSound = false) {
    if (playSplashSound) {
      this.sound?.playSplash();
    }

    this.setMorphValue(0, false);
    this.currentDims.set(BASE_SIZE, BASE_SIZE, BASE_SIZE);
    this.updateColliderExtents();

    this.body.position.set(this.spawnPoint.x, this.spawnPoint.y + 0.6, this.spawnPoint.z);
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.body.quaternion.set(0, 0, 0, 1);

    this.squashStretch = -0.35;
    this.squashVelocity = 9.5;
    this.wobbleAmplitude = 0.55;
    this.reformTimer = 0.45;

    this.rootGroup.position.copy(this.body.position);
  }

  updateColliderExtents() {
    const prevHalfY = this.boxShape.halfExtents.y;
    const newHalfX = this.currentDims.x * 0.5;
    const newHalfY = this.currentDims.y * 0.5;
    const newHalfZ = this.currentDims.z * 0.5;

    this.boxShape.halfExtents.set(newHalfX, newHalfY, newHalfZ);
    this.boxShape.updateConvexPolyhedronRepresentation();
    this.body.updateBoundingRadius();

    // Shift body center upward when growing taller on the ground so the bottom face stays above the floor.
    if (this.isGrounded && newHalfY > prevHalfY) {
      this.body.position.y += newHalfY - prevHalfY;
    }
  }

  checkGrounded() {
    this.isGrounded = false;
    this.groundPlatformBody = null;

    const halfY = this.boxShape.halfExtents.y;
    const halfX = this.boxShape.halfExtents.x * 0.72;
    const halfZ = this.boxShape.halfExtents.z * 0.72;
    const rayLen = halfY + 0.18;

    const offsets = [
      [0, 0],
      [-halfX, -halfZ],
      [halfX, -halfZ],
      [-halfX, halfZ],
      [halfX, halfZ]
    ];

    const from = new CANNON.Vec3();
    const to = new CANNON.Vec3();
    const result = new CANNON.RaycastResult();

    for (const [ox, oz] of offsets) {
      from.set(this.body.position.x + ox, this.body.position.y, this.body.position.z + oz);
      to.set(from.x, from.y - rayLen, from.z);
      result.reset();

      this.physicsWorld.world.raycastClosest(
        from,
        to,
        { collisionFilterMask: -1, skipBackfaces: true },
        result
      );

      if (result.hasHit && result.body !== this.body && result.hitNormalWorld.y > 0.35) {
        this.isGrounded = true;
        this.groundPlatformBody = result.body;
        break;
      }
    }
  }

  update(dt, playModeActive = true) {
    const safeDt = Math.min(dt, 0.05);

    if (playModeActive) {
      if (this.keys.morphFlat) {
        this.adjustMorph(-1.85 * safeDt);
      }
      if (this.keys.morphTall) {
        this.adjustMorph(1.85 * safeDt);
      }
    }

    // Smoothly interpolate physical & visual dimensions toward the volume-preserving target.
    const dimLerp = 1 - Math.exp(-14 * safeDt);
    this.currentDims.lerp(this.targetDims, dimLerp);
    // Enforce exact volume invariant on interpolated dimensions.
    this.currentDims.z = this.constantVolume / (this.currentDims.x * this.currentDims.y);
    this.updateColliderExtents();

    this.checkGrounded();

    // Coyote time gives a 110ms grace window after leaving a ledge so jumps feel forgiving.
    if (this.isGrounded) {
      this.coyoteTimer = 0.11;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - safeDt);
    }

    this.jumpCooldown = Math.max(0, this.jumpCooldown - safeDt);

    if (playModeActive) {
      this.updateMovement(safeDt);
    }

    this.updateSoftBodyDeformation(safeDt);
    this.lastVelY = this.body.velocity.y;
  }

  updateMovement(dt) {
    const moveX = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    const moveZ = (this.keys.backward ? 1 : 0) - (this.keys.forward ? 1 : 0);

    const inputVec = new THREE.Vector2(moveX, moveZ);
    if (inputVec.lengthSq() > 1) {
      inputVec.normalize();
    }

    const maxSpeed = 10.8;
    const accel = this.isGrounded ? 14.0 : 7.5;

    // Inherit horizontal velocity when riding a moving kinematic platform.
    let platformVelX = 0;
    let platformVelZ = 0;
    if (this.isGrounded && this.groundPlatformBody?.userData?.obstacleType === 'moving_platform') {
      platformVelX = this.groundPlatformBody.velocity.x;
      platformVelZ = this.groundPlatformBody.velocity.z;
    }

    const targetVx = inputVec.x * maxSpeed + platformVelX;
    const targetVz = inputVec.y * maxSpeed + platformVelZ;

    const blend = 1 - Math.exp(-accel * dt);
    this.body.velocity.x += (targetVx - this.body.velocity.x) * blend;
    this.body.velocity.z += (targetVz - this.body.velocity.z) * blend;

    if (this.keys.jump && this.coyoteTimer > 0 && this.jumpCooldown <= 0) {
      this.body.velocity.y = 12.6;
      this.coyoteTimer = 0;
      this.jumpCooldown = 0.22;
      this.squashStretch = 0.36;
      this.squashVelocity = 4.5;
      this.wobbleAmplitude = Math.max(this.wobbleAmplitude, 0.25);
      this.sound?.playJump();
    }
  }

  updateSoftBodyDeformation(dt) {
    // Detect landing transition to inject a proportional downward squash impulse.
    if (this.isGrounded && this.lastVelY < -2.5) {
      const impact = Math.min(1.0, Math.abs(this.lastVelY) / 18);
      this.squashVelocity -= impact * 13.5;
      this.wobbleAmplitude = Math.min(0.6, this.wobbleAmplitude + impact * 0.42);
    }

    // Underdamped harmonic oscillator (hooke stiffness + damping) drives jelly bounce-back.
    const velocityStretchTarget = THREE.MathUtils.clamp(this.body.velocity.y * 0.018, -0.22, 0.28);
    const stiffness = 175;
    const damping = 11.5;
    const springForce = -stiffness * (this.squashStretch - velocityStretchTarget) - damping * this.squashVelocity;

    this.squashVelocity += springForce * dt;
    this.squashStretch += this.squashVelocity * dt;
    this.squashStretch = THREE.MathUtils.clamp(this.squashStretch, -0.45, 0.55);

    this.wobblePhase += dt * 24;
    this.wobbleAmplitude *= Math.exp(-4.2 * dt);

    // Apply volume-preserving squash & stretch on top of the active morph dimensions.
    const sy = Math.max(0.45, 1 + this.squashStretch);
    const invSqrtSy = 1 / Math.sqrt(sy);

    let reformScale = 1;
    if (this.reformTimer > 0) {
      this.reformTimer = Math.max(0, this.reformTimer - dt);
      const t = 1 - this.reformTimer / 0.45;
      reformScale = THREE.MathUtils.lerp(0.25, 1.0, t);
    }

    const finalScaleX = this.currentDims.x * invSqrtSy * reformScale;
    const finalScaleY = this.currentDims.y * sy * reformScale;
    const finalScaleZ = this.currentDims.z * invSqrtSy * reformScale;

    this.jellyMesh.scale.set(finalScaleX, finalScaleY, finalScaleZ);

    // Offset visual mesh vertically so the bottom of the jelly stays planted on the collider floor during squash.
    const visualBottomOffset = (finalScaleY - this.currentDims.y) * 0.5;
    this.jellyMesh.position.set(0, visualBottomOffset, 0);

    // Subtle pitch/roll lean in the direction of travel gives tactile weight.
    const leanZ = THREE.MathUtils.clamp(-this.body.velocity.x * 0.018, -0.18, 0.18);
    const leanX = THREE.MathUtils.clamp(this.body.velocity.z * 0.018, -0.18, 0.18);
    this.jellyMesh.rotation.z = THREE.MathUtils.lerp(this.jellyMesh.rotation.z, leanZ, 1 - Math.exp(-12 * dt));
    this.jellyMesh.rotation.x = THREE.MathUtils.lerp(this.jellyMesh.rotation.x, leanX, 1 - Math.exp(-12 * dt));

    // Deform individual vertices with a sinusoidal spring ripple when wobbling.
    const posAttr = this.geometry.attributes.position;
    const arr = posAttr.array;
    const base = this.basePositions;

    if (this.wobbleAmplitude > 0.003) {
      const amp = this.wobbleAmplitude;
      const phase = this.wobblePhase;
      for (let i = 0; i < arr.length; i += 3) {
        const bx = base[i];
        const by = base[i + 1];
        const bz = base[i + 2];

        const wave = Math.sin(by * 7.5 + phase) * amp * 0.16;
        const radial = 1 + wave + (0.5 - by) * Math.max(0, -this.squashStretch) * 0.18;

        arr[i] = bx * radial;
        arr[i + 1] = by;
        arr[i + 2] = bz * radial;
      }
      posAttr.needsUpdate = true;
      this.geometry.computeVertexNormals();
    } else if (this.wobbleAmplitude > 0.0005) {
      arr.set(base);
      posAttr.needsUpdate = true;
      this.geometry.computeVertexNormals();
      this.wobbleAmplitude = 0;
    }

    // Periodic eye blink for character life.
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.isBlinking = !this.isBlinking;
      this.blinkTimer = this.isBlinking ? 0.11 : 2.2 + Math.random() * 2.0;
      const eyeScaleY = this.isBlinking ? 0.12 : 1.0;
      this.leftEye.scale.y = eyeScaleY;
      this.rightEye.scale.y = eyeScaleY;
    }

    this.rootGroup.position.copy(this.body.position);
  }

  getSpeed() {
    const vx = this.body.velocity.x;
    const vz = this.body.velocity.z;
    return Math.hypot(vx, vz);
  }

  getMorphProfileName() {
    if (this.morphValue < -0.35) return 'FLAT-WIDE';
    if (this.morphValue > 0.35) return 'TALL-NARROW';
    return 'BALANCED CUBE';
  }
}
