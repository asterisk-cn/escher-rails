// 視点投影による接続（perspective link）の解決。
//
// 仕組み:
// ボールがレール R1 の端点ノード N1 に到達したとき、
// 現在の視点 view において N1 と画面上で十分近い別ノード N2 を探す。
// N2 に接続しているレールのうち、N1 と直接共有しているもの以外を「乗り換え先」として使う。
//
// これにより、3D 空間では離れた線路が、視点を回すと「画面上では接続して見える」
// 瞬間に実際に乗り換え可能になる、という Escher / Monument Valley 系のメカニクスを実現する。

import { projectPoint } from "./projection.js";
import type { View } from "./projection.js";
import { dist2 } from "./vec.js";
import type { NodeId, RailId, World } from "./world.js";

export type PerspectiveLink = Readonly<{
  fromNode: NodeId;
  toNode: NodeId;
  rail: RailId; // 乗り換え先のレール
  screenDistance: number;
}>;

export type LinkResolveOptions = Readonly<{
  threshold?: number; // 画面距離の閾値
  excludeRailId?: RailId; // 今乗っているレールは除外
}>;

const DEFAULT_THRESHOLD = 0.35;

// ノード N の視点投影クラスタを取得（N 自身と画面距離 < threshold な他ノード）。
export const findOverlappingNodes = (
  world: World,
  nodeId: NodeId,
  view: View,
  threshold: number = DEFAULT_THRESHOLD,
): ReadonlyArray<NodeId> => {
  const n = world.nodes.get(nodeId);
  if (!n) return [];
  const target = projectPoint(n.position, view);
  const result: NodeId[] = [];
  for (const [id, other] of world.nodes) {
    if (id === nodeId) continue;
    const p = projectPoint(other.position, view);
    if (dist2(target, p) < threshold) {
      result.push(id);
    }
  }
  return result;
};

// 端点 nodeId からの乗り換え候補となるレールを列挙する。
// 直接接続している（adjacency にある）レールは「通常の継続」なので excludeRailId と同様に除外したい
// のではなく、ここでは「視点による移動」のみ返す（通常の継続は呼び出し側で処理）。
//
// 戻り値: 視点で重なる他ノード経由で到達できるレール一覧。
export const resolvePerspectiveLinks = (
  world: World,
  nodeId: NodeId,
  view: View,
  options: LinkResolveOptions = {},
): ReadonlyArray<PerspectiveLink> => {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const overlapping = findOverlappingNodes(world, nodeId, view, threshold);
  const n = world.nodes.get(nodeId);
  if (!n) return [];
  const target = projectPoint(n.position, view);

  const links: PerspectiveLink[] = [];
  for (const otherId of overlapping) {
    const adj = world.adjacency.get(otherId) ?? [];
    for (const railId of adj) {
      if (railId === options.excludeRailId) continue;
      const other = world.nodes.get(otherId)!;
      const sd = dist2(projectPoint(other.position, view), target);
      links.push({ fromNode: nodeId, toNode: otherId, rail: railId, screenDistance: sd });
    }
  }
  return links;
};

// 通常の継続（同じノードから出ている別のレール）も含めて、次に乗るレールを選ぶ。
// 戦略:
//   1. 視点接続（他ノード経由）があれば、画面距離が最小のものを優先（Escher 接続）
//      ※ 視点接続を「優先」することで、視点を合わせる行為に意味が生まれる。
//   2. なければ、同じノードに接続している別のレール（通常分岐）から選ぶ。
//      複数あれば「現レール方向の延長線上」に最も近いものを選ぶ。
//   3. どちらもなければ null（行き止まり）。
export type ContinuationResult = Readonly<
  | { kind: "perspective"; rail: RailId; nextNode: NodeId }
  | { kind: "continue"; rail: RailId; nextNode: NodeId }
  | { kind: "deadend" }
>;

export const chooseContinuation = (
  world: World,
  currentNodeId: NodeId,
  currentRailId: RailId,
  incomingDir: { x: number; y: number; z: number }, // ボールの進行方向（current rail 沿い）
  view: View,
  threshold: number = DEFAULT_THRESHOLD,
): ContinuationResult => {
  // 1. 視点接続を優先
  const links = resolvePerspectiveLinks(world, currentNodeId, view, {
    threshold,
    excludeRailId: currentRailId,
  });
  if (links.length > 0) {
    // 最も近いリンク（同距離なら deterministic に id 順）
    const sorted = [...links].sort((a, b) => {
      if (a.screenDistance !== b.screenDistance) return a.screenDistance - b.screenDistance;
      return a.rail < b.rail ? -1 : 1;
    });
    const best = sorted[0]!;
    return { kind: "perspective", rail: best.rail, nextNode: best.toNode };
  }

  // 2. 同じノードからの他レール
  const adj = world.adjacency.get(currentNodeId) ?? [];
  const others = adj.filter((r) => r !== currentRailId);
  if (others.length > 0) {
    // 進行方向に最も沿うレールを選ぶ
    const here = world.nodes.get(currentNodeId)!.position;
    let best: RailId | null = null;
    let bestScore = -Infinity;
    for (const r of others) {
      const rail = world.rails.get(r)!;
      const otherNodeId = rail.from === currentNodeId ? rail.to : rail.from;
      const other = world.nodes.get(otherNodeId)!.position;
      const dx = other.x - here.x;
      const dy = other.y - here.y;
      const dz = other.z - here.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const dot = (dx * incomingDir.x + dy * incomingDir.y + dz * incomingDir.z) / len;
      if (dot > bestScore) {
        bestScore = dot;
        best = r;
      }
    }
    if (best != null) {
      const rail = world.rails.get(best)!;
      const nextNode = rail.from === currentNodeId ? rail.to : rail.from;
      return { kind: "continue", rail: best, nextNode };
    }
  }

  return { kind: "deadend" };
};
