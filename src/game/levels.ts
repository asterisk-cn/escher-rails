// ステージ定義。
//
// 設計指針:
// - 単位スケールを 4 程度の整数座標で組む（視覚的にわかりやすく）。
// - レールはわずかに傾けて重力で転がるようにする（完全水平だと止まる）。
// - 各ステージで「視点を回さないと届かない」状況を 1 つは仕込む。

import { v3 } from "./vec.js";
import type { WorldSpec } from "./world.js";

export const levels: ReadonlyArray<{ name: string; spec: WorldSpec; hint: string }> = [
  // -----------------------------------------------------------------------
  // STAGE 1: 視点接続を初めて体験する。
  // 短いスロープ A→B の終端 B が、別の独立スロープ C→D の始端 C と
  // Z 方向にずれている。視点を真正面（yaw=0）に合わせると B と C が重なり、
  // ボールは C→D へ乗り換えて D（ゴール）に到達できる。
  // -----------------------------------------------------------------------
  {
    name: "Perspective Drop",
    hint: "B と C が画面上で重なる視点を探そう",
    spec: {
      nodes: [
        { id: "A", position: v3(-6, 4, 0) },
        { id: "B", position: v3(-1, 1, 0) },
        { id: "C", position: v3(-1, 1, 6) }, // Z 方向にずれた "double" of B
        { id: "D", position: v3(5, -3, 6) },
      ],
      rails: [
        { id: "r1", from: "A", to: "B" },
        { id: "r2", from: "C", to: "D" },
      ],
      startRailId: "r1",
      startT: 0,
      startDirection: 1,
      goalNodeId: "D",
    },
  },

  // -----------------------------------------------------------------------
  // STAGE 2: 三段ジャンプ。重なりを 2 回作る必要がある。
  // -----------------------------------------------------------------------
  {
    name: "Triple Step",
    hint: "視点を保つと 3 本のレールが 1 本の階段に見える",
    spec: {
      nodes: [
        { id: "A", position: v3(-7, 5, 0) },
        { id: "B", position: v3(-3, 2, 0) },
        { id: "C", position: v3(-3, 2, 4) },
        { id: "D", position: v3(1, -1, 4) },
        { id: "E", position: v3(1, -1, -4) },
        { id: "F", position: v3(6, -4, -4) },
      ],
      rails: [
        { id: "r1", from: "A", to: "B" },
        { id: "r2", from: "C", to: "D" },
        { id: "r3", from: "E", to: "F" },
      ],
      startRailId: "r1",
      goalNodeId: "F",
    },
  },

  // -----------------------------------------------------------------------
  // STAGE 3: フェイクの分岐。
  // 本物の分岐先（同ノードに接続するレール）と、視点接続の選択肢を出す。
  // 視点を切り替えると到達不可能な分岐に進むことになる。
  // -----------------------------------------------------------------------
  {
    name: "False Branch",
    hint: "Y 字の同ノード分岐と視点リンク、どちらが正解？",
    spec: {
      nodes: [
        { id: "A", position: v3(-8, 5, 0) },
        { id: "J", position: v3(-2, 2, 0) }, // 分岐点
        { id: "X", position: v3(2, -2, 0) }, // 行き止まり方向（同ノード分岐の罠）
        { id: "P", position: v3(-2, 2, 5) }, // 視点リンク先（Z 方向の double）
        { id: "G", position: v3(4, -3, 5) }, // ゴール
      ],
      rails: [
        { id: "r1", from: "A", to: "J" },
        { id: "r2", from: "J", to: "X" }, // 通常分岐: J で続く罠ルート
        { id: "r3", from: "P", to: "G" }, // 視点リンクで乗り換えるレール
      ],
      startRailId: "r1",
      goalNodeId: "G",
    },
  },
];
