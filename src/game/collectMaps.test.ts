import { describe, expect, it } from "vitest";
import { generateRandomMap } from "./collectMaps.js";
import { buildWorld } from "./world.js";

const makeRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
};

describe("generateRandomMap", () => {
  it("8 本のレールと 16 個の固有ノードを生成", () => {
    const spec = generateRandomMap(makeRng(1));
    expect(spec.rails.length).toBe(8);
    expect(spec.nodes.length).toBe(16);
    const ids = new Set(spec.nodes.map((n) => n.id));
    expect(ids.size).toBe(16);
  });

  it("どの 2 本のレールも端点（ノード）を共有しない", () => {
    const spec = generateRandomMap(makeRng(7));
    const seen = new Set<string>();
    for (const rail of spec.rails) {
      expect(seen.has(rail.from)).toBe(false);
      expect(seen.has(rail.to)).toBe(false);
      seen.add(rail.from);
      seen.add(rail.to);
    }
  });

  it("buildWorld が成功する（重複 ID なし）", () => {
    const spec = generateRandomMap(makeRng(42));
    expect(() => buildWorld(spec)).not.toThrow();
  });

  it("各レールの長さが [3, 9] に収まる", () => {
    const spec = generateRandomMap(makeRng(99));
    const posOf = (id: string) => spec.nodes.find((n) => n.id === id)!.position;
    for (const rail of spec.rails) {
      const a = posOf(rail.from);
      const b = posOf(rail.to);
      const len = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      expect(len).toBeGreaterThanOrEqual(3);
      expect(len).toBeLessThanOrEqual(9);
    }
  });

  it("seed が異なれば配置も異なる", () => {
    const s1 = generateRandomMap(makeRng(1));
    const s2 = generateRandomMap(makeRng(2));
    // 最初のノードの位置が一致する確率は無視できるほど低い
    expect(s1.nodes[0]!.position).not.toEqual(s2.nodes[0]!.position);
  });
});
