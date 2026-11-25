import * as THREE from 'three';
import type { SportActionEvent } from '../../cv/protocol';
import { disposeObjectTree, GameLoop } from '../core/GameLoop';
import { applySprint, applyStep, type Gait, gaitFor, nextPace, type Pace } from './gait';
import { HurdleFlow, RUNNER_Z } from './hurdleFlow';
import { TrackScore } from './trackScore';

export interface GameHudState { score: number; label: string; speed01: number; status: string }
type Hurdle = { group: THREE.Group; lane: number; z: number; passed: boolean };
const GAIT_STATUS: Record<Gait, string> = { idle: 'Parado', walk: 'Andando', run: 'Correndo' };

export class TrackGame {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 120);
  private readonly runner = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private readonly arms: THREE.Group[] = [];
  private readonly hurdles: Hurdle[] = [];
  private readonly loop: GameLoop;
  private readonly hudTimer: number;
  private lane = 0;
  /** Speed asked for by the player and who set it; `shownSpeed` eases toward it. */
  private pace: Pace = { owner: 'camera', speed01: 0, cadenceSpm: 0 };
  private shownSpeed = 0;
  private gait: Gait = 'idle';
  private stridePhase = 0;
  private readonly score = new TrackScore();
  private readonly hurdleFlow = new HurdleFlow();
  private jumpTime = 0;
  private lastHud = '';
  private status = 'Ande ou corra no lugar com a câmera, ou use ↓';

  constructor(canvas: HTMLCanvasElement, private readonly onHud: (state: GameHudState) => void) {
    this.scene.background = new THREE.Color(0x223038);
    this.scene.fog = new THREE.Fog(0x223038, 25, 75);
    this.camera.position.set(0, 3.4, 11);
    this.camera.lookAt(0, 1.5, -8);
    this.setupScene();
    this.loop = new GameLoop(canvas, this.scene, this.camera, (dt) => this.update(dt));
    this.hudTimer = window.setInterval(() => this.publishHud(), 200);
  }

  private setupScene(): void {
    this.scene.add(new THREE.HemisphereLight(0xbad8e6, 0x253038, 2.1));
    const sun = new THREE.DirectionalLight(0xfff1d0, 3);
    sun.position.set(-5, 10, 6); this.scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 100), new THREE.MeshBasicMaterial({ color: 0x263235 }));
    ground.rotation.x = -Math.PI / 2; ground.position.z = -30; this.scene.add(ground);
    const track = new THREE.Mesh(new THREE.PlaneGeometry(9, 90), new THREE.MeshBasicMaterial({ color: 0x454e50 }));
    track.rotation.x = -Math.PI / 2; track.position.set(0, 0.02, -32); this.scene.add(track);
    const stripeGeo = new THREE.BoxGeometry(0.035, 0.01, 90);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf4b544 });
    for (const x of [-3, 0, 3]) { const line = new THREE.Mesh(stripeGeo, stripeMat); line.position.set(x, 0.035, -32); this.scene.add(line); }
    for (let i = 0; i < 12; i += 1) {
      const h = 2 + (i % 3) * 1.2;
      const building = new THREE.Mesh(new THREE.BoxGeometry(2 + (i % 2), h, 2), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x27373b : 0x202c30, flatShading: true }));
      building.position.set(i % 2 ? -7 : 7, h / 2, -6 - i * 5); this.scene.add(building);
    }
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.85, 4, 8), new THREE.MeshStandardMaterial({ color: 0xeff0e9, roughness: 0.72, flatShading: true }));
    torso.position.y = 1.22; this.runner.add(torso);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), new THREE.MeshStandardMaterial({ color: 0xe8b896, flatShading: true }));
    head.position.y = 2.08; this.runner.add(head);
    const trousers = new THREE.MeshStandardMaterial({ color: 0x34434a, flatShading: true });
    const shoes = new THREE.MeshStandardMaterial({ color: 0xf7a942, flatShading: true });
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * 0.16, 0.82, 0);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.48, 3, 5), trousers); thigh.position.y = -0.25; leg.add(thigh);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.12, 0.38), shoes); foot.position.set(0, -0.58, -0.06); leg.add(foot);
      this.runner.add(leg); this.legs.push(leg);
      const arm = new THREE.Group(); arm.position.set(side * 0.4, 1.63, 0);
      const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.4, 3, 5), trousers); upperArm.position.y = -0.23; arm.add(upperArm);
      arm.rotation.z = side * -0.12; this.runner.add(arm); this.arms.push(arm);
    }
    this.runner.position.set(0, 0, RUNNER_Z); this.scene.add(this.runner);
    this.addHurdle(-1, -30);
    this.addHurdle(1, -48);
  }

  private addHurdle(lane: number, z: number): void {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xf7a942, emissive: 0x65340b, emissiveIntensity: 0.45, flatShading: true });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.13, 0.18), mat); bar.position.y = 0.9; group.add(bar);
    for (const side of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.9, 0.12), mat); leg.position.set(side * 0.95, 0.43, 0); group.add(leg); }
    group.position.set(lane * 1.5, 0, z); this.scene.add(group); this.hurdles.push({ group, lane, z, passed: false });
  }

  onAction(event: SportActionEvent): void {
    if (event.type === 'step') this.pace = applyStep(this.pace);
    if (event.type === 'sprint') this.pace = applySprint(this.pace, event);
    if (event.type === 'jump') { this.jumpTime = 0.72; this.status = 'Salto!'; }
    if (event.type === 'lane') { this.lane = Math.max(-1, Math.min(1, this.lane + (event.direction === 'left' ? -1 : 1))); }
  }

  onKey(key: string): void {
    if (key === 'ArrowLeft' || key.toLowerCase() === 'a') this.lane = Math.max(-1, this.lane - 1);
    if (key === 'ArrowRight' || key.toLowerCase() === 'd') this.lane = Math.min(1, this.lane + 1);
    if (key === ' ' || key === 'ArrowUp' || key.toLowerCase() === 'w') this.jumpTime = 0.72;
    if (key === 'ArrowDown' || key.toLowerCase() === 's') {
      // Keyboard cycles stopped → walking → running and keeps the pick until the player steps on camera.
      this.pace = { owner: 'keyboard', speed01: nextPace(this.pace.speed01), cadenceSpm: 0 };
    }
  }

  private update(dt: number): void {
    this.shownSpeed += (this.pace.speed01 - this.shownSpeed) * Math.min(1, dt * 6);
    if (this.pace.speed01 === 0 && this.shownSpeed < 0.02) this.shownSpeed = 0;
    const speed = this.shownSpeed;
    const gait = gaitFor(speed, this.gait);
    if (gait !== this.gait) this.status = GAIT_STATUS[gait];
    this.gait = gait;

    this.score.advance(dt, speed);
    this.runner.position.x += (this.lane * 1.5 - this.runner.position.x) * Math.min(1, dt * 10);
    // One leg swing per step: follow the player's cadence, or estimate it from speed for the keyboard.
    if (gait !== 'idle') this.stridePhase += dt * Math.PI * (this.pace.cadenceSpm || 70 + speed * 130) / 60;
    const swing = gait === 'idle' ? 0 : gait === 'walk' ? 0.4 : 0.95;
    const stride = Math.sin(this.stridePhase) * swing;
    this.legs[0]!.rotation.x = stride; this.legs[1]!.rotation.x = -stride;
    this.arms[0]!.rotation.x = -stride * (gait === 'run' ? 1.1 : 0.65); this.arms[1]!.rotation.x = -this.arms[0]!.rotation.x;
    this.runner.rotation.x = gait === 'run' ? -0.16 : 0;
    if (this.jumpTime > 0) {
      this.jumpTime = Math.max(0, this.jumpTime - dt);
      this.runner.position.y = Math.sin((1 - this.jumpTime / 0.72) * Math.PI) * 1.35;
      if (this.jumpTime === 0) this.status = GAIT_STATUS[gait];
    } else this.runner.position.y = gait === 'run' ? Math.abs(Math.sin(this.stridePhase)) * 0.14 : 0;
    const advance = dt * speed * 22;
    const airborne = this.jumpTime > 0.15 || this.runner.position.y > 0.45;
    const flow = this.hurdleFlow.advance(this.hurdles, advance, this.lane, airborne);
    for (const { cleared } of flow.judged) {
      if (cleared) this.score.hurdleCleared();
      else this.score.hurdleHit();
    }
    for (const old of flow.despawned) {
      this.hurdles.splice(this.hurdles.indexOf(old), 1);
      this.scene.remove(old.group);
      disposeObjectTree(old.group);
    }
    for (const hurdle of this.hurdles) hurdle.group.position.z = hurdle.z;
    if (flow.spawn) this.addHurdle(Math.round(Math.random() * 2) - 1, -48 - Math.random() * 5);
  }

  private publishHud(): void {
    const score = this.score.display;
    const label = String(score).padStart(5, '0');
    const key = `${label}-${this.shownSpeed.toFixed(2)}-${this.status}`;
    if (key === this.lastHud) return;
    this.lastHud = key;
    this.onHud({ score, label, speed01: this.shownSpeed, status: this.status });
  }

  dispose(): void { window.clearInterval(this.hudTimer); this.loop.dispose(); }
}
