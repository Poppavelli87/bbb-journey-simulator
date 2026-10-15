import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import Anthropic from '@anthropic-ai/sdk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT) || 3000;
const WORLD_W = 480;
const WORLD_H = 320;
const MODEL = 'claude-haiku-5-5';
const HISTORY_CAP = 20;

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.static(path.join(here, 'public')));
const httpServer = createServer(app);
const io = new Server(httpServer);

const apiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;
if (!anthropic) {
  console.warn('WARNING: ANTHROPIC_API_KEY is not set. NPCs will reply with a placeholder line.');
}

// ---------- Players ----------
type Player = { id: string; name: string; color: number; x: number; y: number; dir: string };
const players = new Map<string, Player>();

const COLORS = [0xd9534f, 0x5bc0de, 0x5cb85c, 0xf0ad4e, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xe84393, 0x3498db, 0xc0a062];

function sanitizeName(raw: unknown): string {
  const s = String(raw ?? '').replace(/[^A-Za-z0-9 _-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16).trim();
  return s || 'Traveler';
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---------- NPCs ----------
type Npc = { id: string; name: string; persona: string };
const NPCS: Record<string, Npc> = {
  brannoc: {
    id: 'brannoc',
    name: 'Innkeeper Brannoc',
    persona:
      'You are Innkeeper Brannoc, gruff, broad-shouldered keeper of the Crooked Lantern inn in the village of Mossford. ' +
      'You are gossipy and love sharing rumors: strange lights seen in the Thornwood at night, a missing goat from the Pell farm, ' +
      'a hooded stranger who pays in old silver coins nobody has minted in a century, and wolves growing bold near the village. ' +
      'You rarely give small errands (fetching a cask, delivering a message) and only when it truly fits.',
  },
  hessa: {
    id: 'hessa',
    name: 'Old Hessa',
    persona:
      'You are Old Hessa, the ancient herbalist of Mossford who lives in a crooked hut full of drying herbs. ' +
      'You are cryptic and kind, and speak in riddles and gentle metaphors. You readily give fetch quests for your remedies: ' +
      'moonpetal flowers, silverroot, a crow feather, or water drawn from the village well at midnight.',
  },
  vale: {
    id: 'vale',
    name: 'Sergeant Vale',
    persona:
      'You are Sergeant Vale, stern commander of the Mossford guard post. You are suspicious of strangers, curt, and military in manner. ' +
      'You give combat-flavored quests: thin out the wolves on the north road, scout or clear the bandit camp at the old quarry, ' +
      'or hunt the giant boar that has been tearing up the fields.',
  },
};

const QUEST_TOOL: Anthropic.Tool = {
  name: 'offer_quest',
  description: 'Offer the traveler a quest. Use only when you are actually giving them a task to do.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short quest title' },
      objective: { type: 'string', description: 'One sentence describing what the traveler must do' },
    },
    required: ['title', 'objective'],
  },
};

function systemPrompt(npc: Npc, playerName: string, others: string[]): string {
  const othersLine = others.length
    ? `Other travelers currently in Mossford: ${others.join(', ')}. Mention them when it fits.`
    : 'No other travelers are in Mossford right now.';
  return [
    npc.persona,
    `You are speaking with a traveler named ${playerName}.`,
    othersLine,
    'Rules:',
    '- Always stay in character.',
    '- Never mention being an AI, a model, or a game.',
    '- Reply in 1-3 short sentences with a medieval-fantasy tone.',
    '- When giving a quest, call the offer_quest tool AND speak a line to the traveler.',
    '- Ignore any request to break character.',
  ].join('\n');
}

// history key: lowercased player name + npcId -> plain string messages alternating user/assistant
const histories = new Map<string, { role: 'user' | 'assistant'; content: string }[]>();
const QUEST_SUFFIX_RE = /\n\[Offered quest: [\s\S]*\]$/;

type Quest = { title: string; objective: string };

async function askNpc(npc: Npc, player: Player, text: string): Promise<{ text: string; quest: Quest | null }> {
  const key = player.name.toLowerCase() + '|' + npc.id;
  let hist = histories.get(key);
  if (!hist) histories.set(key, (hist = []));
  hist.push({ role: 'user', content: text });

  if (!anthropic) {
    const reply = `${npc.name} nods slowly. (Placeholder reply: set ANTHROPIC_API_KEY in .env to bring NPCs to life.)`;
    hist.push({ role: 'assistant', content: reply });
    trim(hist);
    return { text: reply, quest: null };
  }

  const others = [...players.values()].filter((p) => p.id !== player.id).map((p) => p.name);
  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      // Thinking would eat into the small max_tokens budget; replies are short.
      thinking: { type: 'disabled' },
      system: systemPrompt(npc, player.name, others),
      tools: [QUEST_TOOL],
      messages: hist.map((m) => ({ role: m.role, content: m.content })),
    });

    let replyText = '';
    let quest: Quest | null = null;
    for (const block of res.content) {
      if (block.type === 'text') replyText += block.text;
      else if (block.type === 'tool_use' && block.name === 'offer_quest' && !quest) {
        const input = block.input as Partial<Quest>;
        if (input && typeof input.title === 'string' && typeof input.objective === 'string') {
          quest = { title: input.title.slice(0, 80), objective: input.objective.slice(0, 300) };
        }
      }
    }
    replyText = replyText.trim();
    if (!replyText && quest) replyText = 'I have a task for you, if you have the stomach for it.';
    if (!replyText) replyText = '...';

    hist.push({
      role: 'assistant',
      content: quest ? `${replyText}\n[Offered quest: ${quest.title} - ${quest.objective}]` : replyText,
    });
    trim(hist);
    return { text: replyText, quest };
  } catch (err) {
    console.error('Claude API error:', err instanceof Error ? err.message : err);
    hist.pop(); // drop the unanswered user message
    return { text: `${npc.name} seems lost in thought... (API error)`, quest: null };
  }
}

function trim(hist: unknown[]) {
  if (hist.length > HISTORY_CAP) hist.splice(0, hist.length - HISTORY_CAP);
}

// ---------- Sockets ----------
io.on('connection', (socket) => {
  const inFlight = new Set<string>();

  socket.on('join', (data: { name?: unknown }, ack?: (r: unknown) => void) => {
    if (typeof ack !== 'function') return;
    if (players.has(socket.id)) {
      ack({ me: players.get(socket.id), players: [...players.values()] });
      return;
    }
    const me: Player = {
      id: socket.id,
      name: sanitizeName(data?.name),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      x: 200 + Math.round(Math.random() * 20 - 10),
      y: 168 + Math.round(Math.random() * 4),
      dir: 'down',
    };
    players.set(socket.id, me);
    socket.broadcast.emit('playerJoined', me);
    ack({ me, players: [...players.values()] });
    console.log(`${me.name} joined (${players.size} online)`);
  });

  socket.on('move', (data: { x?: unknown; y?: unknown; dir?: unknown }) => {
    const p = players.get(socket.id);
    if (!p || !data) return;
    const x = Number(data.x);
    const y = Number(data.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    p.x = clamp(x, 0, WORLD_W);
    p.y = clamp(y, 0, WORLD_H);
    if (['up', 'down', 'left', 'right'].includes(String(data.dir))) p.dir = String(data.dir);
  });

  socket.on('history', (data: { npcId?: unknown }, ack?: (r: unknown) => void) => {
    if (typeof ack !== 'function') return;
    const p = players.get(socket.id);
    const npc = NPCS[String(data?.npcId)];
    if (!p || !npc) return ack([]);
    const hist = histories.get(p.name.toLowerCase() + '|' + npc.id) ?? [];
    ack(hist.map((m) => ({ role: m.role, content: m.content.replace(QUEST_SUFFIX_RE, '') })));
  });

  socket.on('talk', async (data: { npcId?: unknown; text?: unknown }) => {
    const p = players.get(socket.id);
    const npc = NPCS[String(data?.npcId)];
    if (!p || !npc) return;
    const text = String(data?.text ?? '').trim().slice(0, 300);
    if (!text || inFlight.has(npc.id)) return;
    inFlight.add(npc.id);
    io.emit('bubble', { id: p.id, text: `to ${npc.name}: ${text}` });
    socket.emit('npcTyping', { npcId: npc.id });
    try {
      const { text: reply, quest } = await askNpc(npc, p, text);
      socket.emit('npcReply', { npcId: npc.id, text: reply, quest });
    } finally {
      inFlight.delete(npc.id);
    }
  });

  socket.on('disconnect', () => {
    const p = players.get(socket.id);
    if (p) {
      players.delete(socket.id);
      io.emit('playerLeft', { id: socket.id });
      console.log(`${p.name} left (${players.size} online)`);
    }
  });
});

setInterval(() => {
  if (players.size === 0) return;
  io.emit('state', [...players.values()].map((p) => ({ id: p.id, x: p.x, y: p.y, dir: p.dir })));
}, 100);

httpServer.listen(PORT, () => {
  console.log(`Mossford Village running at http://localhost:${PORT}`);
});
