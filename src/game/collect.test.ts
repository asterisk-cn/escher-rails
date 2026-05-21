import { describe, expect, it } from "vitest";
import { initCollect, MAX_LIGHTS, stepCollect } from "./collect.js";
import { v3 } from "./vec.js";
import { buildWorld } from "./world.js";

// 決定論的 RNG (LCG) — テストで再現性を持たせる
const makeRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
};

const world = buildWorld({
  nodes: [
    { id: "A", position: v3(-5, 0, 0) },
    { id: "B", position: v3(5, 0, 0) },
    { id: "C", position: v3(0, -5, 0) },
    { id: "D", position: v3(0, 5, 0) },
  ],
  rails: [
    { id: "r1", from: "A", to: "B" },
    { id: "r2", from: "C", to: "D" },
  ],
  startRailId: "r1",
  goalNodeId: "B",
});

describe("collect mode", () => {
  it("初期化で MAX_LIGHTS 個の光が生成される", () => {
    const state = initCollect(world, 60, makeRng(1));
    expect(state.lights.length).toBe(MAX_LIGHTS);
    expect(state.score).toBe(0);
    expect(state.timeLeft).toBe(60);
  });

  it("光は全レール上の [0, 1] 範囲に置かれる（完全ランダム）", () => {
    const state = initCollect(world, 60, makeRng(7));
    for (const light of state.lights) {
      expect(world.rails.has(light.railId)).toBe(true);
      expect(light.t).toBeGreaterThanOrEqual(0);
      expect(light.t).toBeLessThanOrEqual(1);
    }
  });

  it("ボールが光の近くを通るとスコアが増えて即補充される", () => {
    const state = initCollect(world, 60, makeRng(42));
    const target = state.lights[0]!;
    const r = stepCollect(state, target.position, 1 / 60, world, makeRng(99));
    expect(r.collected).toBeGreaterThanOrEqual(1);
    expect(r.state.score).toBe(state.score + r.collected);
    expect(r.state.lights.length).toBe(MAX_LIGHTS); // 補充される
  });

  it("ボールが遠いとスコアは増えない", () => {
    const state = initCollect(world, 60, makeRng(3));
    const r = stepCollect(state, v3(1000, 1000, 1000), 1 / 60, world, makeRng(7));
    expect(r.collected).toBe(0);
    expect(r.state.score).toBe(0);
  });

  it("dt だけ timeLeft が減る（下限 0）", () => {
    const state = initCollect(world, 1.0, makeRng(5));
    const r1 = stepCollect(state, v3(100, 0, 0), 0.4, world);
    expect(r1.state.timeLeft).toBeCloseTo(0.6, 5);
    const r2 = stepCollect(r1.state, v3(100, 0, 0), 5, world);
    expect(r2.state.timeLeft).toBe(0); // 負にならない
  });
});
