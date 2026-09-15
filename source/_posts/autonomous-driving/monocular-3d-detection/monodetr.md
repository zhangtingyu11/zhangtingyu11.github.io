---
title: MonoDETR 论文解读：深度引导的单目三维目标检测
date: 2026-09-15 18:00:00
updated: 2026-09-15 18:00:00
permalink: posts/monodetr/
categories:
  - 自动驾驶
  - 单目三维目标检测
tags:
  - 论文解读
  - MonoDETR
  - Transformer
  - 深度估计
description: 结合原论文图表，理解 MonoDETR 的前景深度预测、深度引导解码器与实验结果。
cover: /assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-4.png
top_img: /assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-4.png
aside: true
toc: true
---

单目三维检测需要从一张 RGB 图像中估计物体的位置、尺寸和朝向，其中距离最难确定。MonoDETR 引入前景深度预测分支，让候选物体在解码过程中读取深度特征，再结合视觉信息预测三维框。

本文结合 [MonoDETR 论文 v4](https://arxiv.org/abs/2203.13310v4) 的原图与实验表展开。图表均截自原论文，实验数值沿用作者报告的结果。

## 方法

### 中心引导与深度引导

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-1.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-1.png" alt="MonoDETR 原论文图 1：中心引导与深度引导" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>图 1 · 中心引导与深度引导（<a href="https://arxiv.org/pdf/2203.13310v4#page=1">原论文第 1 页</a>，点击图片查看大图）</figcaption></figure>

图 1 上半部分是中心引导：围绕物体的投影中心提取特征，再估计三维属性。下半部分是 MonoDETR 的做法，候选物体通过注意力读取整幅图像中的前景深度特征，因此也能利用中心附近以外的线索。这里比较的是检测头获取信息的方式；传统方法的骨干网络本身仍然有一定的上下文感受野。

### 与其他 Transformer 检测器的关系

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-2.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-2.png" alt="MonoDETR 原论文图 2：与其他 Transformer 检测器的关系" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>图 2 · 与其他 Transformer 检测器的关系（<a href="https://arxiv.org/pdf/2203.13310v4#page=2">原论文第 2 页</a>，点击图片查看大图）</figcaption></figure>

图 2 把几种方法的信息流放在一起。黄色表示二维视觉特征，蓝色是深度信息，绿色是三维表示，红色是鸟瞰图（BEV）表示。DETR 输出二维框；MonoDETR 从单张图像预测三维框，并单独引入深度分支。PETR(v2) 和 BEVFormer 则利用多相机输入，分别通过三维位置编码和 BEV 特征组织空间信息。它们的输入条件不同，这张图主要用来区分架构。

### 前景深度预测

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-3.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-3.png" alt="MonoDETR 原论文图 3：前景深度预测" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>图 3 · 前景深度预测（<a href="https://arxiv.org/pdf/2203.13310v4#page=3">原论文第 3 页</a>，点击图片查看大图）</figcaption></figure>

图 3 的深度预测器很轻：把骨干网络的 1/8、1/16、1/32 特征对齐到 1/16 尺度，融合后经过两层 3×3 卷积，再用 1×1 卷积输出深度分布。深度划为 80 个 LID 区间，另设背景类别；LID 的区间宽度随距离增加。

训练时，将物体深度填入对应的二维框，重叠区域优先保留较近物体。这样的监督来自已有物体标注，不需要额外的稠密深度真值。不过，框内像素共享物体级深度，并不等于每个表面点的真实距离。

### 网络结构与解码过程

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-4.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-4.png" alt="MonoDETR 原论文图 4：网络结构与解码过程" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>图 4 · 网络结构与解码过程（<a href="https://arxiv.org/pdf/2203.13310v4#page=4">原论文第 4 页</a>，点击图片查看大图）</figcaption></figure>

图 4 是完整网络。骨干特征进入视觉和深度两条分支，各自编码后供物体查询（query）读取。解码层按 D → I → V → FFN 的顺序更新查询，重复三次：D 是深度交叉注意力，I 是查询之间的自注意力，V 是视觉交叉注意力，FFN 是前馈网络。也就是说，每个候选先获得深度信息，再与其他候选交互，随后补充外观特征。

模型设置了 50 个查询槽位，最终通过属性头预测类别、二维尺寸、三维中心投影、三维尺寸、深度和朝向，再结合相机几何得到三维框。50 是候选数量，并非每张图固定检测出 50 个物体。深度监督只用于训练。

### 接入多视角检测器

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-5.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-5.png" alt="MonoDETR 原论文图 5：接入多视角检测器" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>图 5 · 接入多视角检测器（<a href="https://arxiv.org/pdf/2203.13310v4#page=6">原论文第 6 页</a>，点击图片查看大图）</figcaption></figure>

图 5 展示了两种接入方式：在 PETRv2 中，深度交叉注意力加在解码器里，直接更新物体查询；在 BEVFormer 中，它加在 BEV 编码器里，先更新 BEV 特征。多相机图像共享深度模块的参数。两种接法都利用深度信息，但作用位置不同，对应的实验见表 4。

### 深度注意力的分布

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-6.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-6.png" alt="MonoDETR 原论文图 6：深度注意力的分布" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>图 6 · 深度注意力的分布（<a href="https://arxiv.org/pdf/2203.13310v4#page=9">原论文第 9 页</a>，点击图片查看大图）</figcaption></figure>

图 6 左侧一列是三个场景的输入图像，右侧各列展示不同查询的注意力响应，白色标记指示查询位置，暖色表示更高的权重。部分响应分布在查询附近以外的区域，说明深度注意力确实在读取非局部信息。至于这些区域为什么有帮助、模型是否学到了正确的几何关系，单凭热图还无法判断。

## 实验

### 方法比较

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-1.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-1.png" alt="MonoDETR 原论文表 1：方法比较" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 1 · 方法比较（<a href="https://arxiv.org/pdf/2203.13310v4#page=3">原论文第 3 页</a>，点击图片查看大图）</figcaption></figure>

表 1 对照了输入视角、额外数据、查询形式和特征聚合方式。MonoDETR 采用单目输入，通过深度感知查询进行全局特征聚合。名字相近的 MonoDTR 使用中心引导，并且需要额外的 LiDAR 监督，两者不是同一个检测框架。表中对时序等条件的归纳对应作者比较的具体版本。

### KITTI 检测结果

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-2.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-2.png" alt="MonoDETR 原论文表 2：KITTI 检测结果" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 2 · KITTI 检测结果（<a href="https://arxiv.org/pdf/2203.13310v4#page=7">原论文第 7 页</a>，点击图片查看大图）</figcaption></figure>

表 2 分别报告测试集 AP₃D、测试集 APBEV 和验证集 AP₃D，每组又分 Easy、Moderate、Hard。以常用的测试集 Moderate AP₃D 为例，MonoDETR 得到 16.47，表中次优 MonoDTR 为 15.39，相差 1.08 个百分点。MonoDETR 不依赖表中列出的额外深度、LiDAR 或 CAD 数据。

这些结果采用汽车类别、IoU = 0.7 和 40 个召回率点。比较时需要固定数据划分与指标：验证集的 20.61 不能直接与测试集的 16.47 比较。这里的领先也只针对原论文列出的方法。

### 推理速度与计算量

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-3.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-3.png" alt="MonoDETR 原论文表 3：推理速度与计算量" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 3 · 推理速度与计算量（<a href="https://arxiv.org/pdf/2203.13310v4#page=7">原论文第 7 页</a>，点击图片查看大图）</figcaption></figure>

表 3 在 RTX 3090、batch size 为 1 的条件下比较效率。MonoDETR 的推理时间为 38 ms，计算量为 62.12 GFLOPs；精度高于表中其他方法，但速度略慢于 GUPNet 和 MonoDTR。原文这里给出的 GUPNet 精度是 15.02，而表 2 为 14.20，因此不把这两个数值视为同一实验设置。

### nuScenes 多视角结果

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-4.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-4.png" alt="MonoDETR 原论文表 4：nuScenes 多视角结果" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 4 · nuScenes 多视角结果（<a href="https://arxiv.org/pdf/2203.13310v4#page=8">原论文第 8 页</a>，点击图片查看大图）</figcaption></figure>

表 4 应当按同一框架加入深度引导前后成对比较。PETRv2 的 NDS 从 0.496 提高到 0.508，BEVFormer 从 0.517 提高到 0.526；mAP 也都有提升。不过，PETRv2 的速度误差从 0.394 增至 0.419，属性误差从 0.184 增至 0.187，并非所有指标都改善。

NDS 是综合检测分数；mATE、mASE、mAOE、mAVE、mAAE 分别是平移、尺寸、朝向、速度和属性误差，越低越好。原表中的 * 表示两阶段微调与测试增强，† 表示 CBGS 数据采样；论文的两组扩展实验未采用这些增强。

### 深度分支的作用

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-5.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-5.png" alt="MonoDETR 原论文表 5：深度分支的作用" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 5 · 深度分支的作用（<a href="https://arxiv.org/pdf/2203.13310v4#page=8">原论文第 8 页</a>，点击图片查看大图）</figcaption></figure>

表 5 逐步移除主要模块。完整模型的 Moderate AP₃D 为 20.61；保留视觉 Transformer、移除深度引导分支后降到 17.81，相差 2.80 个百分点。只在中心检测基线上加入深度预测器得到 16.05，提升明显小于完整架构。深度特征如何参与后续检测，对结果有直接影响。这组实验同时涉及预测器、编码器和注意力模块，不能将全部增益归给某一层。

### 深度编码器的选择

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-6.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-6.png" alt="MonoDETR 原论文表 6：深度编码器的选择" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 6 · 深度编码器的选择（<a href="https://arxiv.org/pdf/2203.13310v4#page=8">原论文第 8 页</a>，点击图片查看大图）</figcaption></figure>

表 6 将深度编码器替换为可变形自注意力、两层卷积，或直接移除。全局自注意力的 Moderate AP₃D 为 20.61，其余三种分别为 18.91、18.36 和 18.38。全局建模在这组实验中更有效；卷积版本与不加编码器接近。这里替换的是深度编码器，视觉编码器不在这组比较之内。

### 解码层的注意力顺序

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-7.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-7.png" alt="MonoDETR 原论文表 7：解码层的注意力顺序" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 7 · 解码层的注意力顺序（<a href="https://arxiv.org/pdf/2203.13310v4#page=9">原论文第 9 页</a>，点击图片查看大图）</figcaption></figure>

表 7 中，先深度交叉注意力、再查询交互、最后视觉交叉注意力的 D → I → V 得到最高的 20.61。把深度读取放到查询交互之后，结果降至 19.28；放到视觉读取之后则是 18.85。原文最后一行将深度与视觉特征相加后统一读取，得到 18.41，并非顺序执行两次独立注意力。这组结果支持作者将深度信息较早引入查询的选择。

### 深度监督与分箱方式

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-8.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-8.png" alt="MonoDETR 原论文表 8：深度监督与分箱方式" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 8 · 深度监督与分箱方式（<a href="https://arxiv.org/pdf/2203.13310v4#page=9">原论文第 9 页</a>，点击图片查看大图）</figcaption></figure>

表 8 的前两行比较监督形式：前景深度配合 LID 得到 20.61，稠密深度配合 LID 为 19.85。其余行保持前景监督，改用均匀分箱 UD 或对数分箱 SID，结果分别为 18.90、18.95。LID 将更多分辨能力留给近处，远处区间逐渐变宽，在这里取得更好的结果。这并不能说明稠密深度普遍没有价值，只能说明它在当前配置下没有优于前景监督。

### 深度位置编码

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-9.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-9.png" alt="MonoDETR 原论文表 9：深度位置编码" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 9 · 深度位置编码（<a href="https://arxiv.org/pdf/2203.13310v4#page=9">原论文第 9 页</a>，点击图片查看大图）</figcaption></figure>

表 9 中，逐米可学习编码得到 20.61，比不加位置编码的 18.94 高 1.67 个百分点。按深度分箱学习编码和深度 sin/cos 编码分别为 19.68、19.57，也好于只编码二维位置的 18.63。距离信息对查询读取深度特征有帮助。这里的逐米编码用于提供位置提示，与预测器输出的 80 个 LID 分类区间是两个不同的设计。

## 小结

MonoDETR 将深度估计和查询式检测放在同一个网络里。表 5 的模块消融和表 7 的顺序实验，分别说明深度分支的作用，以及先读取深度再读取视觉的收益。它仍然依赖单张图像推断距离，遮挡和远处小目标带来的歧义并没有消失。

Renrui Zhang et al. *MonoDETR: Depth-guided Transformer for Monocular 3D Object Detection*. ICCV 2023. [论文](https://arxiv.org/abs/2203.13310v4) · [代码](https://github.com/ZrrSkywalker/MonoDETR)
