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

export function mountIntrinsicLabs(scope = document) {
  scope.querySelectorAll("[data-intrinsic-lab]").forEach(mountLab);
}
