import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World();
    // Tuned arcade gravity (-24 m/s^2) keeps jump arcs crisp and prevents floaty air time.
    this.world.gravity.set(0, -24, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = false;
    this.world.solver.iterations = 12;

    this.materials = {
      jelly: new CANNON.Material('jelly'),
      track: new CANNON.Material('track'),
      bouncy: new CANNON.Material('bouncy'),
      sweeper: new CANNON.Material('sweeper')
    };

    this.setupContactMaterials();
    this.preStepCallbacks = new Set();

    this.world.addEventListener('preStep', () => {
      for (const cb of this.preStepCallbacks) {
        cb(1 / 60);
      }
    });
  }

  setupContactMaterials() {
    // Low lateral friction prevents the box collider from snagging on vertical Shape Gate walls.
    const jellyTrack = new CANNON.ContactMaterial(
      this.materials.jelly,
      this.materials.track,
      {
        friction: 0.015,
        restitution: 0.05,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 3
      }
    );

    const jellyBouncy = new CANNON.ContactMaterial(
      this.materials.jelly,
      this.materials.bouncy,
      {
        friction: 0.02,
        restitution: 0.9,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 3
      }
    );

    const jellySweeper = new CANNON.ContactMaterial(
      this.materials.jelly,
      this.materials.sweeper,
      {
        friction: 0.0,
        restitution: 0.95,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 2
      }
    );

    this.world.addContactMaterial(jellyTrack);
    this.world.addContactMaterial(jellyBouncy);
    this.world.addContactMaterial(jellySweeper);
  }

  onPreStep(callback) {
    this.preStepCallbacks.add(callback);
    return () => this.preStepCallbacks.delete(callback);
  }

  step(dt) {
    const clampedDt = Math.min(dt, 0.1);
    this.world.step(1 / 60, clampedDt, 4);
  }

  addBody(body) {
    this.world.addBody(body);
  }

  removeBody(body) {
    if (body && this.world.bodies.includes(body)) {
      this.world.removeBody(body);
    }
  }
}
