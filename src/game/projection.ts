// 視点投影：3D 空間の点を「画面平面」上の 2D 座標に射影する。
// 簡易のため平行投影（orthographic）。
// View は yaw（Y 軸回りの回転）と pitch（X 軸回りの回転）で定義される。
//
// 視線方向は View 回転を (0,0,-1) に適用して得る。
// 画面平面は視線方向に垂直で、上方向は View 回転を (0,1,0) に適用して得る。
// 画面 x 軸は up × forward。

import type { Vec2, Vec3 } from "./vec.js";
import { dot3, v2, v3 } from "./vec.js";

export type View = Readonly<{
  yaw: number; // Y 軸回り（左右の見回し）。ラジアン。
  pitch: number; // X 軸回り（上下の見上げ／下げ）。ラジアン。
}>;

// View の基底ベクトル：right（画面 +x）、up（画面 +y）、forward（カメラから手前への方向、視点 → シーン）
// 標準的な右手系。Three.js と一致させる: yaw を Y 回り、pitch を X 回りで適用（順序: yaw → pitch）
export type ViewBasis = Readonly<{ right: Vec3; up: Vec3; forward: Vec3 }>;

export const basisOf = (view: View): ViewBasis => {
  // pitch を X 軸で回し、その後 yaw を Y 軸で回した結果のローカル軸を求める。
  // forward は元来 (0, 0, -1)（カメラの前方）。
  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  const cp = Math.cos(view.pitch);
  const sp = Math.sin(view.pitch);

  // forward = R_yaw * R_pitch * (0,0,-1)
  // R_pitch * (0,0,-1) = (0, sin(p), -cos(p))
  // R_yaw  * (0, sin(p), -cos(p)) = (-cos(p)*sin(y), sin(p), -cos(p)*cos(y))
  const forward = v3(-cp * sy, sp, -cp * cy);

  // up = R_yaw * R_pitch * (0,1,0)
  // R_pitch * (0,1,0) = (0, cos(p), sin(p))
  // R_yaw  * (0, cos(p), sin(p)) = (sin(p)*sin(y), cos(p), sin(p)*cos(y))
  const up = v3(sp * sy, cp, sp * cy);

  // right = R_yaw * R_pitch * (1,0,0)
  // R_pitch * (1,0,0) = (1, 0, 0)
  // R_yaw  * (1, 0, 0) = (cos(y), 0, -sin(y))
  const right = v3(cy, 0, -sy);

  return { right, up, forward };
};

// 3D 点を視点平面に平行投影する。画面 (right, up) 座標を返す。
export const projectPoint = (point: Vec3, view: View): Vec2 => {
  const b = basisOf(view);
  return v2(dot3(point, b.right), dot3(point, b.up));
};

// 2 点の画面距離。
export const screenDistance = (a: Vec3, b: Vec3, view: View): number => {
  const pa = projectPoint(a, view);
  const pb = projectPoint(b, view);
  const dx = pa.x - pb.x;
  const dy = pa.y - pb.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// 視線方向 (forward) に沿った「奥行き」。前方ほど値が小さい（手前が大きい）。
// カメラから見て手前にあるノードを判定するときに使う。
export const depth = (point: Vec3, view: View): number => {
  const b = basisOf(view);
  return dot3(point, b.forward);
};
