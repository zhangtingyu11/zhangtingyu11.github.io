---
title: 自动驾驶传感器标定（一）：相机内参
date: 2026-08-19 18:00:00
updated: 2026-08-19 18:00:00
permalink: posts/camera-intrinsics/
categories:
  - 自动驾驶
  - 传感器标定
tags:
  - 计算机视觉
  - 相机标定
  - 相机内参
description: 从直觉出发认识相机内参矩阵，逐一理解 fx、fy、cx、cy 和 s，并通过左右对比实验观察参数变化。
cover: /assets/autonomous-driving/sensor-calibration/01-camera-intrinsics/cover.svg
top_img: /assets/autonomous-driving/sensor-calibration/01-camera-intrinsics/cover.svg
aside: true
toc: true
---

相机内参描述的是：**一条三维光线如何落到二维图片的某个像素上**。下面跟着一个空间点走完投影过程，再动手改变每个参数看看。

## 先分清：一个点为什么有三组坐标

同一个点在投影的不同阶段，会写成相机坐标 `(Xc, Yc, Zc)`、归一化坐标 `(x, y)` 和像素坐标 `(u, v)`。

### 相机坐标系：相机眼中的三维世界

以光心 `O` 为原点，常约定 `Xc` 向右、`Yc` 向下、`Zc` 朝镜头前方。空间点 `P` 的坐标记作 `(Xc, Yc, Zc)`；`P` 只是点的名字。

<figure class="coordinate-figure">
  <img src="/assets/autonomous-driving/sensor-calibration/01-camera-intrinsics/camera-coordinate-system.svg?v=2" alt="相机坐标系、空间点和归一化成像平面的关系">
  <figcaption>空间点 P 发出的光线经过光心 O，与归一化成像平面相交。</figcaption>
</figure>

`Zc` 表示点有多深。投影时先除以深度：

```text
x = Xc / Zc
y = Yc / Zc
```

得到的 `(x, y)` 位于假想的 `Zc = 1` 平面，没有像素单位。`Zc` 越大，投影越靠近光轴，也就是“近大远小”。

<div class="depth-projection" data-depth-projection>
  <div class="depth-projection__header">
    <div>
      <strong>把点 P 沿着 Zc 方向推远</strong>
      <span>保持 Xc = 1.4 不变，只改变点到相机的深度</span>
    </div>
    <button type="button" data-depth-toggle aria-pressed="true">暂停</button>
  </div>
  <canvas data-depth-canvas role="img" aria-label="空间点远离相机时，归一化投影点逐渐靠近光轴的动画"></canvas>
  <div class="depth-projection__control">
    <label>
      <span>深度 Zc</span>
      <output data-depth-output>2.4</output>
      <input data-depth-range type="range" min="2.4" max="8.4" step="0.1" value="2.4" aria-label="调整空间点的深度 Zc">
    </label>
  </div>
  <p class="depth-projection__explain" data-depth-explain aria-live="polite"></p>
</div>

> 不同教材的坐标轴方向可能不同；只要约定与公式前后一致即可。

### 像素坐标系：图片上的最终位置

数字图片通常以左上角为原点 `(0, 0)`，`u` 向右、`v` 向下，单位是像素：

<figure class="coordinate-figure">
  <img src="/assets/autonomous-driving/sensor-calibration/01-camera-intrinsics/image-coordinate-system.svg" alt="图像像素坐标系、主点和投影点的位置关系">
  <figcaption>主点是光轴落到图像上的位置；像素点 p 的坐标写成 (u, v)。</figcaption>
</figure>

完整流程如下：

<div class="projection-flow" role="img" aria-label="空间点依次经过除以深度 Zc 和乘以内参 K，最终得到像素坐标">
  <div class="projection-flow__node projection-flow__node--camera">
    <span class="projection-flow__step">01 · 相机坐标系</span>
    <strong>空间点 P</strong>
    <code>(Xc, Yc, Zc)</code>
    <small>单位通常是米</small>
  </div>
  <div class="projection-flow__arrow">
    <span>除以深度 Zc</span>
    <i aria-hidden="true"></i>
  </div>
  <div class="projection-flow__node projection-flow__node--normalized">
    <span class="projection-flow__step">02 · 归一化平面</span>
    <strong>归一化坐标</strong>
    <code>(x, y)</code>
    <small>没有像素单位</small>
  </div>
  <div class="projection-flow__arrow">
    <span>补 1 后乘以内参 K</span>
    <i aria-hidden="true"></i>
  </div>
  <div class="projection-flow__node projection-flow__node--pixel">
    <span class="projection-flow__step">03 · 数字图像</span>
    <strong>像素坐标</strong>
    <code>(u, v)</code>
    <small>单位是像素 px</small>
  </div>
</div>

因为 `K` 是 3×3 矩阵，要先把 `(x, y)` 写成齐次坐标 `[x, y, 1]ᵀ`。末尾的 `1` 只是数学表示，不是新的空间维度。

## 内参矩阵长什么样？

在标准针孔相机模型中，归一化坐标到像素坐标的完整写法是：

<div class="homogeneous-equation" role="img" aria-label="像素齐次坐标 u v 1 等于内参矩阵 K 乘以归一化齐次坐标 x y 1">
  <span class="vector-grid"><span>u</span><span>v</span><span>1</span></span>
  <span class="homogeneous-equation__symbol">=</span>
  <span class="homogeneous-equation__symbol homogeneous-equation__k">K</span>
  <span class="vector-grid"><span>x</span><span>y</span><span>1</span></span>
</div>

其中，内参矩阵 `K` 通常写成：

<div class="intrinsic-matrix" aria-label="相机内参矩阵 K">
  <span class="intrinsic-matrix__symbol">K =</span>
  <span class="matrix-grid">
    <span>f<sub>x</sub></span><span>s</span><span>c<sub>x</sub></span>
    <span>0</span><span>f<sub>y</sub></span><span>c<sub>y</sub></span>
    <span>0</span><span>0</span><span>1</span>
  </span>
</div>

### 矩阵里的五个参数

<div class="parameter-cards">
  <div class="parameter-card"><strong>f<sub>x</sub></strong><p>横向缩放，单位通常是像素。</p></div>
  <div class="parameter-card"><strong>f<sub>y</sub></strong><p>纵向缩放，单位通常是像素。</p></div>
  <div class="parameter-card"><strong>c<sub>x</sub></strong><p>主点横坐标，控制左右平移。</p></div>
  <div class="parameter-card"><strong>c<sub>y</sub></strong><p>主点纵坐标，控制上下平移。</p></div>
  <div class="parameter-card"><strong>s</strong><p>倾斜参数，控制横向剪切，通常接近 0。</p></div>
</div>

把矩阵乘开，真正决定像素位置的是前两行：

```text
u = fx · x + s · y + cx
v = fy · y          + cy
```

把上一节的 `x = Xc/Zc`、`y = Yc/Zc` 代入，就能得到从三维相机坐标直接计算像素坐标的形式：

```text
u = fx · Xc/Zc + s · Yc/Zc + cx
v = fy · Yc/Zc             + cy
```

### `fx` 和 `fy` 是镜头上写的焦距吗？

不是。镜头焦距用毫米，内参中的 `fx`、`fy` 用像素：

```text
fx = 镜头焦距（mm）÷ 单个像素的横向尺寸（mm/px）
fy = 镜头焦距（mm）÷ 单个像素的纵向尺寸（mm/px）
```

真实变焦时二者通常同比例变化；单独调整只是为了观察各自的作用。

### `cx`、`cy` 为什么不一定在图片正中心？

理想主点接近图片中心，但装配和裁切会产生偏移，所以要通过标定求出。

### `s` 到底是什么？

`s` 描述像素横纵轴不完全垂直造成的剪切。现代相机通常取 `s = 0`。

## 为什么第二行第一列一定写 0？

标准内参约定为上三角矩阵：倾斜放在 `s`，旋转归入外参，所以第二行第一列写 0。若这里非 0，它可能不是这种标准形式的内参矩阵。

## 最后一行为什么是 `[0, 0, 1]`？

它用于保留齐次坐标的第三个分量。把尺度归一化为 1 后，最后一行就是 `[0, 0, 1]`。

<div class="intrinsic-note">
  <strong>一句话记忆：</strong>前两行决定像素落在哪里，最后一行负责齐次坐标的尺度约定。
</div>

## 亲手改变参数看看

左边是原始投影，右边只改变当前选择的参数。拖动滑块直接观察差异。

<div class="intrinsic-lab" data-intrinsic-lab>
  <div class="intrinsic-lab__header">
    <div class="intrinsic-lab__title"><span class="intrinsic-lab__dot"></span>CAMERA INTRINSICS CONSOLE</div>
    <div class="intrinsic-lab__status">PINHOLE MODEL · 800 × 450</div>
  </div>
  <div class="intrinsic-lab__body">
    <div class="intrinsic-lab__tabs" data-tabs role="group" aria-label="选择要观察的内参">
      <button class="is-active" type="button" data-mode="f">真实变焦 f</button>
      <button type="button" data-mode="fx">只看 f<sub>x</sub></button>
      <button type="button" data-mode="fy">只看 f<sub>y</sub></button>
      <button type="button" data-mode="cx">主点 c<sub>x</sub></button>
      <button type="button" data-mode="cy">主点 c<sub>y</sub></button>
      <button type="button" data-mode="s">倾斜 s</button>
    </div>
    <div class="intrinsic-lab__control">
      <label><span data-control-label>真实变焦 f</span><output data-output>125%</output></label>
      <input data-range type="range" min="65" max="150" step="1" value="125" aria-label="调整当前参数">
    </div>
    <div class="intrinsic-lab__matrix-row">
      <span>当前 K =</span>
      <span class="matrix-grid" data-matrix aria-label="当前内参矩阵">
        <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
      </span>
    </div>
    <div class="intrinsic-lab__comparison">
      <div>
        <div class="intrinsic-lab__scene-title"><strong>原始图</strong><span>K₀ = (600, 600, 400, 225, 0)</span></div>
        <canvas role="img" aria-label="使用原始内参投影的道路场景"></canvas>
      </div>
      <div>
        <div class="intrinsic-lab__scene-title"><strong>调整后</strong><span data-changed-label>fₓ = fᵧ = 750 px</span></div>
        <canvas role="img" aria-label="使用调整后内参投影的道路场景"></canvas>
      </div>
    </div>
    <p class="intrinsic-lab__explain" data-explain aria-live="polite"></p>
    <p class="intrinsic-lab__tip">深色背景只是画布；请观察道路、建筑、树、车辆和青色主点的相对变化。</p>
  </div>
</div>

## 内参和镜头畸变不是一回事

内参只产生缩放、平移或剪切，直线仍是直线。鱼眼、桶形和枕形畸变造成的弯曲由另一组畸变参数描述，不在 `K` 中。

## 小结

- `(Xc, Yc, Zc)` 除以深度，得到无单位的 `(x, y)`。
- `[x, y, 1]ᵀ` 乘以内参 `K`，得到像素坐标 `(u, v)`。
- `fx`、`fy` 控制缩放，`cx`、`cy` 控制平移，`s` 控制剪切。
- 内参不负责把直线变弯；那是畸变参数的工作。
