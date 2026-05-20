import { describe, expect, it } from "vitest";
import { makeInitialBall, railDirection, railLength, stepBall } from "./physics.js";
import { v3 } from "./vec.js";
import { buildWorld } from "./world.js";

describe("physics", () => {
  const world = buildWorld({
    nodes: [
      { id: "A", position: v3(0, 5, 0) }, // 高い
      { id: "B", position: v3(10, 0, 0) }, // 低い
    ],
    // A から B へ下る斜めレール
    rails: [{ id: "r1", from: "A", to: "B" }],
    startRailId: "r1",
    startT: 0,
    startDirection: 1,
    goalNodeId: "B",
  });

  it("railLength は端点間ユークリッド距離", () => {
    expect(railLength(world, "r1")).toBeCloseTo(Math.sqrt(100 + 25));
  });

  it("railDirection は from→to の単位ベクトル", () => {
    const d = railDirection(world, "r1");
    const len = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
    expect(len).toBeCloseTo(1);
    expect(d.x).toBeGreaterThan(0);
    expect(d.y).toBeLessThan(0);
  });

  it("重力下りでボールは加速する", () => {
    let ball = makeInitialBall(world);
    expect(ball.speed).toBe(0);
    for (let i = 0; i < 5; i++) {
      const r = stepBall(world, ball, { yaw: 0, pitch: 0 }, 1 / 60);
      ball = r.ball;
    }
    expect(ball.speed).toBeGreaterThan(0);
    expect(ball.t).toBeGreaterThan(0);
  });

  it("水平レールでは加速しない（friction 無視）", () => {
    const flat = buildWorld({
      nodes: [
        { id: "A", position: v3(0, 0, 0) },
        { id: "B", position: v3(10, 0, 0) },
      ],
      rails: [{ id: "r1", from: "A", to: "B" }],
      startRailId: "r1",
      goalNodeId: "B",
    });
    let ball = makeInitialBall(flat);
    for (let i = 0; i < 60; i++) {
      const r = stepBall(flat, ball, { yaw: 0, pitch: 0 }, 1 / 60, { friction: 0 });
      ball = r.ball;
    }
    expect(ball.speed).toBeCloseTo(0);
    expect(ball.t).toBe(0);
  });

  it("到達でゴールイベントが発火する", () => {
    let ball = makeInitialBall(world);
    let goalHit = false;
    for (let i = 0; i < 600 && !goalHit; i++) {
      const r = stepBall(world, ball, { yaw: 0, pitch: 0 }, 1 / 60);
      ball = r.ball;
      for (const ev of r.events) if (ev.kind === "goal") goalHit = true;
    }
    expect(goalHit).toBe(true);
  });

  it("視点接続を経由してレール間を乗り換える", () => {
    // r1: A(0,5,0) → B(0,1,0)（下りスロープ）
    // r2: C(0,1,5) → D(5,-2,5)（B と Z 方向で重なる別レール）
    // yaw=0, pitch=0 の視点では B と C が画面上で重なる → 乗り換え発生
    const w = buildWorld({
      nodes: [
        { id: "A", position: v3(0, 5, 0) },
        { id: "B", position: v3(0, 1, 0) },
        { id: "C", position: v3(0, 1, 5) },
        { id: "D", position: v3(5, -2, 5) },
      ],
      rails: [
        { id: "r1", from: "A", to: "B" },
        { id: "r2", from: "C", to: "D" },
      ],
      startRailId: "r1",
      goalNodeId: "D",
    });
    let ball = makeInitialBall(w);
    let transitioned = false;
    let landedOnR2 = false;
    let goalHit = false;
    for (let i = 0; i < 1000 && !goalHit; i++) {
      const r = stepBall(w, ball, { yaw: 0, pitch: 0 }, 1 / 60);
      ball = r.ball;
      for (const ev of r.events) {
        if (ev.kind === "transition" && ev.via.kind === "perspective") transitioned = true;
        if (ev.kind === "goal") goalHit = true;
      }
      if (ball.railId === "r2") landedOnR2 = true;
    }
    expect(transitioned).toBe(true);
    expect(landedOnR2).toBe(true);
    expect(goalHit).toBe(true);
  });

  it("行き止まりで deadend イベントが発火し速度 0", () => {
    const dead = buildWorld({
      nodes: [
        { id: "A", position: v3(0, 10, 0) },
        { id: "B", position: v3(5, 0, 0) },
        { id: "G", position: v3(100, 0, 0) }, // 到達不能なゴール
      ],
      rails: [{ id: "r1", from: "A", to: "B" }],
      startRailId: "r1",
      goalNodeId: "G",
    });
    let ball = makeInitialBall(dead);
    let deadHit = false;
    for (let i = 0; i < 600 && !deadHit; i++) {
      const r = stepBall(dead, ball, { yaw: 0, pitch: 0 }, 1 / 60);
      ball = r.ball;
      for (const ev of r.events) if (ev.kind === "deadend") deadHit = true;
    }
    expect(deadHit).toBe(true);
    expect(ball.speed).toBe(0);
  });
});
