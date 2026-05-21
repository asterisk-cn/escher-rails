// 視点投影によるレール乗り換え。
//
// 現在の方式:
//  - レール上の任意点で、画面投影された別レールと screen 交差が起きたらその交点で乗り換える。
//    これを「中間視点リンク」と呼ぶ。
//  - 端点（共有ノード）では中間視点リンクが u=0 / v=0 で発火しないため、
//    同一ノードを共有する複数レール（Y 字分岐）の継続のみ chooseContinuation で処理する。

import { projectPoint, type View } from "./projection.js";
import { cross2, dot2, length2, pointSegmentDistance2D, sub2, v2, type Vec2 } from "./vec.js";
import { dot3, type Vec3 } from "./vec.js";
import type { NodeId, RailId, World } from "./world.js";

// 同じノードを共有する他のレール（Y 字分岐）への継続を選ぶ。
// 戦略: 進行方向に最も沿うレールを優先（行き止まりなら deadend）。
export type ContinuationResult = Readonly<
  | { kind: "continue"; rail: RailId; nextNode: NodeId }
  | { kind: "deadend" }
>;

export const chooseContinuation = (
  world: World,
  currentNodeId: NodeId,
  currentRailId: RailId,
  incomingDir: { x: number; y: number; z: number },
): ContinuationResult => {
  const adj = world.adjacency.get(currentNodeId) ?? [];
  const others = adj.filter((r) => r !== currentRailId);
  if (others.length === 0) return { kind: "deadend" };

  const here = world.nodes.get(currentNodeId)!.position;
  let best: RailId | null = null;
  let bestScore = -Infinity;
  for (const r of others) {
    const rail = world.rails.get(r)!;
    const otherNodeId = rail.from === currentNodeId ? rail.to : rail.from;
    const other = world.nodes.get(otherNodeId)!.position;
    const dx = other.x - here.x;
    const dy = other.y - here.y;
    const dz = other.z - here.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const dot = (dx * incomingDir.x + dy * incomingDir.y + dz * incomingDir.z) / len;
    if (dot > bestScore) {
      bestScore = dot;
      best = r;
    }
  }
  if (best == null) return { kind: "deadend" };
  const rail = world.rails.get(best)!;
  const nextNode = rail.from === currentNodeId ? rail.to : rail.from;
  return { kind: "continue", rail: best, nextNode };
};

// ------------------------------------------------------------------
// 中間視点リンク（mid-rail perspective link）
// レール端以外でも、画面上でレール線が交差した瞬間に乗り換えを発生させる。
// ------------------------------------------------------------------

// 2D セグメント (p1,p2) と (q1,q2) の交差。{ u, v } を返す（u は p, v は q 上のパラメータ）。
// 平行 / パラメータが範囲外なら null。
export const segmentIntersect2D = (
  p1: Vec2,
  p2: Vec2,
  q1: Vec2,
  q2: Vec2,
  epsilon: number = 1e-9,
): { u: number; v: number } | null => {
  const r = sub2(p2, p1);
  const s = sub2(q2, q1);
  const denom = cross2(r, s);
  if (Math.abs(denom) < epsilon) return null;
  const qp = sub2(q1, p1);
  const u = cross2(qp, s) / denom;
  const v = cross2(qp, r) / denom;
  if (u < -epsilon || u > 1 + epsilon) return null;
  if (v < -epsilon || v > 1 + epsilon) return null;
  return { u: clamp01(u), v: clamp01(v) };
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export type MidrailMatch = Readonly<{
  rail: RailId;
  v: number; // 乗り換え先レール上の最近点 t [0, 1]
  screenDist: number; // 画面距離
}>;

// ボールの screen 位置 p と他レール screen 線との点-線距離を計算し、
// threshold 以下のものを返す。最近距離のレールを優先。
//
// screenVelocity が十分大きい（動いている）場合は「ボールがそのレールから
// 遠ざかる方向に動いていたら拒否」のフィルタも適用する。
// これで Y 字分岐で乗り換えた直後に元レールへ逆戻りするのを防ぐ。
//
// 静止中（screenVelocity≒0）はフィルタを適用しないので、視点回転で重ねる
// だけで接続が発火し、ボールは新レールへ脱出できる。
export const findNearestRailScreen = (
  world: World,
  excludeRailId: RailId,
  screenPos: Vec2,
  screenVelocity: Vec2,
  view: View,
  threshold: number,
): MidrailMatch | null => {
  const velMag = length2(screenVelocity);
  // 真の停止（数値誤差を除く）かどうかでフィルタの有無を切り替える。
  const useVelFilter = velMag > 1e-6;
  let best: MidrailMatch | null = null;
  for (const [railId, rail] of world.rails) {
    if (railId === excludeRailId) continue;
    const a = world.nodes.get(rail.from)!.position;
    const b = world.nodes.get(rail.to)!.position;
    const sA = projectPoint(a, view);
    const sB = projectPoint(b, view);
    const { dist, t } = pointSegmentDistance2D(screenPos, sA, sB);
    if (dist > threshold) continue;
    if (useVelFilter) {
      const closest = v2(sA.x + t * (sB.x - sA.x), sA.y + t * (sB.y - sA.y));
      const offset = sub2(screenPos, closest);
      // offset · vel > 0 はボールが対象レールから「遠ざかる」方向に動いている
      if (dot2(offset, screenVelocity) > 0) continue;
    }
    if (best === null || dist < best.screenDist) {
      best = { rail: railId, v: t, screenDist: dist };
    }
  }
  return best;
};

// 乗り換え先での進行方向を決定する。
// - screen velocity に十分な大きさがあれば、それに沿う向き（視覚的連続性を優先）。
// - 静止状態（screen velocity が小さい）なら、レール沿い重力成分が下る向きを選ぶ。
//   これで「停止中に視点を回して新レールに乗り換えたとき、自然に下り始める」。
export const chooseDirectionForRail = (
  world: World,
  railId: RailId,
  screenVelocity: Vec2,
  view: View,
  gravity: Vec3,
): 1 | -1 => {
  const rail = world.rails.get(railId)!;
  const a = world.nodes.get(rail.from)!.position;
  const b = world.nodes.get(rail.to)!.position;

  if (length2(screenVelocity) > 1e-3) {
    const sA = projectPoint(a, view);
    const sB = projectPoint(b, view);
    return dot2(screenVelocity, sub2(sB, sA)) >= 0 ? 1 : -1;
  }

  // 重力フォールバック
  const railDir: Vec3 = {
    x: b.x - a.x,
    y: b.y - a.y,
    z: b.z - a.z,
  };
  const g = dot3(gravity, railDir);
  if (g > 0) return 1; // gravity が from→to 向き
  if (g < 0) return -1;
  return 1; // 水平 — 任意
};
