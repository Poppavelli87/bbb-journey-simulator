/* global Phaser, io */
(() => {
  'use strict';

  const WORLD_W = 480;
  const WORLD_H = 320;
  const SPEED = 64; // world units per second
  const TALK_RANGE = 30;

  const TEXT_STYLE = {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 2,
    resolution: 4,
  };

  // ---------- World layout ----------
  const BUILDINGS = [
    { name: 'Crooked Lantern Inn', x: 40, y: 40, w: 96, h: 64, roof: 0x8b3a2b, wall: 0xc8a878 },
    { name: 'Herbalist', x: 352, y: 48, w: 72, h: 56, roof: 0x4f6b35, wall: 0xb89a6a },
    { name: 'Guard Post', x: 352, y: 196, w: 80, h: 60, roof: 0x4a5560, wall: 0x9a9488 },
    { name: 'House', x: 48, y: 196, w: 80, h: 60, roof: 0x7a4a2a, wall: 0xc2a27a },
  ];
  const WELL = { x: 240, y: 160 };
  const TREES = [
    [16, 30], [160, 40], [200, 70], [290, 40], [320, 84], [456, 40],
    [456, 130], [20, 136], [170, 220], [300, 222], [176, 300], [460, 302],
  ];
  const ROAD = { y: 144, h: 32 };
  const PLAZA = { x: 200, y: 124, w: 80, h: 72 };
  const SPURS = [
    { x: 80, y: 104, w: 16, h: 40 }, // inn door -> road
    { x: 380, y: 104, w: 16, h: 40 }, // herbalist door -> road
    { x: 336, y: 176, w: 16, h: 96 }, // guard post: down the side
    { x: 336, y: 256, w: 64, h: 16 }, //   ...across to the door
    { x: 128, y: 176, w: 16, h: 96 }, // house: down the side
    { x: 80, y: 256, w: 64, h: 16 }, //   ...across to the door
  ];
  const NPCS = [
    { id: 'brannoc', name: 'Innkeeper Brannoc', x: 112, y: 120, tunic: 0x7a5230, hair: 0x5a3a1a },
    { id: 'hessa', name: 'Old Hessa', x: 408, y: 120, tunic: 0x3f6a4a, hair: 0xd8d8d0 },
    { id: 'vale', name: 'Sergeant Vale', x: 414, y: 274, tunic: 0x8a2c2c, hair: 0x222222 },
  ];

  const SOLIDS = [];
  for (const b of BUILDINGS) SOLIDS.push({ x: b.x, y: b.y, w: b.w, h: b.h });
  SOLIDS.push({ x: WELL.x - 10, y: WELL.y - 10, w: 20, h: 18 });
  for (const [tx, ty] of TREES) SOLIDS.push({ x: tx - 3, y: ty - 4, w: 6, h: 4 });
  for (const n of NPCS) SOLIDS.push({ x: n.x - 6, y: n.y - 6, w: 12, h: 6 });

  function feetBlocked(x, y) {
    const fx = x - 4, fy = y - 3, fw = 8, fh = 3;
    for (const s of SOLIDS) {
      if (fx < s.x + s.w && fx + fw > s.x && fy < s.y + s.h && fy + fh > s.y) return true;
    }
    return false;
  }

  // ---------- State ----------
  const socket = io();
  let scene = null;
  let me = null; // { id, name, color, sprite, label, bubble }
  let joined = false;
  let joinName = '';
  const remotes = new Map(); // id -> { sprite, label, bubble, tx, ty, dir }
  const npcSprites = [];
  let lastSent = { x: -1, y: -1, dir: '' };
  let sendTimer = 0;
  let myDir = 'down';
  const touchDir = { up: false, down: false, left: false, right: false };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const joinOverlay = $('join-overlay');
  const joinForm = $('join-form');
  const joinInput = $('join-name');
  const talkBtn = $('talk-btn');
  const chat = $('chat');
  const chatTitle = $('chat-title');
  const chatLog = $('chat-log');
  const chatForm = $('chat-form');
  const chatInput = $('chat-input');
  const chatClose = $('chat-close');
  const questsToggle = $('quests-toggle');
  const questsList = $('quests-list');
  const dpad = $('dpad');

  let nearNpc = null;
  let chatNpc = null;
  let typingEl = null;
  const pending = new Set();
  const quests = [];

  try { joinInput.value = localStorage.getItem('mossford-name') || ''; } catch (e) { /* ignore */ }

  // ---------- Textures ----------
  function makeCharTexture(sc, key, tunic, hair) {
    if (sc.textures.exists(key)) return;
    const g = sc.make.graphics({ x: 0, y: 0 }, false);
    const skin = 0xf1c27d;
    const dark = Phaser.Display.Color.IntegerToColor(tunic).darken(25).color;
    g.fillStyle(0x000000, 0.3); g.fillEllipse(8, 15, 10, 3);
    g.fillStyle(0x3b2a1a, 1); g.fillRect(5, 12, 2, 3); g.fillRect(9, 12, 2, 3);
    g.fillStyle(tunic, 1); g.fillRect(4, 7, 8, 6);
    g.fillStyle(dark, 1); g.fillRect(4, 10, 8, 1); g.fillRect(3, 8, 1, 3); g.fillRect(12, 8, 1, 3);
    g.fillStyle(skin, 1); g.fillRect(3, 11, 1, 1); g.fillRect(12, 11, 1, 1);
    g.fillRect(5, 2, 6, 5);
    g.fillStyle(hair, 1); g.fillRect(5, 1, 6, 2); g.fillRect(5, 3, 1, 2);
    g.fillStyle(0x000000, 1); g.fillRect(8, 4, 1, 1); g.fillRect(10, 4, 1, 1);
    g.generateTexture(key, 16, 16);
    g.destroy();
  }

  function makeCharacter(sc, key, x, y, name) {
    const sprite = sc.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);
    const label = sc.add.text(x, y - 16, name, TEXT_STYLE).setOrigin(0.5, 1).setDepth(9000);
    return { sprite, label, bubble: null, bubbleTimer: null };
  }

  function placeCharacter(c, x, y) {
    c.sprite.setPosition(x, y).setDepth(y);
    c.label.setPosition(x, y - 16);
    if (c.bubble) c.bubble.setPosition(x, y - 24);
  }

  function destroyCharacter(c) {
    c.sprite.destroy();
    c.label.destroy();
    if (c.bubble) c.bubble.destroy();
    if (c.bubbleTimer) c.bubbleTimer.remove();
  }

  function showBubble(c, text) {
    if (!scene) return;
    const t = text.length > 40 ? text.slice(0, 39) + '…' : text;
    if (c.bubble) c.bubble.destroy();
    if (c.bubbleTimer) c.bubbleTimer.remove();
    c.bubble = scene.add.text(c.sprite.x, c.sprite.y - 24, t, {
      ...TEXT_STYLE,
      fontSize: '6px',
      backgroundColor: 'rgba(43,29,18,0.85)',
      padding: { x: 2, y: 1 },
    }).setOrigin(0.5, 1).setDepth(9500);
    c.bubbleTimer = scene.time.delayedCall(5000, () => {
      if (c.bubble) c.bubble.destroy();
      c.bubble = null;
      c.bubbleTimer = null;
    });
  }

  // ---------- World drawing ----------
  function drawWorld(sc) {
    const ground = sc.add.graphics().setDepth(-1000);
    for (let ty = 0; ty < WORLD_H / 16; ty++) {
      for (let tx = 0; tx < WORLD_W / 16; tx++) {
        ground.fillStyle((tx + ty) % 2 ? 0x5a9a3c : 0x63a543, 1);
        ground.fillRect(tx * 16, ty * 16, 16, 16);
      }
    }
    // dirt road + spurs
    ground.fillStyle(0xa47c4c, 1);
    ground.fillRect(0, ROAD.y, WORLD_W, ROAD.h);
    for (const s of SPURS) ground.fillRect(s.x, s.y, s.w, s.h);
    ground.fillStyle(0x8e6a3e, 1);
    ground.fillRect(0, ROAD.y, WORLD_W, 2);
    ground.fillRect(0, ROAD.y + ROAD.h - 2, WORLD_W, 2);
    // plaza
    ground.fillStyle(0xb5a58a, 1);
    ground.fillRect(PLAZA.x, PLAZA.y, PLAZA.w, PLAZA.h);
    ground.lineStyle(1, 0x9a8a70, 1);
    for (let y = PLAZA.y + 8; y < PLAZA.y + PLAZA.h; y += 8) ground.lineBetween(PLAZA.x, y, PLAZA.x + PLAZA.w, y);
    ground.strokeRect(PLAZA.x + 0.5, PLAZA.y + 0.5, PLAZA.w - 1, PLAZA.h - 1);

    // well
    const well = sc.add.graphics().setDepth(WELL.y + 8);
    well.fillStyle(0x000000, 0.25); well.fillEllipse(WELL.x, WELL.y + 7, 24, 6);
    well.fillStyle(0x7d7d7d, 1); well.fillCircle(WELL.x, WELL.y, 10);
    well.fillStyle(0x5e5e5e, 1); well.fillCircle(WELL.x, WELL.y, 8);
    well.fillStyle(0x23415e, 1); well.fillCircle(WELL.x, WELL.y, 6);
    well.fillStyle(0x6b4a2a, 1); well.fillRect(WELL.x - 10, WELL.y - 14, 2, 12); well.fillRect(WELL.x + 8, WELL.y - 14, 2, 12);
    well.fillRect(WELL.x - 10, WELL.y - 15, 20, 2);
    well.fillStyle(0xcfc2a0, 1); well.fillRect(WELL.x - 0.5, WELL.y - 13, 1, 8);

    // buildings
    for (const b of BUILDINGS) {
      const g = sc.add.graphics().setDepth(b.y + b.h);
      const roofH = Math.round(b.h * 0.55);
      const wallY = b.y + roofH;
      const wallH = b.h - roofH;
      g.fillStyle(0x000000, 0.25); g.fillRect(b.x + 3, b.y + b.h, b.w - 2, 3);
      g.fillStyle(b.wall, 1); g.fillRect(b.x, wallY, b.w, wallH);
      g.fillStyle(b.roof, 1); g.fillRect(b.x - 2, b.y, b.w + 4, roofH);
      const roofDark = Phaser.Display.Color.IntegerToColor(b.roof).darken(20).color;
      g.fillStyle(roofDark, 1);
      for (let y = b.y + 4; y < wallY; y += 5) g.fillRect(b.x - 2, y, b.w + 4, 1);
      g.fillRect(b.x - 2, wallY - 2, b.w + 4, 2);
      // door
      const doorX = b.x + b.w / 2 - 5;
      g.fillStyle(0x4a2e18, 1); g.fillRect(doorX, b.y + b.h - 14, 10, 14);
      g.fillStyle(0xd4b04a, 1); g.fillRect(doorX + 7, b.y + b.h - 8, 1, 1);
      // windows
      g.fillStyle(0x3a2a1a, 1);
      g.fillRect(b.x + 8, wallY + 6, 10, 8); g.fillRect(b.x + b.w - 18, wallY + 6, 10, 8);
      g.fillStyle(0xf3d98a, 1);
      g.fillRect(b.x + 9, wallY + 7, 8, 6); g.fillRect(b.x + b.w - 17, wallY + 7, 8, 6);
      g.fillStyle(0x3a2a1a, 1);
      g.fillRect(b.x + 12, wallY + 7, 1, 6); g.fillRect(b.x + b.w - 14, wallY + 7, 1, 6);
      sc.add.text(b.x + b.w / 2, b.y - 1, b.name, { ...TEXT_STYLE, color: '#f3d98a' })
        .setOrigin(0.5, 1).setDepth(9000);
    }

    // trees (separate objects, depth = trunk base y)
    for (const [tx, ty] of TREES) {
      const g = sc.add.graphics().setDepth(ty);
      g.fillStyle(0x000000, 0.25); g.fillEllipse(tx, ty, 14, 4);
      g.fillStyle(0x6b4423, 1); g.fillRect(tx - 2, ty - 8, 4, 8);
      g.fillStyle(0x2f6b2a, 1); g.fillCircle(tx, ty - 16, 10);
      g.fillStyle(0x3b8a34, 1); g.fillCircle(tx - 3, ty - 18, 6);
      g.fillStyle(0x4aa040, 1); g.fillCircle(tx - 4, ty - 20, 3);
    }
  }

  // ---------- Scene ----------
  class VillageScene extends Phaser.Scene {
    constructor() { super('village'); }

    create() {
      scene = this;
      this.cameras.main.setZoom(2).centerOn(WORLD_W / 2, WORLD_H / 2);
      drawWorld(this);
      for (const n of NPCS) {
        makeCharTexture(this, 'npc-' + n.id, n.tunic, n.hair);
        const c = makeCharacter(this, 'npc-' + n.id, n.x, n.y, n.name);
        c.label.setColor('#f3d98a');
        npcSprites.push(c);
      }
      this.keys = this.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D', false);
    }

    update(_time, deltaMs) {
      const dt = Math.min(deltaMs / 1000, 0.1);

      // remote interpolation
      const a = Math.min(1, dt * 12);
      for (const r of remotes.values()) {
        const dx = r.tx - r.sprite.x;
        const dy = r.ty - r.sprite.y;
        if (dx * dx + dy * dy > 80 * 80) placeCharacter(r, r.tx, r.ty);
        else placeCharacter(r, r.sprite.x + dx * a, r.sprite.y + dy * a);
        if (r.dir === 'left') r.sprite.setFlipX(true);
        else if (r.dir === 'right') r.sprite.setFlipX(false);
      }

      if (!me) return;

      // local movement
      let mx = 0, my = 0;
      if (!chatNpc) {
        const k = this.keys;
        if (k.LEFT.isDown || k.A.isDown || touchDir.left) mx -= 1;
        if (k.RIGHT.isDown || k.D.isDown || touchDir.right) mx += 1;
        if (k.UP.isDown || k.W.isDown || touchDir.up) my -= 1;
        if (k.DOWN.isDown || k.S.isDown || touchDir.down) my += 1;
      }
      if (mx || my) {
        const len = Math.hypot(mx, my);
        const step = SPEED * dt;
        let x = me.sprite.x, y = me.sprite.y;
        const nx = Phaser.Math.Clamp(x + (mx / len) * step, 4, WORLD_W - 4);
        if (!feetBlocked(nx, y)) x = nx;
        const ny = Phaser.Math.Clamp(y + (my / len) * step, 3, WORLD_H);
        if (!feetBlocked(x, ny)) y = ny;
        myDir = mx < 0 ? 'left' : mx > 0 ? 'right' : my < 0 ? 'up' : 'down';
        if (mx < 0) me.sprite.setFlipX(true);
        else if (mx > 0) me.sprite.setFlipX(false);
        placeCharacter(me, x, y);
      }

      // send position at ~10 Hz when changed
      sendTimer += deltaMs;
      if (sendTimer >= 100) {
        sendTimer = 0;
        const x = Math.round(me.sprite.x * 10) / 10;
        const y = Math.round(me.sprite.y * 10) / 10;
        if (x !== lastSent.x || y !== lastSent.y || myDir !== lastSent.dir) {
          lastSent = { x, y, dir: myDir };
          socket.emit('move', lastSent);
        }
      }

      // NPC proximity
      let best = null, bestD = TALK_RANGE;
      for (const n of NPCS) {
        const d = Math.hypot(n.x - me.sprite.x, n.y - me.sprite.y);
        if (d <= bestD) { best = n; bestD = d; }
      }
      if (best !== nearNpc) {
        nearNpc = best;
        if (nearNpc) talkBtn.textContent = 'Talk to ' + nearNpc.name;
      }
      talkBtn.classList.toggle('hidden', !nearNpc || !!chatNpc);
      if (chatNpc && chatNpc !== nearNpc) closeChat();
    }
  }

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 960,
    height: 640,
    backgroundColor: '#1a120b',
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: VillageScene,
  });

  // ---------- Multiplayer ----------
  function addRemote(p) {
    if (!scene || p.id === socket.id || remotes.has(p.id)) return;
    const key = 'player-' + p.color.toString(16);
    makeCharTexture(scene, key, p.color, 0x4a3020);
    const c = makeCharacter(scene, key, p.x, p.y, p.name);
    c.tx = p.x; c.ty = p.y; c.dir = p.dir;
    remotes.set(p.id, c);
  }

  function removeRemote(id) {
    const r = remotes.get(id);
    if (!r) return;
    destroyCharacter(r);
    remotes.delete(id);
  }

  function doJoin() {
    socket.emit('join', { name: joinName }, (res) => {
      if (!res || !res.me || !scene) return;
      for (const id of [...remotes.keys()]) removeRemote(id);
      const key = 'player-' + res.me.color.toString(16);
      makeCharTexture(scene, key, res.me.color, 0x4a3020);
      if (me) {
        // reconnect: keep our local position, new identity
        destroyCharacter(me);
        const c = makeCharacter(scene, key, me.sprite.x, me.sprite.y, res.me.name);
        me = { ...res.me, ...c };
        lastSent = { x: -1, y: -1, dir: '' };
      } else {
        me = { ...res.me, ...makeCharacter(scene, key, res.me.x, res.me.y, res.me.name) };
      }
      me.label.setColor('#9fd3e8');
      for (const p of res.players) addRemote(p);
      joined = true;
    });
  }

  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    joinName = joinInput.value.trim().slice(0, 16);
    if (!joinName) return;
    try { localStorage.setItem('mossford-name', joinName); } catch (err) { /* ignore */ }
    joinOverlay.classList.add('hidden');
    joinInput.blur();
    const tryJoin = () => (scene ? doJoin() : setTimeout(tryJoin, 50));
    tryJoin();
  });

  socket.on('connect', () => { if (joined) doJoin(); });
  socket.on('playerJoined', (p) => addRemote(p));
  socket.on('playerLeft', ({ id }) => removeRemote(id));
  socket.on('state', (list) => {
    for (const p of list) {
      const r = remotes.get(p.id);
      if (!r) continue;
      r.tx = p.x; r.ty = p.y; r.dir = p.dir;
    }
  });
  socket.on('bubble', ({ id, text }) => {
    const c = me && id === me.id ? me : remotes.get(id);
    if (c) showBubble(c, text);
  });

  // ---------- Chat ----------
  function addLine(who, text, cls) {
    const div = document.createElement('div');
    div.className = 'msg ' + (cls || '');
    const w = document.createElement('span');
    w.className = 'who';
    w.textContent = who + ': ';
    const t = document.createElement('span');
    t.textContent = text;
    div.append(w, t);
    chatLog.appendChild(div);
    if (typingEl) chatLog.appendChild(typingEl); // keep typing line last
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function addQuestCard(quest) {
    const card = document.createElement('div');
    card.className = 'quest-card';
    const title = document.createElement('div');
    title.className = 'q-title';
    title.textContent = 'Quest: ' + quest.title;
    const obj = document.createElement('div');
    obj.textContent = quest.objective;
    const btn = document.createElement('button');
    btn.type = 'button';
    const already = quests.some((q) => q.title === quest.title);
    btn.textContent = already ? 'Accepted' : 'Accept';
    btn.disabled = already;
    btn.addEventListener('click', () => {
      if (!quests.some((q) => q.title === quest.title)) {
        quests.push({ ...quest, giver: chatNpc ? chatNpc.name : '' });
        renderQuests();
      }
      btn.textContent = 'Accepted';
      btn.disabled = true;
    });
    card.append(title, obj, btn);
    chatLog.appendChild(card);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function setTyping(on) {
    if (on && !typingEl) {
      typingEl = document.createElement('div');
      typingEl.className = 'msg typing';
      typingEl.textContent = '...';
      chatLog.appendChild(typingEl);
      chatLog.scrollTop = chatLog.scrollHeight;
    } else if (!on && typingEl) {
      typingEl.remove();
      typingEl = null;
    }
  }

  function openChat(npc) {
    chatNpc = npc;
    chatTitle.textContent = npc.name;
    chatLog.textContent = '';
    typingEl = null;
    chat.classList.remove('hidden');
    document.body.classList.add('chat-open');
    talkBtn.classList.add('hidden');
    socket.emit('history', { npcId: npc.id }, (hist) => {
      if (chatNpc !== npc || !Array.isArray(hist)) return;
      for (const m of hist) addLine(m.role === 'user' ? (me ? me.name : 'You') : npc.name, m.content, m.role === 'user' ? 'me' : '');
      if (pending.has(npc.id)) setTyping(true);
    });
    chatInput.focus();
  }

  function closeChat() {
    chatNpc = null;
    setTyping(false);
    chat.classList.add('hidden');
    document.body.classList.remove('chat-open');
    chatInput.blur();
  }

  talkBtn.addEventListener('click', () => { if (nearNpc) openChat(nearNpc); });
  chatClose.addEventListener('click', closeChat);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && chatNpc) closeChat(); });

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!chatNpc) return;
    const text = chatInput.value.trim().slice(0, 300);
    if (!text || pending.has(chatNpc.id)) return;
    chatInput.value = '';
    pending.add(chatNpc.id);
    addLine(me ? me.name : 'You', text, 'me');
    setTyping(true);
    socket.emit('talk', { npcId: chatNpc.id, text });
  });

  socket.on('npcTyping', ({ npcId }) => { if (chatNpc && chatNpc.id === npcId) setTyping(true); });
  socket.on('npcReply', ({ npcId, text, quest }) => {
    pending.delete(npcId);
    if (!chatNpc || chatNpc.id !== npcId) return;
    setTyping(false);
    addLine(chatNpc.name, text, '');
    if (quest) addQuestCard(quest);
  });

  // ---------- Quest log ----------
  let questsOpen = false;
  function renderQuests() {
    questsToggle.textContent = `Quests (${quests.length})`;
    questsList.textContent = '';
    for (const q of quests) {
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = q.title;
      const s = document.createElement('span');
      s.textContent = (q.giver ? ` (${q.giver})` : '') + ' — ' + q.objective;
      li.append(b, s);
      questsList.appendChild(li);
    }
    questsList.classList.toggle('hidden', !questsOpen || quests.length === 0);
  }
  questsToggle.addEventListener('click', () => { questsOpen = !questsOpen; renderQuests(); });

  // ---------- Touch D-pad ----------
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouch) dpad.classList.remove('hidden');
  for (const btn of dpad.querySelectorAll('button')) {
    const dir = btn.dataset.dir;
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); touchDir[dir] = true; });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) {
      btn.addEventListener(ev, () => { touchDir[dir] = false; });
    }
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
})();
