# Mossford Village

A small multiplayer pixel-art village. Pick a name, walk around with friends in real time, and talk to three NPCs (Innkeeper Brannoc, Old Hessa, Sergeant Vale). The NPCs answer in character through the Claude API and remember what you told them.

- Server: Node + TypeScript (run with `tsx`), Express, Socket.IO. Everything is kept in memory.
- Client: plain HTML/JS/CSS with Phaser 3.80.1 (loaded from cdnjs).
- Controls: arrow keys or WASD on desktop, the on-screen D-pad on phones. Walk up to an NPC and tap **Talk to ...**. Esc closes the chat.

## Requirements

- Node.js 20 or newer
- pnpm (`npm install -g pnpm` if you don't have it)
- An Anthropic API key (optional: without one the server still runs and NPCs reply with a placeholder line)

## Run it (Windows / PowerShell)

1. Install dependencies:

   ```powershell
   Set-Location -LiteralPath 'C:\Users\mxz\mossford-village' -ErrorAction Stop; pnpm install
   ```

2. Create `.env` from the example:

   ```powershell
   Set-Location -LiteralPath 'C:\Users\mxz\mossford-village' -ErrorAction Stop; Copy-Item .env.example .env
   ```

   Open it in Notepad and replace the placeholder with your real key (`ANTHROPIC_API_KEY=sk-ant-...`):

   ```powershell
   Set-Location -LiteralPath 'C:\Users\mxz\mossford-village' -ErrorAction Stop; notepad .env
   ```

3. Start the server:

   ```powershell
   Set-Location -LiteralPath 'C:\Users\mxz\mossford-village' -ErrorAction Stop; pnpm start
   ```

4. Open <http://localhost:3000> in your browser. Stop the server with `Ctrl+C`.

## Play together on phones (Cloudflare quick tunnel)

1. Install cloudflared once:

   ```powershell
   Set-Location -LiteralPath 'C:\Users\mxz\mossford-village' -ErrorAction Stop; winget install --id Cloudflare.cloudflared
   ```

   Then **close PowerShell and open a new window** so `cloudflared` is on your PATH.

2. Keep the server running (`pnpm start`) in the first window. In a **second** PowerShell window, start the tunnel:

   ```powershell
   Set-Location -LiteralPath 'C:\Users\mxz\mossford-village' -ErrorAction Stop; cloudflared tunnel --url http://localhost:3000
   ```

3. It prints a URL like `https://something-random.trycloudflare.com`. Open that URL on both phones, pick a name each, and you'll see each other in the village.

The URL changes each time you restart the tunnel. All state (players, NPC memory) is reset when the server restarts.
