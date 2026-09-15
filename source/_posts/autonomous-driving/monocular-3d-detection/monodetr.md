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

<link rel="stylesheet" href="/assets/vendor/katex/katex.min.css">
<link rel="stylesheet" href="/assets/autonomous-driving/monocular-3d-detection/monodetr/paper.css">

单目三维检测中，物体中心附近的视觉特征可以同时承担定位、尺寸和深度预测，但局部外观并不总能提供足够的距离线索。MonoDETR 关注的是检测过程中的特征获取：<strong>先从图像中学习前景深度，再让物体查询读取这些深度特征，随后结合视觉信息完成三维预测</strong>。

这条思路涉及两个问题：没有额外稠密深度标注时，怎样得到可用的深度表示；得到表示之后，又怎样让它影响候选物体的预测。下面围绕这两点展开，相关消融放在设计说明之后。图表截自 [论文 v4](https://arxiv.org/abs/2203.13310v4)，结果沿用作者报告，未独立复现。

## 研究动机与方法定位

中心引导的方法通常围绕物体的投影中心读取特征，再回归三维属性。图 1 上半部分画出了这种检测方式，下半部分则让目标查询在前景深度特征上分配注意力。读取范围不再局限于中心附近，其他物体及场景区域也可以参与当前候选的表示更新。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-1.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-1.png" alt="MonoDETR 原论文图 1：中心引导与深度引导" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>图 1 · 中心引导与深度引导（<a href="https://arxiv.org/pdf/2203.13310v4#page=1">原论文第 1 页</a>，点击图片查看大图）</figcaption></figure>

这里改变的是检测头获取信息的方式。中心引导模型的骨干网络本身仍然有上下文感受野；MonoDETR 进一步让每个候选通过注意力选择与自身有关的深度信息。能否从这种全局读取中获益，后面需要分别检查深度编码器和查询更新过程。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-2.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-2.png" alt="MonoDETR 原论文图 2：与其他 Transformer 检测器的关系" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>图 2 · 与其他 Transformer 检测器的关系（<a href="https://arxiv.org/pdf/2203.13310v4#page=2">原论文第 2 页</a>，点击图片查看大图）</figcaption></figure>

图 2 将这一选择放回 Transformer 检测器的架构中：黄色对应二维视觉特征，蓝色对应深度，绿色对应三维表示，红色对应 BEV。DETR 从视觉特征预测二维框；MonoDETR 保持单目输入，增加深度分支以预测三维框。PETR(v2) 与 BEVFormer 面向多相机输入，分别通过三维位置编码和 BEV 特征组织空间信息，因此不能直接把几种方法的结果当作同一输入条件下的比较。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-1.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-1.png" alt="MonoDETR 原论文表 1：方法比较" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 1 · 方法比较（<a href="https://arxiv.org/pdf/2203.13310v4#page=3">原论文第 3 页</a>，点击图片查看大图）</figcaption></figure>

表 1 进一步列出了查询形式、特征聚合与额外数据条件。尤其需要区分 MonoDTR 和 MonoDETR：前者采用中心引导并使用额外 LiDAR 监督，后者采用深度感知查询和全局聚合。MonoDETR 要解决的具体问题，就是在只有物体级标注的条件下，为这种查询建立可用的深度信息来源。

## 整体架构

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-4.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-4.png" alt="MonoDETR 原论文图 4：网络结构与解码过程" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>图 4 · 网络结构与解码过程（<a href="https://arxiv.org/pdf/2203.13310v4#page=4">原论文第 4 页</a>，点击图片查看大图）</figcaption></figure>

图 4 中，ResNet-50 提取的特征分成两路：视觉分支保留外观语义，深度分支接受前景深度监督。两路分别编码后，送入同一个解码器。每个解码层依次执行深度交叉注意力、查询间自注意力、视觉交叉注意力和 FFN，连续更新物体查询。

因此，深度分支既需要产生有距离含义的特征，也需要保留能供查询读取的空间结构。先看它如何构造监督与表示，再回到解码器中讨论读取顺序。

## 前景深度预测与编码

### 物体级监督与 LID 分箱

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-3.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-3.png" alt="MonoDETR 原论文图 3：前景深度预测" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>图 3 · 前景深度预测（<a href="https://arxiv.org/pdf/2203.13310v4#page=3">原论文第 3 页</a>，点击图片查看大图）</figcaption></figure>

图 3 中，1/8、1/16、1/32 三个尺度的骨干特征先对齐到 1/16 分辨率，逐元素相加，再经过两层 3×3 卷积得到深度特征。顶部的 1×1 卷积输出深度类别分布。这个分支接受监督后，下面的深度特征才具有明确的距离学习目标。

<strong>监督直接由检测标注构造：二维框内填入对应物体的深度，多个框重叠时保留最近物体的标签</strong>。这样省去了额外稠密深度标注，但框内共享的是物体级距离，并不是每个可见表面点的真实深度。

深度采用 LID（线性递增宽度分箱），近处区间窄，远处区间宽。为避免原文中分箱数与索引使用相同符号，这里用 K 表示分箱总数、b 表示从零开始的索引：

$$
\begin{aligned}\delta &= \frac{2(d_{\max}-d_{\min})}{K(K+1)} \\ b(d)&=\left\lfloor-\frac12+\frac12\sqrt{1+\frac{8(d-d_{\min})}{\delta}}\right\rfloor\end{aligned}
$$

其中 d 是标注深度，δ 同时是第一个区间的宽度和相邻区间宽度的增量。第 b 个区间的下边界为 $d_{\min}+\frac{\delta b(b+1)}{2}$，因而上式就是由连续距离反求区间索引。论文设置 K = 80、深度范围为 0–60 m，并增加一个背景类别。这是前景分箱的表达式，背景单独处理。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-8.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-8.png" alt="MonoDETR 原论文表 8：深度监督与分箱方式" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 8 · 深度监督与分箱方式（<a href="https://arxiv.org/pdf/2203.13310v4#page=9">原论文第 9 页</a>，点击图片查看大图）</figcaption></figure>

下文的消融均采用 KITTI 验证集汽车 $\mathrm{AP}_{3D}$（IoU = 0.7，40 个召回率点），正文引用 Moderate 列。表 8 先比较监督形式：前景 LID 的 Moderate $\mathrm{AP}_{3D}$ 为 20.61，稠密 LID 为 19.85。保持前景监督，改用均匀分箱 UD 或对数间隔分箱 SID，结果为 18.90、18.95。这组结果支持当前网络采用物体级监督和 LID，但不能由此断定稠密深度在其他配置中也没有帮助。

### 全局深度编码

预测分支输出深度特征之后，还需要让不同区域交换信息。论文在这里选择了全局自注意力。理解这个选择，需要先区分“局部”可能指的几种操作：

| 特征获取方式 | 一次更新直接读取哪些位置 | 位置与权重怎样确定 |
|---|---|---|
| 中心附近取特征 | 物体投影中心对应的位置或邻域 | 按预测或指定的中心取特征；它本身不是一种注意力算法 |
| 固定窗口注意力 | 当前窗口内的位置 | 窗口范围固定，在窗口内计算相关性权重 |
| 可变形注意力 | 每个头、每个尺度上的少量采样位置 | 由查询预测相对参考点的偏移与聚合权重，对特征插值采样 |
| 全局注意力 | 当前特征图的全部有效位置 | 查询与全部键计算相关性，再归一化得到聚合权重 |

<strong>表 6 比较的是全局自注意力与可变形自注意力，不是全局注意力与固定窗口注意力。</strong>可变形注意力的采样点能够移动，未必落在狭小的局部区域；更准确的区别是稀疏采样与全位置参与。中心引导也不能等同于固定窗口注意力，骨干网络可能已经把更大范围的上下文融入中心特征。

以图像中的一辆车为例。可变形注意力可能学着在车顶、车底或其他位置采样，用少量特征更新当前表示；这些只是帮助理解的例子，并不代表论文实测的采样位置。全局注意力则让当前特征与整张深度特征图计算相关性，其他车辆或远处区域也有机会参与。所有位置进入计算，不意味着它们获得相同权重，更不保证模型一定使用了正确的几何关系。

设深度特征图共有 $S$ 个位置。全局自注意力为每个位置计算与其余位置的关联，单个头的注意力矩阵为 $S\times S$；可变形注意力只读取预设数量的采样点，不显式构造这个完整矩阵。全局方式扩大了直接交互范围，也增加了计算与存储开销。这解释了为什么模型没有把所有分支都换成全局注意力。

<strong>深度编码器中的更新对象是深度特征图本身：每个深度位置读取其他深度位置，再更新自己的特征。</strong>这里还没有物体查询参与。例如，某辆车所在区域的深度特征可以融合其他前景区域的信息，然后才交给检测解码器。MonoDETR 为这一步设置一个全局自注意力编码块；视觉编码器使用三个块，采用可变形注意力控制计算量。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-6.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-6.png" alt="MonoDETR 原论文表 6：深度编码器的选择" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 6 · 深度编码器的选择（<a href="https://arxiv.org/pdf/2203.13310v4#page=8">原论文第 8 页</a>，点击图片查看大图）</figcaption></figure>

表 6 保留检测框架，替换深度编码器的聚合机制：完整模型使用全局自注意力，替代项分别为可变形自注意力、两层卷积，或直接将深度特征送给解码器。“无编码器”不等于删除整个深度分支。全局自注意力得到 20.61，可变形自注意力为 18.91，两层卷积为 18.36，不加编码器为 18.38。<strong>全局编码相对直接使用深度特征提高了 2.23 个百分点</strong>；卷积版本与不加编码器接近。全局版本比可变形版本高 1.70 个百分点；这不是“把整个网络从局部改成全局”的收益，而是深度编码器这一个位置的对照结果。深度交叉注意力仍在后续解码器中，下面会说明它与这里的自注意力有什么区别。

### 从深度分布到位置编码

编码器输出的特征还会加入距离位置编码。首先，将某个像素的深度分类概率转换成连续深度。按论文式（5）的记法：

$$
d_{\mathrm{map}}(x,y)=\sum_{i=1}^{K+1} P_i(x,y)\,d_{\mathrm{bin},i}
$$

$P_{i}$(x, y) 是该位置第 i 类的预测概率，各类概率之和为 1；$d_{bin,i}$ 是对应的深度取值，原文将其描述为分箱起始值。求和包含论文定义的 K + 1 类。这个 $d_{\mathrm{map}}$ 用来查询距离编码，不能直接等同于最终检测头输出的物体深度。

模型为每一米维护一个可学习向量。若预测距离位于 m 和 m + 1 米之间，就对两行向量做线性插值：

$$
p(d)=(1-\alpha)p_m+\alpha p_{m+1},\qquad m=\lfloor d\rfloor,\quad\alpha=d-m
$$

α 是距离的小数部分，$p_{m}$ 和 $p_{m+1}$ 是相邻整数距离的向量。插值结果逐像素加到深度嵌入上，供后面的交叉注意力使用。<strong>LID 决定分类监督的粒度，逐米编码提供连续距离提示，两者承担不同的作用。</strong>

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-9.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-9.png" alt="MonoDETR 原论文表 9：深度位置编码" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 9 · 深度位置编码（<a href="https://arxiv.org/pdf/2203.13310v4#page=9">原论文第 9 页</a>，点击图片查看大图）</figcaption></figure>

表 9 中，逐米编码得到 20.61，按分箱学习编码为 19.68，深度 sin/cos 为 19.57；只编码二维位置为 18.63，不加编码为 18.94。与二维坐标相比，显式的距离提示更适合这里的深度特征读取。

## 深度引导解码与三维预测

### 查询更新顺序

深度编码器已经让图像位置之间交换了信息，但还没有回答某个候选物体应该读取哪些深度位置。这个任务由解码器中的深度交叉注意力完成。

<strong>自注意力更新的是深度图上的位置；深度交叉注意力更新的是物体查询。</strong>前者的查询、键和值都来自深度特征，后者的查询来自候选物体，键和值来自编码后的深度特征。若有 $N$ 个物体查询和 $S$ 个深度位置，后者的注意力矩阵为 $N\times S$，每一行对应一个候选对整幅深度特征图的读取。

回到图 4 的解码器。设物体查询为 q，加入距离编码后的深度嵌入为 $F_{D}$，忽略多头拆分、残差和归一化，论文式（2）–（4）的读取过程可以写成：

$$
\begin{aligned}Q&=\operatorname{Linear}_Q(q),\quad K_D=\operatorname{Linear}_K(F_D),\quad V_D=\operatorname{Linear}_V(F_D)\\ A_D&=\operatorname{softmax}\!\left(\frac{QK_D^{\mathsf T}}{\sqrt C}\right)\\q^{\prime}&=\operatorname{Linear}(A_DV_D)\end{aligned}
$$

Q 来自物体查询，$K_{D}$、$V_{D}$ 来自深度嵌入，C 是通道维度。$A_{D}$ 的每一行给出一个查询对不同深度特征位置的权重，softmax 沿空间位置归一化。乘上 $V_{D}$ 后，查询得到与自身相关的场景深度信息。

因此，MonoDETR 的两处全局深度交互有前后关系：深度编码器先组织场景内的深度信息，解码器再为各个物体候选读取这些信息。视觉编码器与视觉交叉注意力仍采用可变形注意力。表 6 检验前一步的编码机制，表 7 则检验后一步的深度读取放在什么顺序更合适。

之后才进行查询之间的交互和视觉读取，即 D → I → V → FFN。<strong>深度信息在候选交互之前进入查询，会影响后续的特征更新。</strong>论文使用 50 个查询、256 维通道和三个解码块；50 是候选槽位数，不是固定的最终检测数量。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-7.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-7.png" alt="MonoDETR 原论文表 7：解码层的注意力顺序" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 7 · 解码层的注意力顺序（<a href="https://arxiv.org/pdf/2203.13310v4#page=9">原论文第 9 页</a>，点击图片查看大图）</figcaption></figure>

表 7 直接检验顺序：D → I → V 为 20.61，I → D → V 为 19.28，I → V → D 为 18.85。最后一行将深度与视觉特征相加后统一读取，结果为 18.41，并非依次执行两次独立交叉注意力。<strong>在这组配置下，先读深度再进行候选交互与视觉读取更有效。</strong>

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-6.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-6.png" alt="MonoDETR 原论文图 6：深度注意力的分布" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>图 6 · 深度注意力的分布（<a href="https://arxiv.org/pdf/2203.13310v4#page=9">原论文第 9 页</a>，点击图片查看大图）</figcaption></figure>

图 6 左列是三个场景，右侧各列为不同查询的深度注意力图，白色标记指示查询位置，暖色表示较高权重。响应确实分布在局部中心之外，与全局读取的设计相符。但热图无法单独解释每处响应的贡献；顺序和编码器消融提供了更直接的性能证据。

### 深度输出与三维框恢复

解码后的查询送入 MLP 预测头，输出类别、二维尺寸、三维中心投影、深度、三维尺寸和朝向。最终物体距离还需要由检测头估计，不能直接把整张前景深度图当成检测结果。

作为输出细节的补充，[官方实现的深度预测部分](https://github.com/ZrrSkywalker/MonoDETR/blob/main/lib/models/monodetr/monodetr.py) 融合三种距离估计：查询的直接回归、尺寸投影得到的几何深度，以及在预测中心处从深度图双线性采样的距离。其计算关系为：

$$
\begin{aligned}d_{\mathrm{reg}}&=\frac{1}{\sigma(r)+\varepsilon}-1\\d_{\mathrm{geo}}&=\frac{fH}{h}\\d_{\mathrm{obj}}&=\frac{d_{\mathrm{reg}}+d_{\mathrm{geo}}+d_{\mathrm{sample}}}{3}\end{aligned}
$$

r 是回归头输出，σ 是 sigmoid，ε 用于数值稳定；H 是预测物体高度，h 是对应二维框的像素高度，f 是相机焦距。实现对 h 设置至少一个像素的下限，焦距读取自相机矩阵的 [0, 0] 项。$d_{\mathrm{sample}}$ 来自预测中心处的深度图采样。这段公式说明官方代码中的输出计算，并不把当前代码的全部训练配置视为原论文设置。

得到中心投影 (u, v) 和深度 Z 后，相机内参将其恢复为相机坐标中的中心。对标准针孔模型，有 $X=\frac{(u-c_x)Z}{f_x}$、$Y=\frac{(v-c_y)Z}{f_y}$，再结合尺寸和朝向得到三维框；实际数据还需遵循标定矩阵和框中心约定。论文推理时过滤低置信度查询，不使用预定义锚框或 NMS。

### 匹配与训练目标

查询输出没有固定顺序，训练需要先与真值配对。MonoDETR 用匈牙利算法进行二分匹配，但<strong>匹配代价只包含类别、二维尺寸和三维中心投影</strong>，记为 $L_{2D}$。深度、三维尺寸和朝向组成 $L_{3D}$，不参与配对代价。作者的理由是训练初期三维预测不稳定，加入匹配可能扰乱对应关系。

<strong>配对确定后，三维属性仍然参与训练</strong>。论文式（6）将目标概括为：

$$
\mathcal{L}_{\mathrm{overall}}=\frac{1}{N_{\mathrm{gt}}}\sum_{n=1}^{N_{\mathrm{gt}}}\left(\mathcal{L}_{2D}^{(n)}+\mathcal{L}_{3D}^{(n)}\right)+\mathcal{L}_{\mathrm{dmap}}
$$

$N_{\mathrm{gt}}$ 是匹配到的真值数量，$L_{\mathrm{dmap}}$ 是前景深度分类的 focal loss。这个表达式概括两组属性监督和深度图监督，并不逐项展开实现中的权重、未匹配查询分类或辅助损失。前景深度标签只在训练中使用；推理时，深度表示和检测属性都由输入图像预测。

## 检测效果与计算开销

前面的实验分别检查了监督、编码和读取方式，完整模型的收益还要与更简单的架构比较。表 5–9 都报告 KITTI 验证集汽车 $\mathrm{AP}_{3D}$，采用 IoU = 0.7、40 个召回率点；上文引用的是 Moderate 列。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-5.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-5.png" alt="MonoDETR 原论文表 5：深度分支的作用" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 5 · 深度分支的作用（<a href="https://arxiv.org/pdf/2203.13310v4#page=8">原论文第 8 页</a>，点击图片查看大图）</figcaption></figure>

表 5 中，去掉整个深度引导 Transformer 及深度预测器的中心基线为 15.15；仅为中心基线加入深度预测器为 16.05；采用视觉 Transformer 而不加深度引导分支为 17.81。完整模型为 20.61，<strong>比纯视觉 Transformer 高 2.80 个百分点</strong>。这表明增加一个深度监督分支的收益，和让深度参与整个特征获取过程的收益并不相同。由于比较涉及多个组件，不能将差值全部归给单层注意力。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-2.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-2.png" alt="MonoDETR 原论文表 2：KITTI 检测结果" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 2 · KITTI 检测结果（<a href="https://arxiv.org/pdf/2203.13310v4#page=7">原论文第 7 页</a>，点击图片查看大图）</figcaption></figure>

表 2 再将完整模型与当时的方法比较。测试集 Moderate $\mathrm{AP}_{3D}$ 为 16.47，比表中次优 MonoDTR 的 15.39 高 1.08 个百分点，且不使用表中列出的额外深度、LiDAR 或 CAD 数据。测试集 $\mathrm{AP}_{\mathrm{BEV}}$ 和验证集 $\mathrm{AP}_{3D}$ 是另外两组指标，不能混为同一分数，验证集的 20.61 也不应直接与测试集的 16.47 比高低。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-3.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-3.png" alt="MonoDETR 原论文表 3：推理速度与计算量" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 3 · 推理速度与计算量（<a href="https://arxiv.org/pdf/2203.13310v4#page=7">原论文第 7 页</a>，点击图片查看大图）</figcaption></figure>

表 3 在 RTX 3090、batch size 为 1 的条件下报告 38 ms 和 62.12 GFLOPs。MonoDETR 在这组比较中精度最高，但推理略慢于 GUPNet 和 MonoDTR。原表这里的 GUPNet 精度为 15.02，而表 2 为 14.20；保留这一原文差异，不将两处数值作为一致的对照设置。

## 多视角扩展与讨论

单目实验已经检验了完整架构，另一个问题是深度读取能否脱离该架构，接入已有的多视角检测器。图 5 给出了两个位置不同的接法。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-5.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-fig-5.png" alt="MonoDETR 原论文图 5：接入多视角检测器" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>图 5 · 接入多视角检测器（<a href="https://arxiv.org/pdf/2203.13310v4#page=6">原论文第 6 页</a>，点击图片查看大图）</figcaption></figure>

PETRv2 在解码器中加入深度交叉注意力，直接更新物体查询。BEVFormer 则在 BEV 编码器中引入深度引导，先更新 BEV 特征，再进行检测。各相机视角共享深度模块参数，因此这里考察的是多视角条件下的模块扩展。

<figure class="paper-original"><a href="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-4.png" target="_blank" rel="noopener"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/original-table-4.png" alt="MonoDETR 原论文表 4：nuScenes 多视角结果" loading="lazy" style="background:white;width:100%;height:auto"></a><figcaption>表 4 · nuScenes 多视角结果（<a href="https://arxiv.org/pdf/2203.13310v4#page=8">原论文第 8 页</a>，点击图片查看大图）</figcaption></figure>

表 4 应按相同框架的前后结果成对比较：PETRv2 的 NDS 从 0.496 提升至 0.508，BEVFormer 从 0.517 提升至 0.526，mAP 也有提高。但 PETRv2 的速度误差从 0.394 增至 0.419，属性误差从 0.184 增至 0.187，<strong>收益并未覆盖所有属性</strong>。

NDS 为综合检测分数；mATE、mASE、mAOE、mAVE、mAAE 分别衡量平移、尺寸、朝向、速度和属性误差，越低越好。* 表示两阶段微调与测试增强，† 表示 CBGS；论文的两组扩展实验未采用这些增强，读其他行时需要保留这一条件区别。

MonoDETR 的贡献可以落在一个具体机制上：用物体级深度监督建立场景表示，再让查询在读取视觉信息之前获得深度线索。模块消融、顺序实验和多视角扩展分别检验了这条思路的不同部分。现有证据还不能回答模型究竟利用了哪些物体间关系，也不能保证这种收益在其他场景分布下保持。后续比较同类方法时，深度表示的来源、进入查询的位置以及相应消融，比单独看总榜分数更有解释力。

Renrui Zhang et al. *MonoDETR: Depth-guided Transformer for Monocular 3D Object Detection*. ICCV 2023. [论文 v4](https://arxiv.org/abs/2203.13310v4) · [官方代码](https://github.com/ZrrSkywalker/MonoDETR)
