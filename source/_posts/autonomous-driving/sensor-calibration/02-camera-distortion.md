---
title: 自动驾驶传感器标定（二）：相机畸变
date: 2026-08-20 12:00:00
updated: 2026-08-20 13:23:00
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

真实镜头会让像素偏离理想位置，这就是**相机畸变**。它不是模糊，而是墙边、灯杆和车道线真的被拍弯了。

## 先看看畸变长什么样

切换类型并拖动强度，观察建筑边缘和车道线。

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

### 桶形、枕形和切向

<div class="distortion-kind-cards">
  <div><strong>桶形畸变</strong><p>直线向外鼓，像套在木桶表面；广角镜头常见。</p></div>
  <div><strong>枕形畸变</strong><p>直线向内弯，画面像被四角向外拉伸。</p></div>
  <div><strong>切向畸变</strong><p>径向是顺着中心连线移动；切向则让点横着“滑”，画面因此不对称。常见原因是镜头与传感器没有完全对正。</p></div>
</div>

桶形和枕形属于**径向畸变**：越靠近画面边缘，通常越明显。

### 桶形和鱼眼有什么不同？

<div class="distortion-concept-compare">
  <div>
    <small>桶形畸变</small>
    <strong>同一批景物，位置变形了</strong>
    <span>视野基本没变</span>
  </div>
  <div>
    <small>鱼眼投影</small>
    <strong>更宽的视野，被压进画面</strong>
    <span>画面两侧会多出内容</span>
  </div>
</div>

看上面的动画两侧：切到鱼眼后，会多出两栋建筑。

## 畸变加在计算的哪一步？

畸变作用在**归一化坐标上，发生在乘 K 之前**：

<div class="distortion-flow" role="img" aria-label="归一化坐标先经过畸变模型，再乘以内参矩阵得到像素坐标">
  <div><small>理想投影</small><strong>(x, y)</strong></div>
  <span><b>畸变模型 D</b><i aria-hidden="true"></i></span>
  <div><small>畸变后</small><strong>(x<sub>d</sub>, y<sub>d</sub>)</strong></div>
  <span><b>乘以内参 K</b><i aria-hidden="true"></i></span>
  <div><small>数字图像</small><strong>(u, v)</strong></div>
</div>

`K` 仍是上一篇的 3×3 矩阵；镜头弯曲由额外的畸变参数描述。

## 常见畸变模型

### RadTan：普通镜头

Brown–Conrady 模型也叫 `RadTan`。先计算半径：

```text
r² = x² + y²
L(r) = 1 + k1·r² + k2·r⁴ + k3·r⁶
```

再加入径向和切向偏移：

```text
xd = x·L(r) + 2·p1·x·y + p2·(r² + 2·x²)
yd = y·L(r) + p1·(r² + 2·y²) + 2·p2·x·y
```

<div class="distortion-parameter-cards">
  <div><strong>k1、k2、k3</strong><p>径向系数，控制桶形或枕形弯曲。</p></div>
  <div><strong>p1、p2</strong><p>切向系数，描述镜头偏心或倾斜。</p></div>
</div>

OpenCV 常用顺序为 `(k1, k2, p1, p2, k3)`。在这套公式下，`k1 < 0` 通常是桶形，`k1 > 0` 通常是枕形。

### Rational：更复杂的径向畸变

RadTan 拟合不够时，可把径向缩放改成分式：

```text
       1 + k1·r² + k2·r⁴ + k3·r⁶
L(r) = ───────────────────────────
       1 + k4·r² + k5·r⁴ + k6·r⁶
```

它更灵活，也更容易过拟合。

### Kannala–Brandt：鱼眼

Kannala–Brandt（KB）直接使用光线与光轴的夹角 `θ`：

```text
θ = atan(r)
θd = θ·(1 + k1·θ² + k2·θ⁴ + k3·θ⁶ + k4·θ⁸)
```

RadTan 调整平面半径，KB 则按光线角度投影。OpenCV 的 `fisheye` 模块使用这一类模型。

### 选型速查

<div class="distortion-model-cards">
  <div><strong>RadTan</strong><p>普通针孔、前视或长焦相机。</p></div>
  <div><strong>Rational</strong><p>RadTan 不够准确的较宽视场镜头。</p></div>
  <div><strong>KB / Fisheye</strong><p>鱼眼和接近 180° 的超广角相机。</p></div>
  <div><strong>UCM / Mei</strong><p>全向或折反射相机；通过单位球和参数 ξ 建模。</p></div>
</div>

模型越复杂，越需要覆盖到画面边缘的标定数据。不要只看总 RMS，还要检查边缘残差。
