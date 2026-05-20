// ワールド（線路グラフ）。純粋データ。
//
// RailNode は 3D 空間上の点。
// Rail は 2 つの RailNode を結ぶ直線セグメント。ボールはこの上を走る。
//
// 「視点投影による接続」は、World 自身は持たない。
// 接続判定は projection と組み合わせて perspectiveLinks で動的に解決する。

import type { Vec3 } from "./vec.js";

export type NodeId = string;
export type RailId = string;

export type RailNode = Readonly<{
  id: NodeId;
  position: Vec3;
}>;

export type Rail = Readonly<{
  id: RailId;
  from: NodeId;
  to: NodeId;
}>;

export type World = Readonly<{
  nodes: ReadonlyMap<NodeId, RailNode>;
  rails: ReadonlyMap<RailId, Rail>;
  // ノードごとの隣接レール（双方向）。インデックス。
  adjacency: ReadonlyMap<NodeId, ReadonlyArray<RailId>>;
  gravity: Vec3;
  startRailId: RailId;
  startT: number; // ボール開始位置: rail 上の t in [0,1]
  startDirection: 1 | -1; // 開始時の進行方向（+1 = from→to, -1 = to→from）
  goalNodeId: NodeId;
}>;

export type WorldSpec = Readonly<{
  nodes: ReadonlyArray<RailNode>;
  rails: ReadonlyArray<Rail>;
  gravity?: Vec3;
  startRailId: RailId;
  startT?: number;
  startDirection?: 1 | -1;
  goalNodeId: NodeId;
}>;

export const buildWorld = (spec: WorldSpec): World => {
  const nodes = new Map<NodeId, RailNode>();
  for (const n of spec.nodes) {
    if (nodes.has(n.id)) throw new Error(`Duplicate node id: ${n.id}`);
    nodes.set(n.id, n);
  }
  const rails = new Map<RailId, Rail>();
  const adjacency = new Map<NodeId, RailId[]>();
  for (const r of spec.rails) {
    if (rails.has(r.id)) throw new Error(`Duplicate rail id: ${r.id}`);
    if (!nodes.has(r.from)) throw new Error(`Rail ${r.id}: missing node ${r.from}`);
    if (!nodes.has(r.to)) throw new Error(`Rail ${r.id}: missing node ${r.to}`);
    rails.set(r.id, r);
    if (!adjacency.has(r.from)) adjacency.set(r.from, []);
    if (!adjacency.has(r.to)) adjacency.set(r.to, []);
    adjacency.get(r.from)!.push(r.id);
    adjacency.get(r.to)!.push(r.id);
  }
  if (!rails.has(spec.startRailId)) throw new Error(`Missing start rail: ${spec.startRailId}`);
  if (!nodes.has(spec.goalNodeId)) throw new Error(`Missing goal node: ${spec.goalNodeId}`);

  return {
    nodes,
    rails,
    adjacency,
    gravity: spec.gravity ?? { x: 0, y: -9.8, z: 0 },
    startRailId: spec.startRailId,
    startT: spec.startT ?? 0,
    startDirection: spec.startDirection ?? 1,
    goalNodeId: spec.goalNodeId,
  };
};

// レールの両端ノードを取得
export const railEnds = (world: World, railId: RailId): { from: RailNode; to: RailNode } => {
  const r = world.rails.get(railId);
  if (!r) throw new Error(`Unknown rail: ${railId}`);
  const from = world.nodes.get(r.from);
  const to = world.nodes.get(r.to);
  if (!from || !to) throw new Error(`Rail ${railId} references missing node`);
  return { from, to };
};
