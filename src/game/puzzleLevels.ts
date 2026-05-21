// パズルモードのステージ定義。
//
// 設計指針:
// - 単位スケールを 4 程度の整数座標で組む。
// - レールはわずかに傾けて重力で転がるようにする。
// - 各ステージで「視点を回さないと届かない」状況を 1 つは仕込む。

import { v3 } from "./vec.js";
import type { WorldSpec } from "./world.js";

export type PuzzleLevel = Readonly<{
  name: string;
  hint: string;
  spec: WorldSpec;
}>;

export const puzzleLevels: ReadonlyArray<PuzzleLevel> = [
  {
    name: "Perspective Drop",
    hint: "B と C が画面上で重なる視点を探そう",
    spec: {
      nodes: [
        { id: "A", position: v3(-6, 4, 0) },
        { id: "B", position: v3(-1, 1, 0) },
        { id: "C", position: v3(-1, 1, 6) },
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

  {
    name: "False Branch",
    hint: "Y 字の同ノード分岐と視点リンク、どちらが正解？",
    spec: {
      nodes: [
        { id: "A", position: v3(-8, 5, 0) },
        { id: "J", position: v3(-2, 2, 0) },
        { id: "X", position: v3(2, -2, 0) },
        { id: "P", position: v3(-2, 2, 5) },
        { id: "G", position: v3(4, -3, 5) },
      ],
      rails: [
        { id: "r1", from: "A", to: "J" },
        { id: "r2", from: "J", to: "X" },
        { id: "r3", from: "P", to: "G" },
      ],
      startRailId: "r1",
      goalNodeId: "G",
    },
  },

  {
    name: "Side Step",
    hint: "真横から覗くと 2 本が同じ縦線に揃う",
    spec: {
      nodes: [
        { id: "A", position: v3(0, 5, 0) },
        { id: "B", position: v3(0, 1, 0) },
        { id: "C", position: v3(5, 1, 0) },
        { id: "D", position: v3(5, -3, 0) },
      ],
      rails: [
        { id: "r1", from: "A", to: "B" },
        { id: "r2", from: "C", to: "D" },
      ],
      startRailId: "r1",
      goalNodeId: "D",
    },
  },

  {
    name: "Diagonal",
    hint: "斜め 45° に視点を回すと 2 本が揃う",
    spec: {
      nodes: [
        { id: "A", position: v3(0, 5, 0) },
        { id: "B", position: v3(0, 1, 0) },
        { id: "C", position: v3(5, 1, 5) },
        { id: "D", position: v3(5, -3, 5) },
      ],
      rails: [
        { id: "r1", from: "A", to: "B" },
        { id: "r2", from: "C", to: "D" },
      ],
      startRailId: "r1",
      goalNodeId: "D",
    },
  },

  {
    name: "Spiral Steps",
    hint: "正面視点で 4 本のレールが 1 本の階段になる",
    spec: {
      nodes: [
        { id: "A", position: v3(-8, 6, 0) },
        { id: "B", position: v3(-5, 3, 0) },
        { id: "C", position: v3(-5, 3, 4) },
        { id: "D", position: v3(-2, 0, 4) },
        { id: "E", position: v3(-2, 0, -4) },
        { id: "F", position: v3(2, -3, -4) },
        { id: "G", position: v3(2, -3, 4) },
        { id: "H", position: v3(6, -6, 4) },
      ],
      rails: [
        { id: "r1", from: "A", to: "B" },
        { id: "r2", from: "C", to: "D" },
        { id: "r3", from: "E", to: "F" },
        { id: "r4", from: "G", to: "H" },
      ],
      startRailId: "r1",
      goalNodeId: "H",
    },
  },

  {
    name: "Bird's View",
    hint: "上から覗き込むと 2 本が重なる",
    spec: {
      nodes: [
        { id: "A", position: v3(-5, 2, 0) },
        { id: "B", position: v3(0, -1, 0) },
        { id: "C", position: v3(0, 4, 0) },
        { id: "D", position: v3(5, 1, 0) },
      ],
      rails: [
        { id: "r1", from: "A", to: "B" },
        { id: "r2", from: "C", to: "D" },
      ],
      startRailId: "r1",
      goalNodeId: "D",
    },
  },

  {
    name: "Many Tracks",
    hint: "正面視点を保ったまま 3 本のレールを順に渡る",
    spec: {
      nodes: [
        { id: "A", position: v3(-7, 6, 0) },
        { id: "B", position: v3(-3, 3, 0) },
        { id: "C", position: v3(-3, 3, 6) },
        { id: "D", position: v3(1, 0, 6) },
        { id: "E", position: v3(1, 0, 3) },
        { id: "F", position: v3(6, -4, 3) },
        { id: "X", position: v3(-3, 3, -5) },
        { id: "Y", position: v3(2, 2, -5) },
      ],
      rails: [
        { id: "r1", from: "A", to: "B" },
        { id: "r2", from: "C", to: "D" },
        { id: "r3", from: "E", to: "F" },
        { id: "rX", from: "X", to: "Y" },
      ],
      startRailId: "r1",
      goalNodeId: "F",
    },
  },
];
