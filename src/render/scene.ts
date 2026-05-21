// Three.js シーン構築。
//
// 設計のキモ:
// projection.basisOf(view) と Three.js カメラを完全に一致させる。
// orthographic camera の位置 = -R * forward、up = up でセットアップする。
// こうすることでロジック層が「画面で重なる」と判定した瞬間に、
// 実画面でもピクセル上で重なって見える。

import * as THREE from "three";
import { basisOf, type View } from "../game/projection.js";
import type { World } from "../game/world.js";
import { ballPosition, type BallState } from "../game/physics.js";

const PAPER = 0xf0ead6;
const INK = 0x1a1d24;
const RAIL_COLOR = 0x2b3140;
const BALL_COLOR = 0xc25a4a;
const GOAL_COLOR = 0xf6c177;
const GOAL_RING = 0xc28a30;
const BOX_LINE = 0x2b3140;
const GRID_MAIN = 0x9e9886;
const GRID_SUB = 0xc8c2ad;

const CAMERA_DISTANCE = 40;
const ORTHO_VIEW_SIZE = 14;
const BOUND_MARGIN = 2;

export type SceneRefs = Readonly<{
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  worldGroup: THREE.Group;
  ballMesh: THREE.Mesh;
  goalMesh: THREE.Mesh;
  resize: () => void;
}>;

export const createScene = (canvas: HTMLCanvasElement): SceneRefs => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);

  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const dir = new THREE.DirectionalLight(0xffffff, 0.55);
  dir.position.set(6, 12, 8);
  scene.add(dir);

  const camera = new THREE.OrthographicCamera(
    -ORTHO_VIEW_SIZE, ORTHO_VIEW_SIZE,
    ORTHO_VIEW_SIZE, -ORTHO_VIEW_SIZE,
    -200, 200,
  );

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // ボール
  const ballGeom = new THREE.SphereGeometry(0.45, 24, 18);
  const ballMat = new THREE.MeshStandardMaterial({ color: BALL_COLOR, roughness: 0.55, metalness: 0.1 });
  const ballMesh = new THREE.Mesh(ballGeom, ballMat);
  scene.add(ballMesh);

  // ゴール（あとで位置調整）
  const goalGeom = new THREE.SphereGeometry(0.7, 24, 18);
  const goalMat = new THREE.MeshStandardMaterial({
    color: GOAL_COLOR,
    emissive: GOAL_RING,
    emissiveIntensity: 0.45,
    roughness: 0.3,
  });
  const goalMesh = new THREE.Mesh(goalGeom, goalMat);
  scene.add(goalMesh);

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.left = -ORTHO_VIEW_SIZE * aspect;
    camera.right = ORTHO_VIEW_SIZE * aspect;
    camera.top = ORTHO_VIEW_SIZE;
    camera.bottom = -ORTHO_VIEW_SIZE;
    camera.updateProjectionMatrix();
  };

  return { scene, camera, renderer, worldGroup, ballMesh, goalMesh, resize };
};

// World をシーンに反映（再構築）。
export const populateWorld = (refs: SceneRefs, world: World): void => {
  while (refs.worldGroup.children.length > 0) {
    const c = refs.worldGroup.children[0]!;
    refs.worldGroup.remove(c);
    disposeObject(c);
  }

  // バウンディングボックスを算出
  let xmin = Infinity, ymin = Infinity, zmin = Infinity;
  let xmax = -Infinity, ymax = -Infinity, zmax = -Infinity;
  for (const n of world.nodes.values()) {
    if (n.position.x < xmin) xmin = n.position.x;
    if (n.position.y < ymin) ymin = n.position.y;
    if (n.position.z < zmin) zmin = n.position.z;
    if (n.position.x > xmax) xmax = n.position.x;
    if (n.position.y > ymax) ymax = n.position.y;
    if (n.position.z > zmax) zmax = n.position.z;
  }
  xmin -= BOUND_MARGIN; ymin -= BOUND_MARGIN; zmin -= BOUND_MARGIN;
  xmax += BOUND_MARGIN; ymax += BOUND_MARGIN; zmax += BOUND_MARGIN;
  const sx = xmax - xmin, sy = ymax - ymin, sz = zmax - zmin;
  const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2, cz = (zmin + zmax) / 2;

  // ワイヤーフレーム境界箱
  {
    const boxGeom = new THREE.BoxGeometry(sx, sy, sz);
    const edges = new THREE.EdgesGeometry(boxGeom);
    const lineMat = new THREE.LineBasicMaterial({ color: BOX_LINE, transparent: true, opacity: 0.55 });
    const lines = new THREE.LineSegments(edges, lineMat);
    lines.position.set(cx, cy, cz);
    refs.worldGroup.add(lines);
    boxGeom.dispose(); // edges は別 geometry を保持
  }

  // 床グリッド（バウンディング箱の底面に配置）
  {
    const size = Math.max(sx, sz);
    const div = Math.max(2, Math.round(size));
    const grid = new THREE.GridHelper(size, div, GRID_MAIN, GRID_SUB);
    grid.position.set(cx, ymin, cz);
    refs.worldGroup.add(grid);
  }

  // 軸ヘルパー（バウンディング箱の前下隅）
  {
    const axes = new THREE.AxesHelper(2);
    axes.position.set(xmin, ymin, zmax);
    refs.worldGroup.add(axes);
  }

  // 端点（ゴール以外）の球は描かない。レールの線が見えていれば十分。
  refs.goalMesh.position.set(
    world.nodes.get(world.goalNodeId)!.position.x,
    world.nodes.get(world.goalNodeId)!.position.y,
    world.nodes.get(world.goalNodeId)!.position.z,
  );

  // レール（cylinder + edge outline）
  for (const rail of world.rails.values()) {
    const a = world.nodes.get(rail.from)!.position;
    const b = world.nodes.get(rail.to)!.position;
    const ax = a.x, ay = a.y, az = a.z;
    const bx = b.x, by = b.y, bz = b.z;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const railGeom = new THREE.CylinderGeometry(0.16, 0.16, length, 16, 1);
    const railMat = new THREE.MeshStandardMaterial({ color: RAIL_COLOR, roughness: 0.4, metalness: 0.5 });
    const railMesh = new THREE.Mesh(railGeom, railMat);
    railMesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);

    const dirVec = new THREE.Vector3(dx, dy, dz).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dirVec);
    railMesh.quaternion.copy(quat);
    refs.worldGroup.add(railMesh);

    const edges = new THREE.EdgesGeometry(railGeom, 25);
    const edgeMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.4 });
    const edgeLines = new THREE.LineSegments(edges, edgeMat);
    edgeLines.position.copy(railMesh.position);
    edgeLines.quaternion.copy(railMesh.quaternion);
    refs.worldGroup.add(edgeLines);
  }
};

const disposeObject = (obj: THREE.Object3D): void => {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const m = mesh.material;
    if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
    else if (m) m.dispose();
  });
};

// カメラを view に合わせて配置（orthographic）。
export const applyView = (refs: SceneRefs, view: View): void => {
  const b = basisOf(view);
  const cx = -b.forward.x * CAMERA_DISTANCE;
  const cy = -b.forward.y * CAMERA_DISTANCE;
  const cz = -b.forward.z * CAMERA_DISTANCE;
  refs.camera.position.set(cx, cy, cz);
  refs.camera.up.set(b.up.x, b.up.y, b.up.z);
  refs.camera.lookAt(0, 0, 0);
};

export const placeBall = (refs: SceneRefs, world: World, ball: BallState): void => {
  const p = ballPosition(world, ball);
  refs.ballMesh.position.set(p.x, p.y, p.z);
};
