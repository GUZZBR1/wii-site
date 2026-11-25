export class SchmittTrigger {
  private active = false;
  private lastFire = Number.NEGATIVE_INFINITY;

  constructor(private readonly onThreshold: number, private readonly offThreshold: number, private readonly cooldownMs = 0) {
    if (offThreshold > onThreshold) throw new Error('Schmitt offThreshold must be <= onThreshold');
  }

  update(value: number, timestampMs: number): boolean {
    if (!this.active && value >= this.onThreshold && timestampMs - this.lastFire >= this.cooldownMs) {
      this.active = true;
      this.lastFire = timestampMs;
      return true;
    }
    if (this.active && value <= this.offThreshold) this.active = false;
    return false;
  }

  resetActive(): void { this.active = false; }

  reset(): void { this.active = false; this.lastFire = Number.NEGATIVE_INFINITY; }
  get isActive(): boolean { return this.active; }
}
