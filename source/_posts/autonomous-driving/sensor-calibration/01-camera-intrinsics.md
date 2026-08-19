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

自动驾驶汽车上的相机最终得到的是一张二维图片，道路和车辆却存在于三维世界中。相机内参描述的，就是**相机如何把一条三维光线换算成图片上的像素坐标**。

这篇不从复杂推导开始。我们先跟着一个空间点走完整个投影过程，弄清每一步在使用什么坐标；再打开内参矩阵，看看里面的每个数字究竟改变了什么。

## 先分清：一个点为什么有三组坐标

在看内参矩阵之前，先跟踪一个空间点。它会依次拥有三组坐标：相机坐标 `(Xc, Yc, Zc)`、归一化图像坐标 `(x, y)` 和像素坐标 `(u, v)`。它们不是三个不同的点，而是同一个点在投影过程不同阶段的三种表示。

### 相机坐标系：相机眼中的三维世界

把相机的光心当作原点 `O`。在计算机视觉中，经常约定 `Xc` 向右、`Yc` 向下、`Zc` 朝镜头前方。

我们先随便选一个空间点，并给它取名为 `P`（Point，点）。如果点 `P` 在三个方向上的坐标分别是 `Xc`、`Yc`、`Zc`，就可以记作：

```text
点 P 的相机坐标 = (Xc, Yc, Zc)
```

这里的 `P` 只是点的名字，不参与计算，也不是新的相机参数。图中展示的就是这个点与相机坐标系的关系：

<figure class="coordinate-figure">
  <img src="/assets/autonomous-driving/sensor-calibration/01-camera-intrinsics/camera-coordinate-system.svg?v=2" alt="相机坐标系、空间点和归一化成像平面的关系">
  <figcaption>空间点 P 发出的光线经过光心 O，与归一化成像平面相交。</figcaption>
</figure>

其中，`Zc` 可以直观理解为点在相机前方有多深。投影时先把横纵坐标都除以深度：

```text
x = Xc / Zc
y = Yc / Zc
```

这样得到的 `(x, y)` 叫作**归一化图像坐标**。它位于假想的 `Zc = 1` 平面上，还没有像素单位。同样大小的物体离相机越远，`Zc` 越大，投影通常就越靠近光轴——这就是“近大远小”的数学来源。

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

动画画的是 `Xc-Zc` 截面：点 `P` 的横向位置 `Xc` 始终不变。把它沿光轴推远时，光线与 `Zc = 1` 平面的交点会逐渐靠近光轴；如果把物体看成许多这样的点，整件物体的投影也就会变小。

> 坐标轴方向不是全世界只有一种画法。有些图形学教材会让 `Y` 轴向上，或者让相机朝 `-Z` 方向观察。关键不是死记方向，而是先说明约定，并让后续公式始终与它一致。本文采用计算机视觉中常见的上述约定。

### 像素坐标系：图片上的最终位置

归一化坐标只说明光线相对光轴的方向，相机最终保存的却是一张由像素组成的图片。像素坐标通常把左上角记作原点 `(0, 0)`，`u` 轴向右、`v` 轴向下，单位是**像素**：

<figure class="coordinate-figure">
  <img src="/assets/autonomous-driving/sensor-calibration/01-camera-intrinsics/image-coordinate-system.svg" alt="图像像素坐标系、主点和投影点的位置关系">
  <figcaption>主点是光轴落到图像上的位置；像素点 p 的坐标写成 (u, v)。</figcaption>
</figure>

严格来说，本文把 `Zc = 1` 平面上的 `(x, y)` 称为“归一化图像坐标”，把数字图片上的 `(u, v)` 称为“像素坐标”。口语中的“图像坐标”有时会泛指其中任意一种，所以看到公式时最好先确认它有没有像素单位。

现在，归一化坐标 `(x, y)` 与像素坐标 `(u, v)` 之间还缺一次换算。内参矩阵 `K` 要做的，就是根据相机的焦距、主点和倾斜参数，完成这最后一步。到这里，整个过程可以压缩成一行：

```text
空间点 (Xc, Yc, Zc)  →  归一化坐标 (x, y)  →  像素坐标 (u, v)
          除以 Zc                     乘以内参 K
```

这样一来，`K` 就不再是突然出现的 3×3 数字表了。它正好位于上面流程的第二个箭头，接下来我们把这个“换算盒子”打开。

## 内参矩阵长什么样？

在标准针孔相机模型中，负责把 `(x, y)` 变成 `(u, v)` 的内参矩阵通常写成：

<div class="intrinsic-matrix" aria-label="相机内参矩阵 K">
  <span class="intrinsic-matrix__symbol">K =</span>
  <span class="matrix-grid">
    <span>f<sub>x</sub></span><span>s</span><span>c<sub>x</sub></span>
    <span>0</span><span>f<sub>y</sub></span><span>c<sub>y</sub></span>
    <span>0</span><span>0</span><span>1</span>
  </span>
</div>

把矩阵乘法拆成真正决定像素位置的两行，就是：

```text
u = fx · x + s · y + cx
v = fy · y          + cy
```

把上一节的 `x = Xc/Zc`、`y = Yc/Zc` 代入，就能得到从三维相机坐标直接计算像素坐标的形式：

```text
u = fx · Xc/Zc + s · Yc/Zc + cx
v = fy · Yc/Zc             + cy
```

先别急着记公式。现在只需要抓住结构：`fx`、`fy` 负责缩放，`cx`、`cy` 负责把原点移到主点，`s` 负责横纵方向之间的倾斜耦合。下面逐个认识它们。

## 五个参数分别是什么意思？

<div class="parameter-cards">
  <div class="parameter-card"><strong>f<sub>x</sub></strong><p>横向焦距参数。数值越大，投影点相对主点的横向距离越大。</p></div>
  <div class="parameter-card"><strong>f<sub>y</sub></strong><p>纵向焦距参数。数值越大，投影点相对主点的纵向距离越大。</p></div>
  <div class="parameter-card"><strong>c<sub>x</sub>, c<sub>y</sub></strong><p>主点坐标，也就是相机光轴与成像平面的交点落在哪个像素附近。</p></div>
  <div class="parameter-card"><strong>s</strong><p>倾斜参数（skew）。描述图像的两条像素轴不完全垂直时产生的剪切。</p></div>
</div>

### `fx` 和 `fy` 是镜头上写的焦距吗？

不是同一个单位。镜头常写 `4 mm`、`8 mm`，而内参里的 `fx`、`fy` 通常以**像素**为单位：

```text
fx = 镜头焦距（mm）÷ 单个像素的横向尺寸（mm/px）
fy = 镜头焦距（mm）÷ 单个像素的纵向尺寸（mm/px）
```

所以，真实镜头的焦距发生变化时，`fx` 和 `fy` 通常会一起、近似同比例变化，视觉效果就是正常的放大或缩小。单独修改 `fx` 或 `fy` 是为了观察某个内参的数学作用，它会分别造成横向或纵向拉伸，并不代表正常镜头只在一个方向变焦。

### `cx`、`cy` 为什么不一定在图片正中心？

理想情况下，主点接近图片中心。例如图片尺寸是 `800 × 450`，中心就是 `(400, 225)`。但镜头装配、传感器裁切和制造误差都会让真实主点略有偏移，所以它需要通过标定求出来。

### `s` 到底是什么？

`s` 是 skew，也就是**像素坐标的横轴和纵轴不完全垂直**时产生的倾斜量。它出现在 `u` 的计算中，因此同一个点越偏离主点的上下方向，横向偏移会越明显，画面看起来像被剪切。

现代相机的像素阵列制造得很规整，横纵像素轴通常近似垂直，所以工程中经常令 `s = 0`。但“通常设为 0”不等于它在数学上永远只能是 0。

## 为什么第二行第一列一定写 0？

五个可调参数已经介绍完了，但矩阵中还有几个看似“写死”的数字。先看第二行第一列的 0。

这里的 `K` 不是任意的 3×3 矩阵。标准相机模型会把它约定成**上三角矩阵**，横纵像素轴之间的倾斜统一放在第一行第二列的 `s` 中；其余旋转归到相机外参。因此第二行第一列写成 0。

如果看到另一个 3×3 矩阵的这个位置不是 0，它可能是一般的单应矩阵或其他变换矩阵，并不一定是按这种标准形式写出的相机内参 `K`。

## 最后一行为什么是 `[0, 0, 1]`？

解释完前两行，最后还剩一行 `[0, 0, 1]`。它不直接控制画面的缩放或平移，而是服务于齐次坐标表示。

相机投影使用了齐次坐标。二维像素 `(u, v)` 会临时写成 `(u, v, 1)`，最后一行用于保留这个齐次尺度。由于整个齐次矩阵同时乘一个非零常数并不会改变最终像素位置，我们通常把右下角归一化成 1，于是最后一行就是 `[0, 0, 1]`。

<div class="intrinsic-note">
  <strong>一句话记忆：</strong>前两行决定像素落在哪里，最后一行负责齐次坐标的尺度约定。
</div>

## 亲手改变参数看看

到这里，我们已经知道矩阵为什么长成这样。接下来不再继续看静态公式，而是固定同一个三维场景，只改变一个参数，直接观察像素坐标如何移动。

下面左右两张图使用完全相同的三维道路场景。左边固定为原始内参，右边只应用当前设置，这样不会把“原图”和“变化后”混在一起。

先选择“真实变焦”，观察 `fx`、`fy` 同时变化；再分别选择其他参数，理解每个数字自己的作用。

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

在上面的实验中，无论如何调整内参，直线仍然是直线；画面只发生缩放、平移或剪切。如果直线本身变弯了，那通常不是这五个内参造成的。

鱼眼效果、桶形畸变和枕形畸变会让本应笔直的线条弯曲。这些现象由径向、切向等**畸变参数**描述，不写在这个 3×3 的 `K` 中。

实际标定时，内参与畸变参数经常一起求解；理解时最好先分开。内参主要负责“缩放、平移与剪切”，畸变参数负责“弯曲”。

## 小结

- `(Xc, Yc, Zc)`：描述空间点在相机坐标系中的三维位置。
- `(x, y)`：除以深度后得到的归一化图像坐标，没有像素单位。
- `(u, v)`：内参换算后得到的像素坐标，原点通常位于图片左上角。
- `fx`、`fy`：控制横纵方向的投影尺度。
- `cx`、`cy`：控制主点位置，也就是投影平移量。
- `s`：控制像素轴不垂直造成的剪切，现代相机中通常接近 0。
- 第二行第一列为 0：来自内参矩阵采用上三角形式的约定。
- 最后一行为 `[0, 0, 1]`：来自二维齐次坐标的尺度归一化。
- 真实变焦通常让 `fx` 和 `fy` 同比例变化；单独调一个参数只是敏感性实验。

下一篇将单独讨论相机畸变：为什么直线会变弯，以及标定程序如何把它纠正回来。
