export class ProceduralAudio {
  private context?: AudioContext;
  private muted = false;

  async unlock(): Promise<void> {
    try {
      if (!this.context) this.context = new AudioContext();
      if (this.context.state === 'suspended') await this.context.resume();
    } catch {
      this.context = undefined;
    }
  }

  setMuted(muted: boolean): void { this.muted = muted; }

  hit(power = 0.5): void {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const amount = Math.max(0, Math.min(1, power));
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180 + amount * 130, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18 + amount * 0.2, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain).connect(this.context.destination);
    osc.start(now); osc.stop(now + 0.17);
  }

  jump(): void { this.hit(0.25); }

  step(side: 'left' | 'right'): void {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(side === 'left' ? 92 : 82, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.07);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(gain).connect(this.context.destination);
    osc.start(now); osc.stop(now + 0.1);
  }

  dispose(): void { void this.context?.close(); this.context = undefined; }
}
