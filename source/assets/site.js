import { mountIntrinsicLabs } from "/assets/autonomous-driving/sensor-calibration/01-camera-intrinsics/demo.js";

const mountHomeIntro = (root = document) => {
  const home = root.querySelector?.(".layout--home");
  if (!home || home.querySelector(".gp-home-intro")) return;

  const categoryBar = home.querySelector(".home-category-bar");
  if (!categoryBar) return;

  const intro = document.createElement("section");
  intro.className = "gp-home-intro";
  intro.innerHTML = `
    <div class="gp-home-intro__copy">
      <p class="gp-home-intro__eyebrow"><span></span> GRAPYMAGE · 技术随笔</p>
      <h1>把复杂问题，<br><em>慢慢讲清楚。</em></h1>
      <p class="gp-home-intro__lead">记录计算机视觉、机器人、系统开发与工程实践。少一点术语堆砌，多一点真正弄懂。</p>
      <div class="gp-home-intro__actions">
        <a class="gp-button gp-button--primary" href="/archives/">浏览文章 <span>↗</span></a>
        <a class="gp-button" href="https://github.com/zhangtingyu11" target="_blank" rel="noopener">GitHub</a>
      </div>
    </div>
    <figure class="gp-home-intro__visual">
      <img src="/img/megumi-kato.jpg" alt="樱花街道上的加藤惠" loading="eager">
      <figcaption><span></span> 春日、记录与分享</figcaption>
    </figure>`;

  home.insertBefore(intro, categoryBar);
};

const mountPageFeatures = () => {
  document.documentElement.setAttribute("data-theme", "light");
  window.Solitude?.saveToLocal?.set?.("theme", "light", 365);
  mountHomeIntro(document);
  mountIntrinsicLabs(document);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountPageFeatures, { once: true });
} else {
  mountPageFeatures();
}

document.addEventListener("pjax:complete", mountPageFeatures);
window.Solitude?.on?.("afterNavigate", mountPageFeatures);
