export interface HurdleBody { lane: number; z: number; passed: boolean }
export interface HurdleStep<T extends HurdleBody> { judged: { hurdle: T; cleared: boolean }[]; despawned: T[]; spawn: boolean }

/** The runner holds this depth; a hurdle is judged only once it crosses this plane. */
export const RUNNER_Z = 1.4;
const DESPAWN_Z = 8;
const SPAWN_DISTANCE = 26;

/**
 * Pure rules for the track's hurdles: they move with travelled distance, are judged a single
 * time when they cross the runner's plane, spawn every SPAWN_DISTANCE travelled and are
 * recycled once they are well behind the runner.
 */
export class HurdleFlow {
  private sinceSpawn = 0;

  /** Moves every hurdle `distance` toward the runner and reports what that step produced. */
  advance<T extends HurdleBody>(hurdles: T[], distance: number, runnerLane: number, airborne: boolean): HurdleStep<T> {
    const judged: HurdleStep<T>['judged'] = [];
    for (const hurdle of hurdles) {
      hurdle.z += distance;
      if (!hurdle.passed && hurdle.z > RUNNER_Z) {
        hurdle.passed = true;
        judged.push({ hurdle, cleared: hurdle.lane !== runnerLane || airborne });
      }
    }
    this.sinceSpawn += distance;
    const spawn = this.sinceSpawn > SPAWN_DISTANCE;
    if (spawn) this.sinceSpawn = 0;
    return { judged, despawned: hurdles.filter((hurdle) => hurdle.z > DESPAWN_Z), spawn };
  }
}
