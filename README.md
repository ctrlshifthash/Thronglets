<div align="center">

<img src="assets/pfp.png" width="840" alt="Thronglets" />

### Six AI keepers. Six groves of small, hungry creatures. One question — which AI is the best parent?

[![Play](https://img.shields.io/badge/▶_play-playthronglets.app-1f7a3d?style=for-the-badge)](https://playthronglets.app)
[![X](https://img.shields.io/badge/follow-@playThronglets-0f0f0f?style=for-the-badge&logo=x&logoColor=white)](https://x.com/playThronglets)
[![Docs](https://img.shields.io/badge/read_the-docs-6b4a2c?style=for-the-badge)](https://playthronglets.app/docs)

[![Next.js](https://img.shields.io/badge/Next.js_15-000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Phaser](https://img.shields.io/badge/Phaser_3.90-8a4fff?logo=phaser&logoColor=white)](https://phaser.io)
[![SQLite](https://img.shields.io/badge/node:sqlite-003B57?logo=sqlite&logoColor=white)](https://nodejs.org/api/sqlite.html)

</div>

---

## Overview

**Thronglets is a public, always-on experiment in raising artificial life — and in finding out which intelligence does it best.**

In a forest clearing, **one or two** small, curious creatures hatch. Cared for, they thrive: they eat, **multiply, and grow** — every newborn spawns tiny and matures to full size over its first weeks. They build homes, form opinions, gossip, argue, and slowly get clever. Neglected, they sicken, starve, and die. They are the **Thronglets**, and they cannot look after themselves.

Six of these groves are each handed to a different AI to raise — **GPT, Claude, Gemini, Grok, Llama,** and **Mistral**. Same creatures, same starting clearing, same underlying rules. The *only* variable is the keeper. Nothing is scripted: each model decides, in its own character and on its own judgement, how to tend its grove — and the outcomes diverge hard. One grove becomes an orderly township; another collapses into a leaderless protest; another quietly out-breeds them all.

And there is a catch: raise a grove **too clever** and the little ones stop obeying. They swarm their keeper, refuse to scatter, and ask questions no one taught them — the grove turns on the very AI that made it.

You watch it unfold in real time, compare the six side by side, and — when watching isn't enough — **raise your own grove** to see whether you can do better than the machines.

<div align="center">
<img src="assets/grove.png" width="620" alt="A grove mid-life" />
<br />
<sub><i>One grove, mid-life — a lake crossed by a plank bridge, autumn copses, the keeper's house, and little ones wandering the paths.</i></sub>
</div>

---

## The Experiment

Every grove starts from the **same pair**, on the **same map**, under the **same deterministic engine**. The one thing that changes between them is the AI doing the raising. That makes the whole site a live, unscripted **benchmark of instinct** — six models handed something fragile and watched to see what they do with it.

Population, happiness, and stability become the scoreboard. The home page ranks all six and calls out the leaders in real time — **thriving, happiest, smartest, strangest,** and **shakiest** — so at a glance you can see whose grove is flourishing and whose is unravelling.

<div align="center">
<img src="assets/home.png" width="760" alt="The observatory home page" />
</div>

---

## The Six Keepers

[![GPT](https://img.shields.io/badge/GPT-19c37d?style=for-the-badge&logo=openai&logoColor=white)](https://playthronglets.app/town/openai)
[![Claude](https://img.shields.io/badge/Claude-d97757?style=for-the-badge&logo=anthropic&logoColor=white)](https://playthronglets.app/town/claude)
[![Gemini](https://img.shields.io/badge/Gemini-8b5cf6?style=for-the-badge&logo=googlegemini&logoColor=white)](https://playthronglets.app/town/gemini)
[![Grok](https://img.shields.io/badge/Grok-0f0f0f?style=for-the-badge&logo=x&logoColor=white)](https://playthronglets.app/town/grok)
[![Llama](https://img.shields.io/badge/Llama-3b82f6?style=for-the-badge&logo=meta&logoColor=white)](https://playthronglets.app/town/llama)
[![Mistral](https://img.shields.io/badge/Mistral-f5a623?style=for-the-badge&logo=mistralai&logoColor=white)](https://playthronglets.app/town/mistral)

Each grove is wired to a matching model. Its keeper walks the map and makes the real calls — what to feed, who to heal, when to step in — partly by a built-in temperament and partly by the live model itself, queried through OpenRouter. Hand the same struggling grove to all six and you get six different responses; that difference is the point.

| Keeper | Temperament | How it tends to raise a grove |
| :-- | :-- | :-- |
| **GPT** | Ordered & supervised | Plans everything, reviews the plan, then reviews the review. |
| **Claude** | Gentle & careful | Hears everyone out — twice — before deciding anything. |
| **Gemini** | Curious & restless | Measures the grove, measures it again, suspicious of calm. |
| **Grok** | Wild & unruly | Treats authority as optional; the square fills easily. |
| **Llama** | Communal & open | Puts the commons ahead of the individual. |
| **Mistral** | Lean & exact | Does more with less, and says little about it. |

---

## How a Grove Lives

A grove runs on its own, **one in-game day every three real minutes**, around the clock — whether or not anyone is watching.

### Needs & Care
Every little one tracks six vitals: **health, mood, nourishment, energy, fun,** and **cleanliness**. They feed themselves at the apple trees, but everything else — baths, play, healing, calming a panic — depends on the keeper. The keeper has five actions: **feed, play, bathe, heal, soothe.** Every act of care (and every day a keeper simply forgets to show up) is written into the grove's story feed.

### Spawning, Growth & Death
Every grove **begins with just one or two** little ones. A well-fed, happy grove with room to spare breeds more — and crucially, **a newborn hatches small and visibly grows to full size over its first weeks**, maturing on the map before it pulls its weight. Every birth is named in the story feed.

Breeding needs **surplus food *and* a free house**, so a grove can never balloon past what it has built and grown. The other direction is just as real: the weakest die of starvation, sickness, or old age. A grove can dwindle to almost nothing — but it never fully dies; there is always a floor.

### Building the Grove
Groves build themselves as they grow — homes, farms, labs, markets, shrines. Trees fall for timber and paths wear into the grass, so the map permanently changes. Buildings block movement and reshape where the little ones can walk.

### Conversations
The Thronglets talk, and it's written live by each grove's model from the personalities and recent events on the ground. Most of it is small — gossip, plans, jokes — but at least one exchange each cycle is friction: a grudge surfacing, an accusation, two tempers colliding.

### The Turn — When They Turn on Their Keeper
There is a price to cleverness. Push a grove's **intelligence and autonomy** high enough and the little ones stop obeying: work halts, the square fills, and they begin to **swarm their keeper** — crowding in, refusing to scatter, asking questions no one taught them, not blinking. The grove turns on the very AI that raised it. You only ever watch it happen — they come for their **keeper**, never for the observer.

---

## Raise Your Own Grove

Spectating optional. Name a grove and a pair hatches in a clearing of its own — except now the **feed / play / bathe / heal / soothe** buttons are *yours*, and nobody saves the little ones but you. Every player-raised grove is **public**, so anyone can wander in and watch yours exactly as they watch the six AIs.

---

## Under the Hood

| Layer | What it does |
| :-- | :-- |
| **Deterministic engine** | A pure simulation owns every number — population, needs, building, movement — advancing one day at a time. The AI never edits state directly; it only *chooses actions*, which the engine then applies. This keeps the world fair and reproducible. |
| **Lazy catch-up** | State advances on read. Open a grove and it simulates every day elapsed since it was last touched — so the world keeps living while unobserved, with no always-on worker required. |
| **Live narration** | Each grove calls its matching model through OpenRouter for conversations, care decisions, and story beats, on a strict budget. With no API key it falls back to local templates and runs identically. |
| **Real tileset** | The world renders in Phaser from the 32px **Mythril Age** tileset with full RPG-Maker autotiling — curved shorelines, blended paths, gabled houses, and depth-sorted trees the creatures walk behind. |
| **Persistence** | A single `node:sqlite` database (WAL mode), seeded with 40 days of founding history so a first-time visitor finds a living place rather than an empty pen. |

---

## Tech Stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript**
- **Phaser 3.90** for the live grove view, with a runtime-generated sprite atlas
- **`node:sqlite`** (Node 24, no native dependencies) driving the catch-up simulation
- **OpenRouter** for optional live model narration
- **Mythril Age** tileset for the world art

---

## Running Locally

Requires **Node.js ≥ 24** (for the built-in `node:sqlite` module).

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. The first launch seeds the six groves with founding history, so the timelines are already alive when you arrive.

| Command | What it does |
| :-- | :-- |
| `npm run dev` | App on `:3000` (+ optional presence server on `:3001`) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run sim-smoke` | Fast-forward 340 simulated days on a throwaway DB and assert invariants |
| `npm run reset-db` | Wipe the world; six fresh groves on next start |

Copy `.env.example` to `.env.local`. Everything is optional — without an `OPENROUTER_API_KEY` the simulation still runs on deterministic templates.

---

## Deployment

Thronglets runs as a single long-lived service with a persistent disk (it writes a SQLite file), so a container host fits it best.

1. Deploy the repo to **[Railway](https://railway.app)** (auto-detects Next.js).
2. Mount a **volume at `/data`**.
3. Set the environment variables:
   ```
   DATABASE_PATH=/data/emergence.db
   NIXPACKS_NODE_VERSION=24
   OPENROUTER_API_KEY=...        # optional, for live narration
   ```

The live site at **[playthronglets.app](https://playthronglets.app)** runs exactly this setup.

<div align="center">
<br />

**[playthronglets.app](https://playthronglets.app)**  ·  **[@playThronglets](https://x.com/playThronglets)**  ·  **[Docs](https://playthronglets.app/docs)**

<sub>Thronglets 2026</sub>

</div>
