import type { Point3 } from '../cv/protocol';

export const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));
export const midpoint = (a: Point3, b: Point3): Point3 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
export const distance2 = (a: Point3, b: Point3): number => Math.hypot(a.x - b.x, a.y - b.y);
export const distance3 = (a: Point3, b: Point3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const median = (values: readonly number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

export function landmarkConfidence(...points: Point3[]): number {
  if (!points.length) return 0;
  return Math.min(...points.map((point) => {
    const visibility = point.visibility ?? point.presence ?? 0;
    const presence = point.presence ?? point.visibility ?? 0;
    return Math.min(visibility, presence);
  }));
}
