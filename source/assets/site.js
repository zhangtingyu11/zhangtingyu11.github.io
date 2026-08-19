import { mountIntrinsicLabs } from "/assets/autonomous-driving/sensor-calibration/01-camera-intrinsics/demo.js";

const mountPageFeatures = () => mountIntrinsicLabs(document);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountPageFeatures, { once: true });
} else {
  mountPageFeatures();
}

document.addEventListener("pjax:complete", mountPageFeatures);
window.Solitude?.on?.("afterNavigate", mountPageFeatures);
