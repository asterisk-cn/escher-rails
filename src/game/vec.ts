// 3D / 2D ベクトル演算（純粋関数）
// Three.js の Vector3 に依存しない。レンダラから独立してテスト可能にする。

export type Vec3 = Readonly<{ x: number; y: number; z: number }>;
export type Vec2 = Readonly<{ x: number; y: number }>;

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const v2 = (x: number, y: number): Vec2 => ({ x, y });

export const add3 = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub3 = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale3 = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
export const dot3 = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const length3 = (a: Vec3): number => Math.sqrt(dot3(a, a));
export const normalize3 = (a: Vec3): Vec3 => {
  const l = length3(a);
  return l < 1e-12 ? v3(0, 0, 0) : scale3(a, 1 / l);
};
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 =>
  v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);

export const sub2 = (a: Vec2, b: Vec2): Vec2 => v2(a.x - b.x, a.y - b.y);
export const length2 = (a: Vec2): number => Math.sqrt(a.x * a.x + a.y * a.y);
export const dist2 = (a: Vec2, b: Vec2): number => length2(sub2(a, b));
