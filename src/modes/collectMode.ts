// コレクトモードのコントローラ。
// 制限時間内にレール上の光を集める。スコア＆タイマー駆動。

import { initCollect, isTimeUp, stepCollect, type CollectState } from "../game/collect.js";
import { collectMaps } from "../game/collectMaps.js";
import { ballPosition, makeInitialBall, stepBall, type BallState } from "../game/physics.js";
import type { View } from "../game/projection.js";
import { buildWorld, type World } from "../game/world.js";
import { placeBall, populateWorld, updateLights, type SceneRefs } from "../render/scene.js";

export type CollectInfo = Readonly<{
  mapIndex: number;
  total: number;
  name: string;
  hint: string;
  score: number;
  timeLeft: number;
  timeLimit: number;
  timeUp: boolean;
}>;

export type CollectStepResult = Readonly<{
  justTimeUp: boolean;
  collected: number;
}>;

export type CollectMode = Readonly<{
  type: "collect";
  info: () => CollectInfo;
  step: (view: View, dt: number) => CollectStepResult;
  next: () => void;
  prev: () => void;
  restart: () => void;
  ballPosition: () => ReturnType<typeof ballPosition>;
}>;

export const createCollectMode = (refs: SceneRefs): CollectMode => {
  let mapIndex = 0;
  let world: World;
  let ball: BallState;
  let collect: CollectState;
  let timeUp = false;

  const load = (idx: number) => {
    mapIndex = idx;
    const m = collectMaps[idx]!;
    world = buildWorld(m.generate()); // 毎ロードでランダム生成
    populateWorld(refs, world);
    refs.goalMesh.visible = false; // collect ではゴール球を出さない
    ball = makeInitialBall(world);
    placeBall(refs, world, ball);
    collect = initCollect(world, m.timeLimit);
    updateLights(refs, collect.lights);
    timeUp = false;
  };

  load(0);

  return {
    type: "collect",
    info: () => ({
      mapIndex,
      total: collectMaps.length,
      name: collectMaps[mapIndex]!.name,
      hint: collectMaps[mapIndex]!.hint,
      score: collect.score,
      timeLeft: collect.timeLeft,
      timeLimit: collectMaps[mapIndex]!.timeLimit,
      timeUp,
    }),
    step: (view, dt) => {
      const r = stepBall(world, ball, view, dt);
      ball = r.ball;
      placeBall(refs, world, ball);

      let justTimeUp = false;
      let collected = 0;
      if (!timeUp) {
        const bp = ballPosition(world, ball);
        const cr = stepCollect(collect, bp, dt, world);
        collect = cr.state;
        collected = cr.collected;
        updateLights(refs, collect.lights);
        if (isTimeUp(collect)) {
          timeUp = true;
          justTimeUp = true;
        }
      }
      return { justTimeUp, collected };
    },
    next: () => load((mapIndex + 1) % collectMaps.length),
    prev: () => load((mapIndex - 1 + collectMaps.length) % collectMaps.length),
    restart: () => load(mapIndex),
    ballPosition: () => ballPosition(world, ball),
  };
};
