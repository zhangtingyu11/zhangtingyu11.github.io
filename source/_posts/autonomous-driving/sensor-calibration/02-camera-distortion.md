---
title: 自动驾驶传感器标定（二）：相机畸变
date: 2026-08-20 12:00:00
updated: 2026-08-20 13:53:00
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

相机标定通常会输出两样东西：内参矩阵 `K` 和畸变系数 `D`。上一篇讲了 `K`，这篇看 `D` 到底改了什么。

## 先看效果

拖动滑块时，重点看建筑边缘和车道线。

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
    <div><strong>真实镜头可能拍到的形状</strong><canvas role="img" aria-label="应用当前畸变模型后的道路场景"></canvas></div>
  </div>
  <p data-distortion-explain aria-live="polite"></p>
</div>

### 三种常见现象

<div class="distortion-kind-cards">
  <div><strong>桶形</strong><p>边缘向中心压缩，直线向外鼓。</p></div>
  <div><strong>枕形</strong><p>边缘向外拉伸，直线向内弯。</p></div>
  <div><strong>切向</strong><p>点没有沿中心连线移动，而是向侧面偏，变形通常不对称。</p></div>
</div>

桶形和枕形属于径向畸变，离畸变中心越远通常越明显。切向畸变多与镜片偏心、装配不同轴有关。

### 桶形不等于鱼眼

<div class="distortion-concept-compare">
  <div>
    <small>桶形</small>
    <strong>针孔投影上的径向偏移</strong>
    <span>视野基本没变</span>
  </div>
  <div>
    <small>鱼眼</small>
    <strong>按光线角度压缩宽视场</strong>
    <span>两侧能容纳更多内容</span>
  </div>
</div>

上面的演示里，桶形只改变原有建筑的位置；鱼眼模式还会显示两侧建筑。

## 畸变放在公式的哪里？

上一篇从归一化坐标 `(x, y)` 乘 `K` 得到像素坐标。加入畸变后，计算顺序变成：

<div class="distortion-flow" role="img" aria-label="归一化坐标先经过畸变模型，再乘以内参矩阵得到像素坐标">
  <div><small>理想投影</small><strong>(x, y)</strong></div>
  <span><b>畸变模型 D</b><i aria-hidden="true"></i></span>
  <div><small>畸变后</small><strong>(x<sub>d</sub>, y<sub>d</sub>)</strong></div>
  <span><b>乘以内参 K</b><i aria-hidden="true"></i></span>
  <div><small>数字图像</small><strong>(u, v)</strong></div>
</div>

所以畸变发生在乘 `K` 之前，并不包含在 `K` 中。保存标定结果时，至少要同时记录 `K`、`D` 和模型类型。

## 常见畸变模型

### RadTan

`RadTan` 是两个单词的缩写：`Radial + Tangential`。它把前面提到的径向畸变和切向畸变放在同一个模型里。

<div class="radtan-flow" role="img" aria-label="理想点先经过径向畸变，再叠加切向畸变，得到畸变点">
  <div><small>理想点</small><strong>(x, y)</strong></div>
  <span><b>径向 k</b><i aria-hidden="true"></i><small>桶形 / 枕形</small></span>
  <span><b>切向 p</b><i aria-hidden="true"></i><small>不对称偏移</small></span>
  <div><small>畸变点</small><strong>(x<sub>d</sub>, y<sub>d</sub>)</strong></div>
</div>

这里的 `(x, y)` 是理想归一化坐标，`r` 是它到图像中心的距离：

```text
r² = x² + y²
L(r) = 1 + k1·r² + k2·r⁴ + k3·r⁶
```

`L(r)` 是径向缩放：小于 1 时点向中心移动，呈桶形；大于 1 时点向外移动，呈枕形。

`p1、p2` 再补上切向偏移：

```text
Δxt = 2·p1·x·y + p2·(r² + 2·x²)
Δyt = p1·(r² + 2·y²) + 2·p2·x·y

xd = x·L(r) + Δxt
yd = y·L(r) + Δyt
```

<div class="distortion-parameter-cards">
  <div><strong>k1、k2、k3</strong><p>控制 L(r)，对应上面的桶形和枕形。</p></div>
  <div><strong>p1、p2</strong><p>控制 Δxt、Δyt，对应上面的切向畸变。</p></div>
</div>

OpenCV 常见参数顺序是 `(k1, k2, p1, p2, k3)`。

### Rational

OpenCV 开启 `CALIB_RATIONAL_MODEL` 后，会增加 `k4、k5、k6`：

```text
       1 + k1·r² + k2·r⁴ + k3·r⁶
L(r) = ───────────────────────────
       1 + k4·r² + k5·r⁴ + k6·r⁶
```

它适合 RadTan 无法拟合的复杂径向变化。代价是参数更多，标定板没有覆盖到画面边缘时容易过拟合。

### Kannala–Brandt / Fisheye

鱼眼模型不再从平面半径直接拟合，而是先计算光线与光轴的夹角 `θ`：

```text
θ = atan(r)
θd = θ·(1 + k1·θ² + k2·θ⁴ + k3·θ⁶ + k4·θ⁸)
```

OpenCV 的 `fisheye` 模块使用这一类角度模型。它的系数不能直接拿给普通 `calibrateCamera` 使用。

### 选哪个？

<div class="distortion-model-cards">
  <div><strong>RadTan</strong><p>普通针孔、前视或长焦相机。</p></div>
  <div><strong>Rational</strong><p>RadTan 不够准确的较宽视场镜头。</p></div>
  <div><strong>KB / Fisheye</strong><p>鱼眼和接近 180° 的超广角相机。</p></div>
  <div><strong>UCM / Mei</strong><p>全向或折反射相机；通过单位球和参数 ξ 建模。</p></div>
</div>

一般从最简单的模型开始。只有边缘残差仍有明显规律时，再增加参数。
