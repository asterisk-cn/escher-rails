// ナビゲーションキューブ。3D CAD 風の小さなウィジェット。
//
// 表示: 6 面ラベル付きの立方体。main view の (yaw, pitch) と同期して回転する。
// 操作: 面クリックで主要 6 視点（FRONT / BACK / LEFT / RIGHT / TOP / BOTTOM）にスナップ。
//
// projection.basisOf と一致するカメラ配置で描画するので、メインビューと同じ向きが見える。

import * as THREE from "three";
import { basisOf, type View } from "../game/projection.js";

const CUBE_DISTANCE = 4.5;
const CUBE_ORTHO = 1.0;

// BoxGeometry のマテリアル順は [+X, -X, +Y, -Y, +Z, -Z]
const FACE_DEFS = [
  { axis: "+X", label: "RIGHT", view: { yaw: Math.PI / 2, pitch: 0 } },
  { axis: "-X", label: "LEFT", view: { yaw: -Math.PI / 2, pitch: 0 } },
  { axis: "+Y", label: "TOP", view: { yaw: 0, pitch: -Math.PI / 2 } },
  { axis: "-Y", label: "BOT", view: { yaw: 0, pitch: Math.PI / 2 } },
  { axis: "+Z", label: "FRONT", view: { yaw: 0, pitch: 0 } },
  { axis: "-Z", label: "BACK", view: { yaw: Math.PI, pitch: 0 } },
];

const makeFaceTexture = (label: string): THREE.CanvasTexture => {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  // 紙色のベース
  g.fillStyle = "#ede5cb";
  g.fillRect(0, 0, size, size);
  // ヘアライン枠
  g.strokeStyle = "#3b3a36";
  g.lineWidth = 4;
  g.strokeRect(2, 2, size - 4, size - 4);
  // ラベル
  g.fillStyle = "#1a1d24";
  g.font = "bold 28px Iosevka, JetBrains Mono, ui-monospace, monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(label, size / 2, size / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

export type NavCubeRefs = Readonly<{
  render: (view: View) => void;
  pickFace: (event: MouseEvent) => View | null;
}>;

export const createNavCube = (canvas: HTMLCanvasElement): NavCubeRefs => {
  const scene = new THREE.Scene();
  scene.background = null;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.width, canvas.height, false);

  const camera = new THREE.OrthographicCamera(
    -CUBE_ORTHO, CUBE_ORTHO, CUBE_ORTHO, -CUBE_ORTHO, -10, 10,
  );

  // 軽い照明
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const dl = new THREE.DirectionalLight(0xffffff, 0.4);
  dl.position.set(2, 3, 2);
  scene.add(dl);

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    FACE_DEFS.map((f) => new THREE.MeshLambertMaterial({ map: makeFaceTexture(f.label) })),
  );
  scene.add(cube);

  // 黒い縁線
  const edges = new THREE.EdgesGeometry(cube.geometry);
  const edgeLines = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x1a1d24 }),
  );
  scene.add(edgeLines);

  const raycaster = new THREE.Raycaster();

  const apply = (view: View) => {
    const b = basisOf(view);
    camera.position.set(-b.forward.x * CUBE_DISTANCE, -b.forward.y * CUBE_DISTANCE, -b.forward.z * CUBE_DISTANCE);
    camera.up.set(b.up.x, b.up.y, b.up.z);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };

  const render = (view: View) => {
    apply(view);
    renderer.render(scene, camera);
  };

  const pickFace = (event: MouseEvent): View | null => {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(cube, false);
    if (hits.length === 0) return null;
    const hit = hits[0]!;
    const mi = hit.face?.materialIndex;
    if (mi === undefined) return null;
    return FACE_DEFS[mi]!.view;
  };

  return { render, pickFace };
};
