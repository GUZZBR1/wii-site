export class TrackScore {
  private value = 0;

  advance(dt: number, speed01: number): void {
    if (!Number.isFinite(speed01)) return;
    this.value += dt * speed01 * 50;
  }

  hurdleCleared(): void {
    this.value += 100;
  }

  hurdleHit(): void {
    this.value = Math.max(0, this.value - 35);
  }

  get display(): number {
    return Math.floor(this.value);
  }
}
