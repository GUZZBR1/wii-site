const COUNTDOWN_S = 3;

export type RunPhase = 'countdown' | 'running' | 'paused';

/**
 * Decides whether the run may progress. Owned and written by TrackGame only: camera tracking and
 * key presses come in as calls, time comes in from the fixed-step loop.
 *
 * Losing the camera pauses only a player the camera has actually seen, so keyboard-only runs never
 * pause. A key press while paused gives up on the camera until it tracks again.
 */
export class RunGate {
  private current: RunPhase = 'countdown';
  private remaining = COUNTDOWN_S;
  private cameraSeen = false;

  get phase(): RunPhase {
    return this.current;
  }

  /** Whole seconds left to show during the countdown. */
  get count(): number {
    return Math.ceil(this.remaining);
  }

  /** `tracking` is the app's camera label; 'PROCURANDO' is a transient that changes nothing. */
  setTracking(tracking: string): void {
    if (tracking === 'TRACKING') {
      this.cameraSeen = true;
      if (this.current === 'paused') this.restart();
    } else if (tracking === 'SEM POSE' && this.cameraSeen) {
      this.current = 'paused';
    }
  }

  /** Returns true when the press was consumed to leave the pause. */
  resumeByKey(): boolean {
    if (this.current !== 'paused') return false;
    this.cameraSeen = false;
    this.restart();
    return true;
  }

  advance(dt: number): void {
    if (this.current !== 'countdown') return;
    this.remaining -= dt;
    // Tolerance for the accumulated error of fixed steps.
    if (this.remaining <= 1e-9) this.current = 'running';
  }

  private restart(): void {
    this.current = 'countdown';
    this.remaining = COUNTDOWN_S;
  }
}
