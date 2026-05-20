import { describe, expect, it } from "vitest";
import { chooseContinuation, findOverlappingNodes } from "./perspective.js";
import { v3 } from "./vec.js";
import { buildWorld } from "./world.js";

describe("perspective links", () => {
  it("yaw=0 視点で Z 方向に並んだ 2 ノードは画面上で重なる", () => {
    const world = buildWorld({
      nodes: [
        { id: "A", position: v3(0, 0, 0) },
        { id: "B", position: v3(0, 0, 5) },
        { id: "C", position: v3(3, 0, 0) },
      ],
      rails: [{ id: "r1", from: "A", to: "C" }],
      startRailId: "r1",
      goalNodeId: "C",
    });
    const overlapping = findOverlappingNodes(world, "A", { yaw: 0, pitch: 0 });
    expect(overlapping).toContain("B");
    expect(overlapping).not.toContain("C");
  });

  it("yaw を回せば視点重なりは解消される", () => {
    const world = buildWorld({
      nodes: [
        { id: "A", position: v3(0, 0, 0) },
        { id: "B", position: v3(0, 0, 5) },
      ],
      rails: [{ id: "r1", from: "A", to: "B" }], // 形式上のレール（接続テスト用）
      startRailId: "r1",
      goalNodeId: "B",
    });
    const at0 = findOverlappingNodes(world, "A", { yaw: 0, pitch: 0 });
    expect(at0).toContain("B");
    const at90 = findOverlappingNodes(world, "A", { yaw: Math.PI / 2, pitch: 0 });
    expect(at90).not.toContain("B");
  });

  it("視点接続があるとき chooseContinuation は perspective を返す", () => {
    // A--r1--C と、Z 方向にずれた B--r2--D。yaw=0 で A と B が重なる。
    const world = buildWorld({
      nodes: [
        { id: "A", position: v3(0, 0, 0) },
        { id: "C", position: v3(-3, 0, 0) },
        { id: "B", position: v3(0, 0, 5) },
        { id: "D", position: v3(3, 0, 5) },
      ],
      rails: [
        { id: "r1", from: "C", to: "A" },
        { id: "r2", from: "B", to: "D" },
      ],
      startRailId: "r1",
      goalNodeId: "D",
    });
    const result = chooseContinuation(
      world,
      "A",
      "r1",
      { x: 1, y: 0, z: 0 }, // r1 上で C→A の方向
      { yaw: 0, pitch: 0 },
    );
    expect(result.kind).toBe("perspective");
    if (result.kind === "perspective") {
      expect(result.rail).toBe("r2");
      expect(result.nextNode).toBe("B");
    }
  });

  it("視点接続がなく分岐もないとき deadend", () => {
    const world = buildWorld({
      nodes: [
        { id: "A", position: v3(0, 0, 0) },
        { id: "B", position: v3(5, 0, 0) },
      ],
      rails: [{ id: "r1", from: "A", to: "B" }],
      startRailId: "r1",
      goalNodeId: "B",
    });
    const result = chooseContinuation(
      world,
      "B",
      "r1",
      { x: 1, y: 0, z: 0 },
      { yaw: Math.PI / 2, pitch: 0 },
    );
    expect(result.kind).toBe("deadend");
  });

  it("同ノード分岐があるときは continue を返し進行方向に沿う方を選ぶ", () => {
    // A から両方向にレール。incomingDir = +X のとき +X 側を選ぶ。
    const world = buildWorld({
      nodes: [
        { id: "A", position: v3(0, 0, 0) },
        { id: "L", position: v3(-3, 0, 0) }, // -X 方向
        { id: "R", position: v3(3, 0, 0) }, // +X 方向
      ],
      rails: [
        { id: "rL", from: "L", to: "A" }, // L→A
        { id: "rR", from: "A", to: "R" }, // A→R
      ],
      startRailId: "rL",
      goalNodeId: "R",
    });
    const result = chooseContinuation(
      world,
      "A",
      "rL",
      { x: 1, y: 0, z: 0 }, // L→A の方向 = +X
      { yaw: 0, pitch: 0 }, // X 軸上のノードは画面上で別位置になり視点重なりが無い
    );
    expect(result.kind).toBe("continue");
    if (result.kind === "continue") {
      expect(result.rail).toBe("rR");
      expect(result.nextNode).toBe("R");
    }
  });
});
