import { mountIntrinsicLabs } from "/assets/autonomous-driving/sensor-calibration/01-camera-intrinsics/demo.js?v=20260819-11";

const mountHomeIntro = (root = document) => {
  const home = root.querySelector?.(".layout--home");
  if (!home || home.querySelector(".gp-home-intro")) return;

  const categoryBar = home.querySelector(".home-category-bar");
  if (!categoryBar) return;

  const intro = document.createElement("section");
  intro.className = "gp-home-intro";
  intro.innerHTML = `
    <img class="gp-home-intro__image" src="/img/megumi-kato.jpg?v=20260819-3" alt="樱花街道上的加藤惠" loading="eager">
    <div class="gp-home-intro__shade"></div>
    <div class="gp-home-intro__words">
      <p class="gp-home-intro__name">Grapymage</p>
      <p class="gp-home-intro__quote" aria-label="纸上得来终觉浅，绝知此事要躬行">
        <span data-hero-typing></span><i aria-hidden="true"></i>
      </p>
    </div>`;

  home.insertBefore(intro, categoryBar);
};

const mountHeroTyping = (root = document) => {
  window.clearTimeout(window.__gpHeroTypingTimer);
  const target = root.querySelector?.("[data-hero-typing]");
  if (!target) return;

  const sentence = Array.from("纸上得来终觉浅，绝知此事要躬行");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    target.textContent = sentence.join("");
    return;
  }

  let length = 0;
  let deleting = false;
  const tick = () => {
    target.textContent = sentence.slice(0, length).join("");

    if (!deleting && length === sentence.length) {
      deleting = true;
      window.__gpHeroTypingTimer = window.setTimeout(tick, 2400);
      return;
    }

    if (deleting && length === 0) {
      deleting = false;
      window.__gpHeroTypingTimer = window.setTimeout(tick, 650);
      return;
    }

    length += deleting ? -1 : 1;
    window.__gpHeroTypingTimer = window.setTimeout(tick, deleting ? 55 : 115);
  };

  tick();
};

const mountPageFeatures = () => {
  document.documentElement.setAttribute("data-theme", "light");
  window.Solitude?.saveToLocal?.set?.("theme", "light", 365);
  mountHomeIntro(document);
  mountHeroTyping(document);
  mountIntrinsicLabs(document);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountPageFeatures, { once: true });
} else {
  mountPageFeatures();
}

document.addEventListener("pjax:complete", mountPageFeatures);
window.Solitude?.on?.("afterNavigate", mountPageFeatures);
