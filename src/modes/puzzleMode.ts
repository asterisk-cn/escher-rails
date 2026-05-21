// パズルモードのコントローラ。
// ゴールに到達することが目的。クリア後もボールは止めない。

import { ballPosition, makeInitialBall, stepBall, type BallState } from "../game/physics.js";
import type { View } from "../game/projection.js";
import { puzzleLevels } from "../game/puzzleLevels.js";
import { buildWorld, type World } from "../game/world.js";
import { clearLights, placeBall, populateWorld, type SceneRefs } from "../render/scene.js";

export type PuzzleInfo = Readonly<{
  stageIndex: number;
  total: number;
  name: string;
  hint: string;
  cleared: boolean;
  speed: number;
  railId: string;
  t: number;
}>;

export type PuzzleStepResult = Readonly<{
  justCleared: boolean;
}>;

export type PuzzleMode = Readonly<{
  type: "puzzle";
  info: () => PuzzleInfo;
  step: (view: View, dt: number) => PuzzleStepResult;
  next: () => void;
  prev: () => void;
  restart: () => void;
  ballPosition: () => ReturnType<typeof ballPosition>;
}>;

export const createPuzzleMode = (refs: SceneRefs): PuzzleMode => {
  let stageIndex = 0;
  let world: World;
  let ball: BallState;
  let cleared = false;

  const load = (idx: number) => {
    stageIndex = idx;
    const lv = puzzleLevels[idx]!;
    world = buildWorld(lv.spec);
    populateWorld(refs, world);
    refs.goalMesh.visible = true;
    clearLights(refs);
    ball = makeInitialBall(world);
    placeBall(refs, world, ball);
    cleared = false;
  };

  load(0);

  return {
    type: "puzzle",
    info: () => ({
      stageIndex,
      total: puzzleLevels.length,
      name: puzzleLevels[stageIndex]!.name,
      hint: puzzleLevels[stageIndex]!.hint,
      cleared,
      speed: ball.speed,
      railId: ball.railId,
      t: ball.t,
    }),
    step: (view, dt) => {
      const r = stepBall(world, ball, view, dt);
      ball = r.ball;
      placeBall(refs, world, ball);
      let justCleared = false;
      for (const ev of r.events) {
        if (ev.kind === "goal" && !cleared) {
          cleared = true;
          justCleared = true;
        }
      }
      return { justCleared };
    },
    next: () => load((stageIndex + 1) % puzzleLevels.length),
    prev: () => load((stageIndex - 1 + puzzleLevels.length) % puzzleLevels.length),
    restart: () => load(stageIndex),
    ballPosition: () => ballPosition(world, ball),
  };
};
