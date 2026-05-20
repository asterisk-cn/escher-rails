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
const NODE_COLOR = 0x4a4a4a;
const BALL_COLOR = 0xc25a4a;
const GOAL_COLOR = 0xf6c177;
const GOAL_RING = 0xc28a30;
const OVERLAP_COLOR = 0xf6c177;
const HIGHLIGHT_COLOR = 0xc25a4a;

const CAMERA_DISTANCE = 40;
const ORTHO_VIEW_SIZE = 14;

export type SceneRefs = Readonly<{
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  worldGroup: THREE.Group;
  ballMesh: THREE.Mesh;
  nodeMeshes: Map<string, THREE.Mesh>;
  goalMesh: THREE.Mesh;
  overlapRing: THREE.Mesh;
  overlapRing2: THREE.Mesh;
  resize: () => void;
}>;

export const createScene = (canvas: HTMLCanvasElement): SceneRefs => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);

  // 環境光 + 1 灯のディレクショナル。陰影は控えめに、紙のような印象に。
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const dir = new THREE.DirectionalLight(0xffffff, 0.55);
  dir.position.set(6, 12, 8);
  scene.add(dir);

  // orthographic camera。aspect は resize で調整。
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

  // ゴールマーカ（後で配置）
  const goalGeom = new THREE.SphereGeometry(0.7, 24, 18);
  const goalMat = new THREE.MeshStandardMaterial({
    color: GOAL_COLOR,
    emissive: GOAL_RING,
    emissiveIntensity: 0.45,
    roughness: 0.3,
  });
  const goalMesh = new THREE.Mesh(goalGeom, goalMat);
  scene.add(goalMesh);

  // 視点重なりインジケータ（リング 2 つ）
  const ringGeom = new THREE.RingGeometry(0.7, 0.85, 32);
  const ringMat1 = new THREE.MeshBasicMaterial({
    color: OVERLAP_COLOR, side: THREE.DoubleSide, transparent: true, opacity: 0,
  });
  const ringMat2 = new THREE.MeshBasicMaterial({
    color: HIGHLIGHT_COLOR, side: THREE.DoubleSide, transparent: true, opacity: 0,
  });
  const overlapRing = new THREE.Mesh(ringGeom, ringMat1);
  const overlapRing2 = new THREE.Mesh(ringGeom, ringMat2);
  scene.add(overlapRing, overlapRing2);

  const nodeMeshes = new Map<string, THREE.Mesh>();

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

  return { scene, camera, renderer, worldGroup, ballMesh, nodeMeshes, goalMesh, overlapRing, overlapRing2, resize };
};

// World をシーンに反映（再構築）。
export const populateWorld = (refs: SceneRefs, world: World): void => {
  // 既存の世界オブジェクトをクリア
  while (refs.worldGroup.children.length > 0) {
    const c = refs.worldGroup.children[0]!;
    refs.worldGroup.remove(c);
    disposeObject(c);
  }
  refs.nodeMeshes.clear();

  // ノードを「球 + 黒い縁」で描く
  for (const node of world.nodes.values()) {
    const isGoal = node.id === world.goalNodeId;
    const radius = isGoal ? 0 : 0.28;
    if (radius > 0) {
      const g = new THREE.SphereGeometry(radius, 16, 12);
      const m = new THREE.MeshStandardMaterial({ color: NODE_COLOR, roughness: 0.6 });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(node.position.x, node.position.y, node.position.z);
      refs.worldGroup.add(mesh);
      refs.nodeMeshes.set(node.id, mesh);
    }
  }
  refs.goalMesh.position.set(
    world.nodes.get(world.goalNodeId)!.position.x,
    world.nodes.get(world.goalNodeId)!.position.y,
    world.nodes.get(world.goalNodeId)!.position.z,
  );

  // レール（cylinder で太めに描き、両端は球で丸める）
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

    // 中点に移動
    railMesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    // cylinder のデフォルト軸は +Y。 (ax,ay,az)→(bx,by,bz) の方向に向ける。
    const dirVec = new THREE.Vector3(dx, dy, dz).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dirVec);
    railMesh.quaternion.copy(quat);

    refs.worldGroup.add(railMesh);

    // エッジ線（インクアウトライン）
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
// projection.basisOf と一致させる: forward 方向の逆側にカメラを置く。
export const applyView = (refs: SceneRefs, view: View): void => {
  const b = basisOf(view);
  const cx = -b.forward.x * CAMERA_DISTANCE;
  const cy = -b.forward.y * CAMERA_DISTANCE;
  const cz = -b.forward.z * CAMERA_DISTANCE;
  refs.camera.position.set(cx, cy, cz);
  refs.camera.up.set(b.up.x, b.up.y, b.up.z);
  refs.camera.lookAt(0, 0, 0);
};

// ボールを現在のレール上の位置に置く。
export const placeBall = (refs: SceneRefs, world: World, ball: BallState): void => {
  const p = ballPosition(world, ball);
  refs.ballMesh.position.set(p.x, p.y, p.z);
};

// 視点重なりリングを更新。重なりノードがあれば両方にリングを表示する。
export const updateOverlapRings = (
  refs: SceneRefs,
  world: World,
  targetNodeId: string | null,
  overlappingNodeId: string | null,
  view: View,
): void => {
  const ringMat1 = refs.overlapRing.material as THREE.MeshBasicMaterial;
  const ringMat2 = refs.overlapRing2.material as THREE.MeshBasicMaterial;
  if (!targetNodeId || !overlappingNodeId) {
    ringMat1.opacity = Math.max(0, ringMat1.opacity - 0.05);
    ringMat2.opacity = Math.max(0, ringMat2.opacity - 0.05);
    return;
  }
  const a = world.nodes.get(targetNodeId);
  const c = world.nodes.get(overlappingNodeId);
  if (!a || !c) return;
  refs.overlapRing.position.set(a.position.x, a.position.y, a.position.z);
  refs.overlapRing2.position.set(c.position.x, c.position.y, c.position.z);

  // リングはカメラに正対させる
  const b = basisOf(view);
  const lookAt = (m: THREE.Mesh) => {
    const target = new THREE.Vector3(
      m.position.x - b.forward.x,
      m.position.y - b.forward.y,
      m.position.z - b.forward.z,
    );
    m.up.set(b.up.x, b.up.y, b.up.z);
    m.lookAt(target);
  };
  lookAt(refs.overlapRing);
  lookAt(refs.overlapRing2);

  ringMat1.opacity = Math.min(0.9, ringMat1.opacity + 0.1);
  ringMat2.opacity = Math.min(0.9, ringMat2.opacity + 0.1);
};
