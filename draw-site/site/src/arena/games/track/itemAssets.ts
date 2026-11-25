import * as THREE from 'three';
import type { ItemKind } from './hurdleFlow';

/**
 * Owns the geometry and materials every track item shares. Instances only reference them, so
 * despawning is a plain `scene.remove`; `dispose` frees them once, after the items left the scene
 * (otherwise the scene-wide disposal would free them a second time).
 */
export class ItemAssets {
  private readonly barGeometry = new THREE.BoxGeometry(2.15, 0.13, 0.18);
  private readonly postGeometry = new THREE.BoxGeometry(0.11, 0.9, 0.12);
  private readonly coinGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.09, 16);
  private readonly hurdleMaterial = new THREE.MeshStandardMaterial({ color: 0xf7a942, emissive: 0x65340b, emissiveIntensity: 0.45, flatShading: true });
  private readonly coinMaterial = new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0x8a6d00, emissiveIntensity: 0.7, flatShading: true });

  create(kind: ItemKind): THREE.Group {
    const group = new THREE.Group();
    if (kind === 'coin') {
      const coin = new THREE.Mesh(this.coinGeometry, this.coinMaterial);
      coin.rotation.x = Math.PI / 2; coin.position.y = 1; group.add(coin);
      return group;
    }
    const bar = new THREE.Mesh(this.barGeometry, this.hurdleMaterial); bar.position.y = 0.9; group.add(bar);
    for (const side of [-1, 1]) { const post = new THREE.Mesh(this.postGeometry, this.hurdleMaterial); post.position.set(side * 0.95, 0.43, 0); group.add(post); }
    return group;
  }

  dispose(): void {
    for (const resource of [this.barGeometry, this.postGeometry, this.coinGeometry, this.hurdleMaterial, this.coinMaterial]) resource.dispose();
  }
}
