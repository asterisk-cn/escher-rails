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
    // 摩擦・重力なし → 初速 0 のまま
    expect(ball.speed).toBe(0);
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
        if (ev.kind === "midrail") transitioned = true;
        if (ev.kind === "goal") goalHit = true;
      }
      if (ball.railId === "r2") landedOnR2 = true;
    }
    expect(transitioned).toBe(true);
    expect(landedOnR2).toBe(true);
    expect(goalHit).toBe(true);
  });

  it("重力は視点に追随する: 横レールでも視点を傾けるとボールが動く", () => {
    // X 方向の水平レール
    const flat = buildWorld({
      nodes: [
        { id: "A", position: v3(-5, 0, 0) },
        { id: "B", position: v3(5, 0, 0) },
      ],
      rails: [{ id: "r1", from: "A", to: "B" }],
      startRailId: "r1",
      startT: 0.5,
      goalNodeId: "B",
    });

    // (1) yaw=0, pitch=0 視点: 重力 (0,-up,0) はレールに垂直 → 加速 0
    {
      let ball = makeInitialBall(flat);
      for (let i = 0; i < 30; i++) {
        const r = stepBall(flat, ball, { yaw: 0, pitch: 0 }, 1 / 60);
        ball = r.ball;
      }
      expect(Math.abs(ball.t - 0.5)).toBeLessThan(1e-6); // 動かない
      expect(ball.speed).toBeCloseTo(0);
    }

    // (2) yaw=π/2, pitch=π/4 視点: up が X 軸成分を持ち、effective gravity が
    //     -X 方向に成分を持つ → 横レール沿いに加速
    {
      let ball = makeInitialBall(flat);
      for (let i = 0; i < 30; i++) {
        const r = stepBall(flat, ball, { yaw: Math.PI / 2, pitch: Math.PI / 4 }, 1 / 60);
        ball = r.ball;
      }
      expect(Math.abs(ball.t - 0.5)).toBeGreaterThan(0.01); // 動いた
      expect(ball.speed).toBeGreaterThan(0);
    }
  });

  it("行き止まりではゴール以外なら止まらず跳ね返る", () => {
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
    let bounceHit = false;
    let dirReversedAfterBounce = false;
    let bouncedDir: 1 | -1 | null = null;
    for (let i = 0; i < 600; i++) {
      const r = stepBall(dead, ball, { yaw: 0, pitch: 0 }, 1 / 60);
      ball = r.ball;
      for (const ev of r.events) {
        if (ev.kind === "bounce") {
          bounceHit = true;
          bouncedDir = ball.dir;
        }
      }
      if (bouncedDir !== null && ball.dir !== bouncedDir) {
        // 跳ね返り後、重力で再加速→反対端でまた跳ね返るところまで動いている
        dirReversedAfterBounce = true;
        break;
      }
    }
    expect(bounceHit).toBe(true);
    expect(ball.speed).toBeGreaterThan(0); // 止まっていない
    expect(dirReversedAfterBounce).toBe(true);
  });
});
