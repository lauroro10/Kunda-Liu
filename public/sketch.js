let socket;

let particles = [];
let energy = 0;

let audioStarted = false;
let osc, noise, env;
let amp;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(0);

  socket = io();

  socket.on("ripple", (data) => {
    energy = constrain(energy + data.amount, 0, 1);
  });

  socket.on("sensor", (data) => {
    energy = constrain(energy + data.magnitude * 0.002, 0, 1);
  });

  for (let i = 0; i < 1200; i++) {
    particles.push(new Particle());
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0);
}

function draw() {
  background(0, 40);

  let level = amp ? amp.getLevel() : 0;
  let brightness = map(level + energy, 0, 1.5, 40, 255);

  stroke(255, brightness);
  strokeWeight(1);

  for (let p of particles) {
    p.update();
    p.display();
  }

  energy *= 0.96;

  if (osc) {
    osc.freq(map(energy, 0, 1, 80, 420));
    osc.amp(0.05 + energy * 0.2);
  }
}

function mousePressed() {
  startAudio();
  injectEnergy(0.4);
}

function touchStarted() {
  startAudio();
  injectEnergy(0.4);
  return false;
}

function injectEnergy(amount) {
  energy = constrain(energy + amount, 0, 1);

  socket.emit("ripple", {
    amount: amount,
    t: Date.now(),
  });
}

function startAudio() {
  if (audioStarted) return;

  userStartAudio();

  osc = new p5.Oscillator("sine");
  noise = new p5.Noise("pink");

  amp = new p5.Amplitude();

  osc.start();
  noise.start();

  osc.amp(0.05);
  noise.amp(0.03);

  audioStarted = true;
}

/* ===========================
   Mobile Sensors
=========================== */

if (window.DeviceMotionEvent) {
  window.addEventListener("devicemotion", handleMotion, true);
}

function handleMotion(event) {
  if (!audioStarted) return;

  let x = event.accelerationIncludingGravity.x || 0;
  let y = event.accelerationIncludingGravity.y || 0;
  let z = event.accelerationIncludingGravity.z || 0;

  let magnitude = sqrt(x * x + y * y + z * z);

  if (magnitude > 15) {
    injectEnergy(0.25);

    socket.emit("sensor", {
      magnitude,
      t: Date.now(),
    });
  }
}

/* ===========================
   Particle
=========================== */

class Particle {
  constructor() {
    this.pos = p5.Vector.random2D().mult(random(width));
    this.vel = p5.Vector.random2D();
    this.speed = random(0.2, 1.5);
  }

  update() {
    let angle =
      noise(this.pos.x * 0.002, this.pos.y * 0.002, frameCount * 0.002) *
      TWO_PI *
      2;

    let force = p5.Vector.fromAngle(angle);
    force.mult(this.speed + energy * 4);

    this.vel.add(force);
    this.vel.limit(2 + energy * 6);

    this.pos.add(this.vel);

    if (
      this.pos.x < 0 ||
      this.pos.x > width ||
      this.pos.y < 0 ||
      this.pos.y > height
    ) {
      this.pos = createVector(random(width), random(height));
      this.vel.mult(0);
    }
  }

  display() {
    point(this.pos.x, this.pos.y);
  }
}
