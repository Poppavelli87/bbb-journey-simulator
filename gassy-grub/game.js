/* Gassy Grub — snake, but the snake is a caterpillar with digestive issues. */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Pure game logic (no DOM). Exported for node tests at the bottom.
  // ---------------------------------------------------------------------------

  var GRID = 20;
  var START_LENGTH = 3;
  var BASE_TICK_MS = 150;
  var MIN_TICK_MS = 70;
  var SPEEDUP_EVERY = 5;
  var SPEEDUP_MS = 10;

  var DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  var OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  function hungerThreshold(length) {
    return 10 * length;
  }

  function fartLoss(length) {
    return Math.max(1, Math.ceil(length / 3));
  }

  function tickInterval(leavesEaten) {
    var ms = BASE_TICK_MS - Math.floor(leavesEaten / SPEEDUP_EVERY) * SPEEDUP_MS;
    return Math.max(MIN_TICK_MS, ms);
  }

  function isOpposite(a, b) {
    return OPPOSITE[a] === b;
  }

  function spawnLeaf(snake, rng) {
    var occupied = {};
    for (var i = 0; i < snake.length; i++) occupied[snake[i].x + ',' + snake[i].y] = true;
    var free = [];
    for (var y = 0; y < GRID; y++) {
      for (var x = 0; x < GRID; x++) {
        if (!occupied[x + ',' + y]) free.push({ x: x, y: y });
      }
    }
    if (free.length === 0) return null;
    return free[Math.floor(rng() * free.length)];
  }

  function createState(rng) {
    rng = rng || Math.random;
    var mid = Math.floor(GRID / 2);
    var snake = [];
    for (var i = 0; i < START_LENGTH; i++) snake.push({ x: 5 - i, y: mid });
    return {
      status: 'start', // start | playing | paused | over
      snake: snake,
      dir: 'right',
      queue: [],
      leaf: spawnLeaf(snake, rng),
      score: 0,
      leavesEaten: 0,
      hunger: 0,
      cause: null // wall | self | starved
    };
  }

  // Queue a turn; ignores reversals relative to the last pending direction.
  function queueDirection(state, dir) {
    var last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
    if (dir === last || isOpposite(dir, last)) return false;
    if (state.queue.length >= 2) return false;
    state.queue.push(dir);
    return true;
  }

  // Advance one tile. Returns a list of events for the presentation layer.
  function step(state, rng) {
    rng = rng || Math.random;
    var events = [];
    if (state.queue.length) state.dir = state.queue.shift();

    var d = DIRS[state.dir];
    var head = state.snake[0];
    var next = { x: head.x + d.x, y: head.y + d.y };

    if (next.x < 0 || next.y < 0 || next.x >= GRID || next.y >= GRID) {
      state.status = 'over';
      state.cause = 'wall';
      events.push({ type: 'death', cause: 'wall' });
      return events;
    }

    var eating = state.leaf && next.x === state.leaf.x && next.y === state.leaf.y;
    // The tail moves out of the way this tick unless we're growing.
    var bodyEnd = eating ? state.snake.length : state.snake.length - 1;
    for (var i = 0; i < bodyEnd; i++) {
      if (state.snake[i].x === next.x && state.snake[i].y === next.y) {
        state.status = 'over';
        state.cause = 'self';
        events.push({ type: 'death', cause: 'self' });
        return events;
      }
    }

    state.snake.unshift(next);

    if (eating) {
      state.score += 10;
      state.leavesEaten += 1;
      state.hunger = 0;
      events.push({ type: 'eat', at: { x: next.x, y: next.y } });
      state.leaf = spawnLeaf(state.snake, rng);
      return events;
    }

    state.snake.pop();
    state.hunger += 1;

    if (state.hunger >= hungerThreshold(state.snake.length)) {
      var loss = fartLoss(state.snake.length);
      var newLength = state.snake.length - loss;
      var removed = state.snake.slice(Math.max(newLength, 0));
      var tail = state.snake[state.snake.length - 1];
      state.hunger = 0;
      if (newLength < 2) {
        state.status = 'over';
        state.cause = 'starved';
        events.push({ type: 'fart', removed: removed, tail: tail, dir: state.dir });
        events.push({ type: 'death', cause: 'starved' });
        return events;
      }
      state.snake.length = newLength;
      events.push({ type: 'fart', removed: removed, tail: tail, dir: state.dir });
    }
    return events;
  }

  var Logic = {
    GRID: GRID,
    START_LENGTH: START_LENGTH,
    hungerThreshold: hungerThreshold,
    fartLoss: fartLoss,
    tickInterval: tickInterval,
    isOpposite: isOpposite,
    spawnLeaf: spawnLeaf,
    createState: createState,
    queueDirection: queueDirection,
    step: step
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Logic;
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // ---------------------------------------------------------------------------
  // Browser: rendering, audio, input, loop.
  // ---------------------------------------------------------------------------

  var HIGH_KEY = 'gassyGrub.highScore';
  var CAPTIONS = [
    'Pfffft.', 'Excuse me.', 'Lost some weight.', 'Oops.', 'Brrrapp!',
    'Better out than in.', 'Not me.', 'Toot toot.', 'Smells like defeat.', 'Pardon my leaf.'
  ];
  var DEATH_TEXT = {
    wall: 'Bonked into the wall.',
    self: 'Tried to eat itself.',
    starved: 'Starved out. Farted into nothing.'
  };

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('board');
  var ctx = canvas.getContext('2d');
  var wrap = $('board-wrap');
  var app = $('app');
  var ui = {
    score: $('score'), length: $('length'), high: $('high'),
    fill: $('hunger-fill'), caption: $('caption'),
    start: $('start-screen'), pause: $('pause-screen'), over: $('over-screen'),
    cause: $('cause'), finalScore: $('final-score'), finalHigh: $('final-high'),
    newBest: $('new-best')
  };

  var state = createState();
  var prevSnake = cloneSnake(state.snake);
  var highScore = loadHigh();
  var cell = 20;
  var boardPx = 400;
  var lastTickAt = 0;
  var accumulator = 0;
  var lastFrame = 0;
  var clouds = [];
  var particles = [];
  var sparkles = [];
  var bgCanvas = null;

  function cloneSnake(s) {
    return s.map(function (p) { return { x: p.x, y: p.y }; });
  }

  function loadHigh() {
    try { return parseInt(localStorage.getItem(HIGH_KEY), 10) || 0; } catch (e) { return 0; }
  }
  function saveHigh(v) {
    try { localStorage.setItem(HIGH_KEY, String(v)); } catch (e) { /* ignore */ }
  }

  // ----- Layout -------------------------------------------------------------

  function resize() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    // Reserve room for HUD (~56px), hunger meter (~24px), gaps and padding.
    var avail = Math.min(vw - 22, vh - 120, 640);
    cell = Math.max(10, Math.floor(avail / GRID));
    boardPx = cell * GRID;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = boardPx * dpr;
    canvas.height = boardPx * dpr;
    canvas.style.width = boardPx + 'px';
    canvas.style.height = boardPx + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    app.style.width = (boardPx + 6 + 16) + 'px';
    bgCanvas = buildBackground(dpr);
    draw(1);
  }

  function buildBackground(dpr) {
    var c = document.createElement('canvas');
    c.width = boardPx * dpr;
    c.height = boardPx * dpr;
    var g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var grad = g.createLinearGradient(0, 0, 0, boardPx);
    grad.addColorStop(0, '#d9efc4');
    grad.addColorStop(1, '#c2e3a6');
    g.fillStyle = grad;
    g.fillRect(0, 0, boardPx, boardPx);
    // Soft checker
    for (var y = 0; y < GRID; y++) {
      for (var x = 0; x < GRID; x++) {
        if ((x + y) % 2 === 0) {
          g.fillStyle = 'rgba(255,255,255,0.13)';
          g.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
    // Deterministic little grass tufts and flowers
    var seed = 7;
    var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (var i = 0; i < 40; i++) {
      var tx = rnd() * boardPx, ty = rnd() * boardPx;
      g.strokeStyle = 'rgba(90,150,60,0.35)';
      g.lineWidth = Math.max(1, cell * 0.06);
      g.lineCap = 'round';
      for (var b = -1; b <= 1; b++) {
        g.beginPath();
        g.moveTo(tx, ty);
        g.quadraticCurveTo(tx + b * cell * 0.1, ty - cell * 0.2, tx + b * cell * 0.22, ty - cell * 0.35);
        g.stroke();
      }
    }
    var petals = ['rgba(255,255,255,0.7)', 'rgba(255,214,234,0.75)', 'rgba(255,240,170,0.75)'];
    for (var f = 0; f < 10; f++) {
      var fx = rnd() * boardPx, fy = rnd() * boardPx, r = cell * 0.12;
      g.fillStyle = petals[f % petals.length];
      for (var p = 0; p < 5; p++) {
        var a = (p / 5) * Math.PI * 2;
        g.beginPath();
        g.arc(fx + Math.cos(a) * r, fy + Math.sin(a) * r, r * 0.8, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = 'rgba(240,180,40,0.85)';
      g.beginPath();
      g.arc(fx, fy, r * 0.6, 0, Math.PI * 2);
      g.fill();
    }
    return c;
  }

  // ----- Drawing ------------------------------------------------------------

  function center(p) {
    return { x: (p.x + 0.5) * cell, y: (p.y + 0.5) * cell };
  }

  function drawLeaf(leaf, t) {
    if (!leaf) return;
    var c = center(leaf);
    var bob = Math.sin(t / 300) * cell * 0.04;
    var s = cell * 0.42;
    ctx.save();
    ctx.translate(c.x, c.y + bob);
    ctx.rotate(-0.6 + Math.sin(t / 500) * 0.08);
    // shadow
    ctx.fillStyle = 'rgba(40,70,20,0.18)';
    ctx.beginPath();
    ctx.ellipse(s * 0.1, s * 0.25, s * 0.95, s * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // blade
    var grad = ctx.createLinearGradient(-s, 0, s, 0);
    grad.addColorStop(0, '#3e9b2f');
    grad.addColorStop(1, '#8fd44f');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#2d7a22';
    ctx.lineWidth = Math.max(1, cell * 0.05);
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.quadraticCurveTo(0, -s * 0.85, s, 0);
    ctx.quadraticCurveTo(0, s * 0.85, -s, 0);
    ctx.fill();
    ctx.stroke();
    // vein + stem
    ctx.strokeStyle = 'rgba(230,255,200,0.8)';
    ctx.lineWidth = Math.max(1, cell * 0.04);
    ctx.beginPath();
    ctx.moveTo(-s * 1.25, 0);
    ctx.lineTo(s * 0.8, 0);
    for (var i = -1; i <= 1; i++) {
      ctx.moveTo(i * s * 0.35, 0);
      ctx.lineTo(i * s * 0.35 + s * 0.25, -s * 0.3);
      ctx.moveTo(i * s * 0.35, 0);
      ctx.lineTo(i * s * 0.35 + s * 0.25, s * 0.3);
    }
    ctx.stroke();
    ctx.restore();
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function snakePositions(alpha) {
    var cur = state.snake;
    var out = [];
    for (var i = 0; i < cur.length; i++) {
      var from = prevSnake[i] || cur[i];
      out.push({ x: lerp(from.x, cur[i].x, alpha), y: lerp(from.y, cur[i].y, alpha) });
    }
    return out;
  }

  function drawCaterpillar(alpha, t) {
    var pos = snakePositions(alpha);
    var n = pos.length;
    var dead = state.status === 'over';
    // Body from tail to neck so the head draws on top
    for (var i = n - 1; i >= 1; i--) {
      var p = center(pos[i]);
      var wiggle = Math.sin(t / 120 + i * 0.9) * cell * 0.03;
      var r = cell * (0.46 - Math.min(i, 8) * 0.006);
      // tiny feet
      ctx.fillStyle = '#3c6e22';
      ctx.beginPath();
      ctx.arc(p.x - r * 0.45, p.y + r * 0.8, r * 0.18, 0, Math.PI * 2);
      ctx.arc(p.x + r * 0.45, p.y + r * 0.8, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = i % 2 ? '#7cc644' : '#5aa832';
      ctx.strokeStyle = '#3b7a1e';
      ctx.lineWidth = Math.max(1, cell * 0.05);
      ctx.beginPath();
      ctx.arc(p.x, p.y + wiggle, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // highlight
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.ellipse(p.x - r * 0.3, p.y + wiggle - r * 0.35, r * 0.35, r * 0.2, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    drawHead(center(pos[0]), dead);
  }

  function drawHead(c, dead) {
    var d = DIRS[state.dir];
    var r = cell * 0.52;
    // antennae: point away from direction of travel's forward-ish, angled up
    var fx = d.x, fy = d.y;
    var px = -fy, py = fx; // perpendicular
    ctx.strokeStyle = '#3b5e1e';
    ctx.lineWidth = Math.max(1, cell * 0.06);
    ctx.lineCap = 'round';
    for (var s = -1; s <= 1; s += 2) {
      var bx = c.x + px * s * r * 0.4 + fx * r * 0.4;
      var by = c.y + py * s * r * 0.4 + fy * r * 0.4;
      var tx = bx + px * s * r * 0.5 + fx * r * 0.7;
      var ty = by + py * s * r * 0.5 + fy * r * 0.7;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + fx * r * 0.6, by + fy * r * 0.6, tx, ty);
      ctx.stroke();
      ctx.fillStyle = '#ff8f3a';
      ctx.beginPath();
      ctx.arc(tx, ty, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    // head
    var grad = ctx.createRadialGradient(c.x - r * 0.3, c.y - r * 0.3, r * 0.1, c.x, c.y, r);
    grad.addColorStop(0, '#b5ec7a');
    grad.addColorStop(1, '#4f9e2a');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#2f6a17';
    ctx.lineWidth = Math.max(1, cell * 0.06);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // cheeks
    ctx.fillStyle = 'rgba(255,130,130,0.45)';
    for (var k = -1; k <= 1; k += 2) {
      ctx.beginPath();
      ctx.arc(c.x + px * k * r * 0.62 + fx * r * 0.1, c.y + py * k * r * 0.62 + fy * r * 0.1, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    // eyes, looking toward travel direction
    for (var e = -1; e <= 1; e += 2) {
      var ex = c.x + px * e * r * 0.36 + fx * r * 0.25;
      var ey = c.y + py * e * r * 0.36 + fy * r * 0.25;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#2f4a1f';
      ctx.lineWidth = Math.max(1, cell * 0.03);
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.27, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (dead) {
        ctx.strokeStyle = '#2f2f2f';
        ctx.lineWidth = Math.max(1, cell * 0.05);
        var q = r * 0.14;
        ctx.beginPath();
        ctx.moveTo(ex - q, ey - q); ctx.lineTo(ex + q, ey + q);
        ctx.moveTo(ex + q, ey - q); ctx.lineTo(ex - q, ey + q);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#1d1d1d';
        ctx.beginPath();
        ctx.arc(ex + fx * r * 0.12, ey + fy * r * 0.12, r * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex + fx * r * 0.12 - r * 0.05, ey + fy * r * 0.12 - r * 0.05, r * 0.045, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // smile
    ctx.strokeStyle = '#2f4a1f';
    ctx.lineWidth = Math.max(1, cell * 0.04);
    var mx = c.x + fx * r * 0.62, my = c.y + fy * r * 0.62;
    var ang = Math.atan2(fy, fx);
    ctx.beginPath();
    if (dead) {
      ctx.arc(mx + fx * r * 0.12, my + fy * r * 0.12, r * 0.16, ang + Math.PI - 1, ang + Math.PI + 1);
    } else {
      ctx.arc(mx - fx * r * 0.08, my - fy * r * 0.08, r * 0.16, ang - 1, ang + 1);
    }
    ctx.stroke();
  }

  function drawClouds(dt) {
    for (var i = clouds.length - 1; i >= 0; i--) {
      var c = clouds[i];
      c.life += dt;
      var k = c.life / c.duration;
      if (k >= 1) { clouds.splice(i, 1); continue; }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      var scale = 0.8 + k * 1.6;
      ctx.globalAlpha = (1 - k) * 0.85;
      for (var j = 0; j < c.puffs.length; j++) {
        var p = c.puffs[j];
        var px = c.x + p.dx * cell * scale;
        var py = c.y + p.dy * cell * scale;
        var pr = p.r * cell * scale;
        ctx.fillStyle = '#9ccf3c';
        ctx.strokeStyle = '#6f9a1f';
        ctx.lineWidth = Math.max(1, cell * 0.05);
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      // inner highlights on top so the outline reads as one cloud
      for (var h = 0; h < c.puffs.length; h++) {
        var q = c.puffs[h];
        ctx.fillStyle = '#c4e86a';
        ctx.beginPath();
        ctx.arc(c.x + q.dx * cell * scale, c.y + q.dy * cell * scale, q.r * cell * scale * 0.82, 0, Math.PI * 2);
        ctx.fill();
      }
      // stink lines
      ctx.strokeStyle = '#6f9a1f';
      ctx.lineWidth = Math.max(1, cell * 0.06);
      ctx.lineCap = 'round';
      for (var s = -1; s <= 1; s++) {
        var sx = c.x + s * cell * 0.45 * scale;
        var sy = c.y - cell * 0.9 * scale;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(sx - cell * 0.15, sy - cell * 0.15, sx + cell * 0.15, sy - cell * 0.3, sx, sy - cell * 0.45);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life += dt;
      if (p.life >= p.duration) { particles.splice(i, 1); continue; }
      p.vy += 900 * (cell / 20) * dt / 1000; // gravity
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      var k = p.life / p.duration;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = '#3b7a1e';
      ctx.lineWidth = Math.max(1, cell * 0.04);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 - k * 0.5), 0, Math.PI * 2);
      ctx.fill();
      if (p.outline) ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (var j = sparkles.length - 1; j >= 0; j--) {
      var s = sparkles[j];
      s.life += dt;
      if (s.life >= s.duration) { sparkles.splice(j, 1); continue; }
      var t = s.life / s.duration;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = '#fff6a0';
      ctx.font = 'bold ' + Math.round(cell * 0.6) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+10', s.x, s.y - t * cell);
      ctx.globalAlpha = 1;
    }
  }

  function draw(alpha, dt) {
    var t = performance.now();
    dt = dt || 0;
    ctx.clearRect(0, 0, boardPx, boardPx);
    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, boardPx, boardPx);
    drawLeaf(state.leaf, t);
    drawCaterpillar(alpha, t);
    drawClouds(dt);
    drawParticles(dt);
  }

  // ----- Effects ------------------------------------------------------------

  function spawnFartEffects(ev) {
    var tail = center(ev.tail);
    var d = DIRS[ev.dir];
    var puffs = [];
    var count = 6;
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2;
      puffs.push({ dx: Math.cos(a) * 0.45, dy: Math.sin(a) * 0.35, r: 0.38 + Math.random() * 0.12 });
    }
    puffs.push({ dx: 0, dy: 0, r: 0.5 });
    clouds.push({
      x: tail.x, y: tail.y,
      vx: -d.x * cell * 0.0012, vy: -d.y * cell * 0.0012 - cell * 0.0006,
      life: 0, duration: 1000, puffs: puffs
    });
    // Removed segments pop off
    ev.removed.forEach(function (seg, idx) {
      var c = center(seg);
      for (var k = 0; k < 7; k++) {
        var ang = Math.random() * Math.PI * 2;
        var sp = (60 + Math.random() * 160) * (cell / 20);
        particles.push({
          x: c.x, y: c.y,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 120 * (cell / 20),
          r: cell * (0.1 + Math.random() * 0.12),
          color: (idx + k) % 2 ? '#7cc644' : '#5aa832',
          outline: true,
          life: 0, duration: 600 + Math.random() * 300
        });
      }
    });
    shake();
    showCaption(CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)]);
  }

  function spawnEatEffects(ev) {
    var c = center(ev.at);
    for (var k = 0; k < 8; k++) {
      var ang = (k / 8) * Math.PI * 2;
      var sp = 90 * (cell / 20);
      particles.push({
        x: c.x, y: c.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        r: cell * 0.08, color: '#b8f07a', outline: false, life: 0, duration: 350
      });
    }
    sparkles.push({ x: c.x, y: c.y - cell * 0.3, life: 0, duration: 700 });
  }

  function shake() {
    wrap.classList.remove('shake');
    void wrap.offsetWidth; // restart animation
    wrap.classList.add('shake');
  }

  function showCaption(text) {
    ui.caption.textContent = text;
    ui.caption.classList.remove('show');
    void ui.caption.offsetWidth;
    ui.caption.classList.add('show');
  }

  // ----- Audio --------------------------------------------------------------

  var audio = null;
  function ensureAudio() {
    if (!audio) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audio = new AC();
    }
    if (audio.state === 'suspended') audio.resume();
    return audio;
  }

  function playFart(severity) {
    var ac = ensureAudio();
    if (!ac) return;
    var now = ac.currentTime;
    var dur = 0.55 + Math.random() * 0.35 + severity * 0.1;

    var out = ac.createGain();
    out.gain.value = 0.9;
    out.connect(ac.destination);

    // Tone: sawtooth with a wobbling, falling pitch
    var osc = ac.createOscillator();
    osc.type = 'sawtooth';
    var base = 70 + Math.random() * 40;
    osc.frequency.setValueAtTime(base * 1.4, now);
    osc.frequency.exponentialRampToValueAtTime(base * 0.6, now + dur);

    var lfo = ac.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(18 + Math.random() * 14, now);
    lfo.frequency.linearRampToValueAtTime(8 + Math.random() * 6, now + dur);
    var lfoGain = ac.createGain();
    lfoGain.gain.value = base * 0.45;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    var filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(250, now + dur);
    filter.Q.value = 6;

    var toneGain = ac.createGain();
    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(0.5, now + 0.03);
    toneGain.gain.setValueAtTime(0.5, now + dur * 0.6);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    // Flutter: amplitude modulation for the "bbrrr" texture
    var flutter = ac.createOscillator();
    flutter.frequency.value = 28 + Math.random() * 10;
    var flutterGain = ac.createGain();
    flutterGain.gain.value = 0.25;
    var amp = ac.createGain();
    amp.gain.value = 0.75;
    flutter.connect(flutterGain);
    flutterGain.connect(amp.gain);

    osc.connect(filter);
    filter.connect(amp);
    amp.connect(toneGain);
    toneGain.connect(out);

    // Noise: airy hiss through a bandpass
    var len = Math.floor(ac.sampleRate * dur);
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var noise = ac.createBufferSource();
    noise.buffer = buf;
    var bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(400, now);
    bp.frequency.exponentialRampToValueAtTime(150, now + dur);
    bp.Q.value = 1.2;
    var noiseGain = ac.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    noise.connect(bp);
    bp.connect(noiseGain);
    noiseGain.connect(out);

    [osc, lfo, flutter, noise].forEach(function (n) { n.start(now); n.stop(now + dur + 0.05); });
  }

  function playBlip(freq, dur, type) {
    var ac = ensureAudio();
    if (!ac) return;
    var now = ac.currentTime;
    var o = ac.createOscillator();
    var g = ac.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, now);
    o.frequency.exponentialRampToValueAtTime(freq * 1.6, now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g);
    g.connect(ac.destination);
    o.start(now);
    o.stop(now + dur + 0.02);
  }

  function playDeath() {
    var ac = ensureAudio();
    if (!ac) return;
    var now = ac.currentTime;
    var o = ac.createOscillator();
    var g = ac.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(330, now);
    o.frequency.exponentialRampToValueAtTime(70, now + 0.6);
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    o.connect(g);
    g.connect(ac.destination);
    o.start(now);
    o.stop(now + 0.65);
  }

  // ----- HUD ----------------------------------------------------------------

  function updateHud() {
    ui.score.textContent = state.score;
    ui.length.textContent = state.snake.length;
    ui.high.textContent = Math.max(highScore, state.score);
    var ratio = Math.min(1, state.hunger / hungerThreshold(state.snake.length));
    ui.fill.style.width = (ratio * 100) + '%';
    ui.fill.classList.toggle('warn', ratio >= 0.7 && ratio < 0.9);
    ui.fill.classList.toggle('danger', ratio >= 0.9);
  }

  function showScreen(name) {
    ui.start.classList.toggle('hidden', name !== 'start');
    ui.pause.classList.toggle('hidden', name !== 'paused');
    ui.over.classList.toggle('hidden', name !== 'over');
  }

  // ----- Game flow ----------------------------------------------------------

  function startGame() {
    ensureAudio();
    state = createState();
    state.status = 'playing';
    prevSnake = cloneSnake(state.snake);
    clouds = []; particles = []; sparkles = [];
    accumulator = 0;
    showScreen(null);
    updateHud();
    playBlip(440, 0.12);
  }

  function togglePause() {
    if (state.status === 'playing') {
      state.status = 'paused';
      showScreen('paused');
    } else if (state.status === 'paused') {
      state.status = 'playing';
      accumulator = 0;
      showScreen(null);
    }
  }

  function primaryAction() {
    if (state.status === 'start' || state.status === 'over') startGame();
    else togglePause();
  }

  function gameOver(cause) {
    var isBest = state.score > highScore;
    if (isBest) { highScore = state.score; saveHigh(highScore); }
    ui.cause.textContent = DEATH_TEXT[cause] || 'Game over.';
    ui.finalScore.textContent = state.score;
    ui.finalHigh.textContent = highScore;
    ui.newBest.classList.toggle('hidden', !isBest);
    playDeath();
    // Let the fart/death land before the overlay covers it
    setTimeout(function () {
      if (state.status === 'over') showScreen('over');
    }, cause === 'starved' ? 1100 : 600);
  }

  function tick() {
    prevSnake = cloneSnake(state.snake);
    var events = step(state);
    events.forEach(function (ev) {
      if (ev.type === 'eat') {
        spawnEatEffects(ev);
        playBlip(520 + Math.min(state.leavesEaten, 20) * 15, 0.1);
      } else if (ev.type === 'fart') {
        spawnFartEffects(ev);
        playFart(ev.removed.length);
      } else if (ev.type === 'death') {
        if (ev.cause !== 'starved') shake();
        gameOver(ev.cause);
      }
    });
    // Keep interpolation sane after shrinking
    if (prevSnake.length > state.snake.length) prevSnake.length = state.snake.length;
    updateHud();
  }

  function frame(now) {
    var dt = lastFrame ? Math.min(now - lastFrame, 100) : 16;
    lastFrame = now;
    var interval = tickInterval(state.leavesEaten);
    if (state.status === 'playing') {
      accumulator += dt;
      while (accumulator >= interval && state.status === 'playing') {
        accumulator -= interval;
        tick();
      }
    }
    var alpha = state.status === 'playing' ? Math.min(1, accumulator / interval) : 1;
    draw(alpha, dt);
    requestAnimationFrame(frame);
  }

  // ----- Input --------------------------------------------------------------

  var KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right'
  };

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) primaryAction();
      return;
    }
    if (e.key === 'Enter' && (state.status === 'start' || state.status === 'over')) {
      e.preventDefault();
      startGame();
      return;
    }
    var dir = KEYMAP[e.key];
    if (dir) {
      e.preventDefault();
      if (state.status === 'playing') queueDirection(state, dir);
    }
  });

  var touchStart = null;
  document.addEventListener('touchstart', function (e) {
    if (e.target.closest && e.target.closest('button')) return;
    var t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY, swiped: false };
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (!touchStart || touchStart.swiped) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - touchStart.x;
    var dy = t.clientY - touchStart.y;
    // Turn as soon as the swipe is clear, rather than waiting for touchend
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) {
      handleSwipe(dx, dy);
      touchStart.swiped = true;
    }
  }, { passive: false });

  document.addEventListener('touchend', function (e) {
    if (!touchStart) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - touchStart.x;
    var dy = t.clientY - touchStart.y;
    if (!touchStart.swiped) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) handleSwipe(dx, dy);
      else primaryAction();
    }
    touchStart = null;
  });

  function handleSwipe(dx, dy) {
    if (state.status !== 'playing') return;
    var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    queueDirection(state, dir);
  }

  // Desktop click on the board toggles too (buttons handle their own clicks)
  wrap.addEventListener('click', function (e) {
    if (e.target.closest('button')) return;
    if (e.pointerType === 'touch') return; // handled by touch events
    primaryAction();
  });
  // Blur after click so a later Space press doesn't also re-activate the button
  $('start-btn').addEventListener('click', function (e) { e.stopPropagation(); this.blur(); startGame(); });
  $('restart-btn').addEventListener('click', function (e) { e.stopPropagation(); this.blur(); startGame(); });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state.status === 'playing') togglePause();
  });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  resize();
  updateHud();
  showScreen('start');
  requestAnimationFrame(frame);
})();
