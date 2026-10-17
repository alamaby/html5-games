import * as THREE from 'three';

export class ProceduralTextures {
  static cache = new Map();

  static getStudioEnvironment() {
    if (this.cache.has('studio_env')) {
      return this.cache.get('studio_env');
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Equirectangular studio sky + softboxes provide specular highlights for transmissive jelly.
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0.0, '#ffffff');
    skyGrad.addColorStop(0.28, '#cfe8ff');
    skyGrad.addColorStop(0.5, '#f8fbff');
    skyGrad.addColorStop(0.52, '#d5deeb');
    skyGrad.addColorStop(1.0, '#8d9cb5');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Bright overhead studio softboxes for crisp gelatin rim reflections.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.ellipse(128, 48, 70, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(384, 56, 85, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    this.cache.set('studio_env', texture);
    return texture;
  }

  static getTrackTexture(primaryHex = '#e9eef7', secondaryHex = '#d5deec') {
    const key = `track_${primaryHex}_${secondaryHex}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = secondaryHex;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillRect(128, 128, 128, 128);

    ctx.strokeStyle = 'rgba(20, 24, 33, 0.08)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 252);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    texture.colorSpace = THREE.SRGBColorSpace;
    this.cache.set(key, texture);
    return texture;
  }

  static getSlimePadTexture(baseHex = '#2ec4b6') {
    const key = `slime_${baseHex}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    // Concentric bounce rings communicate upward launch impulse to the player.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 10;
    [42, 78, 112].forEach((r) => {
      ctx.beginPath();
      ctx.arc(128, 128, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    const bubbles = [
      [64, 70, 10],
      [196, 82, 14],
      [78, 188, 12],
      [184, 176, 9],
      [128, 128, 18]
    ];
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    bubbles.forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.cache.set(key, texture);
    return texture;
  }

  static getHazardStripeTexture(stripeHex = '#ff9f1c', darkHex = '#1e2432') {
    const key = `hazard_${stripeHex}_${darkHex}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = stripeHex;
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = darkHex;
    for (let i = -256; i < 512; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 32, 0);
      ctx.lineTo(i + 32 + 256, 256);
      ctx.lineTo(i + 256, 256);
      ctx.closePath();
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    this.cache.set(key, texture);
    return texture;
  }

  static getCheckeredTexture() {
    if (this.cache.has('checkered_finish')) {
      return this.cache.get('checkered_finish');
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const size = 32;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#141821' : '#ffffff';
        ctx.fillRect(x * size, y * size, size, size);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    this.cache.set('checkered_finish', texture);
    return texture;
  }
}
