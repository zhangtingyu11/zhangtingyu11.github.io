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
      <p class="gp-home-intro__eyebrow"><span></span> GRAPYMAGE / TECHNICAL NOTES</p>
      <h1>把复杂问题，<br><em>讲清楚。</em></h1>
      <p class="gp-home-intro__lead">记录计算机视觉、机器人、系统开发与工程实践。少一点术语堆砌，多一点真正弄懂。</p>
      <div class="gp-home-intro__actions">
        <a class="gp-button gp-button--primary" href="/archives/">浏览文章 <span>↗</span></a>
        <a class="gp-button" href="https://github.com/zhangtingyu11" target="_blank" rel="noopener">GitHub</a>
      </div>
    </div>
    <div class="gp-home-intro__terminal" aria-label="博客主题">
      <div class="gp-terminal__bar"><i></i><i></i><i></i><span>grapymage@notes</span></div>
      <div class="gp-terminal__body">
        <p><b>01</b><span>$ focus</span></p>
        <p><b>02</b><strong>vision / robotics / systems</strong></p>
        <p><b>03</b><span>$ principle</span></p>
        <p><b>04</b><strong>understand → build → explain</strong></p>
        <p class="gp-terminal__status"><b>05</b><span><i></i> writing in public</span></p>
      </div>
    </div>`;

  home.insertBefore(intro, categoryBar);
};

const mountPageFeatures = () => {
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
