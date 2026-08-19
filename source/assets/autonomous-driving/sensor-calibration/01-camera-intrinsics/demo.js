const ORIGINAL = Object.freeze({ fx: 600, fy: 600, cx: 400, cy: 225, s: 0 });

const MODES = {
  f:  { label: "真实变焦 f", min: 65, max: 150, step: 1, start: 125, unit: "%" },
  fx: { label: "只看 fₓ", min: 320, max: 900, step: 10, start: 760, unit: " px" },
  fy: { label: "只看 fᵧ", min: 320, max: 900, step: 10, start: 760, unit: " px" },
  cx: { label: "主点 cₓ", min: 250, max: 550, step: 5, start: 500, unit: " px" },
  cy: { label: "主点 cᵧ", min: 135, max: 315, step: 5, start: 285, unit: " px" },
  s:  { label: "倾斜 s", min: -180, max: 180, step: 5, start: 120, unit: " px" }
};

function currentParams(mode, value) {
  if (mode === "f") {
    const scale = value / 100;
    return { ...ORIGINAL, fx: ORIGINAL.fx * scale, fy: ORIGINAL.fy * scale };
  }
  return { ...ORIGINAL, [mode]: value };
}

function polygon(ctx, points, fill, stroke, width = 2) {
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawScene(canvas, p) {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(300, rect.width || 400);
  const cssHeight = cssWidth * 9 / 16;
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssWidth * ratio);
  canvas.height = Math.round(cssHeight * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(cssWidth / 800 * ratio, 0, 0, cssHeight / 450 * ratio, 0, 0);

  const project = ([x, y, z]) => [p.fx * x / z + p.s * y / z + p.cx, p.fy * y / z + p.cy];
  const line3d = (a, b, stroke, width = 2) => {
    const [x1, y1] = project(a), [x2, y2] = project(b);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.stroke();
  };

  ctx.fillStyle = "#0b203a"; ctx.fillRect(0, 0, 800, 450);
  ctx.fillStyle = "#102b47"; ctx.fillRect(0, p.cy, 800, 450 - p.cy);

  // Distant buildings: real projected objects make changes visible above the horizon too.
  const buildings = [
    [-7.2, -5.2, 18, -3.8, 1.2], [-3.2, -3.6, 15, -1.1, 1.2],
    [1.2, -4.6, 17, 4.1, 1.2], [4.6, -3.1, 14, 7.0, 1.2]
  ];
  buildings.forEach(([x1, y1, z, x2, y2], i) => {
    polygon(ctx, [project([x1,y1,z]), project([x2,y1,z]), project([x2,y2,z]), project([x1,y2,z])], i % 2 ? "#143b5c" : "#123450", "#2c6688", 1.2);
    for (let x = x1 + .55; x < x2 - .2; x += .75) {
      line3d([x, y1 + .6, z-.02], [x, y2 - .45, z-.02], "rgba(103,232,249,.32)", 1);
    }
  });

  polygon(ctx, [project([-3.5,1.45,3]), project([3.5,1.45,3]), project([3.5,1.45,28]), project([-3.5,1.45,28])], "#263a50", "#4d6882", 2);
  [-1.4, 0, 1.4].forEach(x => line3d([x,1.44,3], [x,1.44,28], x === 0 ? "#fbbf24" : "#dbeafe", 3));

  [-3.4, 3.4].forEach((x, i) => {
    line3d([x,1.1,9+i*2], [x,-1.4,9+i*2], "#9fb5ca", 3);
    const z = 9 + i * 2;
    polygon(ctx, [project([x,-2.8,z]), project([x-.9,-1.15,z]), project([x+.9,-1.15,z])], "#0f8c7c", "#2dd4bf", 2);
  });

  const z = 7.5;
  polygon(ctx, [project([-1.25,-.2,z]), project([1.25,-.2,z]), project([1.25,1.15,z]), project([-1.25,1.15,z])], "#3b82f6", "#7dd3fc", 3);
  polygon(ctx, [project([-.72,-1.05,z]), project([.72,-1.05,z]), project([1.05,-.2,z]), project([-1.05,-.2,z])], "#2563eb", "#7dd3fc", 3);
  polygon(ctx, [project([-.57,-.91,z-.02]), project([.57,-.91,z-.02]), project([.81,-.29,z-.02]), project([-.81,-.29,z-.02])], "#9bdcff", "#17314d", 2);

  ctx.strokeStyle = "#22d3ee"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(p.cx-9,p.cy); ctx.lineTo(p.cx+9,p.cy); ctx.moveTo(p.cx,p.cy-9); ctx.lineTo(p.cx,p.cy+9); ctx.stroke();
  ctx.beginPath(); ctx.arc(p.cx,p.cy,3,0,Math.PI*2); ctx.fillStyle="#061426"; ctx.fill(); ctx.stroke();
  ctx.fillStyle="#c8f7ff"; ctx.font="500 12px system-ui"; ctx.fillText("主点", p.cx+12, p.cy-9);
}

function describe(mode, value) {
  if (mode === "f") return `模拟镜头焦距变为基准的 ${value}%：fₓ 与 fᵧ 同比例变化，因此画面整体放大或缩小。`;
  const higher = value > ORIGINAL[mode];
  if (mode === "fx") return `只改变 fₓ：所有投影点相对主点沿水平方向${higher ? "拉开" : "靠拢"}，纵坐标不变。`;
  if (mode === "fy") return `只改变 fᵧ：所有投影点相对主点沿垂直方向${higher ? "拉开" : "靠拢"}，横坐标不变。`;
  if (mode === "cx") return `只改变 cₓ：主点与整幅投影一起向${higher ? "右" : "左"}平移，物体大小不变。`;
  if (mode === "cy") return `只改变 cᵧ：主点与整幅投影一起向${higher ? "下" : "上"}平移，物体大小不变。`;
  return "改变 s：同一高度的点横向位移相同，不同高度位移不同，所以画面出现剪切。";
}

function mountLab(root) {
  if (root.dataset.mounted === "true") return;
  root.dataset.mounted = "true";
  const tabs = root.querySelector("[data-tabs]");
  const range = root.querySelector("[data-range]");
  const label = root.querySelector("[data-control-label]");
  const output = root.querySelector("[data-output]");
  const matrix = root.querySelector("[data-matrix]");
  const changedLabel = root.querySelector("[data-changed-label]");
  const explain = root.querySelector("[data-explain]");
  const canvases = root.querySelectorAll("canvas");
  let mode = "f";
  let value = MODES.f.start;

  const render = () => {
    const config = MODES[mode];
    const current = currentParams(mode, value);
    label.textContent = config.label;
    output.value = `${value}${config.unit}`;
    changedLabel.textContent = mode === "f" ? `fₓ = fᵧ = ${Math.round(current.fx)} px` : `${mode.replace("fx","fₓ").replace("fy","fᵧ").replace("cx","cₓ").replace("cy","cᵧ")} = ${value}${config.unit}`;
    explain.textContent = describe(mode, value);
    const values = [current.fx, current.s, current.cx, 0, current.fy, current.cy, 0, 0, 1];
    [...matrix.children].forEach((cell, index) => {
      cell.textContent = Number.isInteger(values[index]) ? values[index] : values[index].toFixed(0);
      const keys = ["fx","s","cx",null,"fy","cy",null,null,null];
      cell.classList.toggle("is-changed", mode === "f" ? keys[index] === "fx" || keys[index] === "fy" : keys[index] === mode);
    });
    drawScene(canvases[0], ORIGINAL);
    drawScene(canvases[1], current);
  };

  tabs.addEventListener("click", event => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    mode = button.dataset.mode;
    const config = MODES[mode];
    value = config.start;
    range.min = config.min; range.max = config.max; range.step = config.step; range.value = value;
    tabs.querySelectorAll("button").forEach(item => item.classList.toggle("is-active", item === button));
    render();
  });
  range.addEventListener("input", () => { value = Number(range.value); render(); });
  const observer = new ResizeObserver(render);
  canvases.forEach(canvas => observer.observe(canvas));
  render();
}

const DEPTH_X = 1.4;

function drawDepthProjection(canvas, depth) {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(300, rect.width || 760);
  const cssHeight = cssWidth < 560 ? cssWidth * .72 : cssWidth * .48;
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssWidth * ratio);
  canvas.height = Math.round(cssHeight * ratio);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const scale = cssWidth / 900;
  const sx = value => value * scale;
  const axisY = cssHeight * .6;
  const origin = { x: sx(72), y: axisY };
  const unit = sx(88);
  const planeX = origin.x + unit;
  const point = { x: origin.x + unit * depth, y: axisY - unit * DEPTH_X };
  const normalizedX = DEPTH_X / depth;
  const projected = { x: planeX, y: axisY - unit * normalizedX };
  const compact = cssWidth < 560;

  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = "#f7fbfa";
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  // A soft depth strip makes motion direction readable without adding a grid.
  const depthGradient = ctx.createLinearGradient(planeX, 0, cssWidth, 0);
  depthGradient.addColorStop(0, "rgba(104, 198, 181, .09)");
  depthGradient.addColorStop(1, "rgba(151, 187, 226, .09)");
  ctx.fillStyle = depthGradient;
  ctx.fillRect(planeX, 0, cssWidth - planeX, cssHeight);

  ctx.lineCap = "round";
  ctx.strokeStyle = "#bddbd6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(origin.x, axisY);
  ctx.lineTo(cssWidth - sx(35), axisY);
  ctx.stroke();

  ctx.strokeStyle = "#71c9b8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(planeX, sx(58));
  ctx.lineTo(planeX, cssHeight - sx(48));
  ctx.stroke();

  ctx.fillStyle = "#54817d";
  ctx.font = `${Math.max(12, sx(15))}px system-ui, sans-serif`;
  ctx.fillText("归一化平面  Zc = 1", planeX + sx(12), sx(48));
  ctx.fillText("光轴", cssWidth - sx(78), axisY - sx(10));

  // The current camera ray and its intersection with the normalized plane.
  ctx.strokeStyle = "#79a7b8";
  ctx.lineWidth = Math.max(2, sx(3));
  ctx.setLineDash([sx(9), sx(8)]);
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Show the fixed Xc offset at P.
  ctx.strokeStyle = "rgba(85, 133, 128, .42)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(point.x, axisY);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();

  ctx.fillStyle = "#284f4d";
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, Math.max(6, sx(8)), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ea8b73";
  ctx.beginPath();
  ctx.arc(point.x, point.y, Math.max(7, sx(10)), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#5f8e9f";
  ctx.beginPath();
  ctx.arc(projected.x, projected.y, Math.max(6, sx(8)), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#294d4d";
  ctx.font = `700 ${Math.max(13, sx(17))}px system-ui, sans-serif`;
  ctx.fillText("光心 O", origin.x - sx(26), axisY + sx(34));
  const pointLabelX = compact ? Math.min(point.x - sx(42), cssWidth - 92) : point.x - sx(42);
  ctx.fillText("空间点 P", pointLabelX, point.y - sx(20));
  ctx.fillStyle = "#4d7887";
  ctx.fillText("投影点", projected.x + sx(12), projected.y - sx(10));

  if (!compact) {
    ctx.fillStyle = "#6a8b88";
    ctx.font = `${sx(14)}px system-ui, sans-serif`;
    ctx.fillText("Xc = 1.4（保持不变）", point.x - sx(70), axisY + sx(27));
  }

  const formulaX = compact ? cssWidth * .14 : sx(300);
  const formulaY = cssHeight - sx(42);
  const formulaWidth = compact ? cssWidth * .72 : sx(300);
  ctx.fillStyle = "rgba(255, 255, 255, .92)";
  ctx.strokeStyle = "#d9ebe7";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(formulaX, formulaY - sx(42), formulaWidth, sx(56), sx(12));
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#315856";
  ctx.font = `700 ${Math.max(12, sx(16))}px ui-monospace, monospace`;
  ctx.fillText(`x = 1.4 / ${depth.toFixed(1)} = ${normalizedX.toFixed(2)}`, formulaX + sx(18), formulaY - sx(7));
}

function mountDepthProjection(root) {
  if (root.dataset.mounted === "true") return;
  root.dataset.mounted = "true";
  const canvas = root.querySelector("[data-depth-canvas]");
  const range = root.querySelector("[data-depth-range]");
  const output = root.querySelector("[data-depth-output]");
  const explain = root.querySelector("[data-depth-explain]");
  const toggle = root.querySelector("[data-depth-toggle]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let playing = !reducedMotion;
  let direction = 1;
  let lastTime = 0;
  let frameId = 0;

  const render = () => {
    const depth = Number(range.value);
    const x = DEPTH_X / depth;
    output.value = depth.toFixed(1);
    explain.textContent = `Zc = ${depth.toFixed(1)} 时，x = 1.4 ÷ ${depth.toFixed(1)} = ${x.toFixed(2)}。Zc 越大，投影点越靠近光轴。`;
    drawDepthProjection(canvas, depth);
  };

  const updateToggle = () => {
    toggle.textContent = playing ? "暂停" : "播放";
    toggle.setAttribute("aria-pressed", String(playing));
  };

  const tick = time => {
    if (!root.isConnected) return;
    if (!lastTime) lastTime = time;
    const elapsed = Math.min(40, time - lastTime);
    lastTime = time;
    let next = Number(range.value) + direction * elapsed * .00105;
    if (next >= Number(range.max)) { next = Number(range.max); direction = -1; }
    if (next <= Number(range.min)) { next = Number(range.min); direction = 1; }
    range.value = next.toFixed(2);
    render();
    if (playing) frameId = requestAnimationFrame(tick);
  };

  const start = () => {
    if (!playing) return;
    lastTime = 0;
    cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(tick);
  };

  toggle.addEventListener("click", () => {
    playing = !playing;
    updateToggle();
    if (playing) start();
    else cancelAnimationFrame(frameId);
  });
  range.addEventListener("input", () => {
    playing = false;
    cancelAnimationFrame(frameId);
    updateToggle();
    render();
  });

  const observer = new ResizeObserver(render);
  observer.observe(canvas);
  updateToggle();
  render();
  start();
}

export function mountIntrinsicLabs(scope = document) {
  scope.querySelectorAll("[data-intrinsic-lab]").forEach(mountLab);
  scope.querySelectorAll("[data-depth-projection]").forEach(mountDepthProjection);
}
