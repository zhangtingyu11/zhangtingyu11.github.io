---
title: MonoDETR 图解：读懂 6 幅图与 9 张表
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
description: 用六幅中文示意图和九张完整实验表，读懂 MonoDETR 的深度引导机制与实验依据。
cover: /assets/autonomous-driving/monocular-3d-detection/monodetr/pipeline.svg
top_img: /assets/autonomous-driving/monocular-3d-detection/monodetr/pipeline.svg
aside: true
toc: true
---

<link rel="stylesheet" href="/assets/autonomous-driving/monocular-3d-detection/monodetr/visual-guide.css">

**一张图像，怎样预测物体的三维位置？** MonoDETR 让物体查询先读取深度线索，再结合视觉特征输出三维框。下面沿着论文的 **6 幅图、9 张表** 来理解它。

图为中文自绘示意，表格按论文数值重排；每项均链接到 [论文 v4](https://arxiv.org/abs/2203.13310v4) 对应页。实验结果来自原文，未独立复现。

## 六幅图：先理解方法

### 图 1 · 从中心到全局深度

<figure class="md-figure"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/figure-1.svg" alt="沿上下两条路径比较候选物体如何读取特征。深度引导让 query 获取非局部前景信息，缓解只依赖中心附近特征的限制。" loading="lazy"><figcaption>中文阅读示意 · <a href="https://arxiv.org/pdf/2203.13310v4#page=1">查看原论文图 1（第 1 页）</a></figcaption></figure>

<div class="md-explain"><p><b>怎么看</b>沿上下两条路径比较候选物体如何读取特征。</p><p><b>记住什么</b>深度引导让 query 获取非局部前景信息，缓解只依赖中心附近特征的限制。</p><p class="md-caveat"><b>边界</b>中心引导不意味着骨干网络完全没有上下文。</p></div>

### 图 2 · 与 DETR、PETR、BEVFormer 的关系

<figure class="md-figure"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/figure-2.svg" alt="从左往右看输入条件、特征表示和输出。MonoDETR 用单目输入做三维检测；PETR(v2)、BEVFormer 面向多视角。" loading="lazy"><figcaption>中文阅读示意 · <a href="https://arxiv.org/pdf/2203.13310v4#page=2">查看原论文图 2（第 2 页）</a></figcaption></figure>

<div class="md-explain"><p><b>怎么看</b>从左往右看输入条件、特征表示和输出。</p><p><b>记住什么</b>MonoDETR 用单目输入做三维检测；PETR(v2)、BEVFormer 面向多视角。</p><p class="md-caveat"><b>边界</b>这张图用于定位方法，不能据此比较谁更强。</p></div>

### 图 3 · 轻量深度预测器

<figure class="md-figure"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/figure-3.svg" alt="先对齐多尺度特征，再预测深度分箱的概率分布。只用物体标注构造前景深度监督，不需要额外的稠密深度真值。" loading="lazy"><figcaption>中文阅读示意 · <a href="https://arxiv.org/pdf/2203.13310v4#page=3">查看原论文图 3（第 3 页）</a></figcaption></figure>

<div class="md-explain"><p><b>怎么看</b>先对齐多尺度特征，再预测深度分箱的概率分布。</p><p><b>记住什么</b>只用物体标注构造前景深度监督，不需要额外的稠密深度真值。</p><p class="md-caveat"><b>边界</b>框内使用物体级深度，不代表每个表面像素的真实距离。</p></div>

### 图 4 · 完整网络

<figure class="md-figure"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/figure-4.svg" alt="沿两条编码分支走到解码器，重点看 D → I → V 的顺序。先读深度，再让候选交互、读取视觉，最后回归三维属性。" loading="lazy"><figcaption>中文阅读示意 · <a href="https://arxiv.org/pdf/2203.13310v4#page=4">查看原论文图 4（第 4 页）</a></figcaption></figure>

<div class="md-explain"><p><b>怎么看</b>沿两条编码分支走到解码器，重点看 D → I → V 的顺序。</p><p><b>记住什么</b>先读深度，再让候选交互、读取视觉，最后回归三维属性。</p><p class="md-caveat"><b>边界</b>50 个 query 是候选槽位，不代表每张图固定输出 50 个物体；推理不输入训练标签。</p></div>

### 图 5 · 扩展到多视角

<figure class="md-figure"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/figure-5.svg" alt="上行看 PETRv2 的解码器，下行看 BEVFormer 的 BEV 编码器。深度引导可以作为模块接入其他三维检测框架，实验对应表 4。" loading="lazy"><figcaption>中文阅读示意 · <a href="https://arxiv.org/pdf/2203.13310v4#page=6">查看原论文图 5（第 6 页）</a></figcaption></figure>

<div class="md-explain"><p><b>怎么看</b>上行看 PETRv2 的解码器，下行看 BEVFormer 的 BEV 编码器。</p><p><b>记住什么</b>深度引导可以作为模块接入其他三维检测框架，实验对应表 4。</p><p class="md-caveat"><b>边界</b>两个框架的插入位置不同，多视角结果不能当作单目结果。</p></div>

### 图 6 · 注意力可视化

<figure class="md-figure"><img src="/assets/autonomous-driving/monocular-3d-detection/monodetr/figure-6.svg" alt="在原图中先定位白色 query 标记，再看对应行的暖色区域。可视化显示部分响应分布在非局部区域，与全局深度聚合的设计一致。" loading="lazy"><figcaption>中文阅读示意 · <a href="https://arxiv.org/pdf/2203.13310v4#page=9">查看原论文图 6（第 9 页）</a></figcaption></figure>

<div class="md-explain"><p><b>怎么看</b>在原图中先定位白色 query 标记，再看对应行的暖色区域。</p><p><b>记住什么</b>可视化显示部分响应分布在非局部区域，与全局深度聚合的设计一致。</p><p class="md-caveat"><b>边界</b>注意力图提供定性证据，不能单独证明模型学会了正确的几何推理。</p></div>

## 九张表：再检验结论

表 2–3 为 KITTI 对比，表 4 为 nuScenes；表 5–9 为 KITTI 验证集消融，数值为汽车 AP₃D（IoU = 0.7，40 个召回率点）。**↑ 越高越好，↓ 越低越好。**

### 表 1 · 方法定位

<div class="md-table" tabindex="0" role="region" aria-label="表 1：方法定位，可横向滚动"><table><caption>表 1 · 方法定位（原表数值重排）</caption><thead><tr><th scope="col">方法 / 输入</th><th scope="col">DETR</th><th scope="col">额外数据</th><th scope="col">引导</th><th scope="col">Query</th><th scope="col">聚合</th></tr></thead><tbody><tr><th scope="row">DETR3D / 多视角</th><td>是</td><td>—</td><td>视觉</td><td>3D</td><td>局部</td></tr><tr><th scope="row">PETR(v2) / 多视角</th><td>是</td><td>时序</td><td>视觉</td><td>3D</td><td>全局</td></tr><tr><th scope="row">BEVFormer / 多视角</th><td>是</td><td>时序</td><td>视觉</td><td>BEV、3D</td><td>全局</td></tr><tr><th scope="row">MonoDTR / 单目</th><td>否</td><td>LiDAR</td><td>中心</td><td>无</td><td>局部</td></tr><tr><th scope="row">MonoDETR / 单目</th><td>是</td><td>—</td><td>深度</td><td>深度感知</td><td>全局</td></tr></tbody></table></div>

<p class="md-source"><a href="https://arxiv.org/pdf/2203.13310v4#page=3">原论文表 1 · 第 3 页</a></p>

<div class="md-explain"><p><b>怎么看</b>按行比较输入、是否采用 DETR、额外数据和特征聚合方式。</p><p><b>记住什么</b>MonoDETR 的组合是：单目输入 + DETR 查询 + 全局深度引导。</p><p class="md-caveat"><b>边界</b>MonoDTR 与 MonoDETR 名字相近，但检测范式不同；这张表是原论文对所列版本的概括。</p></div>

### 表 2 · KITTI 主结果

<div class="md-stat"><strong>16.47</strong><span>Test AP₃D · Moderate · +1.08 个百分点</span></div>

<details class="md-details"><summary>展开完整实验表（含所有方法与指标）</summary><div class="md-table" tabindex="0" role="region" aria-label="表 2：KITTI 主结果，可横向滚动"><table><caption>表 2 · KITTI 主结果（原表数值重排）</caption><thead><tr><th scope="col">方法</th><th scope="col">额外数据</th><th scope="col">Test 3D·易</th><th scope="col">Test 3D·中</th><th scope="col">Test 3D·难</th><th scope="col">Test BEV·易</th><th scope="col">Test BEV·中</th><th scope="col">Test BEV·难</th><th scope="col">Val 3D·易</th><th scope="col">Val 3D·中</th><th scope="col">Val 3D·难</th></tr></thead><tbody><tr><th scope="row">PatchNet</th><td>Depth</td><td>15.68</td><td>11.12</td><td>10.17</td><td>22.97</td><td>16.86</td><td>14.97</td><td>-</td><td>-</td><td>-</td></tr><tr><th scope="row">D4LCN</th><td>Depth</td><td>16.65</td><td>11.72</td><td>9.51</td><td>22.51</td><td>16.02</td><td>12.55</td><td>-</td><td>-</td><td>-</td></tr><tr><th scope="row">DDMP-3D</th><td>Depth</td><td>19.71</td><td>12.78</td><td>9.80</td><td>28.08</td><td>17.89</td><td>13.44</td><td>-</td><td>-</td><td>-</td></tr><tr><th scope="row">Kinematic3D</th><td>Video</td><td>19.07</td><td>12.72</td><td>9.17</td><td>26.69</td><td>17.52</td><td>13.10</td><td>19.76</td><td>14.10</td><td>10.47</td></tr><tr><th scope="row">MonoRUn</th><td>LiDAR</td><td>19.65</td><td>12.30</td><td>10.58</td><td>27.94</td><td>17.34</td><td>15.24</td><td>20.02</td><td>14.65</td><td>12.61</td></tr><tr><th scope="row">CaDDN</th><td>LiDAR</td><td>19.17</td><td>13.41</td><td>11.46</td><td>27.94</td><td>18.91</td><td>17.19</td><td>23.57</td><td>16.31</td><td>13.84</td></tr><tr><th scope="row">MonoDTR</th><td>LiDAR</td><td>21.99</td><td>15.39</td><td>12.73</td><td>28.59</td><td>20.38</td><td>17.14</td><td>24.52</td><td>18.57</td><td>15.51</td></tr><tr><th scope="row">AutoShape</th><td>CAD</td><td>22.47</td><td>14.17</td><td>11.36</td><td>30.66</td><td>20.08</td><td>15.59</td><td>20.09</td><td>14.65</td><td>12.07</td></tr><tr><th scope="row">SMOKE</th><td>None</td><td>14.03</td><td>9.76</td><td>7.84</td><td>20.83</td><td>14.49</td><td>12.75</td><td>14.76</td><td>12.85</td><td>11.50</td></tr><tr><th scope="row">MonoPair</th><td>None</td><td>13.04</td><td>9.99</td><td>8.65</td><td>19.28</td><td>14.83</td><td>12.89</td><td>16.28</td><td>12.30</td><td>10.42</td></tr><tr><th scope="row">RTM3D</th><td>None</td><td>13.61</td><td>10.09</td><td>8.18</td><td>-</td><td>-</td><td>-</td><td>19.47</td><td>16.29</td><td>15.57</td></tr><tr><th scope="row">PGD</th><td>None</td><td>19.05</td><td>11.76</td><td>9.39</td><td>26.89</td><td>16.51</td><td>13.49</td><td>19.27</td><td>13.23</td><td>10.65</td></tr><tr><th scope="row">IAFA</th><td>None</td><td>17.81</td><td>12.01</td><td>10.61</td><td>25.88</td><td>17.88</td><td>15.35</td><td>18.95</td><td>14.96</td><td>14.84</td></tr><tr><th scope="row">MonoDLE</th><td>None</td><td>17.23</td><td>12.26</td><td>10.29</td><td>24.79</td><td>18.89</td><td>16.00</td><td>17.45</td><td>13.66</td><td>11.68</td></tr><tr><th scope="row">MonoRCNN</th><td>None</td><td>18.36</td><td>12.65</td><td>10.03</td><td>25.48</td><td>18.11</td><td>14.10</td><td>16.61</td><td>13.19</td><td>10.65</td></tr><tr><th scope="row">MonoGeo</th><td>None</td><td>18.85</td><td>13.81</td><td>11.52</td><td>25.86</td><td>18.99</td><td>16.19</td><td>18.45</td><td>14.48</td><td>12.87</td></tr><tr><th scope="row">MonoFlex</th><td>None</td><td>19.94</td><td>13.89</td><td>12.07</td><td>28.23</td><td>19.75</td><td>16.89</td><td>23.64</td><td>17.51</td><td>14.83</td></tr><tr><th scope="row">GUPNet</th><td>None</td><td>20.11</td><td>14.20</td><td>11.77</td><td>-</td><td>-</td><td>-</td><td>22.76</td><td>16.46</td><td>13.72</td></tr><tr class="md-best"><th scope="row">MonoDETR</th><td>None</td><td>25.00</td><td>16.47</td><td>13.58</td><td>33.60</td><td>22.11</td><td>18.60</td><td>28.84</td><td>20.61</td><td>16.38</td></tr><tr><th scope="row">相对各列次优提升</th><td>—</td><td>+2.53</td><td>+1.08</td><td>+0.85</td><td>+2.94</td><td>+1.73</td><td>+1.41</td><td>+4.32</td><td>+2.04</td><td>+0.81</td></tr></tbody></table></div></details>

<p class="md-source"><a href="https://arxiv.org/pdf/2203.13310v4#page=7">原论文表 2 · 第 7 页</a></p>

<div class="md-explain"><p><b>怎么看</b>固定一种指标与数据划分，再横向看 Easy / Moderate / Hard。AP 使用 40 个召回率点，类别为汽车。</p><p><b>记住什么</b>Test 3D 中等难度为 16.47，比表中次优 MonoDTR 的 15.39 高 1.08 个百分点。</p><p class="md-caveat"><b>边界</b>不要把 Test 与 Val，或 AP₃D 与 APBEV 混比；跨论文还需核对 IoU 阈值、额外监督和增强。</p></div>

### 表 3 · 速度与计算量

<div class="md-table" tabindex="0" role="region" aria-label="表 3：速度与计算量，可横向滚动"><table><caption>表 3 · 速度与计算量（原表数值重排）</caption><thead><tr><th scope="col">方法</th><th scope="col">耗时 ms ↓</th><th scope="col">GFLOPs ↓</th><th scope="col">Test AP₃D·中 ↑</th></tr></thead><tbody><tr><th scope="row">MonoDLE</th><td>40</td><td>79.12</td><td>12.26</td></tr><tr><th scope="row">GUPNet</th><td>34</td><td>62.32</td><td>15.02</td></tr><tr><th scope="row">MonoDTR</th><td>37</td><td>120.48</td><td>15.39</td></tr><tr class="md-best"><th scope="row">MonoDETR</th><td>38</td><td>62.12</td><td>16.47</td></tr></tbody></table></div>

<p class="md-source"><a href="https://arxiv.org/pdf/2203.13310v4#page=7">原论文表 3 · 第 7 页</a></p>

<div class="md-explain"><p><b>怎么看</b>在 RTX 3090、batch=1 下看耗时，再看计算量与精度。</p><p><b>记住什么</b>MonoDETR 为 38 ms、62.12 GFLOPs，在该比较中取得最高精度，但不是最快。</p><p class="md-caveat"><b>边界</b>表 3 的 GUPNet 为 15.02，表 2 为 14.20；保留原表数值，不把二者当作同一设置。</p></div>

### 表 4 · 多视角扩展结果

<div class="md-stat"><strong>+0.012 / +0.009</strong><span>PETRv2 / BEVFormer · NDS · 同框架前后对比</span></div>

<details class="md-details"><summary>展开完整实验表（含所有方法与指标）</summary><div class="md-table" tabindex="0" role="region" aria-label="表 4：多视角扩展结果，可横向滚动"><table><caption>表 4 · 多视角扩展结果（原表数值重排）</caption><thead><tr><th scope="col">方法</th><th scope="col">图像尺寸</th><th scope="col">NDS ↑</th><th scope="col">mAP ↑</th><th scope="col">mATE ↓</th><th scope="col">mASE ↓</th><th scope="col">mAOE ↓</th><th scope="col">mAVE ↓</th><th scope="col">mAAE ↓</th></tr></thead><tbody><tr><th scope="row">CenterNet</th><td>—</td><td>0.328</td><td>0.306</td><td>0.716</td><td>0.264</td><td>0.609</td><td>1.426</td><td>0.658</td></tr><tr><th scope="row">FCOS3D*</th><td>1600×900</td><td>0.415</td><td>0.343</td><td>0.725</td><td>0.263</td><td>0.422</td><td>1.292</td><td>0.153</td></tr><tr><th scope="row">PGD*</th><td>1600×900</td><td>0.428</td><td>0.369</td><td>0.683</td><td>0.260</td><td>0.439</td><td>1.268</td><td>0.185</td></tr><tr><th scope="row">DETR3D†</th><td>1600×900</td><td>0.434</td><td>0.349</td><td>0.716</td><td>0.268</td><td>0.379</td><td>0.842</td><td>0.200</td></tr><tr><th scope="row">BEVDet†</th><td>1408×512</td><td>0.417</td><td>0.349</td><td>0.637</td><td>0.269</td><td>0.490</td><td>0.914</td><td>0.268</td></tr><tr><th scope="row">PETR†</th><td>1600×900</td><td>0.442</td><td>0.370</td><td>0.711</td><td>0.267</td><td>0.383</td><td>0.865</td><td>0.201</td></tr><tr><th scope="row">PETRv2</th><td>800×320</td><td>0.496</td><td>0.401</td><td>0.745</td><td>0.268</td><td>0.448</td><td>0.394</td><td>0.184</td></tr><tr class="md-best"><th scope="row">PETRv2 + 深度引导</th><td>800×320</td><td>0.508</td><td>0.410</td><td>0.727</td><td>0.265</td><td>0.389</td><td>0.419</td><td>0.187</td></tr><tr><th scope="row">BEVFormer</th><td>1600×900</td><td>0.517</td><td>0.416</td><td>0.673</td><td>0.274</td><td>0.372</td><td>0.394</td><td>0.198</td></tr><tr class="md-best"><th scope="row">BEVFormer + 深度引导</th><td>1600×900</td><td>0.526</td><td>0.423</td><td>0.661</td><td>0.272</td><td>0.349</td><td>0.371</td><td>0.192</td></tr></tbody></table></div></details>

<p class="md-source"><a href="https://arxiv.org/pdf/2203.13310v4#page=8">原论文表 4 · 第 8 页</a></p>

<div class="md-explain"><p><b>怎么看</b>先看 PETRv2、BEVFormer 各自加入模块前后的配对行。* 表示两阶段微调及测试增强，† 表示 CBGS；两组扩展实验均不用这些增强。</p><p><b>记住什么</b>PETRv2 的 NDS：0.496 → 0.508；BEVFormer：0.517 → 0.526。</p><p class="md-caveat"><b>边界</b>增益并非覆盖所有指标：PETRv2 的速度误差 0.394 → 0.419，属性误差 0.184 → 0.187，均变差。</p></div>

<p class="md-source">NDS 为综合检测分数；mAP 为平均精度。mATE、mASE、mAOE、mAVE、mAAE 分别衡量平移、尺寸、朝向、速度、属性误差。</p>

### 表 5 · 大模块消融

<div class="md-table" tabindex="0" role="region" aria-label="表 5：大模块消融，可横向滚动"><table><caption>表 5 · 大模块消融（原表数值重排）</caption><thead><tr><th scope="col">架构</th><th scope="col">Easy</th><th scope="col">Moderate</th><th scope="col">Hard</th></tr></thead><tbody><tr class="md-best"><th scope="row">完整 MonoDETR</th><td>28.84</td><td><span class="md-bar" style="--bar:68.70%">20.61</span></td><td>16.38</td></tr><tr><th scope="row">去掉整个深度引导 Transformer</th><td>19.69</td><td><span class="md-bar" style="--bar:50.50%">15.15</span></td><td>13.93</td></tr><tr><th scope="row">深度预测器 + 中心基线，无 Transformer</th><td>20.19</td><td><span class="md-bar" style="--bar:53.50%">16.05</span></td><td>14.18</td></tr><tr><th scope="row">视觉 Transformer，无深度引导分支</th><td>24.14</td><td><span class="md-bar" style="--bar:59.37%">17.81</span></td><td>15.60</td></tr></tbody></table></div>

<p class="md-source"><a href="https://arxiv.org/pdf/2203.13310v4#page=8">原论文表 5 · 第 8 页</a></p>

<div class="md-explain"><p><b>怎么看</b>四行分别去掉大模块，观察完整架构相比对应基线的变化。</p><p><b>记住什么</b>完整模型比纯视觉 Transformer 高 2.80 个百分点：20.61 − 17.81。</p><p class="md-caveat"><b>边界</b>“无深度引导”移除预测器、深度编码器与深度交叉注意力，不能把增益全归给一个 attention 层。</p></div>

### 表 6 · 深度编码器

<div class="md-table" tabindex="0" role="region" aria-label="表 6：深度编码器，可横向滚动"><table><caption>表 6 · 深度编码器（原表数值重排）</caption><thead><tr><th scope="col">机制</th><th scope="col">Easy</th><th scope="col">Moderate</th><th scope="col">Hard</th></tr></thead><tbody><tr class="md-best"><th scope="row">全局自注意力</th><td>28.84</td><td><span class="md-bar" style="--bar:68.70%">20.61</span></td><td>16.38</td></tr><tr><th scope="row">可变形自注意力</th><td>26.43</td><td><span class="md-bar" style="--bar:63.03%">18.91</span></td><td>15.55</td></tr><tr><th scope="row">两层 3×3 卷积</th><td>25.55</td><td><span class="md-bar" style="--bar:61.20%">18.36</span></td><td>15.28</td></tr><tr><th scope="row">无深度编码器</th><td>24.25</td><td><span class="md-bar" style="--bar:61.27%">18.38</span></td><td>15.41</td></tr></tbody></table></div>

<p class="md-source"><a href="https://arxiv.org/pdf/2203.13310v4#page=8">原论文表 6 · 第 8 页</a></p>

<div class="md-explain"><p><b>怎么看</b>替换深度编码器，而不是视觉编码器；“无”表示深度特征直接送入 decoder。</p><p><b>记住什么</b>全局自注意力最好；相对无编码器，中等 AP 提高 2.23 个百分点。</p><p class="md-caveat"><b>边界</b>支持此设置下非局部深度编码的价值，不能推出可变形注意力在所有任务中都更差。</p></div>

### 表 7 · 解码器的顺序

<div class="md-table" tabindex="0" role="region" aria-label="表 7：解码器的顺序，可横向滚动"><table><caption>表 7 · 解码器的顺序（原表数值重排）</caption><thead><tr><th scope="col">顺序</th><th scope="col">Easy</th><th scope="col">Moderate</th><th scope="col">Hard</th></tr></thead><tbody><tr class="md-best"><th scope="row">D → I → V</th><td>28.84</td><td><span class="md-bar" style="--bar:68.70%">20.61</span></td><td>16.38</td></tr><tr><th scope="row">I → D → V</th><td>26.24</td><td><span class="md-bar" style="--bar:64.27%">19.28</span></td><td>16.03</td></tr><tr><th scope="row">I → V → D</th><td>25.84</td><td><span class="md-bar" style="--bar:62.83%">18.85</span></td><td>15.72</td></tr><tr><th scope="row">I → (D + V)</th><td>24.94</td><td><span class="md-bar" style="--bar:61.37%">18.41</span></td><td>15.39</td></tr></tbody></table></div>

<p class="md-source"><a href="https://arxiv.org/pdf/2203.13310v4#page=9">原论文表 7 · 第 9 页</a></p>

<div class="md-explain"><p><b>怎么看</b>D＝深度交叉注意力；I＝查询间自注意力；V＝视觉交叉注意力。最后一行先融合特征，再统一交叉注意力。</p><p><b>记住什么</b>D → I → V 最好：先用深度更新 query，再进行物体交互与视觉聚合。</p><p class="md-caveat"><b>边界</b>这是顺序实验；I → (D + V) 不是先后执行两个独立 attention 层。</p></div>

### 表 8 · 前景监督与深度分箱

<div class="md-table" tabindex="0" role="region" aria-label="表 8：前景监督与深度分箱，可横向滚动"><table><caption>表 8 · 前景监督与深度分箱（原表数值重排）</caption><thead><tr><th scope="col">深度图 / 分箱</th><th scope="col">Easy</th><th scope="col">Moderate</th><th scope="col">Hard</th></tr></thead><tbody><tr class="md-best"><th scope="row">前景 + LID</th><td>28.84</td><td><span class="md-bar" style="--bar:68.70%">20.61</span></td><td>16.38</td></tr><tr><th scope="row">稠密 + LID</th><td>27.69</td><td><span class="md-bar" style="--bar:66.17%">19.85</span></td><td>15.98</td></tr><tr><th scope="row">前景 + UD</th><td>25.61</td><td><span class="md-bar" style="--bar:63.00%">18.90</span></td><td>15.49</td></tr><tr><th scope="row">前景 + SID</th><td>26.05</td><td><span class="md-bar" style="--bar:63.17%">18.95</span></td><td>15.59</td></tr></tbody></table></div>

<p class="md-source"><a href="https://arxiv.org/pdf/2203.13310v4#page=9">原论文表 8 · 第 9 页</a></p>

<div class="md-explain"><p><b>怎么看</b>先对比前两行的监督形式，再保持前景监督，对比 UD、SID、LID 的分箱方式。</p><p><b>记住什么</b>前景 LID 比稠密 LID 高 0.76 个百分点；比前景 UD 高 1.71。</p><p class="md-caveat"><b>边界</b>不能推出“稠密深度无用”。结果只支持该网络与监督配置下的选择。</p></div>

<p class="md-source">UD：均匀分箱；SID：按对数尺度分箱；LID：分箱宽度随距离线性增大。</p>

### 表 9 · 深度位置编码

<div class="md-table" tabindex="0" role="region" aria-label="表 9：深度位置编码，可横向滚动"><table><caption>表 9 · 深度位置编码（原表数值重排）</caption><thead><tr><th scope="col">编码方式</th><th scope="col">Easy</th><th scope="col">Moderate</th><th scope="col">Hard</th></tr></thead><tbody><tr class="md-best"><th scope="row">逐米可学习编码</th><td>28.84</td><td><span class="md-bar" style="--bar:68.70%">20.61</span></td><td>16.38</td></tr><tr><th scope="row">按分箱可学习编码</th><td>28.06</td><td><span class="md-bar" style="--bar:65.60%">19.68</span></td><td>16.04</td></tr><tr><th scope="row">深度 sin/cos</th><td>27.42</td><td><span class="md-bar" style="--bar:65.23%">19.57</span></td><td>15.82</td></tr><tr><th scope="row">二维 sin/cos</th><td>26.48</td><td><span class="md-bar" style="--bar:62.10%">18.63</span></td><td>15.52</td></tr><tr><th scope="row">无位置编码</th><td>26.76</td><td><span class="md-bar" style="--bar:63.13%">18.94</span></td><td>15.85</td></tr></tbody></table></div>

<p class="md-source"><a href="https://arxiv.org/pdf/2203.13310v4#page=9">原论文表 9 · 第 9 页</a></p>

<div class="md-explain"><p><b>怎么看</b>区分编码什么（深度或二维位置）与怎样编码（学习向量或 sin/cos）。</p><p><b>记住什么</b>逐米编码最好；比无编码的 18.94 高 1.67 个百分点。</p><p class="md-caveat"><b>边界</b>逐米位置编码不同于 80 个 LID 深度分箱：前者提供距离提示，后者用于深度分类。</p></div>

## 读完带走什么

**核心贡献：把深度用于中间的信息读取。** 图 4 串起网络，表 5 检验深度分支，表 7 检验解码顺序。读后续方法时，也可以沿着“深度从哪里来、在哪里用、增益由什么实验支撑”这三个问题展开。

论文：Renrui Zhang et al., *MonoDETR: Depth-guided Transformer for Monocular 3D Object Detection*, ICCV 2023. [arXiv v4](https://arxiv.org/abs/2203.13310v4) · [官方代码](https://github.com/ZrrSkywalker/MonoDETR)
