// 線路上のボール運動（純粋関数）。
//
// ボールはレール R の上を 1 次元的に運動する。
// レール R は from→to のベクトル方向 d を持ち、ボールの「進行方向係数」
// dir ∈ {+1, -1} と speed (>=0) を持つ。
// 速度ベクトル v_world = dir * d * speed。
//
// 視覚的接続:
// 毎ステップ、ボールの screen 位置と他レールの screen セグメントとの
// 点-線距離を計算し、threshold 以下なら乗り換える。
// 移動中も静止中も同じロジックで判定できるため、停止後に視点を回して
// 「他レールに重ねる」ことで脱出できる。

import { basisOf, projectPoint, type View } from "./projection.js";
import {
  chooseContinuation,
  chooseDirectionForRail,
  findNearestRailScreen,
  type ContinuationResult,
  type MidrailMatch,
} from "./perspective.js";
import { dot3, length3, lerp3, scale3, sub3, sub2, type Vec3 } from "./vec.js";
import { railEnds, type RailId, type World } from "./world.js";

export type BallState = Readonly<{
  railId: RailId;
  t: number;
  dir: 1 | -1;
  speed: number;
  cooldown: number; // 乗り換え後の再判定抑止（秒）
}>;

export type StepResult = Readonly<{
  ball: BallState;
  events: ReadonlyArray<StepEvent>;
}>;

export type StepEvent =
  | { kind: "goal" }
  | { kind: "bounce"; atNodeId: string }
  | { kind: "transition"; via: ContinuationResult }
  | { kind: "midrail"; rail: RailId; via: MidrailMatch };

const BOUNCE_FACTOR = 0.65;
const MIN_BOUNCE_SPEED = 0.3;
// 乗り換え時に保証する最低速度（停止後の脱出で重要）。
const MIN_TRANSITION_SPEED = 0.6;
// 乗り換え後のクールダウン（秒）。これより前は再判定しない。
const TRANSITION_COOLDOWN = 0.3;
// 画面距離の閾値（screen unit, ortho 14 単位に対し 0.15 ≒ 1%）。
// 値が小さいほど「重なり判定」が厳しくなり、ワープしにくくなる。
const SCREEN_THRESHOLD = 0.15;

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

export const ballPosition = (world: World, ball: BallState): Vec3 => {
  const { from, to } = railEnds(world, ball.railId);
  return lerp3(from.position, to.position, ball.t);
};

export const stepBall = (
  world: World,
  ball: BallState,
  view: View,
  dt: number,
  options: { threshold?: number; friction?: number } = {},
): StepResult => {
  const friction = options.friction ?? 0;
  const threshold = options.threshold ?? SCREEN_THRESHOLD;

  // 重力は視点に追随する: 画面上の「下方向」(= -basis.up) が常に重力方向。
  // 視点を回すと、固定の world Y 軸ではなく screen 基準で gravity が変わる。
  const gMag = length3(world.gravity);
  const basis = basisOf(view);
  const effectiveGravity: Vec3 = scale3(basis.up, -gMag);

  const dirVec = railDirection(world, ball.railId);
  const aAlong = dot3(effectiveGravity, dirVec);

  const signedVelocity0 = ball.speed * ball.dir;
  let signedVelocity = signedVelocity0 + aAlong * dt;
  signedVelocity *= 1 - friction * dt;

  const len = railLength(world, ball.railId);
  if (len < 1e-9) return { ball, events: [] };

  const newT = ball.t + (signedVelocity * dt) / len;
  const newDir: 1 | -1 = signedVelocity >= 0 ? 1 : -1;
  const speed = Math.abs(signedVelocity);
  const newCooldown = Math.max(0, ball.cooldown - dt);

  const events: StepEvent[] = [];

  // --- 視覚的接続（点-線距離による）---
  // クールダウン中は判定をスキップ。
  if (newCooldown <= 0) {
    const railEndsCur = railEnds(world, ball.railId);
    const tClamped = newT > 1 ? 1 : newT < 0 ? 0 : newT;
    const p0 = lerp3(railEndsCur.from.position, railEndsCur.to.position, ball.t);
    const p1 = lerp3(railEndsCur.from.position, railEndsCur.to.position, tClamped);
    const sBallOld = projectPoint(p0, view);
    const sBallNew = projectPoint(p1, view);
    const screenVel = sub2(sBallNew, sBallOld);
    const match = findNearestRailScreen(world, ball.railId, sBallNew, screenVel, view, threshold);
    if (match !== null) {
      const dir = chooseDirectionForRail(world, match.rail, screenVel, view, effectiveGravity);
      const nextSpeed = Math.max(speed, MIN_TRANSITION_SPEED);
      const nextBall: BallState = {
        railId: match.rail,
        t: match.v,
        dir,
        speed: nextSpeed,
        cooldown: TRANSITION_COOLDOWN,
      };
      events.push({ kind: "midrail", rail: match.rail, via: match });
      return { ball: nextBall, events };
    }
  }

  // --- 端点処理 ---
  // 境界を「外向きに」越えた場合のみ処理する。静止中は何もしない。
  const exitedFromEnd = newT >= 1 && signedVelocity > 0;
  const exitedFromStart = newT <= 0 && signedVelocity < 0;
  if (exitedFromEnd || exitedFromStart) {
    const atEndT = exitedFromEnd ? 1 : 0;
    const rail = world.rails.get(ball.railId)!;
    const atNodeId = atEndT === 1 ? rail.to : rail.from;

    // ゴール到達 — 通知のみ。ボールは止めず、通常の端点処理へ。
    if (atNodeId === world.goalNodeId) {
      events.push({ kind: "goal" });
    }

    // 同一ノード分岐があれば進む。なければ跳ね返る。
    const incomingDir = scale3(dirVec, newDir);
    const cont = chooseContinuation(world, atNodeId, ball.railId, incomingDir);
    if (cont.kind === "deadend") {
      events.push({ kind: "bounce", atNodeId });
      const bouncedDir = -newDir as 1 | -1;
      const bouncedSpeed = Math.max(speed * BOUNCE_FACTOR, MIN_BOUNCE_SPEED);
      return {
        ball: {
          railId: ball.railId,
          t: atEndT,
          dir: bouncedDir,
          speed: bouncedSpeed,
          cooldown: newCooldown,
        },
        events,
      };
    }

    events.push({ kind: "transition", via: cont });
    const nextRail = world.rails.get(cont.rail)!;
    const startsAtFrom = nextRail.from === atNodeId;
    const nextT = startsAtFrom ? 0 : 1;
    const nextDir: 1 | -1 = startsAtFrom ? 1 : -1;
    return {
      ball: {
        railId: cont.rail,
        t: nextT,
        dir: nextDir,
        speed,
        cooldown: TRANSITION_COOLDOWN,
      },
      events,
    };
  }

  return {
    ball: {
      railId: ball.railId,
      t: newT,
      dir: newDir,
      speed,
      cooldown: newCooldown,
    },
    events,
  };
};

export const makeInitialBall = (world: World): BallState => ({
  railId: world.startRailId,
  t: world.startT,
  dir: world.startDirection,
  speed: 0,
  // 開始直後に近傍レールへ即ワープしないようウォームアップ猶予を与える。
  cooldown: TRANSITION_COOLDOWN,
});
