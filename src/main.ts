// アプリケーションエントリ。
//
// 構成:
//  - View 状態 (yaw, pitch) はキーボード入力で更新する。
//  - World とボール状態を保持し、毎フレーム stepBall を進める。
//  - Three.js のシーンを View にあわせて投影更新する。
//
// projection.basisOf と Three.js camera の配置を一致させているので、
// 「画面上で重なって見えたノード」がそのまま「視点接続候補」になる。

import { findOverlappingNodes, resolvePerspectiveLinks } from "./game/perspective.js";
import { levels } from "./game/levels.js";
import { makeInitialBall, stepBall, type BallState } from "./game/physics.js";
import { projectPoint, type View } from "./game/projection.js";
import { buildWorld, type World } from "./game/world.js";
import { applyView, createScene, placeBall, populateWorld, updateOverlapRings } from "./render/scene.js";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const stageNumEl = document.getElementById("stage-num")!;
const statusEl = document.getElementById("hud-status")!;
const debugEl = document.getElementById("hud-debug")!;

const refs = createScene(canvas);
refs.resize();
window.addEventListener("resize", refs.resize);

// --- ゲーム状態 ---
type Mode = "ready" | "running" | "cleared" | "failed";
type GameState = {
  levelIndex: number;
  world: World;
  view: View;
  ball: BallState;
  mode: Mode;
  // 視点接続候補の前回値（HUD 表示用）
  currentEndpointNode: string | null;
  currentOverlapNode: string | null;
};

const loadLevel = (idx: number): GameState => {
  const lv = levels[idx]!;
  const world = buildWorld(lv.spec);
  populateWorld(refs, world);
  const ball = makeInitialBall(world);
  placeBall(refs, world, ball);
  stageNumEl.textContent = `${idx + 1} — ${lv.name}`;
  setStatus(`READY · ${lv.hint}`);
  return {
    levelIndex: idx,
    world,
    view: { yaw: 0, pitch: 0 },
    ball,
    mode: "ready",
    currentEndpointNode: null,
    currentOverlapNode: null,
  };
};

const setStatus = (s: string) => {
  statusEl.textContent = s;
};

let state: GameState = loadLevel(0);

// --- 入力 ---
const keys = new Set<string>();
window.addEventListener("keydown", (e) => {
  keys.add(e.key);
  if (e.key === " " || e.key === "Spacebar") {
    e.preventDefault();
    if (state.mode === "ready") {
      state.mode = "running";
      setStatus("ROLLING…");
    } else if (state.mode === "cleared" || state.mode === "failed") {
      state = loadLevel(state.levelIndex);
    } else {
      // running 中の Space → リセット
      state = loadLevel(state.levelIndex);
    }
  } else if (e.key === "r" || e.key === "R") {
    state = loadLevel(state.levelIndex);
  } else if (e.key === "n" || e.key === "N") {
    const next = (state.levelIndex + 1) % levels.length;
    state = loadLevel(next);
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key));

const VIEW_SPEED = 1.6; // rad/sec
const MAX_PITCH = Math.PI / 2.2;

const updateView = (dt: number) => {
  if (keys.has("ArrowLeft")) state.view = { ...state.view, yaw: state.view.yaw - VIEW_SPEED * dt };
  if (keys.has("ArrowRight")) state.view = { ...state.view, yaw: state.view.yaw + VIEW_SPEED * dt };
  if (keys.has("ArrowUp")) {
    state.view = { ...state.view, pitch: Math.min(MAX_PITCH, state.view.pitch + VIEW_SPEED * dt) };
  }
  if (keys.has("ArrowDown")) {
    state.view = { ...state.view, pitch: Math.max(-MAX_PITCH, state.view.pitch - VIEW_SPEED * dt) };
  }
};

// 現在ボールが乗っているレールの「進行方向端点」と、その視点重なりを取得
const computeOverlapHint = (): { endpoint: string | null; overlap: string | null } => {
  const rail = state.world.rails.get(state.ball.railId);
  if (!rail) return { endpoint: null, overlap: null };
  // 進行方向の端点
  const endpoint = state.ball.dir === 1 ? rail.to : rail.from;
  const overlapping = findOverlappingNodes(state.world, endpoint, state.view);
  // 自ノードと、現レールの直接の隣接ノードは無視（同レール上の端点ではない別の double を探す）
  const filtered = overlapping.filter((id) => id !== rail.from && id !== rail.to);
  const overlap = filtered.length > 0 ? filtered[0]! : null;
  return { endpoint, overlap };
};

const updateDebug = () => {
  const yawDeg = ((state.view.yaw * 180) / Math.PI).toFixed(1);
  const pitchDeg = ((state.view.pitch * 180) / Math.PI).toFixed(1);
  const ep = state.currentEndpointNode ?? "-";
  const ov = state.currentOverlapNode ?? "-";
  const links = state.currentEndpointNode
    ? resolvePerspectiveLinks(state.world, state.currentEndpointNode, state.view).length
    : 0;
  debugEl.textContent =
    `yaw ${yawDeg}°  pitch ${pitchDeg}°\n` +
    `endpoint ${ep}  overlap ${ov}\n` +
    `perspective links ${links}\n` +
    `mode ${state.mode}  speed ${state.ball.speed.toFixed(2)}`;
};

// --- メインループ ---
let last = performance.now();
const tick = () => {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  updateView(dt);

  if (state.mode === "running") {
    const r = stepBall(state.world, state.ball, state.view, dt);
    state.ball = r.ball;
    for (const ev of r.events) {
      if (ev.kind === "goal") {
        state.mode = "cleared";
        setStatus("CLEAR! · N: 次のステージ / R: もう一度");
      } else if (ev.kind === "deadend") {
        state.mode = "failed";
        setStatus("DEAD END · R で再挑戦");
      }
    }
  }

  const hint = computeOverlapHint();
  state.currentEndpointNode = hint.endpoint;
  state.currentOverlapNode = hint.overlap;

  applyView(refs, state.view);
  placeBall(refs, state.world, state.ball);
  updateOverlapRings(refs, state.world, hint.endpoint, hint.overlap, state.view);
  refs.renderer.render(refs.scene, refs.camera);
  updateDebug();

  requestAnimationFrame(tick);
};

requestAnimationFrame(tick);

// projectPoint をブラウザコンソールで使えるようにデバッグ用に公開（任意）
(globalThis as unknown as { __debug: unknown }).__debug = {
  state: () => state,
  projectPoint,
};
