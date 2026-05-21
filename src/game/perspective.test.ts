import { describe, expect, it } from "vitest";
import { chooseContinuation } from "./perspective.js";
import { v3 } from "./vec.js";
import { buildWorld } from "./world.js";

describe("chooseContinuation", () => {
  it("行き止まり: 端点に他のレールが無いとき deadend", () => {
    const world = buildWorld({
      nodes: [
        { id: "A", position: v3(0, 0, 0) },
        { id: "B", position: v3(5, 0, 0) },
      ],
      rails: [{ id: "r1", from: "A", to: "B" }],
      startRailId: "r1",
      goalNodeId: "B",
    });
    const result = chooseContinuation(world, "B", "r1", { x: 1, y: 0, z: 0 });
    expect(result.kind).toBe("deadend");
  });

  it("Y 字分岐: 同じノードから出ている他レールを進行方向に沿って選ぶ", () => {
    // A から +X 側 (R) と +Y 側 (U) の 2 本に分岐
    const world = buildWorld({
      nodes: [
        { id: "L", position: v3(-3, 0, 0) },
        { id: "A", position: v3(0, 0, 0) },
        { id: "R", position: v3(3, 0, 0) },
        { id: "U", position: v3(0, 3, 0) },
      ],
      rails: [
        { id: "rL", from: "L", to: "A" },
        { id: "rR", from: "A", to: "R" },
        { id: "rU", from: "A", to: "U" },
      ],
      startRailId: "rL",
      goalNodeId: "R",
    });
    // 進行方向 +X なら R 側
    const r1 = chooseContinuation(world, "A", "rL", { x: 1, y: 0, z: 0 });
    expect(r1.kind).toBe("continue");
    if (r1.kind === "continue") expect(r1.nextNode).toBe("R");

    // 進行方向 +Y なら U 側
    const r2 = chooseContinuation(world, "A", "rL", { x: 0, y: 1, z: 0 });
    expect(r2.kind).toBe("continue");
    if (r2.kind === "continue") expect(r2.nextNode).toBe("U");
  });
});
