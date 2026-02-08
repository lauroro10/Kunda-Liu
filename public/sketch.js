let socket;

let audioReady = false;
let oscLow, oscHigh, noise;
let envLow, envHigh;
let filterLP;
let amp;
let fft;

let particles = [];
let flow = { x: 0, y: 0, energy: 0 };
let remoteEnergy = 0;
let lastPulseAt = 0;

const N_PARTICLES = 1400;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  background(0);

  socket = io();

  socket.on("pulse", (data) => {
    if (!data) return;
    remoteEnergy = max(remoteEnergy, data.energy || 0);
    flow.x = lerp(flow.x, data.fx || 0, 0.25);
    flow.y = lerp(flow.y, data.fy || 0, 0.25);
    lastPulseAt = millis();
  });

  socket.on("sensor", (data) => {
    if (!data) return;
    flow.x = lerp(flow.x, data.fx || 0, 0.35);
    flow.y = lerp(flow.y, data.fy || 0, 0.35);
    flow.energy = max(flow.energy, data.energy || 0);
  });

  for (let i = 0; i < N_PARTICLES; i++) {
    particles.push(new Particle());
  }

  const btnAudio = document.getElementById("btn-audio");
  const btnSensors = document.getElementById("btn-sensors");

  btnAudio.addEventListener("click", () => {
    initAudio();
    injectEnergy(0.9);
  });

  btnSensors.addEventListener("click", async () => {
    await enableSensors();
  });
}

function draw() {
  // trails
  noStroke();
  fill(0, 18);
  rect(0, 0, width, height);

  // audio-driven forces
  const a = audioReady ? amp.getLevel() : 0;
  const spectrum = audioReady ? fft.analyze() : null;

  let bass = 0;
  let air = 0;
  if (spectrum) {
    bass = fft.getEnergy("bass") / 255;
    air = fft.getEnergy("highMid") / 255;
  }

  // decay remote energy
  remoteEnergy *= 0.93;

  // combine local + remote energy
  const energy = constrain(flow.energy + remoteEnergy + a * 1.2, 0, 1);

  // steer with flow + audio
  const fx = flow.x * (0.6 + bass * 0.8);
  const fy = flow.y * (0.6 + bass * 0.8);

  // subtle attractor that shifts with high frequencies
  const cx = width * 0.5 + sin(frameCount * 0.01) * width * 0.12 * (0.2 + air);
  const cy = height * 0.5 + cos(frameCount * 0.012) * height * 0.12 * (0.2 + air);

  for (let i = 0; i < particles.length; i++) {
    particles[i].step(energy, fx, fy, cx, cy, bass, air);
    particles[i].draw(energy, bass, air);
  }

  // automatically keep sound alive with tiny pulses
  if (audioReady) {
    if (millis() - lastPulseAt > 1200 && random() < 0.02) {
      triggerPulse(0.15 + energy * 0.25);
    }
  }
}

function mousePressed() {
  initAudio();
  const strength = 0.35 + (mouseIsPressed ? 0.25 : 0);
  triggerPulse(strength);
  injectEnergy(0.55);

  // broadcast
  socket.emit("pulse", {
    energy: constrain(strength, 0, 1),
    fx: flow.x,
    fy: flow.y,
    t: Date.now(),
  });
}

function touchStarted() {
  initAudio();
  triggerPulse(0.35);
  injectEnergy(0.6);

  socket.emit("pulse", {
    energy: 0.35,
    fx: flow.x,
    fy: flow.y,
    t: Date.now(),
  });

  return false;
}

function initAudio() {
  if (audioReady) return;

  userStartAudio();

  oscLow = new p5.Oscillator("sine");
  oscHigh = new p5.Oscillator("triangle");
  noise = new p5.Noise("pink");

  envLow = new p5.Envelope();
  envLow.setADSR(0.001, 0.14, 0.0, 0.24);
  envLow.setRange(0.9, 0);

  envHigh = new p5.Envelope();
  envHigh.setADSR(0.001, 0.05, 0.0, 0.11);
  envHigh.setRange(0.25, 0);

  filterLP = new p5.LowPass();
  filterLP.freq(900);
  filterLP.res(14);

  oscLow.disconnect();
  oscHigh.disconnect();
  noise.disconnect();

  oscLow.connect(filterLP);
  oscHigh.connect(filterLP);
  noise.connect(filterLP);

  filterLP.connect();

  oscLow.start();
  oscHigh.start();
  noise.start();

  amp = new p5.Amplitude();
  amp.setInput(filterLP);

  fft = new p5.FFT(0.85, 1024);
  fft.setInput(filterLP);

  audioReady = true;
}

function triggerPulse(strength = 0.35) {
  if (!audioReady) initAudio();

  const s = constrain(strength, 0, 1);

  const lowFreq = lerp(45, 130, s);
  const highFreq = lerp(800, 2600, s);
  const cutoff = lerp(450, 1700, s);

  oscLow.freq(lowFreq);
  oscHigh.freq(highFreq);
  filterLP.freq(cutoff);

  // noise breath
  noise.amp(lerp(0.02, 0.10, s), 0.01);

  envLow.play(oscLow, 0, 0.16 + s * 0.12);
  envHigh.play(oscHigh, 0, 0.07 + s * 0.05);
}

function injectEnergy(amount) {
  flow.energy = constrain(flow.energy + amount, 0, 1);
}

async function enableSensors() {
  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
    const p = await DeviceMotionEvent.requestPermission();
    if (p !== "granted") return;
  }

  window.addEventListener("devicemotion", (e) => {
    const ax = (e.accelerationIncludingGravity && e.accelerationIncludingGravity.x) || 0;
    const ay = (e.accelerationIncludingGravity && e.accelerationIncludingGravity.y) || 0;
    const az = (e.accelerationIncludingGravity && e.accelerationIncludingGravity.z) || 0;

    const mag = Math.min(30, Math.sqrt(ax * ax + ay * ay + az * az)) / 30;

    // map to flow direction
    flow.x = lerp(flow.x, constrain(ax / 12, -1, 1), 0.25);
    flow.y = lerp(flow.y, constrain(ay / 12, -1, 1), 0.25);

    if (mag > 0.18) {
      initAudio();
      triggerPulse(constrain(mag, 0, 1));
      injectEnergy(mag);
    }

    socket.emit("sensor", {
      fx: flow.x,
      fy: flow.y,
      energy: constrain(mag, 0, 1),
      t: Date.now(),
    });
  });

  window.addEventListener("deviceorientation", (e) => {
    const beta = e.beta || 0;
    const gamma = e.gamma || 0;

    const nx = constrain(gamma / 45, -1, 1);
    const ny = constrain(beta / 45, -1, 1);

    flow.x = lerp(flow.x, nx, 0.15);
    flow.y = lerp(flow.y, ny, 0.15);

    socket.emit("sensor", {
      fx: flow.x,
      fy: flow.y,
      energy: 0,
      t: Date.now(),
    });
  });
}

class Particle {
  constructor() {
    this.reset(true);
  }

  reset(initial = false) {
    this.x = random(width);
    this.y = random(height);
    this.vx = random(-0.2, 0.2);
    this.vy = random(-0.2, 0.2);
    this.seed = random(1000);
    this.life = initial ? random(30, 180) : random(60, 260);
    this.size = random(0.6, 2.2);
  }

  step(energy, fx, fy, cx, cy, bass, air) {
    this.life -= 1;
    if (this.life <= 0) this.reset(false);

    // flow field from noise
    const n = noise2D(
      this.x * 0.0025,
      this.y * 0.0025,
      this.seed + frameCount * 0.002
    );

    const angle = n * TWO_PI * (0.9 + air * 0.7);
    const flowX = cos(angle);
    const flowY = sin(angle);

    // attraction to center (scale pressure)
    const dx = cx - this.x;
    const dy = cy - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.0001;
    const ax = (dx / dist) * (0.06 + bass * 0.10) * energy;
    const ay = (dy / dist) * (0.06 + bass * 0.10) * energy;

    const push = 0.22 + energy * 0.9;

    this.vx += (flowX * push + fx * 0.7) * 0.12 + ax;
    this.vy += (flowY * push + fy * 0.7) * 0.12 + ay;

    // damping
    this.vx *= 0.94;
    this.vy *= 0.94;

    this.x += this.vx;
    this.y += this.vy;

    // wrap
    if (this.x < -10) this.x = width + 10;
    if (this.x > width + 10) this.x = -10;
    if (this.y < -10) this.y = height + 10;
    if (this.y > height + 10) this.y = -10;
  }

  draw(energy, bass, air) {
    const glow = 20 + energy * 180;
    const alpha = 18 + energy * 70;

    // color is derived from bass/air (no explicit RGB naming)
    const h = (200 + air * 90 - bass * 40) % 360;
    colorMode(HSL, 360, 100, 100, 100);
    fill(h, 80, 60 + bass * 20, alpha);

    const s = this.size * (0.8 + energy * 2.2);
    circle(this.x, this.y, s);

    // occasional spark
    if (random() < 0.002 + air * 0.004) {
      fill(h, 95, 85, min(90, glow));
      circle(this.x, this.y, s * 3.2);
    }
    colorMode(RGB, 255, 255, 255, 255);
  }
}

// simple noise helper
function noise2D(x, y, z) {
  return (noise(x, y, z) * 2 - 1);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0);
}
