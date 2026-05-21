// アプリケーションエントリ。モード切替と入力配線のみ。
// ゲームロジックは modes/ 配下に分割されている。
//
// 操作:
//   Tab          モード切替（PUZZLE ⇄ COLLECT）
//   ← →         同モード内のステージ／マップを前後
//   Space / R    現ステージを再開
//   ドラッグ     視点回転（制限なし）

import { projectPoint, type View } from "./game/projection.js";
import { createCollectMode, type CollectMode } from "./modes/collectMode.js";
import { createPuzzleMode, type PuzzleMode } from "./modes/puzzleMode.js";
import { applyView, createScene } from "./render/scene.js";
import { createNavCube } from "./render/navCube.js";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const navCanvas = document.getElementById("navcube") as HTMLCanvasElement;
const stageEl = document.getElementById("hud-stage") as HTMLDivElement;
const stageNumEl = document.getElementById("stage-num")!;
const statusEl = document.getElementById("hud-status")!;
const collectEl = document.getElementById("hud-collect") as HTMLDivElement;
const timeNumEl = document.getElementById("time-num")!;
const scoreNumEl = document.getElementById("score-num")!;
const debugEl = document.getElementById("hud-debug")!;

const refs = createScene(canvas);
refs.resize();
window.addEventListener("resize", refs.resize);

const navCube = createNavCube(navCanvas);

// --- モード管理 ---
type ActiveMode = PuzzleMode | CollectMode;
let mode: ActiveMode = createCollectMode(refs); // 起動時は Collect モードがメイン
let view: View = { yaw: 0.4, pitch: 0.25 };

const setMode = (kind: "puzzle" | "collect") => {
  if (mode.type === kind) return;
  mode = kind === "puzzle" ? createPuzzleMode(refs) : createCollectMode(refs);
  view = { yaw: 0.4, pitch: 0.25 };
  setStatus("");
  syncModeHUD();
};

const setStatus = (s: string) => {
  statusEl.textContent = s;
};

const syncModeHUD = () => {
  if (mode.type === "puzzle") {
    const i = mode.info();
    stageEl.hidden = false;
    stageNumEl.textContent = `${i.stageIndex + 1} / ${i.total}`;
    collectEl.hidden = true;
  } else {
    const i = mode.info();
    stageEl.hidden = true;
    collectEl.hidden = false;
    timeNumEl.textContent = i.timeLeft.toFixed(1);
    scoreNumEl.textContent = String(i.score);
  }
};

syncModeHUD();

// --- 入力 ---
window.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    setMode(mode.type === "puzzle" ? "collect" : "puzzle");
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    mode.next();
    setStatus("");
    syncModeHUD();
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    mode.prev();
    setStatus("");
    syncModeHUD();
  } else if (e.key === " " || e.key === "Spacebar" || e.key === "r" || e.key === "R") {
    e.preventDefault();
    mode.restart();
    setStatus("");
    syncModeHUD();
  }
});

const MOUSE_YAW_SENS = 0.006;
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
      // 既に解放済み
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
  view = {
    yaw: view.yaw + dx * MOUSE_YAW_SENS,
    pitch: view.pitch - dy * MOUSE_PITCH_SENS,
  };
});

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("pointerleave", endDrag);
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// ナビキューブは向き表示のみ
navCanvas.style.pointerEvents = "none";

const updateDebug = () => {
  const yawDeg = ((view.yaw * 180) / Math.PI).toFixed(1);
  const pitchDeg = ((view.pitch * 180) / Math.PI).toFixed(1);
  debugEl.textContent = `mode ${mode.type}\nyaw ${yawDeg}°  pitch ${pitchDeg}°`;
};

// --- メインループ ---
let last = performance.now();
const tick = () => {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (mode.type === "puzzle") {
    const r = mode.step(view, dt);
    if (r.justCleared) setStatus("CLEAR!");
  } else {
    const r = mode.step(view, dt);
    const i = mode.info();
    timeNumEl.textContent = i.timeLeft.toFixed(1);
    scoreNumEl.textContent = String(i.score);
    if (r.justTimeUp) {
      setStatus(`TIME UP — SCORE ${i.score}`);
      // 中央の TIME/SCORE と TIME UP メッセージが重なるので隠す
      collectEl.hidden = true;
    }
  }

  applyView(refs, view);
  refs.renderer.render(refs.scene, refs.camera);
  navCube.render(view);
  updateDebug();

  requestAnimationFrame(tick);
};

requestAnimationFrame(tick);

(globalThis as unknown as { __debug: unknown }).__debug = {
  mode: () => mode,
  view: () => view,
  projectPoint,
};
