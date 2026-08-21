---
title: 自动驾驶传感器标定（二）：相机畸变
date: 2026-08-20 12:00:00
updated: 2026-08-21 11:00:00
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

`RadTan` 是 `Radial + Tangential`：先处理围绕光轴对称的径向误差，再补上镜片偏心造成的不对称误差。

它不是一条必须背下来的光学定律，而是一把**拟合工具**。标定板告诉我们角点实际落在哪里，模型负责把理想点 `(x, y)` 移到观测点 `(xd, yd)`。

<div class="radtan-flow" role="img" aria-label="理想点先经过径向畸变，再叠加切向畸变，得到畸变点">
  <div><small>理想点</small><strong>(x, y)</strong></div>
  <span><b>径向 k</b><i aria-hidden="true"></i><small>桶形 / 枕形</small></span>
  <span><b>切向 p</b><i aria-hidden="true"></i><small>不对称偏移</small></span>
  <div><small>畸变点</small><strong>(x<sub>d</sub>, y<sub>d</sub>)</strong></div>
</div>

这里的 `(x, y)` 是**理想归一化图像坐标**，不是最终的像素坐标 `(u, v)`。可以把它理解成：先在理想图像上铺一张坐标网格，光轴穿过图像的位置是原点 `O`，向右是 `x`，向下是 `y`。内参 `K` 会在后面把这张网格换算成像素。

先只看径向部分。下面三步回答的是：**图像中的一个理想点，应该沿着原来的方向移动多远？**

<div class="formula-story">
  <div class="formula-story__with-visual">
    <b>1</b>
    <section><strong>先量它离光轴多远</strong><code>r² = x² + y²</code><p>原点 <code>(0, 0)</code> 是光轴位置。处在同一圆环上的点，<code>r</code> 相同，应使用相同的径向修正。</p></section>
    <figure class="formula-story__visual">
      <svg viewBox="0 0 300 170" role="img" aria-label="理想图像上铺有归一化坐标网格，点 P 的坐标是 x y，它到光轴原点 O 的距离是 r">
        <rect class="formula-story__image-frame" x="8" y="8" width="284" height="154" rx="10"></rect>
        <path class="formula-story__sky" d="M9 9h282v78H9z"></path>
        <path class="formula-story__road" d="M70 161l60-74h42l63 74z"></path>
        <path class="formula-story__building" d="M22 55h48v32H22zM230 47h43v40h-43z"></path>
        <path class="formula-story__lane" d="M151 94v17m0 12v31"></path>
        <path class="formula-story__grid" d="M79 9v152M150 9v152M221 9v152M9 48h282M9 87h282M9 126h282"></path>
        <path class="formula-story__axis" d="M22 87h258m-8-5 8 5-8 5M150 21v128m-5-8 5 8 5-8"></path>
        <line class="formula-story__radius" x1="150" y1="87" x2="221" y2="48"></line>
        <circle class="formula-story__origin" cx="150" cy="87" r="5"></circle>
        <circle class="formula-story__point" cx="221" cy="48" r="6"></circle>
        <text class="formula-story__plane-label" x="20" y="28">理想图像 · 归一化坐标</text>
        <text x="137" y="103">O</text><text x="229" y="45">P(x, y)</text>
        <text class="formula-story__axis-label" x="276" y="79">x</text><text class="formula-story__axis-label" x="158" y="146">y</text>
        <text class="formula-story__accent-text" x="185" y="58">r</text>
      </svg>
    </figure>
  </div>
  <div class="formula-story__with-visual">
    <b>2</b>
    <section><strong>算这一圈要缩放多少</strong><code>L(r) = 1 + k1·r² + k2·r⁴ + k3·r⁶</code><p><code>1</code> 表示不移动；后面的三项让标定程序能够逐步修正中部、边缘和最外圈。</p></section>
    <figure class="formula-story__visual">
      <svg viewBox="0 0 300 170" role="img" aria-label="在同一张归一化图像上，缩放倍率小于一时点向光轴移动，大于一时点远离光轴">
        <rect class="formula-story__image-frame" x="8" y="8" width="284" height="154" rx="10"></rect>
        <path class="formula-story__sky" d="M9 9h282v78H9z"></path>
        <path class="formula-story__road" d="M70 161l60-74h42l63 74z"></path>
        <path class="formula-story__building" d="M22 55h48v32H22zM230 47h43v40h-43z"></path>
        <path class="formula-story__lane" d="M151 94v17m0 12v31"></path>
        <path class="formula-story__grid" d="M79 9v152M150 9v152M221 9v152M9 48h282M9 87h282M9 126h282"></path>
        <line class="formula-story__guide" x1="150" y1="87" x2="266" y2="23"></line>
        <circle class="formula-story__origin" cx="150" cy="87" r="5"></circle>
        <circle class="formula-story__base-point" cx="221" cy="48" r="6"></circle>
        <circle class="formula-story__point" cx="199" cy="60" r="6"></circle>
        <circle class="formula-story__out-point" cx="247" cy="34" r="6"></circle>
        <text class="formula-story__plane-label" x="20" y="28">同一张归一化图像</text>
        <text x="137" y="103">O</text><text x="208" y="69">L = 1</text>
        <text class="formula-story__accent-text" x="160" y="54">L &lt; 1</text><text class="formula-story__warm-text" x="236" y="23">L &gt; 1</text>
      </svg>
    </figure>
  </div>
  <div class="formula-story__with-visual">
    <b>3</b>
    <section><strong>横纵坐标一起乘</strong><code>xr = x·L(r)，yr = y·L(r)</code><p><code>x、y</code> 乘同一个倍率，所以点只会沿着它与原点的连线移动，不会拐向侧面。</p></section>
    <figure class="formula-story__visual">
      <svg viewBox="0 0 300 170" role="img" aria-label="在归一化图像中，理想点 P 和径向修正后的点 Pd 位于光轴原点 O 发出的同一条射线上">
        <rect class="formula-story__image-frame" x="8" y="8" width="284" height="154" rx="10"></rect>
        <path class="formula-story__sky" d="M9 9h282v78H9z"></path>
        <path class="formula-story__road" d="M70 161l60-74h42l63 74z"></path>
        <path class="formula-story__building" d="M22 55h48v32H22zM230 47h43v40h-43z"></path>
        <path class="formula-story__lane" d="M151 94v17m0 12v31"></path>
        <path class="formula-story__grid" d="M79 9v152M150 9v152M221 9v152M9 48h282M9 87h282M9 126h282"></path>
        <line class="formula-story__guide" x1="150" y1="87" x2="254" y2="30"></line>
        <line class="formula-story__radius" x1="150" y1="87" x2="199" y2="60"></line>
        <circle class="formula-story__origin" cx="150" cy="87" r="5"></circle>
        <circle class="formula-story__base-point" cx="221" cy="48" r="6"></circle>
        <circle class="formula-story__point" cx="199" cy="60" r="6"></circle>
        <text class="formula-story__plane-label" x="20" y="28">径向修正发生在图像平面内</text>
        <text x="137" y="103">O</text><text x="225" y="45">P</text><text class="formula-story__accent-text" x="205" y="72">Pd</text>
        <text x="159" y="52">方向不变</text>
      </svg>
    </figure>
  </div>
</div>

这就解释了 `L(r)` 的含义：`L(r) < 1` 时点靠近原点，形成桶形；`L(r) > 1` 时点远离原点，形成枕形。比如 `(x, y) = (0.6, 0.8)`，若 `L(r) = 0.9`，新位置就是 `(0.54, 0.72)`——方向没变，只是半径缩短了 10%。

为什么使用 `r²、r⁴、r⁶`？因为镜头的径向误差通常平滑且近似对称，只与“离中心多远”有关。多项式给标定程序几档由内到外的调节能力；最高次项越高，影响越集中在画面边缘。

但径向缩放只能让点沿直线靠近或远离原点。如果实际角点还偏向一侧，就需要 `p1、p2` 产生一个二维偏移：

```text
Δxt = 2·p1·x·y + p2·(r² + 2·x²)
Δyt = p1·(r² + 2·y²) + 2·p2·x·y
```

这两行不用背。只需要看出三件事：中心处 `x = y = 0`，偏移自然为 0；越靠近边缘，偏移通常越大；`p1、p2` 提供两个独立方向，让模型可以拟合向左上、右下等不对称偏移。

最后把“径向位置”和“切向偏移”相加：

```text
xd = x·L(r) + Δxt
yd = y·L(r) + Δyt
```

现在整套公式就能和上面的现象对应起来：`k1～k3` 负责桶形或枕形，`p1、p2` 负责切向偏移。

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

Rational 仍然只是在算径向缩放 `L(r)`，后面的切向公式完全不变。它要解决的问题是：有些宽视场镜头到了边缘突然变化，单个多项式不够灵活。

RadTan 只能不断给结果做加法；Rational 增加一个分母，相当于又多了一组可以“压住或放大曲线”的旋钮：

```text
       1 + k1·r² + k2·r⁴ + k3·r⁶
L(r) = ───────────────────────────
       1 + k4·r² + k5·r⁴ + k6·r⁶
```

分子就是原来的 RadTan 径向模型，`k4、k5、k6` 只控制分母。两边一起配合，能拟合更复杂的边缘变化；代价是参数更多，而且分母接近 0 时会不稳定。所以不是镜头越高级越该用 Rational，而是 RadTan 的边缘残差仍有规律时才考虑它。

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
    <span><i aria-hidden="true"></i>鱼眼基础半径 θ<output data-kb-fisheye-output>1.31</output></span>
  </div>
  <p data-kb-angle-explain aria-live="polite"></p>
</div>

<figure class="coordinate-figure">
  <img src="/assets/autonomous-driving/sensor-calibration/02-camera-distortion/pinhole-triangle.svg?v=1" alt="针孔投影中的直角三角形：邻边是焦距 1，对边是图像半径 r">
</figure>

KB 不直接拿针孔半径做畸变，而是先找回光线角度，再决定这个角度在鱼眼图像中对应多大的半径。

<div class="formula-story">
  <div><b>1</b><section><strong>先求针孔点的平面距离</strong><code>r = √(x² + y²)</code><p><code>r</code> 是归一化平面上，从光轴原点 <code>O</code> 到点 <code>(x, y)</code> 的距离。</p></section></div>
  <div><b>2</b><section><strong>再反推出光线角度</strong><code>θ = atan(r)</code><p>针孔在归一化平面上满足 <code>r = tan(θ)</code>，所以用反函数 <code>atan</code> 把半径还原成角度。</p></section></div>
</div>

为什么要绕到角度？因为针孔使用 `r = tan(θ)`，当 `θ` 接近 90° 时，`r` 会冲向无穷大；鱼眼想装下接近 180° 的总视场，就不能继续按这条曲线投影。

最容易理解的鱼眼基准是等距投影：`ρ = f·θ`。意思是光线角度每增加相同的一小段，图像半径也增加相同的一小段。除以焦距 `f` 后，归一化半径的数值就是 `θ`；真正的像素距离稍后再由内参换算。

真实镜头不会与理想等距曲线完全一致，所以 KB 再加一组可拟合的修正项：

```text
θd = θ·(1 + k1·θ² + k2·θ⁴ + k3·θ⁶ + k4·θ⁸)
```

读这行公式时，可以把括号整体看成“修正倍率”。开头的 `1` 表示先保留理想等距投影，`k1～k4` 再让标定程序从小角度到大角度逐段调整。只使用偶次幂，是为了让左右两侧相同大小的角度得到相同倍率；最外面的 `θ` 则保留左右方向。

灰点是没有修正时的预测，橙圈是棋盘格角点的实际观测，绿点是加入 `k1～k4` 后的预测。修正的目的，就是让绿点尽量对准橙圈。

下面固定 `θ = 1 rad`、归一化焦距 `f = 1`。拖动倍率，试着让绿点与橙圈重合：

<div class="kb-radius-lab" data-kb-radius-lab>
  <label class="kb-radius-lab__control">
    <span>模型修正倍率<output data-kb-radius-factor-output>0.65</output></span>
    <input data-kb-radius-factor-range type="range" min="60" max="140" step="1" value="65" aria-label="调整 KB 半径修正倍率，使绿色预测点对准橙色观测点">
  </label>
  <div class="kb-radius-lab__values">
    <span data-kind="base">灰点：不加 k 的预测 1.00</span>
    <span data-kind="observed">橙圈：实际观测 0.82</span>
    <span data-kind="corrected">绿点：加 k 的预测 <output data-kb-radius-result-output>0.65</output></span>
  </div>
  <canvas role="img" aria-label="调整修正倍率，使加入 k 后的绿色预测点对准棋盘格角点的橙色实际观测位置"></canvas>
  <p data-kb-radius-explain aria-live="polite">绿色预测点太靠近 O，继续增大倍率。</p>
</div>

动画只对齐了一个点。实际标定会同时使用许多棋盘格角点，寻找一组 `k`，让所有预测点整体最接近观测点。

得到新半径 `θd` 后，还差两步：

<div class="formula-story">
  <div><b>3</b><section><strong>把点放回原来的方向</strong><code>xd = θd·x/r，yd = θd·y/r</code><p><code>(x/r, y/r)</code> 只表示方向，乘上新半径 <code>θd</code> 后得到鱼眼归一化坐标。</p></section></div>
  <div><b>4</b><section><strong>用内参换成像素</strong><code>u = fx·xd + s·yd + cx<br>v = fy·yd + cy</code><p><code>fx、fy</code> 负责缩放，<code>cx、cy</code> 把原点移到主点；多数相机的 <code>s = 0</code>。</p></section></div>
</div>

<details class="formula-reference">
  <summary>把四步连成一套完整公式</summary>
  <pre><code>r = √(x² + y²)<br>θ = atan(r)<br>θd = θ·(1 + k1·θ² + k2·θ⁴ + k3·θ⁶ + k4·θ⁸)<br><br>xd = θd·x/r<br>yd = θd·y/r<br><br>u = fx·xd + s·yd + cx<br>v = fy·yd + cy</code></pre>
</details>

如果 `r = 0`，点就在光轴上，不需要做除法，像素位置直接是主点 `(cx, cy)`。OpenCV `fisheye` 的 `k1～k4` 修正的是“角度到半径”的关系，与 RadTan 中按 `r²、r⁴、r⁶` 修正针孔坐标的 `k` 不是同一套参数，不能混用。

### 选哪个？

<div class="distortion-model-cards">
  <div><strong>RadTan</strong><p>普通针孔、前视或长焦相机。</p></div>
  <div><strong>Rational</strong><p>RadTan 不够准确的较宽视场镜头。</p></div>
  <div><strong>KB / Fisheye</strong><p>鱼眼和接近 180° 的超广角相机。</p></div>
  <div><strong>UCM / Mei</strong><p>全向或折反射相机；通过单位球和参数 ξ 建模。</p></div>
</div>

一般从最简单的模型开始。只有边缘残差仍有明显规律时，再增加参数。
