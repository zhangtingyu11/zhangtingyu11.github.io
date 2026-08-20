---
title: 自动驾驶传感器标定（二）：相机畸变
date: 2026-08-20 12:00:00
updated: 2026-08-20 15:22:00
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
  <div><strong>切向</strong><p>点没有沿畸变中心与它的连线移动，而是向侧面偏，变形通常不对称。</p></div>
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

这个形式不是随便凑的：

1. 镜头大致绕光轴对称，所以径向缩放只需要看半径 `r`。
2. 中心点不应移动，所以缩放从常数 `1` 开始。
3. 对称且平滑的径向变化，可以用 `r²、r⁴、r⁶` 逐级逼近。
4. 镜片偏心会破坏对称性，再用 `p1、p2` 补上切向偏移。

<div class="radtan-flow" role="img" aria-label="理想点先经过径向畸变，再叠加切向畸变，得到畸变点">
  <div><small>理想点</small><strong>(x, y)</strong></div>
  <span><b>径向 k</b><i aria-hidden="true"></i><small>桶形 / 枕形</small></span>
  <span><b>切向 p</b><i aria-hidden="true"></i><small>不对称偏移</small></span>
  <div><small>畸变点</small><strong>(x<sub>d</sub>, y<sub>d</sub>)</strong></div>
</div>

这里的 `(x, y)` 是理想归一化坐标。原点 `(0, 0)` 对应像素图像中的主点 `(cx, cy)`；`r` 是点到这个原点的距离，不是到图像几何中心的距离：

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

三个 `k` 的变形方向相同，区别在影响范围：

<div class="radtan-power-map" role="img" aria-label="k1 从中部开始产生影响，k2 主要影响边缘，k3 主要影响最外圈">
  <div class="radtan-power-map__axis"><span>中心</span><span>边缘</span></div>
  <div><b>k1 · r²</b><span><i style="--level:.04"></i><i style="--level:.16"></i><i style="--level:.36"></i><i style="--level:.64"></i><i style="--level:1"></i></span><small>中部开始</small></div>
  <div><b>k2 · r⁴</b><span><i style="--level:.002"></i><i style="--level:.026"></i><i style="--level:.13"></i><i style="--level:.41"></i><i style="--level:1"></i></span><small>主要在边缘</small></div>
  <div><b>k3 · r⁶</b><span><i style="--level:.001"></i><i style="--level:.004"></i><i style="--level:.047"></i><i style="--level:.26"></i><i style="--level:1"></i></span><small>集中在最外圈</small></div>
</div>

<div class="radtan-parameter-lab" data-radtan-parameter-lab>
  <div class="radtan-parameter-lab__tabs" data-radtan-parameter-tabs role="group" aria-label="选择一个 RadTan 参数">
    <button class="is-active" type="button" data-radtan-parameter="k1">k1</button>
    <button type="button" data-radtan-parameter="k2">k2</button>
    <button type="button" data-radtan-parameter="k3">k3</button>
    <button type="button" data-radtan-parameter="p1">p1</button>
    <button type="button" data-radtan-parameter="p2">p2</button>
  </div>
  <label class="radtan-parameter-lab__control">
    <span><b data-radtan-parameter-name>k1</b><output data-radtan-parameter-output>-0.105</output></span>
    <input data-radtan-parameter-range type="range" min="-100" max="100" step="1" value="-75" aria-label="调整当前 RadTan 参数">
  </label>
  <div class="radtan-parameter-lab__comparison">
    <div><strong>参数为 0</strong><canvas role="img" aria-label="无畸变的道路场景"></canvas></div>
    <div><strong>只改变当前参数</strong><canvas role="img" aria-label="只改变当前 RadTan 参数后的道路场景"></canvas></div>
  </div>
  <p data-radtan-parameter-explain aria-live="polite"></p>
</div>

OpenCV 常见参数顺序是 `(k1, k2, p1, p2, k3)`。

### Rational

RadTan 的 `L(r)` 是有限多项式。宽视场镜头的边缘变化较快时，只在分子继续增加高次项，拟合容易变得敏感。Rational 把它改成两个多项式的比值：

```text
       1 + k1·r² + k2·r⁴ + k3·r⁶
L(r) = ───────────────────────────
       1 + k4·r² + k5·r⁴ + k6·r⁶
```

OpenCV 开启 `CALIB_RATIONAL_MODEL` 后，分母会增加 `k4、k5、k6`。它能更灵活地调整边缘曲线，但分母接近 0 时会变得不稳定。

<div class="radtan-parameter-lab" data-rational-parameter-lab>
  <div class="radtan-parameter-lab__tabs" data-rational-parameter-tabs role="group" aria-label="选择一个 Rational 分母参数">
    <button class="is-active" type="button" data-rational-parameter="k4">k4</button>
    <button type="button" data-rational-parameter="k5">k5</button>
    <button type="button" data-rational-parameter="k6">k6</button>
  </div>
  <label class="radtan-parameter-lab__control">
    <span><b data-rational-parameter-name>k4</b><output data-rational-parameter-output>+0.056</output></span>
    <input data-rational-parameter-range type="range" min="-100" max="100" step="1" value="70" aria-label="调整当前 Rational 分母参数">
  </label>
  <div class="radtan-parameter-lab__comparison">
    <div><strong>分母为 1（RadTan）</strong><canvas role="img" aria-label="只使用 RadTan 分子的道路场景"></canvas></div>
    <div><strong>加入分母（Rational）</strong><canvas role="img" aria-label="加入当前 Rational 分母参数后的道路场景"></canvas></div>
  </div>
  <p data-rational-parameter-explain aria-live="polite"></p>
</div>

### Kannala–Brandt / Fisheye

先把相机从侧面切开。`θ` 是光线与正前方光轴的夹角；180° 是左右两边的总视场，所以最边缘的光线相对光轴接近 ±90°。

针孔中，光线穿过小孔后不改变方向；角度越接近 90°，落点就越远。鱼眼多了一组镜片：光线只在镜片处改变方向，镜片前后仍是直线。这个方向变化就是折射。

<div class="kb-angle-lab" data-kb-angle-lab>
  <label class="kb-angle-lab__control">
    <span>光线与光轴夹角 θ <output data-kb-angle-output>75°</output></span>
    <input data-kb-angle-range type="range" min="0" max="89" step="1" value="75" aria-label="调整光线与光轴夹角">
  </label>
  <canvas role="img" aria-label="针孔直线传播与鱼眼光线在镜片处折射的侧视对比"></canvas>
  <div class="kb-angle-lab__values">
    <span><i aria-hidden="true"></i>针孔交点 r = tan(θ)<output data-kb-pinhole-output>3.73</output></span>
    <span><i aria-hidden="true"></i>鱼眼位置 r = θ<output data-kb-fisheye-output>1.31</output></span>
  </div>
  <p data-kb-angle-explain aria-live="polite"></p>
</div>

<figure class="coordinate-figure">
  <img src="/assets/autonomous-driving/sensor-calibration/02-camera-distortion/pinhole-triangle.svg?v=1" alt="针孔投影中的直角三角形：邻边是焦距 1，对边是图像半径 r">
</figure>

看图中的直角三角形：邻边是 `f = 1`，对边是 `r`，所以 `tan(θ) = r / 1 = r`。反过来，`θ = atan(r)`。KB 就从这个角度开始建模：

```text
r = √(x² + y²)
θ = atan(r)
```

把后面的公式拆成两步就好。

**第一步：算新半径。** 在 KB 模型里，`θd` 就是光线最终落在归一化图像上的半径：

```text
θd = θ·(1 + k1·θ² + k2·θ⁴ + k3·θ⁶ + k4·θ⁸)
```

`k1～k4` 是标定时拟合出来的调节量。它们全为 0 时，`θd = θ`；不为 0 时，就把点向中心拉或向外推。越靠后的 `k` 乘着越高次方，主要微调画面最外圈。

<figure class="coordinate-figure">
  <img src="/assets/autonomous-driving/sensor-calibration/02-camera-distortion/kb-radius-mapping.svg?v=1" alt="KB 模型保持点相对图像中心的方向不变，只把原半径 r 替换成新半径 θd">
</figure>

**第二步：放回原方向。** `(x/r, y/r)` 只表示方向；乘上新半径 `θd`，就得到新位置：

```text
xd = (θd / r)·x
yd = (θd / r)·y
```

一句话：`k1～k4` 只决定点离中心多远，不改变它位于中心的哪个方向。OpenCV `fisheye` 的四个 `k` 与 RadTan 的 `k` 含义不同，不能混用。

### 选哪个？

<div class="distortion-model-cards">
  <div><strong>RadTan</strong><p>普通针孔、前视或长焦相机。</p></div>
  <div><strong>Rational</strong><p>RadTan 不够准确的较宽视场镜头。</p></div>
  <div><strong>KB / Fisheye</strong><p>鱼眼和接近 180° 的超广角相机。</p></div>
  <div><strong>UCM / Mei</strong><p>全向或折反射相机；通过单位球和参数 ξ 建模。</p></div>
</div>

一般从最简单的模型开始。只有边缘残差仍有明显规律时，再增加参数。
