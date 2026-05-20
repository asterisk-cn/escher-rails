// 線路上のボール運動（純粋関数）。
//
// ボールはレール R の上を 1 次元的に運動する。
// レール R は from→to のベクトル方向 d を持ち、ボールの「進行方向係数」
// dir ∈ {+1, -1} と speed (>=0) を持つ。
// 速度ベクトル v_world = dir * d * speed。
//
// レール沿いの重力加速度 a_along = (gravity · d̂) * dir
//   ※ ボールが +d 方向に進んでいる（dir=+1）ときに重力 g が +d 方向を向いていれば加速、
//     逆向きなら減速。dir=-1 のときは符号反転。
//
// 端点に到達したら呼び出し側で continuation 解決を行う。

import type { View } from "./projection.js";
import { chooseContinuation, type ContinuationResult } from "./perspective.js";
import { add3, dot3, length3, lerp3, scale3, sub3, type Vec3 } from "./vec.js";
import { railEnds, type RailId, type World } from "./world.js";

export type BallState = Readonly<{
  railId: RailId;
  t: number; // 現在位置 in [0, 1]
  dir: 1 | -1; // 進行方向: +1 = from→to に向かう, -1 = 逆
  speed: number; // >= 0
}>;

export type StepResult = Readonly<{
  ball: BallState;
  events: ReadonlyArray<StepEvent>;
}>;

export type StepEvent =
  | { kind: "goal" }
  | { kind: "deadend"; atNodeId: string }
  | { kind: "transition"; via: ContinuationResult };

// レール沿い単位方向ベクトル
export const railDirection = (world: World, railId: RailId): Vec3 => {
  const { from, to } = railEnds(world, railId);
  const d = sub3(to.position, from.position);
  const len = length3(d);
  if (len < 1e-9) return { x: 0, y: 0, z: 0 };
  return scale3(d, 1 / len);
};

export const railLength = (world: World, railId: RailId): number => {
  const { from, to } = railEnds(world, railId);
  return length3(sub3(to.position, from.position));
};

// 現在のワールド座標
export const ballPosition = (world: World, ball: BallState): Vec3 => {
  const { from, to } = railEnds(world, ball.railId);
  return lerp3(from.position, to.position, ball.t);
};

// 物理 1 ステップ（半陰的 Euler）。
// dt 秒進める。視点 view は接続解決に必要（端点到達時のみ参照される）。
export const stepBall = (
  world: World,
  ball: BallState,
  view: View,
  dt: number,
  options: { threshold?: number; minSpeed?: number; friction?: number } = {},
): StepResult => {
  const friction = options.friction ?? 0.02; // 軽い減衰（最終的に止まれる）

  const dirVec = railDirection(world, ball.railId);
  // レール沿いの「符号付き速度」を使う。+1 方向（from→to）を正とする。
  // gravity をレール方向に投影した成分が、from→to 方向への加速度。
  const aAlong = dot3(world.gravity, dirVec);

  const signedVelocity0 = ball.speed * ball.dir;
  let signedVelocity = signedVelocity0 + aAlong * dt;
  signedVelocity *= 1 - friction * dt;

  const len = railLength(world, ball.railId);
  if (len < 1e-9) return { ball, events: [] };

  let newT = ball.t + (signedVelocity * dt) / len;
  let newDir: 1 | -1 = signedVelocity >= 0 ? 1 : -1;
  let speed = Math.abs(signedVelocity);

  // 端点に到達したかチェック
  const events: StepEvent[] = [];
  if (newT >= 1 || newT <= 0) {
    const atEndT = newT >= 1 ? 1 : 0;
    const rail = world.rails.get(ball.railId)!;
    const atNodeId = atEndT === 1 ? rail.to : rail.from;

    // ゴール判定
    if (atNodeId === world.goalNodeId) {
      return {
        ball: { railId: ball.railId, t: atEndT, dir: newDir, speed: 0 },
        events: [{ kind: "goal" }],
      };
    }

    // 次のレールを探す
    const incomingDir = scale3(dirVec, newDir);
    const cont = chooseContinuation(world, atNodeId, ball.railId, incomingDir, view, options.threshold);
    if (cont.kind === "deadend") {
      events.push({ kind: "deadend", atNodeId });
      return {
        ball: { railId: ball.railId, t: atEndT, dir: newDir, speed: 0 },
        events,
      };
    }

    events.push({ kind: "transition", via: cont });

    // 新レールに乗り換え。乗り換え先での t と dir を決定。
    const nextRail = world.rails.get(cont.rail)!;
    const startNodeOfNext = cont.kind === "perspective" ? cont.nextNode : atNodeId;
    // 新レールの from が startNode なら t=0 開始 (dir=+1)、to なら t=1 (dir=-1)
    const startsAtFrom = nextRail.from === startNodeOfNext;
    const nextT = startsAtFrom ? 0 : 1;
    const nextDir: 1 | -1 = startsAtFrom ? 1 : -1;

    // 視点接続の場合は speed をそのまま継承（同じ視覚的方向に進むため）。
    // 通常分岐の場合も speed を継承（ただし新レール沿いの方向にリマップ）。
    return {
      ball: { railId: cont.rail, t: nextT, dir: nextDir, speed },
      events,
    };
  }

  return {
    ball: { railId: ball.railId, t: newT, dir: newDir, speed },
    events,
  };
};

export const makeInitialBall = (world: World): BallState => ({
  railId: world.startRailId,
  t: world.startT,
  dir: world.startDirection,
  speed: 0,
});
