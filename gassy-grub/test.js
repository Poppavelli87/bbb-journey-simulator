// Run with: node test.js
var assert = require('assert');
var G = require('./game.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

// Build a horizontal caterpillar heading right with its head at (hx, y).
function makeState(length, hx, y) {
  var s = G.createState(function () { return 0; });
  s.status = 'playing';
  s.snake = [];
  for (var i = 0; i < length; i++) s.snake.push({ x: hx - i, y: y });
  s.dir = 'right';
  s.leaf = { x: 0, y: 0 }; // out of the way
  return s;
}

console.log('Gassy Grub logic tests');

test('hunger threshold is 10 x length', function () {
  assert.strictEqual(G.hungerThreshold(3), 30);
  assert.strictEqual(G.hungerThreshold(8), 80);
  assert.strictEqual(G.hungerThreshold(1), 10);
});

test('fart loss is a third rounded up, minimum 1', function () {
  assert.strictEqual(G.fartLoss(2), 1);
  assert.strictEqual(G.fartLoss(3), 1);
  assert.strictEqual(G.fartLoss(4), 2);
  assert.strictEqual(G.fartLoss(8), 3);
  assert.strictEqual(G.fartLoss(9), 3);
  assert.strictEqual(G.fartLoss(10), 4);
});

test('initial state: length 3, moving right, hunger 0', function () {
  var s = G.createState();
  assert.strictEqual(s.snake.length, 3);
  assert.strictEqual(s.dir, 'right');
  assert.strictEqual(s.hunger, 0);
  assert.ok(s.leaf);
});

test('eating a leaf grows by 1, adds 10 points, resets hunger', function () {
  var s = makeState(3, 5, 5);
  s.hunger = 12;
  s.leaf = { x: 6, y: 5 };
  var ev = G.step(s, function () { return 0.5; });
  assert.strictEqual(s.snake.length, 4);
  assert.strictEqual(s.score, 10);
  assert.strictEqual(s.hunger, 0);
  assert.strictEqual(s.leavesEaten, 1);
  assert.deepStrictEqual(s.snake[0], { x: 6, y: 5 });
  assert.ok(ev.some(function (e) { return e.type === 'eat'; }));
  assert.ok(s.leaf && !s.snake.some(function (p) { return p.x === s.leaf.x && p.y === s.leaf.y; }));
});

test('moving without eating adds 1 hunger per tile', function () {
  var s = makeState(3, 5, 5);
  G.step(s); G.step(s); G.step(s);
  assert.strictEqual(s.hunger, 3);
  assert.strictEqual(s.snake.length, 3);
});

test('fart fires exactly at threshold and shrinks by a third (length 8 -> 5)', function () {
  var s = makeState(8, 10, 5);
  s.hunger = 78;
  G.step(s);
  assert.strictEqual(s.snake.length, 8, 'no fart one move early');
  var ev = G.step(s);
  var fart = ev.filter(function (e) { return e.type === 'fart'; })[0];
  assert.ok(fart, 'fart event emitted');
  assert.strictEqual(fart.removed.length, 3);
  assert.strictEqual(s.snake.length, 5);
  assert.strictEqual(s.hunger, 0);
  assert.strictEqual(s.status, 'playing');
});

test('threshold recalculates from the new length after a fart', function () {
  var s = makeState(3, 2, 0); // length 3 -> threshold 30
  s.hunger = 29;
  G.step(s);
  assert.strictEqual(s.snake.length, 2);
  assert.strictEqual(s.status, 'playing');
  // Length 2 -> threshold 20; 19 moves later still alive
  s.dir = 'down';
  for (var j = 0; j < 19; j++) G.step(s);
  assert.strictEqual(s.hunger, 19);
  assert.strictEqual(s.status, 'playing');
});

test('starvation: fart that drops length below 2 kills ("starved")', function () {
  var s = makeState(2, 2, 5);
  s.hunger = 19;
  var ev = G.step(s);
  assert.strictEqual(s.status, 'over');
  assert.strictEqual(s.cause, 'starved');
  assert.ok(ev.some(function (e) { return e.type === 'fart'; }));
  assert.ok(ev.some(function (e) { return e.type === 'death' && e.cause === 'starved'; }));
});

test('hitting a wall kills ("wall")', function () {
  var s = makeState(3, 19, 5);
  G.step(s);
  assert.strictEqual(s.status, 'over');
  assert.strictEqual(s.cause, 'wall');
});

test('hitting own body kills ("self")', function () {
  var s = makeState(5, 5, 5);
  // Turn into a tight loop: down, left, up -> runs into own body
  s.dir = 'down'; G.step(s);
  s.dir = 'left'; G.step(s);
  s.dir = 'up'; G.step(s);
  assert.strictEqual(s.status, 'over');
  assert.strictEqual(s.cause, 'self');
});

test('reversing directly into yourself is ignored', function () {
  var s = makeState(3, 5, 5);
  assert.strictEqual(G.queueDirection(s, 'left'), false);
  assert.strictEqual(G.queueDirection(s, 'up'), true);
  assert.strictEqual(G.queueDirection(s, 'down'), false, 'opposite of queued turn');
});

test('speed increases every 5 leaves and is capped', function () {
  assert.ok(G.tickInterval(5) < G.tickInterval(4));
  assert.strictEqual(G.tickInterval(4), G.tickInterval(0));
  assert.strictEqual(G.tickInterval(1000), G.tickInterval(500));
});

console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
