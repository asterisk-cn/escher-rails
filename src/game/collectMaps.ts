// コレクトモードのマップ。
//
// レールは毎回ランダム配置。レールどうしは端点を共有しないので
// 同ノード分岐 (continue) は発生せず、ボールはすべて視覚的接続のみで移動する。

import { length3, sub3, v3, type Vec3 } from "./vec.js";
import type { WorldSpec } from "./world.js";

export type CollectMap = Readonly<{
  name: string;
  hint: string;
  timeLimit: number;
  // 毎ロードで新しい配置を返す。
  generate: (rng?: () => number) => WorldSpec;
}>;

const RAIL_COUNT = 8;
const BOUND = 6; // 配置範囲 [-BOUND, BOUND]^3
const MIN_LEN = 3;
const MAX_LEN = 9;

const randomPoint = (rng: () => number): Vec3 =>
  v3((rng() * 2 - 1) * BOUND, (rng() * 2 - 1) * BOUND, (rng() * 2 - 1) * BOUND);

export const generateRandomMap = (rng: () => number = Math.random): WorldSpec => {
  const nodes: { id: string; position: Vec3 }[] = [];
  const rails: { id: string; from: string; to: string }[] = [];

  for (let i = 0; i < RAIL_COUNT; i++) {
    let from: Vec3 = v3(0, 0, 0);
    let to: Vec3 = v3(0, 0, 0);
    // 長さが [MIN_LEN, MAX_LEN] に入るまで再抽選（最大 50 回）。
    for (let attempts = 0; attempts < 50; attempts++) {
      from = randomPoint(rng);
      to = randomPoint(rng);
      const len = length3(sub3(to, from));
      if (len >= MIN_LEN && len <= MAX_LEN) break;
    }
    // ノード ID は rail 番号 + 端点記号。共有しない（各レール固有）。
    nodes.push({ id: `n${i}a`, position: from });
    nodes.push({ id: `n${i}b`, position: to });
    rails.push({ id: `r${i}`, from: `n${i}a`, to: `n${i}b` });
  }

  return {
    nodes,
    rails,
    startRailId: "r0",
    startT: 0.5, // 端点で即バウンスしないよう中点開始
    startDirection: 1,
    goalNodeId: "n0a", // collect モードでは未使用
  };
};

export const collectMaps: ReadonlyArray<CollectMap> = [
  {
    name: "Random 8",
    hint: "ランダム配置の 8 本",
    timeLimit: 60,
    generate: (rng) => generateRandomMap(rng),
  },
];
