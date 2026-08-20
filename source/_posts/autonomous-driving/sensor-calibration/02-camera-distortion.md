---
title: 自动驾驶传感器标定（二）：相机畸变
date: 2026-08-20 12:00:00
updated: 2026-08-20 12:00:00
permalink: posts/camera-distortion/
categories:
  - 自动驾驶
  - 传感器标定
tags:
  - 计算机视觉
  - 相机标定
  - 相机畸变
description: 从桶形、枕形和切向畸变出发，理解 RadTan、Rational、Kannala–Brandt 与全向相机模型。
cover: /assets/autonomous-driving/sensor-calibration/02-camera-distortion/cover.svg
top_img: /assets/autonomous-driving/sensor-calibration/02-camera-distortion/cover.svg
aside: true
toc: true
---

上一篇里的针孔相机默认“直线拍出来还是直线”。真实镜头却会让画面边缘弯曲，这就是**相机畸变**。

## 畸变发生在哪一步？

畸变发生在归一化坐标和像素坐标之间：

<div class="distortion-flow" role="img" aria-label="归一化坐标先经过畸变模型，再乘以内参矩阵得到像素坐标">
  <div><small>理想投影</small><strong>(x, y)</strong></div>
  <span><b>畸变模型 D</b><i aria-hidden="true"></i></span>
  <div><small>畸变后</small><strong>(x<sub>d</sub>, y<sub>d</sub>)</strong></div>
  <span><b>乘以内参 K</b><i aria-hidden="true"></i></span>
  <div><small>数字图像</small><strong>(u, v)</strong></div>
</div>

所以 `K` 可以保持同样的 3×3 形式，真正变化的是前面选用了哪一种畸变或投影模型。

## 先认识三种常见现象

<div class="distortion-kind-cards">
  <div><strong>桶形畸变</strong><p>画面像木桶一样鼓起，边缘被拉向中心，广角镜头常见。</p></div>
  <div><strong>枕形畸变</strong><p>画面像软垫一样向内收紧，边缘被推离中心。</p></div>
  <div><strong>切向畸变</strong><p>镜头与传感器没有完全对正，变形通常不再左右对称。</p></div>
</div>

桶形和枕形都属于**径向畸变**：离主点越远，变化通常越明显。

## RadTan：最常见的普通镜头模型

Brown–Conrady 模型也常叫 `RadTan`。先计算点到主点的半径：

```text
r² = x² + y²
L(r) = 1 + k1·r² + k2·r⁴ + k3·r⁶
```

再叠加径向与切向畸变：

```text
xd = x·L(r) + 2·p1·x·y + p2·(r² + 2·x²)
yd = y·L(r) + p1·(r² + 2·y²) + 2·p2·x·y
```

<div class="distortion-parameter-cards">
  <div><strong>k1、k2、k3</strong><p>径向系数，控制桶形或枕形弯曲。</p></div>
  <div><strong>p1、p2</strong><p>切向系数，描述镜头偏心或倾斜。</p></div>
</div>

OpenCV 中最常见的参数顺序是 `(k1, k2, p1, p2, k3)`。系数正负要结合具体公式判断；在这套公式下，`k1 < 0` 通常呈桶形，`k1 > 0` 通常呈枕形。

## Rational：RadTan 的宽角扩展

当普通多项式不够用时，可以把径向缩放改成分式：

```text
       1 + k1·r² + k2·r⁴ + k3·r⁶
L(r) = ───────────────────────────
       1 + k4·r² + k5·r⁴ + k6·r⁶
```

它能拟合更复杂的径向变化，但参数更多，也更容易过拟合。标定图没有覆盖到画面边缘时，不要只为降低误差盲目增加参数。

## Kannala–Brandt：鱼眼常用模型

鱼眼接近 180° 视场时，不能只把它当作“畸变很大的针孔”。Kannala–Brandt（KB）直接使用光线与光轴的夹角 `θ`：

```text
θ = atan(r)
θd = θ·(1 + k1·θ² + k2·θ⁴ + k3·θ⁶ + k4·θ⁸)
```

再用 `θd/r` 把方向映射到图像。它关注的是**光线角度**，而 RadTan 关注的是**成像平面上的半径**。OpenCV 的 `fisheye` 模块使用的就是这一类模型。

真实鱼眼还可能接近等距、等立体角或体视投影；KB 用角度多项式统一拟合这些不同镜头。

## 还会遇到哪些模型？

<div class="distortion-model-cards">
  <div><strong>RadTan</strong><p>普通针孔、前视或长焦相机。</p></div>
  <div><strong>Rational</strong><p>RadTan 不够准确的较宽视场镜头。</p></div>
  <div><strong>KB / Fisheye</strong><p>鱼眼和接近 180° 的超广角相机。</p></div>
  <div><strong>UCM / Mei</strong><p>全向或折反射相机；通过单位球和参数 ξ 建模。</p></div>
</div>

工程中还会看到 Thin Prism、Tilted Sensor、Double Sphere 和 EUCM。名字很多，但核心问题只有一个：**像素点对应哪一条空间光线？**

## 亲手改变畸变看看

左右是同一个道路场景。切换畸变类型，再拖动强度滑块，重点观察建筑边缘和车道线。

<div class="distortion-lab" data-distortion-lab>
  <div class="distortion-lab__tabs" data-distortion-tabs role="group" aria-label="选择畸变类型">
    <button class="is-active" type="button" data-distortion-mode="barrel">桶形</button>
    <button type="button" data-distortion-mode="pincushion">枕形</button>
    <button type="button" data-distortion-mode="tangential">切向</button>
    <button type="button" data-distortion-mode="fisheye">鱼眼</button>
  </div>
  <label class="distortion-lab__control">
    <span>畸变强度 <output data-distortion-output>70%</output></span>
    <input data-distortion-range type="range" min="0" max="100" step="1" value="70" aria-label="调整畸变强度">
  </label>
  <div class="distortion-lab__comparison">
    <div><strong>理想针孔图像</strong><canvas role="img" aria-label="无畸变的道路场景"></canvas></div>
    <div><strong>畸变后</strong><canvas role="img" aria-label="应用当前畸变模型后的道路场景"></canvas></div>
  </div>
  <p data-distortion-explain aria-live="polite"></p>
</div>

## 模型怎么选？

- 普通镜头先用 RadTan；边缘仍有系统性残差，再考虑 Rational。
- 鱼眼优先使用 KB / Fisheye，不要硬套普通针孔模型。
- 全向或折反射相机再考虑 UCM / Mei、Double Sphere 等模型。
- 不只看总 RMS：还要看画面边缘、残差分布和反投影光线是否稳定。

## 小结

- RadTan 用 `k` 描述径向弯曲，用 `p` 描述切向偏心。
- Rational 是 RadTan 的分式扩展，表达力更强，也更容易过拟合。
- KB 用光线夹角 `θ` 建模，适合鱼眼和超广角。
- `K` 与畸变模型必须配套保存，不能只拿一个 3×3 矩阵描述整台相机。

