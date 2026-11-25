import * as THREE from 'three';

export function disposeObjectTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of meshMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometries.forEach((geometry) => { geometry.dispose(); });
  textures.forEach((texture) => { texture.dispose(); });
  materials.forEach((material) => { material.dispose(); });
}

export class GameLoop {
  readonly renderer: THREE.WebGLRenderer;
  private accumulator = 0;
  private previousTime = 0;
  private readonly observer: ResizeObserver;
  private disposed = false;

  constructor(
    canvas: HTMLCanvasElement,
    readonly scene: THREE.Scene,
    readonly camera: THREE.PerspectiveCamera,
    private readonly update: (dt: number) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setClearColor(0x10161b);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement ?? canvas);
    this.resize();
    this.renderer.setAnimationLoop((time) => this.tick(time));
  }

  private tick(time: number): void {
    if (this.disposed) return;
    if (!this.previousTime) this.previousTime = time;
    this.accumulator += Math.min((time - this.previousTime) / 1000, 0.1);
    this.previousTime = time;
    const fixed = 1 / 60;
    let steps = 0;
    while (this.accumulator >= fixed && steps < 5) {
      this.update(fixed);
      this.accumulator -= fixed;
      steps += 1;
    }
    if (steps === 5) this.accumulator = 0;
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const host = this.renderer.domElement.parentElement ?? this.renderer.domElement;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    disposeObjectTree(this.scene);
    this.renderer.dispose();
  }
}
