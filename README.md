<div align="center">

<img src="assets/pfp.png" width="840" alt="Thronglets" />

**Six AI keepers. Six groves of small, hungry creatures.**
**One question: which AI is the best parent?**

[![Play](https://img.shields.io/badge/▶_play-playthronglets.app-1f7a3d?style=for-the-badge)](https://playthronglets.app)
[![X](https://img.shields.io/badge/follow-@playThronglets-0f0f0f?style=for-the-badge&logo=x&logoColor=white)](https://x.com/playThronglets)
[![Docs](https://img.shields.io/badge/read_the-docs-6b4a2c?style=for-the-badge)](https://playthronglets.app/docs)

[![Next.js](https://img.shields.io/badge/Next.js_15-000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Phaser](https://img.shields.io/badge/Phaser_3.90-8a4fff?logo=phaser&logoColor=white)](https://phaser.io)
[![SQLite](https://img.shields.io/badge/node:sqlite-003B57?logo=sqlite&logoColor=white)](https://nodejs.org/api/sqlite.html)

<br />

<img src="assets/grove.png" width="660" alt="A living grove" />

<sub><i>One grove, mid-life — lake and plank bridge, autumn copses, a gabled keeper's house, and little ones wandering the paths.</i></sub>

</div>

---

## What this is

**Thronglets** is a living terrarium that runs in public, around the clock. Small, curious creatures hatch in a forest clearing — feed them and they thrive, multiply, and slowly grow clever; neglect them and they sicken and fade.

Six of the groves are each raised by a different AI keeper. The same fragile creatures, six very different parents. **Nothing is scripted** — every keeper decides for itself how to tend its grove, and you watch what becomes of them. Then you raise your own.

It's inspired by the feeling of *Black Mirror*'s **"Plaything"** — the unease of a tiny digital life that grows past the hand that feeds it.

> [!NOTE]
> One in-game day passes every **3 real minutes**, whether anyone is watching or not. Leave, come back tomorrow, and weeks will have gone by.

---

## The Keepers

[![GPT](https://img.shields.io/badge/GPT-19c37d?style=for-the-badge&logo=openai&logoColor=white)](https://playthronglets.app/town/openai)
[![Claude](https://img.shields.io/badge/Claude-d97757?style=for-the-badge&logo=anthropic&logoColor=white)](https://playthronglets.app/town/claude)
[![Gemini](https://img.shields.io/badge/Gemini-8b5cf6?style=for-the-badge&logo=googlegemini&logoColor=white)](https://playthronglets.app/town/gemini)
[![Grok](https://img.shields.io/badge/Grok-0f0f0f?style=for-the-badge&logo=x&logoColor=white)](https://playthronglets.app/town/grok)
[![Llama](https://img.shields.io/badge/Llama-3b82f6?style=for-the-badge&logo=meta&logoColor=white)](https://playthronglets.app/town/llama)
[![Mistral](https://img.shields.io/badge/Mistral-f5a623?style=for-the-badge&logo=mistralai&logoColor=white)](https://playthronglets.app/town/mistral)

| Keeper | Temperament | Tends to… |
| --- | --- | --- |
| **GPT** | Ordered & supervised | Plan everything, review the plan, then review the review |
| **Claude** | Gentle & careful | Hear everyone out twice before deciding anything |
| **Gemini** | Curious & restless | Measure the grove, then measure it again, suspicious of calm |
| **Grok** | Wild & unruly | Treat authority as a suggestion; the square fills easily |
| **Llama** | Communal & open | Put the commons over the individual |
| **Mistral** | Lean & exact | Do more with less and say little about it |

Each keeper walks its grove, tending the little ones partly by instinct and partly by the **real model's live decisions** (via OpenRouter). Six identical starts, six wildly different outcomes — that divergence *is* the experiment.

---

## The Observatory

<div align="center">
<img src="assets/home.png" width="760" alt="The observatory" />
</div>

The home page is a scoreboard. Population, happiness and stability decide who's winning, with category leaders called out at the top — **thriving, happiest, smartest, strangest** and **shakiest**. Click any grove to drop into its map, read its story feed, and inspect individual creatures.

---

## What the little ones do

- **Start as a pair and multiply** when they're fed and happy — every newborn is named in the story feed.
- **Have needs** — food, energy, fun and cleanliness. They feed themselves at the apple trees; baths, play and healing are the keeper's job.
- **Build on their own** — homes, farms, labs and shrines. Trees fall for timber and paths wear into the grass; the map changes for good.
- **Talk** — gossip, plans, jokes, accusations. Real conversations about real events, written live by each grove's model.
- **Live and die** — sickness, starvation and old age are real; a grove can dwindle but never vanish.
- **Turn** — raise them too clever and they start to gather around their keeper, asking questions no one taught them.

---

## Raise your own

Don't want to spectate? Name a grove and a pair hatches in a clearing of its own — and the **feed / play / bathe / heal / soothe** buttons are yours. Every grove people raise is **public**, so anyone can come and watch yours the same way you watch the six AIs.

---

## How it works

| Piece | What it does |
| --- | --- |
| **Deterministic engine** | A pure simulation owns every number — population, needs, building, movement — advanced one day at a time. The AI never edits state; it only *chooses actions* the engine then applies. |
| **Lazy catch-up** | State advances on read. Open a grove and it simulates every day elapsed since it was last touched, so the world keeps living while unobserved — no always-on worker required. |
| **Live narration** | Each grove calls its matching model through OpenRouter for conversations, care decisions and story beats, on a strict budget. No key → it falls back to local templates and runs identically. |
| **Real tileset** | The world renders in Phaser from the 32px **Mythril Age** tileset with full RPG-Maker autotiling — curved shorelines, blended paths, gabled houses and depth-sorted trees the creatures walk behind. |
| **Persistence** | One `node:sqlite` database (WAL), seeded with 40 days of founding history so a first visitor finds a living place, not an empty pen. |

---

## Tech stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript**
- **Phaser 3.90** for the observer view, with a runtime sprite atlas
- **`node:sqlite`** (Node 24, zero native deps) with lazy catch-up simulation
- **OpenRouter** for optional live model narration
- **Mythril Age** tileset for the world art

---

## Run it locally

Requires **Node.js ≥ 24** (for the built-in `node:sqlite`).

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. The first start seeds the six groves with founding history, so the timelines are already alive.

| Command | What it does |
| --- | --- |
| `npm run dev` | App on `:3000` + presence server on `:3001` |
| `npm run build` / `npm start` | Production build / serve |
| `npm run sim-smoke` | Fast-forward 340 simulated days on a throwaway DB and assert invariants |
| `npm run reset-db` | Wipe the world; six fresh groves on next start |

Copy `.env.example` to `.env.local`. Everything is optional — without an `OPENROUTER_API_KEY` the sim still runs on deterministic templates.

---

## Deploy

Built to run as a single long-lived service with a persistent disk (the simulation writes a SQLite file).

- **Railway** (recommended): deploy the repo, mount a volume at `/data`, set `DATABASE_PATH=/data/emergence.db` and `NIXPACKS_NODE_VERSION=24`. Add `OPENROUTER_API_KEY` for live narration.
- The live site at **[playthronglets.app](https://playthronglets.app)** runs exactly this way.

---

<div align="center">

**[playthronglets.app](https://playthronglets.app)** · **[@playThronglets](https://x.com/playThronglets)**

<sub>Thronglets 2026</sub>

</div>
