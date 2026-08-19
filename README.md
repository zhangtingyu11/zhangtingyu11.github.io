# Grapymage 的个人博客

基于 Hexo 8 与 Solitude 4，使用 GitHub Actions 部署到 GitHub Pages。

## 本地预览

```bash
npm install
npm run server
```

打开 `http://localhost:4000`。

## 内容结构

```text
source/
├── _posts/                         # Markdown 文章
└── assets/                         # 与文章结构对应的图片、CSS、JS
    └── autonomous-driving/
        └── sensor-calibration/
```

旧版生成后的网站保存在 `archive/legacy-static-site` 分支和 `legacy-static-2024` 标签中，不在新站批量恢复。
