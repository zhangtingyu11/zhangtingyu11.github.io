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

function drawKbAngleGeometry(canvas, angleDegrees) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(280, rect.width || 600);
  const horizontal = width >= 560;
  const height = horizontal ? 290 : 430;
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const gap = 12;
  const panels = horizontal
    ? [
        { x: 8, y: 8, width: (width - gap - 16) / 2, height: height - 16 },
        { x: 8 + (width - gap - 16) / 2 + gap, y: 8, width: (width - gap - 16) / 2, height: height - 16 }
      ]
    : [
        { x: 8, y: 8, width: width - 16, height: 201 },
        { x: 8, y: 221, width: width - 16, height: 201 }
      ];
  const radians = angleDegrees * Math.PI / 180;

  const drawPanel = (panel, type) => {
    ctx.fillStyle = type === "pinhole" ? "#f7fafb" : "#f7fbfa";
    ctx.strokeStyle = type === "pinhole" ? "#dbe6eb" : "#d8e8e4";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panel.x, panel.y, panel.width, panel.height, 11);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#315c55";
    ctx.font = "700 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(type === "pinhole" ? "针孔：光线不改变方向" : "鱼眼：光线在镜片处折射", panel.x + 14, panel.y + 13);

    const centerY = panel.y + panel.height * .59;
    const lensX = panel.x + panel.width * .5;
    const focal = Math.min(62, panel.width * .21, panel.height * .27);
    const sensorX = lensX - focal;
    const sensorHalf = Math.min(panel.height * .32, focal * 1.6);
    const sensorTop = centerY - sensorHalf;
    const sensorBottom = centerY + sensorHalf;
    const outputRadius = type === "pinhole" ? Math.tan(radians) : radians;
    const targetY = centerY + focal * outputRadius;
    const color = type === "pinhole" ? "#6f93a3" : "#58a99a";

    ctx.strokeStyle = "#9eb3ae";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(panel.x + 16, centerY);
    ctx.lineTo(panel.x + panel.width - 16, centerY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#70837f";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("光轴", panel.x + panel.width - 42, centerY + 6);

    ctx.strokeStyle = "#809b95";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sensorX, sensorTop);
    ctx.lineTo(sensorX, sensorBottom);
    ctx.stroke();
    ctx.fillStyle = "#70837f";
    ctx.textAlign = "center";
    ctx.fillText("传感器", sensorX, sensorBottom + 7);

    if (type === "fisheye") {
      const lensHalf = Math.min(43, panel.height * .2);
      const lensWidth = 11;
      ctx.beginPath();
      ctx.moveTo(lensX, centerY - lensHalf);
      ctx.bezierCurveTo(lensX - lensWidth, centerY - lensHalf * .55, lensX - lensWidth, centerY + lensHalf * .55, lensX, centerY + lensHalf);
      ctx.bezierCurveTo(lensX + lensWidth, centerY + lensHalf * .55, lensX + lensWidth, centerY - lensHalf * .55, lensX, centerY - lensHalf);
      ctx.closePath();
      ctx.fillStyle = "rgba(117, 201, 186, .18)";
      ctx.strokeStyle = "#79bfb2";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#70837f";
      ctx.textAlign = "center";
      ctx.fillText("镜片", lensX, centerY + lensHalf + 8);
    } else {
      ctx.strokeStyle = "#809b95";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lensX, centerY - 25);
      ctx.lineTo(lensX, centerY - 7);
      ctx.moveTo(lensX, centerY + 7);
      ctx.lineTo(lensX, centerY + 25);
      ctx.stroke();
      ctx.fillStyle = "#70837f";
      ctx.textAlign = "center";
      ctx.fillText("针孔", lensX, centerY + 33);
    }

    const right = panel.x + panel.width - 14;
    const top = panel.y + 43;
    const cos = Math.max(Math.cos(radians), .001);
    const sin = Math.max(Math.sin(radians), .001);
    const incomingLength = Math.min((right - lensX) / cos, (centerY - top) / sin);
    const incomingX = lensX + incomingLength * cos;
    const incomingY = centerY - incomingLength * sin;

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(incomingX, incomingY);
    ctx.lineTo(lensX, centerY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(lensX, centerY);
    if (type === "pinhole") {
      if (targetY <= sensorBottom) {
        ctx.lineTo(sensorX, targetY);
      } else {
        const bottomY = panel.y + panel.height - 14;
        const bottomX = lensX - (bottomY - centerY) / Math.max(Math.tan(radians), .001);
        ctx.lineTo(bottomX, bottomY);
      }
    } else {
      ctx.lineTo(sensorX, targetY);
    }
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("入射光", (incomingX + lensX) / 2 + 7, (incomingY + centerY) / 2 - 13);
    if (type === "fisheye") {
      ctx.fillText("折射后", (lensX + sensorX) / 2 - 5, (centerY + targetY) / 2 + 8);
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(lensX, centerY, 22, -radians, 0);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.fillText("θ", lensX + 24, centerY - 18);

    ctx.beginPath();
    ctx.arc(lensX, centerY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#315c55";
    ctx.fill();

    if (targetY >= sensorTop && targetY <= sensorBottom) {
      ctx.beginPath();
      ctx.arc(sensorX, targetY, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = "#6f7f85";
      ctx.textAlign = "left";
      ctx.fillText("落点超出传感器", sensorX + 8, sensorBottom - 11);
    }
  };

  drawPanel(panels[0], "pinhole");
  drawPanel(panels[1], "fisheye");
}

function drawKbRadiusMapping(canvas, factor) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(280, rect.width || 600);
  const height = width >= 520 ? 280 : 250;
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const plane = { x: 12, y: 12, width: width - 24, height: height - 24 };
  const originX = width >= 520 ? plane.x + plane.width * .25 : plane.x + 62;
  const originY = plane.y + plane.height * .42;
  const angle = .42;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const maxFactor = 1.45;
  const baseLength = Math.min(
    width * .39,
    (plane.x + plane.width - 30 - originX) / (dx * maxFactor),
    (plane.y + plane.height - 34 - originY) / (dy * maxFactor)
  );
  const guideLength = baseLength * maxFactor;
  const baseX = originX + dx * baseLength;
  const baseY = originY + dy * baseLength;
  const correctedX = originX + dx * baseLength * factor;
  const correctedY = originY + dy * baseLength * factor;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#f8fbfa";
  ctx.strokeStyle = "#d8e6e2";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(plane.x, plane.y, plane.width, plane.height, 10);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(plane.x, plane.y, plane.width, plane.height, 10);
  ctx.clip();
  ctx.strokeStyle = "#e6efec";
  ctx.lineWidth = 1;
  for (let x = plane.x + 34; x < plane.x + plane.width; x += 42) {
    ctx.beginPath();
    ctx.moveTo(x, plane.y);
    ctx.lineTo(x, plane.y + plane.height);
    ctx.stroke();
  }
  for (let y = plane.y + 34; y < plane.y + plane.height; y += 42) {
    ctx.beginPath();
    ctx.moveTo(plane.x, y);
    ctx.lineTo(plane.x + plane.width, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "#526b66";
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("归一化成像平面（正面看）", plane.x + 14, plane.y + 11);

  ctx.strokeStyle = "#9eb3ae";
  ctx.fillStyle = "#718681";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plane.x + 18, originY);
  ctx.lineTo(plane.x + plane.width - 17, originY);
  ctx.lineTo(plane.x + plane.width - 24, originY - 4);
  ctx.moveTo(plane.x + plane.width - 17, originY);
  ctx.lineTo(plane.x + plane.width - 24, originY + 4);
  ctx.moveTo(originX, plane.y + 34);
  ctx.lineTo(originX, plane.y + plane.height - 16);
  ctx.lineTo(originX - 4, plane.y + plane.height - 23);
  ctx.moveTo(originX, plane.y + plane.height - 16);
  ctx.lineTo(originX + 4, plane.y + plane.height - 23);
  ctx.stroke();
  ctx.font = "700 12px ui-monospace, monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("x", plane.x + plane.width - 20, originY - 7);
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText("y", originX + 8, plane.y + plane.height - 17);

  ctx.fillStyle = "rgba(220, 241, 235, .72)";
  ctx.beginPath();
  ctx.arc(originX, originY, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#b3c4c0";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 7]);
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(originX + dx * guideLength, originY + dy * guideLength);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "#8b9f9a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(baseX, baseY);
  ctx.stroke();

  ctx.strokeStyle = "#58a99a";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(correctedX, correctedY);
  ctx.stroke();

  const distance = Math.hypot(correctedX - baseX, correctedY - baseY);
  if (distance > 12) {
    const normalX = -dy * 16;
    const normalY = dx * 16;
    const startX = baseX + normalX;
    const startY = baseY + normalY;
    const endX = correctedX + normalX;
    const endY = correctedY + normalY;
    const arrowAngle = Math.atan2(endY - startY, endX - startX);
    ctx.strokeStyle = "#d08a6e";
    ctx.fillStyle = "#d08a6e";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - Math.cos(arrowAngle - .55) * 9, endY - Math.sin(arrowAngle - .55) * 9);
    ctx.lineTo(endX - Math.cos(arrowAngle + .55) * 9, endY - Math.sin(arrowAngle + .55) * 9);
    ctx.closePath();
    ctx.fill();
    ctx.font = "700 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(factor < 1 ? "向 O" : "远离 O", (startX + endX) / 2, (startY + endY) / 2 - 4);
  }

  const radiusLabelX = originX + dx * baseLength * .48 + dy * 19;
  const radiusLabelY = originY + dy * baseLength * .48 - dx * 19;
  ctx.fillStyle = "#607772";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("这条线段的长度就是平面距离", radiusLabelX, radiusLabelY);

  ctx.beginPath();
  ctx.arc(originX, originY, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#315c55";
  ctx.fill();
  ctx.fillStyle = "#315c55";
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("原点 O=(0,0)", originX, originY + 13);

  ctx.beginPath();
  ctx.arc(baseX, baseY, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#829691";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(correctedX, correctedY, 9, 0, Math.PI * 2);
  ctx.fillStyle = "#58a99a";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.font = "700 13px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  if (Math.abs(factor - 1) < .035) {
    ctx.fillStyle = "#315c55";
    ctx.textAlign = width < 420 ? "right" : "left";
    ctx.fillText("f·θ 与 f·θd 重合", width < 420 ? baseX - 12 : baseX + 14, baseY - 12);
  } else {
    ctx.fillStyle = "#6c7f7b";
    ctx.textAlign = "left";
    ctx.fillText("f·θ 基础位置", baseX + 13, baseY - 13);
    ctx.fillStyle = "#3f756d";
    const correctedLabelX = factor < 1 ? correctedX - 10 : correctedX + 13;
    ctx.textAlign = factor < 1 ? "right" : "left";
    ctx.fillText("f·θd 修正后", correctedLabelX, correctedY + 16);
  }
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

function mountKbAngleLab(root) {
  if (root.dataset.mounted === "true") return;
  root.dataset.mounted = "true";
  const range = root.querySelector("[data-kb-angle-range]");
  const angleOutput = root.querySelector("[data-kb-angle-output]");
  const pinholeOutput = root.querySelector("[data-kb-pinhole-output]");
  const fisheyeOutput = root.querySelector("[data-kb-fisheye-output]");
  const explain = root.querySelector("[data-kb-angle-explain]");
  const canvas = root.querySelector("canvas");

  const render = () => {
    const degrees = Number(range.value);
    const radians = degrees * Math.PI / 180;
    const pinhole = Math.tan(radians);
    angleOutput.value = `${degrees}°`;
    pinholeOutput.value = pinhole.toFixed(2);
    fisheyeOutput.value = radians.toFixed(2);
    explain.textContent = pinhole > 1.6
      ? "针孔的落点已经超出传感器；鱼眼光线在镜片处折射后，仍能落在传感器内。"
      : "注意折点：镜片前后都是直线，光线只在镜片处改变方向。";
    drawKbAngleGeometry(canvas, degrees);
  };

  range.addEventListener("input", render);
  const observer = new ResizeObserver(render);
  observer.observe(canvas);
  render();
}

function mountKbRadiusLab(root) {
  if (root.dataset.mounted === "true") return;
  root.dataset.mounted = "true";
  const range = root.querySelector("[data-kb-radius-factor-range]");
  const factorOutput = root.querySelector("[data-kb-radius-factor-output]");
  const resultOutput = root.querySelector("[data-kb-radius-result-output]");
  const explain = root.querySelector("[data-kb-radius-explain]");
  const canvas = root.querySelector("canvas");

  const render = () => {
    const factor = Number(range.value) / 100;
    factorOutput.value = factor.toFixed(2);
    resultOutput.value = factor.toFixed(2);
    if (factor < .99) explain.textContent = "倍率小于 1：绿点被拉向原点 O。";
    else if (factor > 1.01) explain.textContent = "倍率大于 1：绿点远离原点 O。";
    else explain.textContent = "倍率等于 1：修正前后的位置重合。";
    drawKbRadiusMapping(canvas, factor);
  };

  range.addEventListener("input", render);
  const observer = new ResizeObserver(render);
  observer.observe(canvas);
  render();
}

export function mountDistortionLabs(scope = document) {
  scope.querySelectorAll("[data-distortion-lab]").forEach(mountDistortionLab);
  scope.querySelectorAll("[data-radtan-parameter-lab]").forEach(mountRadTanParameterLab);
  scope.querySelectorAll("[data-rational-parameter-lab]").forEach(mountRationalParameterLab);
  scope.querySelectorAll("[data-kb-angle-lab]").forEach(mountKbAngleLab);
  scope.querySelectorAll("[data-kb-radius-lab]").forEach(mountKbRadiusLab);
}
