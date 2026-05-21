// コレクトモード: 時間制限内にレール上のランダムな「光」をできるだけ多く集める。
//
// 純粋データ + 純粋関数のみ。Three.js 非依存。

import { lerp3, type Vec3 } from "./vec.js";
import type { RailId, World } from "./world.js";

export type Light = Readonly<{
  id: string;
  railId: RailId;
  t: number;
  position: Vec3; // 3D 位置（railId と t から算出してキャッシュ）
}>;

export type CollectState = Readonly<{
  score: number;
  timeLeft: number; // 残り秒
  lights: ReadonlyArray<Light>;
  nextLightId: number;
}>;

export const MAX_LIGHTS = 5;
const COLLECT_RADIUS = 0.7;

const pickRailT = (
  world: World,
  rng: () => number,
): { railId: RailId; t: number; position: Vec3 } => {
  const railIds = [...world.rails.keys()];
  const railId = railIds[Math.floor(rng() * railIds.length)]!;
  // 端を含めて完全に均等分布。
  const t = rng();
  const rail = world.rails.get(railId)!;
  const a = world.nodes.get(rail.from)!.position;
  const b = world.nodes.get(rail.to)!.position;
  return { railId, t, position: lerp3(a, b, t) };
};

// 不足分を満たすまで光を生成（破壊的）。
const fillLights = (
  state: { score: number; timeLeft: number; lights: Light[]; nextLightId: number },
  world: World,
  rng: () => number,
): void => {
  while (state.lights.length < MAX_LIGHTS) {
    const { railId, t, position } = pickRailT(world, rng);
    state.lights.push({
      id: `L${state.nextLightId++}`,
      railId,
      t,
      position,
    });
  }
};

export const initCollect = (
  world: World,
  timeLimit: number,
  rng: () => number = Math.random,
): CollectState => {
  const mutable = {
    score: 0,
    timeLeft: timeLimit,
    lights: [] as Light[],
    nextLightId: 0,
  };
  fillLights(mutable, world, rng);
  return mutable;
};

export const stepCollect = (
  prev: CollectState,
  ballPos: Vec3,
  dt: number,
  world: World,
  rng: () => number = Math.random,
): { state: CollectState; collected: number } => {
  let collected = 0;
  let score = prev.score;
  const remaining: Light[] = [];
  for (const light of prev.lights) {
    const dx = light.position.x - ballPos.x;
    const dy = light.position.y - ballPos.y;
    const dz = light.position.z - ballPos.z;
    if (dx * dx + dy * dy + dz * dz < COLLECT_RADIUS * COLLECT_RADIUS) {
      collected++;
      score++;
    } else {
      remaining.push(light);
    }
  }
  const mutable = {
    score,
    timeLeft: Math.max(0, prev.timeLeft - dt),
    lights: remaining,
    nextLightId: prev.nextLightId,
  };
  fillLights(mutable, world, rng);
  return { state: mutable, collected };
};

export const isTimeUp = (state: CollectState): boolean => state.timeLeft <= 0;
