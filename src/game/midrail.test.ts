import { describe, expect, it } from "vitest";
import {
  chooseDirectionForRail,
  findNearestRailScreen,
  segmentIntersect2D,
} from "./perspective.js";
import { v2, v3 } from "./vec.js";
import { buildWorld } from "./world.js";

describe("segmentIntersect2D", () => {
  it("十字に交わる 2 セグメントは中央で交差", () => {
    const r = segmentIntersect2D(v2(-1, 0), v2(1, 0), v2(0, -1), v2(0, 1));
    expect(r).not.toBeNull();
    expect(r!.u).toBeCloseTo(0.5);
    expect(r!.v).toBeCloseTo(0.5);
  });

  it("平行なセグメントは null", () => {
    const r = segmentIntersect2D(v2(0, 0), v2(1, 0), v2(0, 1), v2(1, 1));
    expect(r).toBeNull();
  });
});

describe("findNearestRailScreen", () => {
  // r1: A(-5,2,0) → B(5,-2,0)   斜め下
  // r2: C(0,-2,4) → D(0,2,-4)   yaw=0 投影では縦線（X=0）
  const world = buildWorld({
    nodes: [
      { id: "A", position: v3(-5, 2, 0) },
      { id: "B", position: v3(5, -2, 0) },
      { id: "C", position: v3(0, -2, 4) },
      { id: "D", position: v3(0, 2, -4) },
    ],
    rails: [
      { id: "r1", from: "A", to: "B" },
      { id: "r2", from: "C", to: "D" },
    ],
    startRailId: "r1",
    goalNodeId: "D",
  });
  const view = { yaw: 0, pitch: 0 };

  it("ボール screen 位置が r2 (X=0 縦線) に近ければ拾われる", () => {
    const screenPos = v2(0.05, 0); // X=0 線上、ほぼ中央
    const m = findNearestRailScreen(world, "r1", screenPos, v2(0, 0), view, 0.2);
    expect(m).not.toBeNull();
    expect(m!.rail).toBe("r2");
    expect(m!.v).toBeCloseTo(0.5, 1); // 縦線の中央付近
  });

  it("離れた点では null（threshold 以上）", () => {
    const screenPos = v2(2, -1); // r2 から遠い
    const m = findNearestRailScreen(world, "r1", screenPos, v2(0, 0), view, 0.4);
    expect(m).toBeNull();
  });

  it("現レール ID は判定対象から除外される", () => {
    // r1 自身の上にある点を r1 除外で検査
    const m = findNearestRailScreen(world, "r1", v2(0, 0), v2(0, 0), view, 0.2);
    expect(m?.rail).toBe("r2"); // r1 ではなく r2 が取れる
  });

  it("移動中: レールから遠ざかる向きに動いていたら拒否", () => {
    // ボールは r2 から右側 (+X) にちょっと離れた位置にいて、右へ動いている。
    // r2 (X=0 線) から遠ざかる方向なので拒否される。
    const screenPos = v2(0.05, 0); // r2 すぐ近く
    const screenVel = v2(1, 0); // +X 方向 = r2 から離れる向き
    const m = findNearestRailScreen(world, "r1", screenPos, screenVel, view, 0.2);
    expect(m).toBeNull();
  });

  it("移動中: レールに近づく向きに動いていれば受理", () => {
    const screenPos = v2(0.05, 0);
    const screenVel = v2(-1, 0); // -X 方向 = r2 に近づく
    const m = findNearestRailScreen(world, "r1", screenPos, screenVel, view, 0.2);
    expect(m?.rail).toBe("r2");
  });

  it("静止中（vel≈0）はフィルタを使わず距離だけで判定", () => {
    const screenPos = v2(0.05, 0);
    const m = findNearestRailScreen(world, "r1", screenPos, v2(0, 0), view, 0.2);
    expect(m?.rail).toBe("r2");
  });

  it("threshold を満たすレールが複数あれば最近距離のものを返す", () => {
    const w2 = buildWorld({
      nodes: [
        { id: "A", position: v3(-5, 2, 0) },
        { id: "B", position: v3(5, -2, 0) },
        { id: "C", position: v3(0, -2, 4) }, // X=0 縦線
        { id: "D", position: v3(0, 2, -4) },
        { id: "E", position: v3(0.3, -2, 4) }, // 少しオフセット
        { id: "F", position: v3(0.3, 2, -4) },
      ],
      rails: [
        { id: "r1", from: "A", to: "B" },
        { id: "r2", from: "C", to: "D" },
        { id: "r3", from: "E", to: "F" },
      ],
      startRailId: "r1",
      goalNodeId: "D",
    });
    const m = findNearestRailScreen(w2, "r1", v2(0.05, 0), v2(0, 0), view, 0.6);
    expect(m?.rail).toBe("r2"); // 0.05 → r2 (距離 0.05), r3 (距離 0.25)
  });
});

describe("chooseDirectionForRail", () => {
  const world = buildWorld({
    nodes: [
      { id: "A", position: v3(0, 0, 0) },
      { id: "B", position: v3(5, 0, 0) },
    ],
    rails: [{ id: "r1", from: "A", to: "B" }],
    startRailId: "r1",
    goalNodeId: "B",
  });
  const view = { yaw: 0, pitch: 0 };
  const gravity = v3(0, -9.8, 0);

  it("screen velocity が +X 方向なら +1（A→B 向き）", () => {
    const dir = chooseDirectionForRail(world, "r1", v2(1, 0), view, gravity);
    expect(dir).toBe(1);
  });

  it("screen velocity が -X 方向なら -1", () => {
    const dir = chooseDirectionForRail(world, "r1", v2(-1, 0), view, gravity);
    expect(dir).toBe(-1);
  });

  it("静止中（screen velocity≒0）は重力に沿った向きを選ぶ", () => {
    // 下りレール A(0,5,0) → B(5,0,0): gravity·railDir < 0 なので dir=-1 が正しい
    // ところが gravity (0,-9.8,0) と railDir (proportional to (5,-5,0)) の内積 = 0*0 + (-9.8)*(-5) + 0 = 49 > 0
    // つまり gravity は from→to 方向に正の成分 → dir=+1（A→B 方向）に下る
    const downhill = buildWorld({
      nodes: [
        { id: "A", position: v3(0, 5, 0) },
        { id: "B", position: v3(5, 0, 0) },
      ],
      rails: [{ id: "r1", from: "A", to: "B" }],
      startRailId: "r1",
      goalNodeId: "B",
    });
    const dir = chooseDirectionForRail(downhill, "r1", v2(0, 0), view, gravity);
    expect(dir).toBe(1);
  });
});
