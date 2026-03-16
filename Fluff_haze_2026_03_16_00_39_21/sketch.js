let video;
let faceMesh;
let faces = [];
let modelReady = false;

// mouth control
let mouthAmount = 0;
let targetMouthAmount = 0;

// scene data
let stars = [];
let backRidge = [];
let midRidge = [];
let frontRidge = [];

// debug
let showDebug = false;

function preload() {
  // FaceMesh is used to read mouth opening
  const options = {
    maxFaces: 1,
    refineLandmarks: true,
    flipped: true
  };

  faceMesh = ml5.faceMesh(options, () => {
    modelReady = true;
  });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  noCursor();

  // hidden webcam feed
  video = createCapture(
    { video: { facingMode: "user" }, audio: false },
    () => {}
  );

  video.size(640, 480);
  video.hide();
  video.elt.setAttribute("playsinline", "");
  video.elt.muted = true;

  faceMesh.detectStart(video, gotFaces);

  buildStars();
  buildLandscape();
}

function gotFaces(results) {
  faces = results || [];
}

function draw() {
  updateMouthAmount();

  drawSky();
  drawStars();
  drawAurora();
  drawMountains();
  drawSnowMist();
  drawTitle();

  if (showDebug) drawDebugView();
}

function updateMouthAmount() {
  if (faces.length === 0) {
    targetMouthAmount = 0;
    mouthAmount = lerp(mouthAmount, targetMouthAmount, 0.08);
    return;
  }

  const pts = getFacePoints();
  if (!pts) return;

  // upper lip and lower lip
  const upperLip = toXY(pts[13]);
  const lowerLip = toXY(pts[14]);

  // use eye width as a scale reference
  const leftEye = toXY(pts[33]);
  const rightEye = toXY(pts[263]);

  const mouthOpen = dist(upperLip.x, upperLip.y, lowerLip.x, lowerLip.y);
  const faceWidth = dist(leftEye.x, leftEye.y, rightEye.x, rightEye.y);

  if (faceWidth > 0) {
    const ratio = mouthOpen / faceWidth;
    targetMouthAmount = constrain(map(ratio, 0.012, 0.12, 0, 1), 0, 1);
  } else {
    targetMouthAmount = 0;
  }

  // smooth movement so the aurora feels alive rather than jumpy
  mouthAmount = lerp(mouthAmount, targetMouthAmount, 0.12);
}

function getFacePoints() {
  if (faces.length === 0) return null;

  if (faces[0].keypoints) return faces[0].keypoints;
  if (faces[0].scaledMesh) return faces[0].scaledMesh;

  return null;
}

function toXY(p) {
  if (Array.isArray(p)) {
    return { x: p[0], y: p[1] };
  }
  return { x: p.x, y: p.y };
}

function buildStars() {
  stars = [];

  for (let i = 0; i < 260; i++) {
    stars.push({
      x: random(width),
      y: random(height * 0.62),
      s: random(0.8, 2.6),
      a: random(35, 95),
      t: random(TWO_PI)
    });
  }
}

function buildLandscape() {
  backRidge = generateRidge(height * 0.44, height * 0.12, 0.0018, 90);
  midRidge = generateRidge(height * 0.58, height * 0.14, 0.0024, 190);
  frontRidge = generateRidge(height * 0.76, height * 0.11, 0.0030, 290);
}

function generateRidge(baseY, amp, scale, seedOffset) {
  const pts = [];
  const step = 40;

  for (let x = -80; x <= width + 80; x += step) {
    const n = noise(seedOffset + x * scale);
    const y = baseY - n * amp;
    pts.push({ x, y });
  }

  return pts;
}

function drawSky() {
  // deep blue sky gradient
  for (let y = 0; y < height; y += 2) {
    const t = map(y, 0, height, 0, 1);

    const h = lerp(228, 246, t);
    const s = lerp(78, 68, t);
    const b = lerp(10, 3, t);

    stroke(h, s, b, 100);
    line(0, y, width, y);
  }
}

function drawStars() {
  noStroke();

  for (let s of stars) {
    const twinkle = sin(frameCount * 0.01 + s.t) * 0.5 + 0.5;
    const alpha = s.a + twinkle * 18 + mouthAmount * 10;

    fill(60, 10, 100, alpha);
    circle(s.x, s.y, s.s + twinkle * 0.5);
  }
}

function drawAurora() {
  const power = 0.16 + mouthAmount * 1.2;
  const speed = 0.0016 + mouthAmount * 0.0038;

  blendMode(ADD);

  drawAuroraRibbon({
    seed: 12.4,
    hue: 138,
    sat: 78,
    bri: 100,
    alpha: 10 + power * 24,
    baseY: height * 0.18,
    amp: 22 + power * 48,
    thickness: 90 + power * 120,
    speed
  });

  drawAuroraRibbon({
    seed: 24.9,
    hue: 168,
    sat: 55,
    bri: 100,
    alpha: 8 + power * 18,
    baseY: height * 0.15,
    amp: 18 + power * 40,
    thickness: 70 + power * 95,
    speed: speed * 1.15
  });

  drawAuroraRibbon({
    seed: 49.8,
    hue: 286,
    sat: 28,
    bri: 100,
    alpha: 5 + power * 10,
    baseY: height * 0.22,
    amp: 16 + power * 28,
    thickness: 46 + power * 62,
    speed: speed * 0.78
  });

  // stronger response when the mouth opens wider
  if (mouthAmount > 0.32) {
    drawAuroraRibbon({
      seed: 77.3,
      hue: 132,
      sat: 88,
      bri: 100,
      alpha: 10 + mouthAmount * 26,
      baseY: height * 0.11,
      amp: 20 + mouthAmount * 70,
      thickness: 80 + mouthAmount * 140,
      speed: speed * 1.35
    });
  }

  blendMode(BLEND);
}

function drawAuroraRibbon(cfg) {
  const t = frameCount * cfg.speed + cfg.seed * 10;
  const step = 10;

  const centre = [];
  const upper = [];
  const lower = [];

  for (let x = -40; x <= width + 40; x += step) {
    const n1 = noise(cfg.seed + x * 0.0022, t);
    const n2 = noise(cfg.seed * 2.1 + x * 0.0045, t * 1.35);
    const n3 = noise(cfg.seed * 4.7 + x * 0.0018, t * 0.7);

    const wave = sin(x * 0.004 + t * 5.5) * 0.5 + 0.5;

    const cy =
      cfg.baseY +
      (n1 - 0.5) * cfg.amp * 1.4 +
      (n2 - 0.5) * cfg.amp * 0.8 +
      wave * cfg.amp * 0.35;

    const thick =
      cfg.thickness *
      (0.45 + n3 * 0.55);

    centre.push({ x, y: cy });
    upper.push({ x, y: cy - thick });
    lower.push({ x, y: cy + thick * 0.22 });
  }

  // outer glow
  fill(cfg.hue, cfg.sat, cfg.bri, cfg.alpha * 0.18);
  noStroke();
  beginShape();
  for (let p of lower) vertex(p.x, p.y + 16);
  for (let i = upper.length - 1; i >= 0; i--) vertex(upper[i].x, upper[i].y - 26);
  endShape(CLOSE);

  // main body
  fill(cfg.hue, cfg.sat, cfg.bri, cfg.alpha * 0.45);
  beginShape();
  for (let p of lower) vertex(p.x, p.y);
  for (let i = upper.length - 1; i >= 0; i--) vertex(upper[i].x, upper[i].y);
  endShape(CLOSE);

  // bright inner ribbon
  fill(cfg.hue, min(100, cfg.sat + 12), 100, cfg.alpha * 0.30);
  beginShape();
  for (let p of centre) vertex(p.x, p.y + 8);
  for (let i = centre.length - 1; i >= 0; i--) vertex(centre[i].x, centre[i].y - 22);
  endShape(CLOSE);

  // edge line
  noFill();
  stroke(cfg.hue, cfg.sat, 100, cfg.alpha * 0.8);
  strokeWeight(1.6);
  beginShape();
  for (let p of centre) vertex(p.x, p.y);
  endShape();
}

function drawMountains() {
  // far ridge
  drawRidge(backRidge, color(222, 30, 7, 100), height);

  // middle ridge with snow
  drawRidge(midRidge, color(222, 24, 5, 100), height);
  drawSnowCaps(midRidge, height * 0.51, 14);

  // front ridge with stronger snow cap
  drawRidge(frontRidge, color(222, 22, 3, 100), height);
  drawSnowCaps(frontRidge, height * 0.66, 18);
}

function drawRidge(ridge, fillCol, bottomY) {
  noStroke();
  fill(fillCol);

  beginShape();
  vertex(ridge[0].x, bottomY);
  for (let p of ridge) vertex(p.x, p.y);
  vertex(ridge[ridge.length - 1].x, bottomY);
  endShape(CLOSE);
}

function drawSnowCaps(ridge, thresholdY, depth) {
  const segments = [];
  let current = [];

  for (let p of ridge) {
    if (p.y < thresholdY) {
      current.push(p);
    } else {
      if (current.length > 1) segments.push(current);
      current = [];
    }
  }

  if (current.length > 1) segments.push(current);

  noStroke();
  fill(210, 8, 98, 90);

  for (let seg of segments) {
    beginShape();

    for (let p of seg) vertex(p.x, p.y);

    for (let i = seg.length - 1; i >= 0; i--) {
      const p = seg[i];
      vertex(p.x, p.y + depth + noise(p.x * 0.02) * 4);
    }

    endShape(CLOSE);
  }

  // thin bright crest line
  noFill();
  stroke(210, 6, 100, 55);
  strokeWeight(1.3);

  for (let seg of segments) {
    beginShape();
    for (let p of seg) vertex(p.x, p.y + 1);
    endShape();
  }
}

function drawSnowMist() {
  noStroke();

  const glow = 4 + mouthAmount * 12;

  fill(160, 10, 95, glow);
  rect(0, height * 0.82, width, height * 0.18);

  fill(175, 12, 100, glow * 0.55);
  rect(0, height * 0.86, width, height * 0.14);
}

function drawTitle() {
  fill(0, 0, 100, 86);
  textAlign(LEFT, BOTTOM);
  textSize(15);
  text("Open your mouth to brighten the aurora", 18, height - 18);

  fill(0, 0, 100, 42);
  textAlign(RIGHT, BOTTOM);
  text("Press D for debug", width - 18, height - 18);
}

function drawDebugView() {
  if (!video) return;

  const w = 220;
  const h = 165;
  const x = width - w - 18;
  const y = 18;

  push();
  stroke(0, 0, 100, 40);
  strokeWeight(1);
  noFill();
  rect(x, y, w, h);

  translate(x + w, y);
  scale(-1, 1);
  image(video, 0, 0, w, h);
  pop();

  if (faces.length > 0) {
    const pts = getFacePoints();
    if (pts) {
      const upper = toXY(pts[13]);
      const lower = toXY(pts[14]);

      const sx1 = map(upper.x, 0, video.width, x + w, x);
      const sy1 = map(upper.y, 0, video.height, y, y + h);
      const sx2 = map(lower.x, 0, video.width, x + w, x);
      const sy2 = map(lower.y, 0, video.height, y, y + h);

      stroke(130, 80, 100, 85);
      strokeWeight(2);
      line(sx1, sy1, sx2, sy2);

      noStroke();
      fill(0, 0, 100, 90);
      circle(sx1, sy1, 6);
      circle(sx2, sy2, 6);

      fill(0, 0, 100, 90);
      textSize(12);
      textAlign(LEFT, TOP);
      text(`mouth: ${mouthAmount.toFixed(2)}`, x, y + h + 8);
    }
  }
}

function keyPressed() {
  if (key === "d" || key === "D") {
    showDebug = !showDebug;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  buildStars();
  buildLandscape();
}