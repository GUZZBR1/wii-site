import * as THREE from 'three';
import type { AimZone, SportActionEvent } from '../../cv/protocol';
import { GameLoop } from '../core/GameLoop';
import type { GameHudState } from '../track/TrackGame';

export class TennisGame {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
  private readonly ball = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8ff54, emissive: 0x4d7020, emissiveIntensity: 0.4 }));
  private readonly opponent: THREE.Mesh;
  private readonly loop: GameLoop;
  private readonly hudTimer: number;
  private score = 0;
  private ballVelocity = new THREE.Vector3(0, 0, 0);
  private activeRally = false;
  private aim: AimZone = 'center';
  private status = 'Dê uma raquetada para iniciar';
  private lastHud = '';

  constructor(canvas: HTMLCanvasElement, private readonly onHud: (state: GameHudState) => void) {
    this.scene.background = new THREE.Color(0x17251d);
    this.scene.fog = new THREE.Fog(0x17251d, 22, 55);
    this.camera.position.set(0, 8, 15); this.camera.lookAt(0, 0, -1);
    this.scene.add(new THREE.HemisphereLight(0xe3f4d5, 0x1a2c1e, 2));
    const light = new THREE.DirectionalLight(0xffefc4, 3); light.position.set(-5, 9, 8); this.scene.add(light);
    const court = new THREE.Mesh(new THREE.PlaneGeometry(12, 22), new THREE.MeshStandardMaterial({ color: 0x246c55, roughness: 0.8 }));
    court.rotation.x = -Math.PI / 2; court.position.z = -2; this.scene.add(court);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8ebd7 });
    const addLine = (w: number, h: number, x: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, h), lineMat); m.position.set(x, 0.025, z); this.scene.add(m); };
    addLine(11.5, 0.06, 0, -12); addLine(11.5, 0.06, 0, 8); addLine(0.06, 20, -5.7, -2); addLine(0.06, 20, 5.7, -2); addLine(11.5, 0.06, 0, -2);
    const net = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.75, 0.12), new THREE.MeshStandardMaterial({ color: 0xdce4d7, roughness: 0.9 })); net.position.set(0, 0.42, -2); this.scene.add(net);
    const player = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1, 4, 8), new THREE.MeshStandardMaterial({ color: 0xf3a844, flatShading: true })); player.position.set(0, 0.8, 6); this.scene.add(player);
    this.opponent = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.9, 4, 8), new THREE.MeshStandardMaterial({ color: 0xe9eee5, flatShading: true })); this.opponent.position.set(0, 0.75, -10); this.scene.add(this.opponent);
    this.ball.position.set(0, 1.25, 5.1); this.scene.add(this.ball);
    this.loop = new GameLoop(canvas, this.scene, this.camera, (dt) => this.update(dt));
    this.hudTimer = window.setInterval(() => this.publishHud(), 200);
  }

  onAction(event: SportActionEvent): void {
    if (event.type !== 'swing') return;
    const zones: Record<string, number> = { cross: -3.5, center: 0, line: 3.5 };
    const x = zones[event.aimZone];
    this.aim = event.aimZone;
    const aimLabel = this.aim === 'cross' ? 'CRUZADA' : this.aim === 'line' ? 'PARALELA' : 'CENTRO';
    this.ball.position.set(0, 1.25 + event.power01 * 0.7, 5.1);
    this.ballVelocity.set(x * 0.48, 1.2 + event.power01 * 2.2, -15 - event.power01 * 10);
    this.activeRally = true;
    this.status = `${event.side === 'forehand' ? 'FOREHAND' : 'BACKHAND'} · ${aimLabel}`;
  }

  onKey(key: string): void {
    if (key === ' ' || key === 'ArrowUp' || key.toLowerCase() === 'w') {
      this.onAction({ id: Date.now(), timestampMs: performance.now(), confidence: 1, trackingState: 'tracked', source: 'keyboard', type: 'swing', side: 'forehand', power01: 0.6, aimZone: this.aim });
    }
    if (key === 'ArrowLeft' || key.toLowerCase() === 'a') { this.aim = 'cross'; this.status = 'Mira · CRUZADA'; }
    if (key === 'ArrowRight' || key.toLowerCase() === 'd') { this.aim = 'line'; this.status = 'Mira · PARALELA'; }
  }

  private update(dt: number): void {
    if (!this.activeRally) { this.ball.position.y = 1.2 + Math.sin(performance.now() / 480) * 0.08; return; }
    this.ballVelocity.y -= 9.8 * dt;
    this.ball.position.addScaledVector(this.ballVelocity, dt);
    this.opponent.position.x += (THREE.MathUtils.clamp(this.ball.position.x, -4.4, 4.4) - this.opponent.position.x) * dt * 1.3;
    if (this.ball.position.y < 0.15 || Math.abs(this.ball.position.x) > 6 || this.ball.position.z < -13) {
      const pointWon = this.ball.position.y > 0.12 && Math.abs(this.ball.position.x) <= 5.7;
      if (pointWon) this.score += 1;
      this.activeRally = false;
      this.status = pointWon ? 'PONTO! Pronto para outra' : 'Fora! Tente novamente';
      this.ball.position.set(0, 1.2, 5.1); this.ballVelocity.set(0, 0, 0);
    }
  }

  private publishHud(): void {
    const label = String(this.score).padStart(2, '0');
    const key = `${label}-${this.status}`;
    if (key === this.lastHud) return;
    this.lastHud = key;
    this.onHud({ score: this.score, label, speed01: 0, status: this.status });
  }

  dispose(): void { window.clearInterval(this.hudTimer); this.loop.dispose(); }
}
