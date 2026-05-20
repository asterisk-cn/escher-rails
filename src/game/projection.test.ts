import { describe, expect, it } from "vitest";
import { basisOf, projectPoint, screenDistance } from "./projection.js";
import { v3 } from "./vec.js";

describe("projection", () => {
  it("yaw=0, pitch=0 のとき forward は -Z、up は +Y、right は +X", () => {
    const b = basisOf({ yaw: 0, pitch: 0 });
    expect(b.forward.x).toBeCloseTo(0);
    expect(b.forward.y).toBeCloseTo(0);
    expect(b.forward.z).toBeCloseTo(-1);
    expect(b.up.x).toBeCloseTo(0);
    expect(b.up.y).toBeCloseTo(1);
    expect(b.up.z).toBeCloseTo(0);
    expect(b.right.x).toBeCloseTo(1);
    expect(b.right.y).toBeCloseTo(0);
    expect(b.right.z).toBeCloseTo(0);
  });

  it("yaw=π/2 のとき forward は -X、right は -Z", () => {
    const b = basisOf({ yaw: Math.PI / 2, pitch: 0 });
    expect(b.forward.x).toBeCloseTo(-1);
    expect(b.forward.y).toBeCloseTo(0);
    expect(b.forward.z).toBeCloseTo(0);
    expect(b.right.x).toBeCloseTo(0);
    expect(b.right.z).toBeCloseTo(-1);
  });

  it("projectPoint: yaw=0, pitch=0 のとき (x,y,z) → (x,y)", () => {
    const p = projectPoint(v3(2, 3, 5), { yaw: 0, pitch: 0 });
    expect(p.x).toBeCloseTo(2);
    expect(p.y).toBeCloseTo(3);
  });

  it("Z 軸方向に並んだ 2 点は yaw=0 視点では画面距離 0", () => {
    const d = screenDistance(v3(1, 2, 0), v3(1, 2, 10), { yaw: 0, pitch: 0 });
    expect(d).toBeCloseTo(0);
  });

  it("Z 軸方向に並んだ 2 点でも yaw=π/2 にすれば X 距離として現れる", () => {
    const d = screenDistance(v3(0, 0, 0), v3(0, 0, 10), { yaw: Math.PI / 2, pitch: 0 });
    expect(d).toBeCloseTo(10);
  });
});
