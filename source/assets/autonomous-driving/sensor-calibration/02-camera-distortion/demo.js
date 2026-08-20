const MODES = {
  barrel: {
    label: "桶形畸变",
    describe: "同一视场内，边缘位置发生较温和的径向偏移；直线向外鼓起。"
  },
  pincushion: {
    label: "枕形畸变",
    describe: "离主点越远，点越向外扩张；画面边缘呈现向内收紧的形状。"
  },
  tangential: {
    label: "切向畸变",
    describe: "镜头与传感器没有完全对正，画面出现不对称的斜向拉扯。"
  },
  fisheye: {
    label: "鱼眼投影",
    describe: "把更宽视场压进同一张图；两侧出现针孔画面外的建筑，边缘压缩也更强。"
  }
};

const RADTAN_PARAMETERS = {
  k1: { scale: .14, initial: -75, describe: "r² 项：从画面中部开始明显。负值偏桶形，正值偏枕形。" },
  k2: { scale: .14, initial: -75, describe: "r⁴ 项：中心变化很小，主要影响画面边缘。" },
  k3: { scale: .14, initial: -75, describe: "r⁶ 项：基本只动最外圈，对边缘数据最敏感。" },
  p1: { scale: .08, initial: 65, describe: "切向项：主要表现为上下方向的不对称偏移。" },
  p2: { scale: .08, initial: 65, describe: "切向项：主要表现为左右方向的不对称偏移。" }
};

const RATIONAL_PARAMETERS = {
  k4: { scale: .08, initial: 70, describe: "分母的 r² 项：从画面中部开始改变径向缩放。" },
  k5: { scale: .08, initial: 70, describe: "分母的 r⁴ 项：变化主要集中在画面边缘。" },
  k6: { scale: .08, initial: 70, describe: "分母的 r⁶ 项：主要调整最外圈，数值过大时最容易不稳定。" }
};

function transformPoint(px, py, mode, strength) {
  if (mode === "none" || strength === 0) return [px, py];
  const focal = 360;
  const x = (px - 400) / focal;
  const y = (py - 225) / focal;
  const r2 = x * x + y * y;
  const amount = strength / 100;
  let xd = x;
  let yd = y;

  if (mode === "barrel") {
    const k1 = -.19 * amount;
    const k2 = .025 * amount;
    const scale = 1 + k1 * r2 + k2 * r2 * r2;
    xd = x * scale;
    yd = y * scale;
  } else if (mode === "pincushion") {
    const k1 = .2 * amount;
    const k2 = .025 * amount;
    const scale = 1 + k1 * r2 + k2 * r2 * r2;
    xd = x * scale;
    yd = y * scale;
  } else if (mode === "tangential") {
    const p1 = .09 * amount;
    const p2 = -.075 * amount;
    xd = x + 2 * p1 * x * y + p2 * (r2 + 2 * x * x);
    yd = y + p1 * (r2 + 2 * y * y) + 2 * p2 * x * y;
  } else if (mode === "fisheye") {
    const r = Math.sqrt(r2);
    if (r > 1e-8) {
      const theta = Math.atan(r);
      const theta2 = theta * theta;
      const thetaDistorted = theta * (1 + .035 * amount * theta2);
      const fishScale = thetaDistorted / r;
      const scale = 1 + amount * (fishScale - 1);
      xd = x * scale;
      yd = y * scale;
    }
  }

  return [400 + focal * xd, 225 + focal * yd];
}

function transformRadTanPoint(px, py, coefficients) {
  const focal = 360;
  const x = (px - 400) / focal;
  const y = (py - 225) / focal;
  const r2 = x * x + y * y;
  const numerator = 1 + coefficients.k1 * r2 + coefficients.k2 * r2 ** 2 + coefficients.k3 * r2 ** 3;
  const denominator = 1 + (coefficients.k4 || 0) * r2 + (coefficients.k5 || 0) * r2 ** 2 + (coefficients.k6 || 0) * r2 ** 3;
  const radial = numerator / denominator;
  const deltaX = 2 * coefficients.p1 * x * y + coefficients.p2 * (r2 + 2 * x * x);
  const deltaY = coefficients.p1 * (r2 + 2 * y * y) + 2 * coefficients.p2 * x * y;
  return [
    400 + focal * (x * radial + deltaX),
    225 + focal * (y * radial + deltaY)
  ];
}

function sampleEdge(a, b, count = 22) {
  const points = [];
  for (let index = 0; index <= count; index += 1) {
    const t = index / count;
    points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return points;
}

function samplePolygon(vertices) {
  const points = [];
  vertices.forEach((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    points.push(...sampleEdge(vertex, next));
  });
  return points;
}

function drawScene(canvas, mode, strength, coefficients = null) {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(280, rect.width || 400);
  const cssHeight = cssWidth * 9 / 16;
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssWidth * ratio);
  canvas.height = Math.round(cssHeight * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(cssWidth / 800 * ratio, 0, 0, cssHeight / 450 * ratio, 0, 0);

  const map = point => coefficients
    ? transformRadTanPoint(point[0], point[1], coefficients)
    : transformPoint(point[0], point[1], mode, strength);
  const path = (points, { stroke = null, fill = null, width = 2, close = false, dash = [] } = {}) => {
    const mapped = points.map(map);
    ctx.beginPath();
    mapped.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (close) ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };
  const line = (a, b, color, width = 2, dash = []) => path(sampleEdge(a, b, 34), { stroke: color, width, dash });
  const polygon = (vertices, fill, stroke = null, width = 2) => path(samplePolygon(vertices), { fill, stroke, width, close: true });
  const circle = (center, radius, fill, stroke = null, width = 2) => {
    const points = [];
    for (let index = 0; index <= 72; index += 1) {
      const angle = index / 72 * Math.PI * 2;
      points.push([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius]);
    }
    path(points, { fill, stroke, width, close: true });
  };

  ctx.fillStyle = "#f3f8f7";
  ctx.fillRect(0, 0, 800, 450);
  circle([655, 80], 35, "#f4d8a5");

  polygon([[0, 110], [270, 110], [270, 325], [0, 350]], "#d9e8e5", "#6e938d", 2);
  polygon([[540, 95], [800, 95], [800, 350], [540, 320]], "#dce8ef", "#728fa0", 2);
  polygon([[285, 170], [515, 170], [515, 300], [285, 300]], "#e8efed", "#789b95", 2);

  if (mode === "fisheye") {
    polygon([[-205, 70], [-20, 70], [-20, 365], [-205, 390]], "#cfe3df", "#5d8981", 2);
    polygon([[820, 55], [1010, 55], [1010, 390], [820, 365]], "#d2e1e9", "#658696", 2);
    [-165, -100, 855, 920].forEach(x => {
      [115, 185, 255].forEach(y => polygon([[x,y], [x+34,y], [x+34,y+34], [x,y+34]], "#f7fbfa", "#87a49e", 1.3));
    });
  }

  [55, 125, 195].forEach(x => {
    [150, 220, 290].forEach(y => polygon([[x,y], [x+38,y], [x+38,y+36], [x,y+36]], "#f7fbfa", "#91aaa5", 1.4));
  });
  [575, 645, 715].forEach(x => {
    [135, 205, 275].forEach(y => polygon([[x,y], [x+38,y], [x+38,y+36], [x,y+36]], "#f8fbfd", "#91a7b2", 1.4));
  });
  [320, 385, 450].forEach(x => polygon([[x,205], [x+34,205], [x+34,245], [x,245]], "#f8fbfa", "#9aafab", 1.2));

  line([0, 325], [800, 325], "#638c85", 2.2);
  polygon([[115,450], [685,450], [515,285], [285,285]], "#c9d6d3", "#6f8b86", 2);
  line([400,450], [400,285], "#f7f1cf", 5, [24, 18]);
  line([225,450], [335,285], "#f7fbfa", 3);
  line([575,450], [465,285], "#f7fbfa", 3);

  [365, 430].forEach(x => line([x, 350], [x, 325], "#537d76", 4));
  line([365, 325], [430, 325], "#537d76", 4);
  circle([397, 325], 18, "#e68b70", "#ffffff", 3);

  line([75, 355], [75, 245], "#657f7b", 4);
  line([75, 245], [112, 245], "#657f7b", 4);
  circle([116, 245], 8, "#f1c879", "#ffffff", 2);
  line([725, 355], [725, 230], "#657f7b", 4);
  line([725, 230], [688, 230], "#657f7b", 4);
  circle([684, 230], 8, "#f1c879", "#ffffff", 2);
}

function mountDistortionLab(root) {
  if (root.dataset.mounted === "true") return;
  root.dataset.mounted = "true";
  const tabs = root.querySelector("[data-distortion-tabs]");
  const range = root.querySelector("[data-distortion-range]");
  const output = root.querySelector("[data-distortion-output]");
  const explain = root.querySelector("[data-distortion-explain]");
  const canvases = root.querySelectorAll("canvas");
  let mode = "barrel";

  const render = () => {
    const strength = Number(range.value);
    output.value = `${strength}%`;
    explain.textContent = `${MODES[mode].label}：${MODES[mode].describe}`;
    drawScene(canvases[0], "none", 0);
    drawScene(canvases[1], mode, strength);
  };

  tabs.addEventListener("click", event => {
    const button = event.target.closest("button[data-distortion-mode]");
    if (!button) return;
    mode = button.dataset.distortionMode;
    tabs.querySelectorAll("button").forEach(item => item.classList.toggle("is-active", item === button));
    render();
  });
  range.addEventListener("input", render);
  const observer = new ResizeObserver(render);
  canvases.forEach(canvas => observer.observe(canvas));
  render();
}

function mountRadTanParameterLab(root) {
  if (root.dataset.mounted === "true") return;
  root.dataset.mounted = "true";
  const tabs = root.querySelector("[data-radtan-parameter-tabs]");
  const range = root.querySelector("[data-radtan-parameter-range]");
  const name = root.querySelector("[data-radtan-parameter-name]");
  const output = root.querySelector("[data-radtan-parameter-output]");
  const explain = root.querySelector("[data-radtan-parameter-explain]");
  const canvases = root.querySelectorAll("canvas");
  const values = Object.fromEntries(Object.entries(RADTAN_PARAMETERS).map(([key, item]) => [key, item.initial]));
  let active = "k1";

  const render = () => {
    const definition = RADTAN_PARAMETERS[active];
    const coefficient = definition.scale * values[active] / 100;
    const coefficients = { k1: 0, k2: 0, k3: 0, p1: 0, p2: 0, [active]: coefficient };
    name.textContent = active;
    output.value = `${coefficient >= 0 ? "+" : ""}${coefficient.toFixed(3)}`;
    explain.textContent = definition.describe;
    drawScene(canvases[0], "none", 0);
    drawScene(canvases[1], "radtan", 0, coefficients);
  };

  tabs.addEventListener("click", event => {
    const button = event.target.closest("button[data-radtan-parameter]");
    if (!button) return;
    active = button.dataset.radtanParameter;
    range.value = values[active];
    tabs.querySelectorAll("button").forEach(item => item.classList.toggle("is-active", item === button));
    render();
  });
  range.addEventListener("input", () => {
    values[active] = Number(range.value);
    render();
  });
  const observer = new ResizeObserver(render);
  canvases.forEach(canvas => observer.observe(canvas));
  range.value = values[active];
  render();
}

function mountRationalParameterLab(root) {
  if (root.dataset.mounted === "true") return;
  root.dataset.mounted = "true";
  const tabs = root.querySelector("[data-rational-parameter-tabs]");
  const range = root.querySelector("[data-rational-parameter-range]");
  const name = root.querySelector("[data-rational-parameter-name]");
  const output = root.querySelector("[data-rational-parameter-output]");
  const explain = root.querySelector("[data-rational-parameter-explain]");
  const canvases = root.querySelectorAll("canvas");
  const values = Object.fromEntries(Object.entries(RATIONAL_PARAMETERS).map(([key, item]) => [key, item.initial]));
  const base = { k1: -.12, k2: .025, k3: 0, p1: 0, p2: 0, k4: 0, k5: 0, k6: 0 };
  let active = "k4";

  const render = () => {
    const definition = RATIONAL_PARAMETERS[active];
    const coefficient = definition.scale * values[active] / 100;
    const rational = { ...base, [active]: coefficient };
    name.textContent = active;
    output.value = `${coefficient >= 0 ? "+" : ""}${coefficient.toFixed(3)}`;
    explain.textContent = `${definition.describe} 正值增大分母，负值减小分母。`;
    drawScene(canvases[0], "radtan", 0, base);
    drawScene(canvases[1], "rational", 0, rational);
  };

  tabs.addEventListener("click", event => {
    const button = event.target.closest("button[data-rational-parameter]");
    if (!button) return;
    active = button.dataset.rationalParameter;
    range.value = values[active];
    tabs.querySelectorAll("button").forEach(item => item.classList.toggle("is-active", item === button));
    render();
  });
  range.addEventListener("input", () => {
    values[active] = Number(range.value);
    render();
  });
  const observer = new ResizeObserver(render);
  canvases.forEach(canvas => observer.observe(canvas));
  range.value = values[active];
  render();
}

export function mountDistortionLabs(scope = document) {
  scope.querySelectorAll("[data-distortion-lab]").forEach(mountDistortionLab);
  scope.querySelectorAll("[data-radtan-parameter-lab]").forEach(mountRadTanParameterLab);
  scope.querySelectorAll("[data-rational-parameter-lab]").forEach(mountRationalParameterLab);
}
