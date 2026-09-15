---
title: MonoDGP 论文解读：解耦查询与几何误差先验
date: 2026-09-15 18:05:00
updated: 2026-09-15 18:05:00
permalink: posts/monodgp/
categories:
  - 自动驾驶
  - 单目三维目标检测
tags:
  - 论文解读
  - MonoDGP
  - Transformer
  - 深度估计
description: 从 MonoDETR 的深度融合出发，解释几何误差修正、二维与三维查询解耦，以及前景区域增强，结合全部原文图表展开消融。
cover: /assets/autonomous-driving/monocular-3d-detection/monodgp/fig-2.png
top_img: /assets/autonomous-driving/monocular-3d-detection/monodgp/fig-2.png
aside: true
toc: true
---

<link rel="stylesheet" href="/assets/vendor/katex/katex.min.css">
<link rel="stylesheet" href="/assets/autonomous-driving/monocular-3d-detection/monodetr/paper.css">

[MonoDETR](/posts/monodetr/) 用深度特征引导物体查询，最后融合直接回归、深度图采样和几何计算三种距离。MonoDGP 接着追问：<strong>如果几何计算本身有规律性的偏差，能否让网络专门预测这个偏差？</strong>

由此牵出另外两个设计：几何计算需要稳定的二维框，因而先用二维查询完成定位，再进行三维解码；深度分支需要更清楚的前景信息，因而加入区域增强。全文沿着这条依赖关系展开。

依据 [原论文 arXiv:2410.19590v2](https://arxiv.org/abs/2410.19590v2)（2025-03-12，含补充材料）和 [官方代码](https://github.com/PuFanqi23/MonoDGP)。图表及指标均来自作者，未独立复现。

## 从预测深度改为预测几何误差

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-1.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-1.png" alt="MonoDGP 图 1：与 MonoDETR 的结构及预测量比较" loading="lazy"></a><figcaption>图 1 · 与 MonoDETR 的结构及预测量比较（<a href="https://arxiv.org/pdf/2410.19590v2#page=1">原文第 1 页</a>，点击放大）</figcaption></figure>

### 图 1：从 MonoDETR 到 MonoDGP

图 1(a) 是 MonoDETR：视觉、深度两路编码得到特征，物体查询通过深度引导解码器读取它们，再进行检测预测。图 1(b) 保留这套主体，在三个位置做了改动：

| 图中的位置 | MonoDGP 的具体操作 | 与后续预测的关系 |
|---|---|---|
| 顶部 Region Segmentation Head | 预测前景概率，用概率调整特征权重，并生成前景/背景标记 | 为视觉、深度分支提供经过区域增强的输入 |
| 中间 Visual Decoder → 2D Queries | 先从视觉特征更新查询，输出二维预测，再把查询和参考点交给三维解码器 | 三维解码从已经获得二维定位信息的状态开始 |
| 底部 GE Prior | 用预测车高和二维框高计算几何距离，再加上预测的深度误差 | 最终距离改为“几何初值＋残差”，不再使用三路平均 |

以图中一辆车为例，RSH 先给车所在区域较高的前景概率；这些概率用于调整特征，并非把车辆裁出来单独处理。一个可学习查询经过视觉解码器后逐渐对应这辆车，二维头从它预测框的位置与大小。随后，<strong>同一个候选的查询状态继续进入深度引导解码器</strong>，结合深度和视觉特征，预测三维尺寸、朝向及距离修正量。

这里的 <strong>2D Queries 是经过二维解码更新的特征向量</strong>，不是二维框坐标；参考点另行提供空间定位信息。图中的 2D Prediction 从这个阶段分出，3D Prediction 则使用继续更新后的查询。

最后把预测量接起来。假设焦距为 $700\,\mathrm{px}$，预测车高为 $1.5\,\mathrm m$、二维框高为 $50\,\mathrm{px}$，几何式先给出 $21\,\mathrm m$。若三维头预测的残差为 $+2\,\mathrm m$，最终中心距离就是：

$$
\widehat Z=\underbrace{\frac{700\times1.5}{50}}_{\text{几何初值 }21\,\mathrm m}
+\underbrace{2}_{\text{预测残差，单位 m}}=23\,\mathrm m.
$$

这只是数值示意。训练时，用相加后的距离与真实中心深度比较，学习修正量。<strong>深度分支仍然提供解码所需的特征；最终距离如何计算，是另一处改动。</strong>

图 1(c) 左边统计完整深度，右边统计几何深度与中心深度的差值。中间箭头表示<strong>将学习目标从完整距离改为剩余误差</strong>，不是网络把一张分布图转换成另一张。作者认为几何式解释了距离变化的主要部分后，剩余误差更集中，可能更容易学习；下面先说明这个误差从何而来，再讨论支撑它的实验。

### 二维框高为何不能直接代替中心投影高

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-4.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-4.png" alt="MonoDGP 图 4：几何误差的来源" loading="lazy"></a><figcaption>图 4 · 几何误差的来源（<a href="https://arxiv.org/pdf/2410.19590v2#page=5">原文第 5 页</a>，点击放大）</figcaption></figure>

图 4(a) 的两条竖线有相同的三维高度，却不一定处于相同的深度平面。设焦距为 $f$、物体三维高度为 $H$，物体中心处竖直线段的投影高度为 $h_c$，二维包围框高度为 $h_{\mathrm{bbox}}$：

$$
Z=\frac{fH}{h_c},\qquad Z_{\mathrm{geo}}=\frac{fH}{h_{\mathrm{bbox}}},\qquad \widehat Z=Z_{\mathrm{geo}}+\widehat Z_{\mathrm{err}}.
$$

包围框要包住可见物体，其上下边界不必来自中心平面，所以 $h_{\mathrm{bbox}}$ 通常更大，计算出的距离更近。图 4(b) 进一步说明，这个差值与车长、朝向等物体属性有关。作者选择容易从图像边缘定位的框高，再学习误差，避免直接预测难以观察的 $h_c$。

这一分析假设相机俯仰角、横滚角为零，并忽略地面坡度。论文所谓“透视不变”也有条件，补充材料还分析了相机高度带来的偏差，不能理解成任意场景下的严格不变量。

### 三种修正位置的消融

<figure class="paper-original supplement"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/correction-example.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/correction-example.png" alt="同一初值下三种残差修正位置" loading="lazy"></a><figcaption>自绘补充示意 · 同一初值下三种残差修正位置，非论文实验图。点击放大。</figcaption></figure>

上图把三种方案放到同一个数值例子里：预测一个米制距离残差、预测一个三维高度残差，或者预测一个像素高度残差。网络输出的量不同，接入几何公式的位置也不同。

$$
\begin{aligned}
\text{深度修正：}\quad &\widehat Z=\frac{fH}{h_{\mathrm{bbox}}}+\widehat Z_{\mathrm{err}},\\
\text{三维高度修正：}\quad &\widehat Z=\frac{f(H+\widehat H_{\mathrm{err}})}{h_{\mathrm{bbox}}},\\
\text{框高修正：}\quad &\widehat Z=\frac{fH}{h_{\mathrm{bbox}}-\widehat h_{\mathrm{err}}}.
\end{aligned}
$$

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-4.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-4.png" alt="MonoDGP 表 4：深度获取方式及误差参数化" loading="lazy"></a><figcaption>表 4 · 深度获取方式及误差参数化（<a href="https://arxiv.org/pdf/2410.19590v2#page=8">原文第 8 页</a>，点击放大）</figcaption></figure>

表 4 前五行先替换最终深度的获取方式：Depth map 在目标位置读取深度图；Direct Depth 从物体查询直接输出距离；两行 Geometry 分别将预测框高、预测中心投影高放进投影公式；Weighted Fusion 融合多路估计。后三行则保留几何初值，分别学习上述三种修正量。中心投影高分支的具体标签构造未在这一消融说明中展开，不能把它当成换入真值的实验。

在 KITTI val Car Moderate 上，单独使用框高计算只有 7.99；加入深度残差后为 22.34，高于高度残差的 22.09、框高残差的 21.18，以及融合方案的 21.64。<strong>这一组支持“计算初值后学习修正”，而不是直接把几何式当作最终距离。</strong>

<details>
<summary>残差为何可能更好学：分布和梯度</summary>

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-5.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-5.png" alt="MonoDGP 图 5：深度、高度及其误差分布" loading="lazy"></a><figcaption>图 5 · 深度、高度及其误差分布（<a href="https://arxiv.org/pdf/2410.19590v2#page=6">原文第 6 页</a>，点击放大）</figcaption></figure>

图 5 比较深度、三维高度及两种误差的直方图。作者认为，几何式先解释了距离随透视变化的主要部分，剩余误差更集中，学习任务因而更简单。这是作者对效果的解释；分布集中本身并不证明网络必然更容易学。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-6.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-6.png" alt="MonoDGP 图 6：各变量分别标准化后的箱线图" loading="lazy"></a><figcaption>图 6 · 各变量分别标准化后的箱线图（<a href="https://arxiv.org/pdf/2410.19590v2#page=6">原文第 6 页</a>，点击放大）</figcaption></figure>

图 6 对各变量分别进行 $X'=(X-\mu)/\sigma$ 标准化，再比较箱线图。它呈现的是标准化后的形状、分位范围与尾部，不能用来直接比较原始米制方差。

框高修正还把预测量放进分母：

$$
\frac{\partial L}{\partial \widehat h_{\mathrm{err}}}
=\frac{\partial L}{\partial \widehat Z}\,
\frac{fH}{(h_{\mathrm{bbox}}-\widehat h_{\mathrm{err}})^2}.
$$

当分母变小时，梯度容易放大；深度残差则以加法接入。这个差别解释了两种参数化的训练性质，但表 4 的收益仍只适用于作者的实验设置。

</details>

## 先完成二维定位，再进行深度引导解码

几何初值依赖预测框高。如果二维框和三维属性都从同一份经过深度交互的查询预测，二维定位也会受这份表示的影响。MonoDGP 因此给二维任务增加了更早的输出位置。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-2.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-2.png" alt="MonoDGP 图 2：整体架构与二维、三维预测头" loading="lazy"></a><figcaption>图 2 · 整体架构与二维、三维预测头（<a href="https://arxiv.org/pdf/2410.19590v2#page=3">原文第 3 页</a>，点击放大）</figcaption></figure>

图 2 中，视觉和深度编码仍并行存在；新增的二维视觉解码器先输出二维查询及参考点，二维检测头在这里预测类别、投影中心和二维尺寸。随后，这些查询进入三维深度引导解码器，预测三维尺寸、朝向和深度误差。

<figure class="paper-original supplement"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/query-example.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/query-example.png" alt="二维查询如何进入三维解码" loading="lazy"></a><figcaption>自绘补充示意 · 二维查询如何进入三维解码，非论文实验图。点击放大。</figcaption></figure>

二维解码器中的 I 只让候选查询彼此交互，V 再通过多尺度可变形注意力读取视觉特征。三维解码器接收更新后的二维状态，按 D → I → V → FFN 继续更新：D 读取全局深度特征，I 交换已经带有深度信息的查询，V 再围绕参考位置采样视觉信息。每一步都接收前一步的结果。

<strong>“解耦”指二维头与三维头使用不同阶段的查询，不是去掉三维解码器里的视觉注意力，也不是两套完全独立的网络。</strong> 表 5 中，在 Mixup3D 基础上加入二维查询解码器，Moderate 从 20.79 到 21.38；完整模型去掉它后，从 22.34 到 21.48。后面的配置图标出了这两组比较。

## 前景区域如何进入深度分支

查询已经有了更稳定的二维起点，但它读取的深度特征仍可能混入背景。RSH（Region Segmentation Head）利用现有二维框生成区域监督，让网络预测哪些位置更可能属于目标。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-3.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-3.png" alt="MonoDGP 图 3：区域分割头 RSH" loading="lazy"></a><figcaption>图 3 · 区域分割头 RSH（<a href="https://arxiv.org/pdf/2410.19590v2#page=4">原文第 4 页</a>，点击放大）</figcaption></figure>

图 3 左侧逐级上采样、融合多尺度特征，并通过 SE 通道注意力和分割头生成概率图。它有两个用途：连续概率与原特征逐元素相乘，增强前景的相对权重；概率经过阈值后，选择前景或背景向量，加入深度编码的 token 与位置表示。

<figure class="paper-original supplement"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/region-example.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/region-example.png" alt="概率加权与离散区域向量" loading="lazy"></a><figcaption>自绘补充示意 · 概率加权与离散区域向量，非论文实验图。点击放大。</figcaption></figure>

<strong>监督标签是“框内填 1、框外填 0”，并不需要额外的像素级物体轮廓标注。</strong> 每个尺度用 Dice loss 监督预测概率：

$$
L_{\mathrm{region}}^i=1-\frac{2\sum_jp_jg_j}{\sum_jp_j+\sum_jg_j}.
$$

其中 $p_j$ 是前景概率，$g_j$ 是框生成的二值标签，$i$ 表示特征尺度。阈值产生的离散标记负责选择区域向量；区域损失直接监督的是连续概率。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-3.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-3.png" alt="MonoDGP 表 3：区域向量阈值消融" loading="lazy"></a><figcaption>表 3 · 区域向量阈值消融（<a href="https://arxiv.org/pdf/2410.19590v2#page=8">原文第 8 页</a>，点击放大）</figcaption></figure>

表 3 只比较 segment embedding 的阈值和移除该向量的情况：0.3、0.5、0.7 分别得到 21.51、21.64、21.54；w/o 为 21.43。<strong>w/o 仍保留概率加权的特征增强，不能叫“去掉 RSH”。</strong> 这一组使用融合深度设置，21.64 也不是最终残差模型的 22.34。

## 训练监督与最终输出

三维头预测有符号深度残差，并输出用于不确定性加权的量。最终深度监督作用于相加后的结果：

$$
L_{\mathrm{depth}}=\frac{\sqrt2}{\sigma_d}
\left|Z_{\mathrm{geo}}+\widehat Z_{\mathrm{err}}-Z_{\mathrm{gt}}\right|
+\log\sigma_d.
$$

$Z_{\mathrm{gt}}$ 是目标中心深度，$\sigma_d$ 是预测的不确定性尺度。误差通过最终深度传回残差分支及可微的几何计算路径；不能据此说它另外使用了一份独立“残差真值”损失。

<strong>推理使用几何深度与预测残差之和；深度图继续服务于特征编码，不参与最后的三路平均。</strong> [当前官方模型代码](https://github.com/PuFanqi23/MonoDGP/blob/main/lib/models/monodgp/monodgp.py) 中也保留了这个加法，三路平均代码已被注释。这里将代码核对与论文描述分别说明，不把当前仓库当作全部消融的实现证据。

<details>
<summary>其他损失、匹配与训练条件</summary>

二维头监督类别、二维框、GIoU 和投影中心；三维头监督尺寸、朝向和上述中心深度。深度图分支仍有物体级深度图监督，RSH 另有区域损失。

总损失可按模块写成：

$$
L=L_{2D}+L_{3D}+\lambda_8L_{\mathrm{dmap}}+\lambda_9\sum_iL_{\mathrm{region}}^i.
$$

这里不固定求和上界：正文列出四个尺度 $i=0,1,2,3$，原式 (10) 却写到 4，两处不一致。

作者使用 ResNet-50、50 个查询、8 个注意力头、每层多尺度可变形注意力 4 个采样点；训练采用 11 组的 group-wise one-to-many assignment，使每个目标在不同组内获得匹配监督。训练还使用 Mixup3D，单张 RTX 3090、batch size 8、250 epochs；推理过滤类别置信度低于 0.2 的查询。主模型使用标准检测标注，不需要额外 LiDAR 深度监督。

</details>

## 模块收益与计算代价

<figure class="paper-original supplement"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/module-example.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/module-example.png" alt="模块消融的开关配置" loading="lazy"></a><figcaption>自绘补充示意 · 模块消融的开关配置，非论文实验图。点击放大。</figcaption></figure>

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-5.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-5.png" alt="MonoDGP 表 5：训练增强与模块消融" loading="lazy"></a><figcaption>表 5 · 训练增强与模块消融（<a href="https://arxiv.org/pdf/2410.19590v2#page=8">原文第 8 页</a>，点击放大）</figcaption></figure>

表 5 将训练增强与模块贡献分开列出。无新增项的基线是 20.22，只有 Mixup3D 为 20.79，因此完整模型到 22.34 的 <strong>2.12 个百分点不能全部归给网络结构</strong>。从完整模型分别移除 RSH、解耦查询或深度误差，对应 21.93、21.48、21.64，才更直接反映各部件在这一组合中的作用。消融训练五次，按 Moderate 指标报告中位结果。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-2.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-2.png" alt="MonoDGP 表 2：参数、计算量与运行时间" loading="lazy"></a><figcaption>表 2 · 参数、计算量与运行时间（<a href="https://arxiv.org/pdf/2410.19590v2#page=7">原文第 7 页</a>，点击放大）</figcaption></figure>

表 2 使用同样的删模块对照衡量开销：基线 35 ms，完整模型 42 ms，参数从 35.93M 到 38.90M；去掉二维查询解码器或 RSH，分别为 39 ms、37 ms。时间是在 RTX 3090、batch size 1 下测得，不能直接换算为其他设备的部署性能。

## KITTI 检测效果

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-1.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-1.png" alt="MonoDGP 表 1：KITTI Car 检测结果" loading="lazy"></a><figcaption>表 1 · KITTI Car 检测结果（<a href="https://arxiv.org/pdf/2410.19590v2#page=7">原文第 7 页</a>，点击放大）</figcaption></figure>

表 1 的 Car 指标采用 IoU 0.7、40 个召回位置的 $\mathrm{AP}_{3D}$ 与 $\mathrm{AP}_{\mathrm{BEV}}$。MonoDGP 的 test Moderate $\mathrm{AP}_{3D}$ 为 18.72，MonoDETR 为 16.47，直接差值是 <strong>2.25 个百分点</strong>；表末的 +1.55 比较的是此前该列最高的 17.17，并非 MonoDETR。val 上两者是 22.34 与 20.61，差 1.73；也不要与表 5 的内部基线 20.22 混用。

测试集 Easy BEV 的 35.24 仍低于 OccupancyM3D 的 35.38，论文并非每个指标都领先。作者在 val 选择最佳验证 checkpoint，test 则从最后几个 checkpoint 提交，这也是阅读跨划分数字时需要保留的条件。

<details>
<summary>图 10：与 MonoCD、MonoDETR 的定性比较</summary>

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-10.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-10.png" alt="MonoDGP 图 10：定性检测结果" loading="lazy"></a><figcaption>图 10 · 定性检测结果（<a href="https://arxiv.org/pdf/2410.19590v2#page=16">原文第 16 页</a>，点击放大）</figcaption></figure>

绿色是真值，红色是预测；每个场景同时给出图像投影和鸟瞰图。可以对照同一辆车的深度偏移与朝向，而不只看二维投影是否重叠。作者也指出第三组示例最左侧车辆受到高度遮挡影响：几何分支依赖框高和三维高度，遮挡仍会造成误差。这些示例展示具体表现，不能替代全数据集统计。

</details>

## 补充实验：几何先验的适用范围

<details>
<summary>相机高度、车辆分布与“透视不变”的条件（图 7—9）</summary>

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-7.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-7.png" alt="MonoDGP 图 7：相机低于目标时的几何关系" loading="lazy"></a><figcaption>图 7 · 相机低于目标时的几何关系（<a href="https://arxiv.org/pdf/2410.19590v2#page=12">原文第 12 页</a>，点击放大）</figcaption></figure>

图 7 讨论相机低于物体的情况，$\gamma=H_{\mathrm{cam}}/H<1$。几何深度与最近轮所在平面的深度也不是严格相等，两者仍有偏差：

$$
l_{\mathrm{bias}}=\frac{(1-\gamma)Z_wl_a}{Z_w+\gamma l_a}.
$$

$Z_w$ 为轮平面深度，$l_a$ 为图中沿深度方向的几何长度。取论文示例附近的量级，$\gamma=5/6,Z_w=50\,\mathrm m,l_a=1\,\mathrm m$，偏差约 0.16 m；这是示意计算。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-8.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-8.png" alt="MonoDGP 图 8：KITTI 深度与三维高度分布" loading="lazy"></a><figcaption>图 8 · KITTI 深度与三维高度分布（<a href="https://arxiv.org/pdf/2410.19590v2#page=12">原文第 12 页</a>，点击放大）</figcaption></figure>

图 8 展示 KITTI 车辆深度跨度较大、车高相对集中的分布，用于支持作者对常见车辆和相机高度关系的讨论。它不能保证换成其他物体类别或相机安装位置后条件仍成立。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-9.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/fig-9.png" alt="MonoDGP 图 9：相机高于目标时的几何关系" loading="lazy"></a><figcaption>图 9 · 相机高于目标时的几何关系（<a href="https://arxiv.org/pdf/2410.19590v2#page=13">原文第 13 页</a>，点击放大）</figcaption></figure>

图 9 则处理 $\gamma>1$ 的情况。作者推得：

$$
l_{\mathrm{bias}}=\frac{(\gamma-1)Z_wL}{Z_w+\gamma L},\qquad L=l_a+l_{b1}+l_{b2}.
$$

例如 $\gamma=6/5,Z_w=50\,\mathrm m,L=2\,\mathrm m$，偏差约 0.38 m。两个公式仍含深度和相机高度，说明这里的距离不敏感是有条件的近似。

</details>

<details>
<summary>真值替换与预训练深度模型（表 8、9）</summary>

<figure class="paper-original supplement"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/replacement-example.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/replacement-example.png" alt="真值替换与初始深度来源替换" loading="lazy"></a><figcaption>自绘补充示意 · 真值替换与初始深度来源替换，非论文实验图。点击放大。</figcaption></figure>

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-8.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-8.png" alt="MonoDGP 表 8：几何输入的真值替换" loading="lazy"></a><figcaption>表 8 · 几何输入的真值替换（<a href="https://arxiv.org/pdf/2410.19590v2#page=14">原文第 14 页</a>，点击放大）</figcaption></figure>

表 8 分别用真值三维高度 $H$、真值二维框高 $h$ 替换预测输入：只换 $H$ 从 22.34 到 31.89，只换 $h$ 到 25.04，同时替换到 48.55。它表明高度估计仍显著限制最终精度。<strong>这是借助真值的诊断实验，48.55 不是可部署结果。</strong> 两个高度都准确，也不意味着框所在表面与物体中心的几何差异消失。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-9.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-9.png" alt="MonoDGP 表 9：预训练米制深度变体" loading="lazy"></a><figcaption>表 9 · 预训练米制深度变体（<a href="https://arxiv.org/pdf/2410.19590v2#page=14">原文第 14 页</a>，点击放大）</figcaption></figure>

表 9 将初始深度来源换成经过米制深度预训练的 Depth Anything V2，再接误差修正：Hypersim 的 Small 模型为 9.11，Virtual KITTI 2 的 Small、Base 为 20.48、21.15。结果反映深度来源与训练域的影响；该变体使用外部预训练，和主方法的数据条件不同。

表 9 的首行原文标为 Direct Depth、数值 18.87，而表 4 的 Direct Depth 为 19.23、Depth map 才是 18.87。这里保留原表差异，不擅自给该行改名。论文也未在这张表中完整交代所有预训练变体的微调设置。

</details>

<details>
<summary>行人、骑行者与 Waymo（表 6、7、10）</summary>

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-6.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-6.png" alt="MonoDGP 表 6：其他类别的模块消融" loading="lazy"></a><figcaption>表 6 · 其他类别的模块消融（<a href="https://arxiv.org/pdf/2410.19590v2#page=14">原文第 14 页</a>，点击放大）</figcaption></figure>

表 6 沿用前面的删模块操作：移除 segment embeddings 只取消区域向量；移除 RSH 同时取消区域增强和向量；移除 depth error 取消最终残差修正。IoU 0.5 的 val Moderate 上，完整模型行人/骑行者为 10.06/6.61，去掉 RSH 为 9.42/4.34，去掉深度误差为 7.55/5.86。不同类别的变化幅度不同，车辆上的增益不能原样外推。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-7.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-7.png" alt="MonoDGP 表 7：其他类别的测试结果" loading="lazy"></a><figcaption>表 7 · 其他类别的测试结果（<a href="https://arxiv.org/pdf/2410.19590v2#page=14">原文第 14 页</a>，点击放大）</figcaption></figure>

表 7 转为 KITTI test，行人/骑行者 Moderate 分别为 9.89/2.82，对应 MonoDETR 的 7.19/2.74。骑行者的提升很小，且低于表中 MonoDDE 的 3.78，不能写成所有类别全面领先。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-10.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodgp/table-10.png" alt="MonoDGP 表 10：Waymo 检测结果" loading="lazy"></a><figcaption>表 10 · Waymo 检测结果（<a href="https://arxiv.org/pdf/2410.19590v2#page=15">原文第 15 页</a>，点击放大）</figcaption></figure>

表 10 在 Waymo 上分别报告 IoU 0.5/0.7、Level 1/2 及不同距离段；AP 衡量检测，APH 还考虑朝向。IoU 0.7、Level 1 全距离的 $\mathrm{AP}_{3D}$ 为 4.28，高于 MonoUNI 的 3.20，但低于使用额外 LiDAR 监督的 CaDDN 5.03。比较时应先对齐同一等级、距离段和监督条件，不能从某一列推出总体最优。

</details>

MonoDGP 对 MonoDETR 最直接的推进，是把深度输出改成<strong>几何初值加可学习残差</strong>，再用二维查询解耦和前景增强为它提供更合适的输入。实验支持这一组合在给定设置下有效；高度真值替换与跨类别结果也表明，预测高度误差、遮挡和物体几何差异仍然值得继续研究。
