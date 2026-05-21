// アプリケーションエントリ。
//
// 視点 (yaw, pitch) はマウスドラッグで自由に回転。回転制限なし。
// 物理 (stepBall) は毎フレーム進む。レール上の任意点で他レールと
// screen 交差したら自動的に乗り換える（中間視点リンク）。

import { levels } from "./game/levels.js";
import { makeInitialBall, stepBall, type BallState } from "./game/physics.js";
import { projectPoint, type View } from "./game/projection.js";
import { buildWorld, type World } from "./game/world.js";
import { applyView, createScene, placeBall, populateWorld } from "./render/scene.js";
import { createNavCube } from "./render/navCube.js";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const navCanvas = document.getElementById("navcube") as HTMLCanvasElement;
const stageNumEl = document.getElementById("stage-num")!;
const statusEl = document.getElementById("hud-status")!;
const debugEl = document.getElementById("hud-debug")!;

const refs = createScene(canvas);
refs.resize();
window.addEventListener("resize", refs.resize);

const navCube = createNavCube(navCanvas);

// --- ゲーム状態 ---
type GameState = {
  levelIndex: number;
  world: World;
  view: View;
  ball: BallState;
  cleared: boolean; // ゴール到達フラグ（達成後もボールは止めない）
};

const loadLevel = (idx: number): GameState => {
  const lv = levels[idx]!;
  const world = buildWorld(lv.spec);
  populateWorld(refs, world);
  const ball = makeInitialBall(world);
  placeBall(refs, world, ball);
  stageNumEl.textContent = `${idx + 1} / ${levels.length}`;
  setStatus(""); // 中央のステージ情報は出さない。CLEAR! のみ後でここに表示。
  return {
    levelIndex: idx,
    world,
    view: { yaw: 0.4, pitch: 0.25 }, // 少し斜めの初期視点で 3D 感を出す
    ball,
    cleared: false,
  };
};

const setStatus = (s: string) => {
  statusEl.textContent = s;
};

let state: GameState = loadLevel(0);

// --- 入力 ---
// 矢印キーで前後ステージへ。Space/R で現ステージ再開。
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") {
    e.preventDefault();
    state = loadLevel((state.levelIndex + 1) % levels.length);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    state = loadLevel((state.levelIndex - 1 + levels.length) % levels.length);
  } else if (e.key === " " || e.key === "Spacebar" || e.key === "r" || e.key === "R") {
    e.preventDefault();
    state = loadLevel(state.levelIndex);
  }
});

const MOUSE_YAW_SENS = 0.006; // ピクセルあたり rad
const MOUSE_PITCH_SENS = 0.006;

let dragging = false;
let lastX = 0;
let lastY = 0;
let pointerId: number | null = null;

canvas.style.cursor = "grab";

canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 && e.pointerType === "mouse") return;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  pointerId = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = "grabbing";
});

const endDrag = () => {
  if (!dragging) return;
  dragging = false;
  if (pointerId !== null) {
    try {
      canvas.releasePointerCapture(pointerId);
    } catch {
      // 既に解放済みなど
    }
    pointerId = null;
  }
  canvas.style.cursor = "grab";
};

canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  // 回転制限なし。yaw/pitch をそのまま蓄積する（CAD 風）。
  state.view = {
    yaw: state.view.yaw + dx * MOUSE_YAW_SENS,
    pitch: state.view.pitch - dy * MOUSE_PITCH_SENS,
  };
});

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("pointerleave", endDrag);

// 右クリックメニュー無効化（ドラッグ操作の邪魔になりうるため）
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// ナビゲーションキューブは向き表示のみ（クリックスナップは無効）。
navCanvas.style.pointerEvents = "none";

const updateDebug = () => {
  const yawDeg = ((state.view.yaw * 180) / Math.PI).toFixed(1);
  const pitchDeg = ((state.view.pitch * 180) / Math.PI).toFixed(1);
  debugEl.textContent =
    `yaw ${yawDeg}°  pitch ${pitchDeg}°\n` +
    `rail ${state.ball.railId}  t ${state.ball.t.toFixed(2)}\n` +
    `speed ${state.ball.speed.toFixed(2)}  cooldown ${state.ball.cooldown.toFixed(2)}`;
};

// --- メインループ ---
let last = performance.now();
const tick = () => {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // ボールは常時更新する（ゴール後も止めない）。
  const r = stepBall(state.world, state.ball, state.view, dt);
  state.ball = r.ball;
  for (const ev of r.events) {
    if (ev.kind === "goal" && !state.cleared) {
      state.cleared = true;
      setStatus("CLEAR!");
    }
  }

  applyView(refs, state.view);
  placeBall(refs, state.world, state.ball);
  refs.renderer.render(refs.scene, refs.camera);
  navCube.render(state.view);
  updateDebug();

  requestAnimationFrame(tick);
};

requestAnimationFrame(tick);

(globalThis as unknown as { __debug: unknown }).__debug = {
  state: () => state,
  projectPoint,
};
