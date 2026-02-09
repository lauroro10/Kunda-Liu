let socket;
let statusEl;

let particles = [];
const COUNT = 1600;

let targetEnergy = 0.08;
let energy = 0.08;

let steerX = 0;
let steerY = 0;

let lastSensorAt = 0;
let lastPulseAt = 0;

// audio
let audioReady = false;
let carrier, pinkNoise, lp, env, amp;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  background(0);

  statusEl = document.getElementById("status");

  initParticles();
  setupSocket();
  setupUI();
}

function draw() {
  // smooth energy + decay
  targetEnergy *= 0.985;
  targetEnergy = max(targetEnergy, 0.05);
  energy = lerp(energy, targetEnergy, 0.12);

  const level = audioReady ? amp.getLevel() : 0;
  const bright = constrain(map(level, 0, 0.25, 0.2, 1.0), 0.2, 1.0);

  // louder -> less fade -> brighter trails
  const fade = lerp(30, 10, bright);
  noStroke();
  fill(0, fade);
  rect(0, 0, width, height);

  const speed = (0.6 + energy * 3.6) * (0.7 + bright);
  const alphaBase = 18 + bright * 90 + energy * 70;

  // flow
  const t = frameCount * 0.002;
  blendMode(ADD);

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    const n = noise(p.x * 0.0022, p.y * 0.0022, t);
    const a = n * TWO_PI * 2.0;

    const fx = cos(a) + steerX * 1.25;
    const fy = sin(a) + steerY * 1.25;

    const px = p.x;
    const py = p.y;

    p.vx = lerp(p.vx, fx, 0.09);
    p.vy = lerp(p.vy, fy, 0.09);

    p.x += p.vx * speed;
    p.y += p.vy * speed;

    if (p.x < -20) p.x = width + 20;
    if (p.x > width + 20) p.x = -20;
    if (p.y < -20) p.y = height + 20;
    if (p.y > height + 20) p.y = -20;

    const a2 = alphaBase * p.w;
    stroke(200, 220, 255, a2);
    strokeWeight(1.0 + p.w * 1.4);
    line(px, py, p.x, p.y);
  }

  blendMode(BLEND);

  // status text
  const sock = socket ? (socket.connected ? "connected" : "connecting") : "missing";
  const sensorState = (millis() - lastSensorAt < 1500) ? "live" : "idle";
  statusEl.textContent = `socket: ${sock} • energy: ${energy.toFixed(2)} • audio: ${audioReady ? "on" : "off"} • sensor: ${sensorState}`;

  // keep audio responsive
  if (audioReady && random() < 0.01 * (0.3 + energy)) {
    triggerSound(0.12 + energy * 0.25);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initParticles();
  background(0);
}

function initParticles() {
  particles = [];
  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      vx: random(-0.2, 0.2),
      vy: random(-0.2, 0.2),
      w: random(0.35, 1.0),
    });
  }
}

function setupSocket() {
  socket = io();

  socket.on("sensor", (data) => {
    if (!data) return;
    lastSensorAt = millis();

    if (typeof data.tx === "number" && typeof data.ty === "number") {
      steerX = lerp(steerX, data.tx, 0.18);
      steerY = lerp(steerY, data.ty, 0.18);
    }

    if (typeof data.shake === "number") {
      const inj = constrain(data.shake, 0, 1.6);
      bumpEnergy(inj * 0.55);

      if (audioReady && millis() - lastPulseAt > 70) {
        lastPulseAt = millis();
        triggerSound(0.12 + inj * 0.35);
      }
    }
  });

  socket.on("pulse", (data) => {
    if (!data) return;

    const p = constrain(data.p || 0.4, 0, 1.6);
    bumpEnergy(p * 0.5);

    if (audioReady && millis() - lastPulseAt > 70) {
      lastPulseAt = millis();
      triggerSound(0.12 + p * 0.35);
    }
  });
}

function setupUI() {
  const btnAudio = document.getElementById("btnAudio");
  const btnSensors = document.getElementById("btnSensors");
  const btnClear = document.getElementById("btnClear");

  btnAudio.addEventListener("click", async () => {
    await startAudio();
    btnAudio.disabled = true;
  });

  btnSensors.addEventListener("click", async () => {
    await enableSensors();
    btnSensors.disabled = true;
  });

  btnClear.addEventListener("click", () => {
    background(0);
    targetEnergy = 0.08;
    energy = 0.08;
  });

  // desktop inject energy
  window.addEventListener("pointerdown", async () => {
    if (!audioReady) await startAudio();
    socketEmitPulse(0.65);
  }, { passive: true });

  window.addEventListener("pointermove", (e) => {
    if (e.buttons !== 1) return;
    socketEmitPulse(0.22);
  }, { passive: true });
}

function socketEmitPulse(p) {
  bumpEnergy(p * 0.5);
  if (audioReady) triggerSound(0.16 + p * 0.25);
  if (socket && socket.connected) {
    socket.emit("pulse", { p, t: Date.now() });
  }
}

function bumpEnergy(v) {
  targetEnergy += v;
  targetEnergy = constrain(targetEnergy, 0.05, 1.6);
}

// ---------------- Audio ----------------
async function startAudio() {
  if (audioReady) return;

  await userStartAudio();

  carrier = new p5.Oscillator("sine");
  pinkNoise = new p5.Noise("pink");

  env = new p5.Envelope();
  env.setADSR(0.005, 0.12, 0.0, 0.18);
  env.setRange(0.9, 0);

  lp = new p5.LowPass();
  lp.freq(1200);
  lp.res(10);

  carrier.disconnect();
  pinkNoise.disconnect();

  carrier.connect(lp);
  pinkNoise.connect(lp);

  lp.connect();

  carrier.start();
  pinkNoise.start();

  carrier.amp(0.02, 0.2);
  pinkNoise.amp(0.012, 0.2);

  amp = new p5.Amplitude();
  amp.setInput(lp);

  audioReady = true;
}

function triggerSound(strength) {
  if (!audioReady) return;

  const s = constrain(strength, 0, 1);

  const base = lerp(70, 230, s) + energy * 50;
  const cut = lerp(550, 2900, s) + energy * 800;

  carrier.freq(base);
  lp.freq(cut, 0.03);

  env.play(carrier, 0, 0.03);
}

// ---------------- Sensors (phone) ----------------
async function enableSensors() {
  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
    const r = await DeviceMotionEvent.requestPermission();
    if (r !== "granted") return;
  }

  if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
    const r2 = await DeviceOrientationEvent.requestPermission();
    if (r2 !== "granted") return;
  }

  window.addEventListener("devicemotion", onMotion, { passive: true });
  window.addEventListener("deviceorientation", onOrientation, { passive: true });
}

let lastSend = 0;
let tilt = { tx: 0, ty: 0 };

function onMotion(e) {
  const now = Date.now();
  if (now - lastSend < 50) return;
  lastSend = now;

  const a = e.accelerationIncludingGravity || e.acceleration;
  if (!a) return;

  const x = a.x || 0;
  const y = a.y || 0;
  const z = a.z || 0;

  const mag = Math.sqrt(x * x + y * y + z * z);

  const shake = constrain((mag - 12) / 14, 0, 1.6);

  if (socket && socket.connected) {
    socket.emit("sensor", {
      shake,
      tx: tilt.tx,
      ty: tilt.ty,
      t: now
    });
  }
}

function onOrientation(e) {
  const beta = (typeof e.beta === "number") ? e.beta : 0;
  const gamma = (typeof e.gamma === "number") ? e.gamma : 0;

  tilt.tx = constrain(gamma / 35, -1, 1);
  tilt.ty = constrain(beta / 35, -1, 1);
}
