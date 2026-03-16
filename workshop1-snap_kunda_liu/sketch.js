/*
Project title: Snap
Author: Kunda Liu
Module: WCC1（DCT）

This sketch explores interaction through accumulation and disturbance.
The screen begins as a calm field. Each click introduces a temporary
anomaly that pulls and distorts the field around it.

The work is inspired by ideas of resonance, collapse, and memory,
where small actions can slowly reshape an entire system.

Interaction:
Click anywhere on the screen to create a new disturbance point.
Multiple points can exist and influence the field at the same time.
*/

let dots = [];
let anomalies = [];

let cols = 100;
let rows = 70;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(0);

  buildGrid();
}

// build a grid of dots that fills the screen
function buildGrid() {
  dots = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let px = map(x, 0, cols - 1, 0, width);
      let py = map(y, 0, rows - 1, 0, height);
      dots.push(new Dot(px, py));
    }
  }
}

function draw() {
  // fade the background slightly for motion trails
  noStroke();
  fill(0, 25);
  rect(0, 0, width, height);

  // update all active anomalies
  for (let i = anomalies.length - 1; i >= 0; i--) {
    anomalies[i].update();
    if (anomalies[i].dead) {
      anomalies.splice(i, 1);
    }
  }

  // update and draw all dots
  for (let d of dots) {
    d.update(anomalies);
    d.display();
  }
}

// click to create a new pull point
function mousePressed() {
  anomalies.push(new Anomaly(mouseX, mouseY));

  // limit how many can exist at once
  if (anomalies.length > 4) {
    anomalies.shift();
  }
}

class Dot {
  constructor(x, y) {
    this.origin = createVector(x, y);
    this.pos = createVector(x, y);
    this.prev = this.pos.copy();

    this.vel = p5.Vector.random2D().mult(random(0.03, 0.12));
    this.size = random(1.2, 1.8);
  }

  update(anomalies) {
    this.prev.set(this.pos);
    let acc = createVector(0, 0);

    for (let a of anomalies) {
      let dir = p5.Vector.sub(a.pos, this.pos);
      let d = dir.mag() + 0.001;

      if (d > a.radius) continue;

      dir.normalize();

      let pull = (a.strength * 0.6) / (d * d);
      pull = constrain(pull, 0, 0.12);

      let swirl = createVector(-dir.y, dir.x).mult(
        0.08 *
          noise(
            this.pos.x * 0.01,
            this.pos.y * 0.01,
            frameCount * 0.01
          )
      );

      let edge = 1 - d / a.radius;
      edge *= edge;

      acc.add(dir.mult(pull * edge));
      acc.add(swirl.mult(edge));
    }

    acc.add(p5.Vector.random2D().mult(0.005));

    this.vel.add(acc);
    this.vel.mult(0.985);
    this.vel.limit(1.6);

    this.pos.add(this.vel);

    let home = p5.Vector.sub(this.origin, this.pos);
    this.pos.add(home.mult(0.001));
  }

  display() {
    stroke(255, 60);
    strokeWeight(1);
    line(this.prev.x, this.prev.y, this.pos.x, this.pos.y);
  }
}

class Anomaly {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.radius = min(width, height) * 0.15;

    this.life = 1;
    this.decay = random(0.993, 0.996);
    this.seed = random(1000);
    this.dead = false;
  }

  get strength() {
    let t = frameCount * 0.03 + this.seed;
    return this.life * (0.8 + sin(t) * 0.25);
  }

  update() {
    this.life *= this.decay;
    if (this.life < 0.05) {
      this.dead = true;
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  buildGrid();
}
