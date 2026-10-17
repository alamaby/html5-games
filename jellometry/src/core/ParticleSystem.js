import * as THREE from 'three';

const CONFETTI_COLORS = ['#ff4d6d', '#2ec4b6', '#ff9f1c', '#3a86ff', '#f4f6fa'];

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.activeParticles = [];

    this.dropletGeom = new THREE.SphereGeometry(0.11, 8, 8);
    this.confettiGeom = new THREE.PlaneGeometry(0.22, 0.14);
  }

  emitDroplets(origin, colorHex = '#ff4d6d', count = 10) {
    const baseColor = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.2,
        transparent: true,
        opacity: 0.88
      });
      const mesh = new THREE.Mesh(this.dropletGeom, mat);
      mesh.position.copy(origin).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.2) * 0.4,
          (Math.random() - 0.5) * 0.6
        )
      );

      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 4.5;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        2.5 + Math.random() * 4.5,
        Math.sin(angle) * speed
      );

      this.scene.add(mesh);
      this.activeParticles.push({
        mesh,
        velocity,
        angularVelocity: new THREE.Vector3(),
        gravity: -18,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.25,
        shrink: true
      });
    }
  }

  emitBounceBurst(origin, colorHex = '#2ec4b6') {
    this.emitDroplets(origin.clone().add(new THREE.Vector3(0, 0.4, 0)), colorHex, 14);
  }

  emitConfetti(origin, count = 75) {
    for (let i = 0; i < count; i++) {
      const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      const mat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(this.confettiGeom, mat);
      mesh.position.copy(origin).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 4.5,
          1.8 + Math.random() * 2.5,
          (Math.random() - 0.5) * 2.0
        )
      );
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 8.0,
        5.0 + Math.random() * 7.5,
        (Math.random() - 0.5) * 8.0
      );
      const angularVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );

      this.scene.add(mesh);
      this.activeParticles.push({
        mesh,
        velocity,
        angularVelocity,
        gravity: -9.5,
        life: 0,
        maxLife: 1.6 + Math.random() * 0.9,
        shrink: false
      });
    }
  }

  update(dt) {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.activeParticles.splice(i, 1);
        continue;
      }

      p.velocity.y += p.gravity * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.rotation.x += p.angularVelocity.x * dt;
      p.mesh.rotation.y += p.angularVelocity.y * dt;
      p.mesh.rotation.z += p.angularVelocity.z * dt;

      if (p.shrink) {
        const s = Math.max(0.01, 1 - p.life / p.maxLife);
        p.mesh.scale.setScalar(s);
      }
    }
  }

  clear() {
    for (const p of this.activeParticles) {
      this.scene.remove(p.mesh);
      p.mesh.material.dispose();
    }
    this.activeParticles.length = 0;
  }
}
