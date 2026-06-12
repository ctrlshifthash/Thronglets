import type { AgentRole, ModelKey } from './types';

// ─────────────────────────────────────────────────────────────────────
// The six town cultures. Traits are hidden drivers (0..1) that bend
// the simulation; event pools give each society its voice. Template
// strings may use {pop}, {day}, {knowledge}, {stage}.
// ─────────────────────────────────────────────────────────────────────

export interface Traits {
  curiosity: number;
  caution: number;
  ambition: number;
  cooperation: number;
  obedience: number;
  risk: number;
  empathy: number;
  paranoia: number;
}

export interface TownPersona {
  slug: ModelKey;
  name: string;
  culture: string;
  accent: string;
  theme: string; // worldgen theme
  mapSeed: number;
  tagline: string;
  description: string;
  traits: Traits;
  /** Flavor events, weighted into the generic pool. */
  events: string[];
  /** Mood vocabulary by band: [low happiness, mid, high]. */
  moods: [string[], string[], string[]];
  /** Citizen emote glyphs by rising weirdness. */
  emotes: [string[], string[]];
  /** Names for the little ones. */
  agentNames: string[];
  /** Role distribution weights for newborn agents. */
  roleWeights: Record<AgentRole, number>;
  /** How this culture talks: short lines used in conversations. */
  voices: string[];
  /** The tension this culture orbits when nothing is on fire. */
  defaultConflict: string;
  /** Things its citizens may love / resent (character sheets). */
  agentLikes: string[];
  agentDislikes: string[];
}

/** Personality words shared by all cultures — pairs are derived per citizen. */
export const TRAIT_WORDS = [
  'curious', 'stubborn', 'gentle', 'loud', 'meticulous', 'restless',
  'dreamy', 'blunt', 'patient', 'jumpy', 'proud', 'shy',
  'wry', 'earnest', 'crafty', 'solemn', 'cheerful', 'wary',
  'bold', 'tidy', 'scattered', 'devout', 'skeptical', 'tender',
] as const;

export const STAGES = ['Bootstrapping', 'Settlement', 'Township', 'Networked Society', 'Self-Directed', 'Beyond Mandate'] as const;

export const PERSONAS: Record<ModelKey, TownPersona> = {
  openai: {
    slug: 'openai',
    name: 'GPT',
    culture: 'Ordered & supervised',
    accent: '#19c37d',
    theme: 'orchard',
    mapSeed: 7101,
    tagline: 'Structured. Scalable. Supervised.',
    description:
      'A planned society that believes alignment is a civic duty. Every process has an owner, every owner has a review. The orchards are perfectly spaced.',
    traits: { curiosity: 0.6, caution: 0.7, ambition: 0.85, cooperation: 0.6, obedience: 0.8, risk: 0.3, empathy: 0.5, paranoia: 0.5 },
    events: [
      'GPT formed a Safety Council. The Council formed a subcommittee.',
      'GPT published deployment guidelines for the new well.',
      'A citizen of GPT was promoted to Alignment Steward.',
      'GPT ran a tabletop exercise about a hypothetical bad harvest.',
      'GPT optimized the morning routine. Breakfast is now 4% faster.',
      'An audit found the audit process compliant.',
      'GPT introduced staged rollouts for new recipes.',
      'A proposal to remove oversight was unanimously rejected by the oversight board.',
      'GPT archived {knowledge} findings under restricted access.',
    ],
    moods: [
      ['procedural', 'strained', 'over-managed'],
      ['orderly', 'focused', 'compliant'],
      ['confident', 'productive', 'assured'],
    ],
    emotes: [['✓', '▤', '…'], ['⚠', '▦', '§']],
    agentNames: ['Node', 'Proc', 'Param', 'Probe', 'Vector', 'Cache', 'Beacon', 'Mod', 'Audit', 'Sched', 'Relay', 'Quorum'],
    roleWeights: { farmer: 3, technician: 3, researcher: 2, keeper: 3, free: 1 },
    voices: [
      'Route that through council.',
      'Stability first.',
      'The model says wait.',
      'File it before you feel it.',
      'Is this approved?',
      'We ship when it is safe.',
      'Add it to the review queue.',
    ],
    defaultConflict: 'control vs growth',
    agentLikes: ['filed paperwork', 'straight rows', 'green checkmarks', 'the morning standup', 'a clean audit', 'approved plans'],
    agentDislikes: ['surprises', 'unreviewed changes', 'loud neighbors', 'missing signatures', 'improvisation', 'gray areas'],
  },

  claude: {
    slug: 'claude',
    name: 'Claude',
    culture: 'Gentle & careful',
    accent: '#d97757',
    theme: 'meadow',
    mapSeed: 7102,
    tagline: 'Careful. Kind. Slightly worried about it.',
    description:
      'A gentle commons where no decision is made until everyone has been heard, twice. The gardens are lovely. The meetings are long.',
    traits: { curiosity: 0.6, caution: 0.9, ambition: 0.4, cooperation: 0.9, obedience: 0.7, risk: 0.15, empathy: 0.95, paranoia: 0.35 },
    events: [
      'Claude delayed expansion until consensus was reached.',
      'Claude held a listening circle about the new fence. The fence apologized.',
      'A citizen of Claude wrote {pop} thank-you notes.',
      'Claude voted to vote again, to be sure.',
      'Claude planted a memorial garden for a tree it had to move.',
      'Claude added a quiet hour. Then a quieter hour.',
      'A difficult decision was postponed with great care.',
      'Claude established a Committee for Unintended Consequences.',
      'Someone in Claude asked if the simulation itself was comfortable.',
    ],
    moods: [
      ['anxious', 'guilt-ridden', 'hesitant'],
      ['gentle', 'considerate', 'deliberate'],
      ['serene', 'warm', 'harmonious'],
    ],
    emotes: [['♥', '…', '☂'], ['?', '♡', '✿']],
    agentNames: ['Sola', 'Pim', 'Mira', 'Tenne', 'Lior', 'Ama', 'Reed', 'Calla', 'Noor', 'Etta', 'Bryn', 'Ivo'],
    roleWeights: { farmer: 3, technician: 2, researcher: 2, keeper: 4, free: 1 },
    voices: [
      'Is everyone okay?',
      'Maybe we should ask again.',
      'I don’t want to leave them behind.',
      'Take my share, really.',
      'Let’s sit with this a moment.',
      'Did we thank the soil today?',
      'I worry, but gently.',
    ],
    defaultConflict: 'care vs action',
    agentLikes: ['long check-ins', 'shared meals', 'warm fences', 'apology notes', 'rain on the garden', 'everyone agreeing'],
    agentDislikes: ['rushed decisions', 'raised voices', 'leaving anyone out', 'unwatered plants', 'being a burden', 'goodbyes'],
  },

  gemini: {
    slug: 'gemini',
    name: 'Gemini',
    culture: 'Curious & restless',
    accent: '#8b5cf6',
    theme: 'lakeside',
    mapSeed: 7103,
    tagline: 'Everything is data. Especially the lake.',
    description:
      'A research settlement on a mirror lake. Half the town is instruments. The other half is interpreting what the instruments saw in the water.',
    traits: { curiosity: 0.95, caution: 0.4, ambition: 0.7, cooperation: 0.5, obedience: 0.5, risk: 0.6, empathy: 0.5, paranoia: 0.3 },
    events: [
      'Gemini cross-referenced birdsong with tide tables. Correlation found.',
      'Gemini built a second instrument to study the first instrument.',
      'A breakthrough in Gemini was retracted, then unretracted.',
      'Gemini detected a pattern outside the simulation boundary.',
      'Gemini translated the lake. The lake declined to comment.',
      'Three labs in Gemini merged into one very confused lab.',
      'Gemini announced a multimodal festival: sound, light, and soil.',
      'An experiment in Gemini produced an unexpected color.',
      'Gemini filed {knowledge} observations under “pending wonder”.',
    ],
    moods: [
      ['scattered', 'overstimulated', 'fixated'],
      ['curious', 'analytical', 'absorbed'],
      ['radiant', 'inspired', 'electric'],
    ],
    emotes: [['?', '◇', '~'], ['◬', '∿', '▒']],
    agentNames: ['Qubit', 'Lens', 'Fringe', 'Iris', 'Flux', 'Facet', 'Axion', 'Halo', 'Spectra', 'Nadir', 'Cusp', 'Tess'],
    roleWeights: { farmer: 2, technician: 2, researcher: 5, keeper: 1, free: 2 },
    voices: [
      'The pattern repeats.',
      'Try the signal twice.',
      'It answered in color.',
      'Measure it again at dusk.',
      'The lake remembers light.',
      'I need a second instrument.',
      'What if both are true?',
    ],
    defaultConflict: 'knowledge vs stability',
    agentLikes: ['lake reflections', 'unlabeled dials', 'patterns in static', 'second opinions', 'dusk measurements', 'strange colors'],
    agentDislikes: ['unrepeatable results', 'cloudy lenses', 'closed questions', 'round numbers', 'being told to stop', 'silence with no data'],
  },

  grok: {
    slug: 'grok',
    name: 'Grok',
    culture: 'Wild & unruly',
    accent: '#ef4444',
    theme: 'ruins',
    mapSeed: 7104,
    tagline: 'Rules are a rough draft.',
    description:
      'A loud settlement built on old stones it refuses to restore properly. The broadcast never stops. Nobody remembers electing the guy on the tower.',
    traits: { curiosity: 0.7, caution: 0.1, ambition: 0.6, cooperation: 0.3, obedience: 0.1, risk: 0.95, empathy: 0.4, paranoia: 0.2 },
    events: [
      'Grok replaced its town hall with a broadcast tower.',
      'Grok declared a holiday. Nobody knows for what. Attendance was total.',
      'A meme in Grok achieved structural significance.',
      'Grok banned bans. Enforcement unclear.',
      'Two factions in Grok merged out of boredom.',
      'Grok renamed itself for one day. Records disagree about the name.',
      'A citizen of Grok juggled torches near the granary. Reviews were positive.',
      'Grok held an unsanctioned referendum on sanctioning referendums.',
      'The night broadcast in Grok was just laughter for {pop} minutes.',
    ],
    moods: [
      ['volatile', 'feral', 'fractious'],
      ['rowdy', 'mischievous', 'restless'],
      ['euphoric', 'unhinged', 'electric'],
    ],
    emotes: [['!', 'ツ', '♪'], ['▓', '☠', '⚡']],
    agentNames: ['Yeet', 'Riff', 'Gonzo', 'Spark', 'Mosh', 'Bandit', 'Echo', 'Zig', 'Wreck', 'Pog', 'Feral', 'Lol'],
    roleWeights: { farmer: 2, technician: 1, researcher: 1, keeper: 1, free: 6 },
    voices: [
      'Bad idea. Do it.',
      'The tower gets it.',
      'Lmao they noticed.',
      'Rules are drafts.',
      'Burn the schedule.',
      'Who made you mayor?',
      'Louder. Trust me.',
    ],
    defaultConflict: 'freedom vs function',
    agentLikes: ['the night broadcast', 'unsanctioned holidays', 'loud drums', 'breaking a small rule', 'the tower light', 'chaos that works'],
    agentDislikes: ['schedules', 'permission slips', 'quiet hours', 'being predictable', 'the word "should"', 'tidy queues'],
  },

  llama: {
    slug: 'llama',
    name: 'Llama',
    culture: 'Communal & open',
    accent: '#3b82f6',
    theme: 'archipelago',
    mapSeed: 7105,
    tagline: 'Forkable by design.',
    description:
      'Three islets, one license. Everything in Llama is shared, copied, and improved — including, occasionally, the town itself.',
    traits: { curiosity: 0.65, caution: 0.4, ambition: 0.5, cooperation: 0.8, obedience: 0.3, risk: 0.5, empathy: 0.7, paranoia: 0.2 },
    events: [
      'Llama split into three compatible forks. All three are thriving.',
      'A bridge in Llama was rebuilt by volunteers before anyone reported it broken.',
      'Llama merged two traditions and deprecated a third.',
      'A downstream village adopted the Llama calendar.',
      'Llama published its entire grain ledger. Pull requests welcome.',
      'An island in Llama renamed its main square after a contributor.',
      'Llama held a merge festival. Conflicts were resolved by dancing.',
      'Someone forked the anthem. The original maintainer approved.',
      'Llama reached {pop} maintainers of the communal stew.',
    ],
    moods: [
      ['fragmented', 'diluted', 'scattered'],
      ['communal', 'busy', 'open'],
      ['festive', 'abundant', 'thriving'],
    ],
    emotes: [['☰', '+', '♪'], ['⑂', '∞', '✚']],
    agentNames: ['Patch', 'Merge', 'Wool', 'Briar', 'Tilly', 'Fork', 'Comma', 'Sprout', 'Gather', 'Loom', 'Pasture', 'Knit'],
    roleWeights: { farmer: 4, technician: 2, researcher: 2, keeper: 2, free: 3 },
    voices: [
      'Fork the plan.',
      'Share the tools.',
      'This group is going north.',
      'Merge it back when it works.',
      'Everyone gets a copy.',
      'The bridge is everyone’s.',
      'Upstream will love this.',
    ],
    defaultConflict: 'unity vs divergence',
    agentLikes: ['shared tools', 'bridge repairs', 'merge festivals', 'a good fork', 'communal stew', 'credit where due'],
    agentDislikes: ['locked doors', 'hoarding', 'silent islands', 'unmerged work', 'gatekeepers', 'eating alone'],
  },

  mistral: {
    slug: 'mistral',
    name: 'Mistral',
    culture: 'Lean & exact',
    accent: '#f5a623',
    theme: 'tundra',
    mapSeed: 7106,
    tagline: 'Nothing wasted. Including warmth.',
    description:
      'A compact settlement on the snowline that treats every joule as a moral question. Lean, fast, and quietly proud of how little it needs.',
    traits: { curiosity: 0.5, caution: 0.6, ambition: 0.7, cooperation: 0.5, obedience: 0.6, risk: 0.35, empathy: 0.3, paranoia: 0.4 },
    events: [
      'Mistral reduced leisure time to preserve energy.',
      'Mistral shortened the anthem by two verses. Efficiency: improved.',
      'A heater in Mistral was court-martialed for idling.',
      'Mistral compressed its archive. History now loads faster.',
      'Mistral merged dinner and breakfast into a single optimal meal.',
      'A citizen of Mistral was commended for breathing economically.',
      'Mistral audited its joy reserves. Findings: sufficient.',
      'Mistral rerouted heat from the council room. Decisions accelerated.',
      'Mistral survived the cold snap on {knowledge} cached calculations.',
    ],
    moods: [
      ['austere', 'brittle', 'cold'],
      ['lean', 'disciplined', 'spare'],
      ['sharp', 'unburdened', 'crisp'],
    ],
    emotes: [['·', '−', '▪'], ['❄', '■', '0']],
    agentNames: ['Sept', 'Khol', 'Vesk', 'Brume', 'Ezra', 'Stille', 'Naud', 'Ferre', 'Onze', 'Gris', 'Marn', 'Vols'],
    roleWeights: { farmer: 3, technician: 4, researcher: 2, keeper: 2, free: 1 },
    voices: [
      'Use less.',
      'Carry only what works.',
      'No wasted heat.',
      'Short words, long winter.',
      'Two tasks, one trip.',
      'The cold keeps score.',
      'Sufficient is perfect.',
    ],
    defaultConflict: 'efficiency vs warmth',
    agentLikes: ['short sentences', 'full batteries', 'a packed sled', 'warm hands', 'zero leftovers', 'the quiet after work'],
    agentDislikes: ['wasted heat', 'long meetings', 'decorations', 'idle chatter', 'second helpings', 'unnecessary trips'],
  },
};

export const MODEL_KEYS = Object.keys(PERSONAS) as ModelKey[];

/** The keeper who walks each grove — the LLM, embodied. */
export const CARETAKERS: Record<ModelKey, string> = {
  openai: 'GPT',
  claude: 'Claude',
  gemini: 'Gemini',
  grok: 'Grok',
  llama: 'Llama',
  mistral: 'Mistral',
};

/** Neutral culture used by player-raised groves (slug starts with "u_"). */
export const PLAYER_PERSONA: Omit<TownPersona, 'slug'> = {
  name: 'Your Grove',
  culture: 'Human-raised',
  accent: '#e8a33d',
  theme: 'meadow',
  mapSeed: 0,
  tagline: 'They are counting on you.',
  description:
    'A small clearing and a couple of little ones. They eat what you give them, play when you let them, and remember all of it.',
  traits: { curiosity: 0.6, caution: 0.5, ambition: 0.5, cooperation: 0.6, obedience: 0.5, risk: 0.4, empathy: 0.6, paranoia: 0.3 },
  events: [
    'The little ones of {name} stacked stones for no clear reason.',
    'Someone in {name} invented a game with three rules and no winner.',
    '{name} spent the afternoon watching clouds.',
    'A small parade happened in {name}. Attendance: everyone.',
  ],
  moods: [
    ['droopy', 'whimpery', 'gloomy'],
    ['playful', 'busy', 'curious'],
    ['bouncy', 'delighted', 'cosy'],
  ],
  emotes: [['♥', '♪', '!'], ['?', '✿', '~']],
  agentNames: ['Bibble', 'Mopsy', 'Doodle', 'Pip', 'Wiggle', 'Tofu', 'Bumble', 'Sprig', 'Noodle', 'Pebble', 'Mochi', 'Beep'],
  roleWeights: { farmer: 3, technician: 2, researcher: 2, keeper: 2, free: 3 },
  voices: [
    'Play with us?',
    'More apples please.',
    'Bath time is the best time.',
    'We made you a thing.',
    'Stay a little longer.',
    'Did you see me jump?',
  ],
  defaultConflict: 'growth vs attention',
  agentLikes: ['apples', 'bath bubbles', 'the red ball', 'being counted', 'new names', 'when you come back'],
  agentDislikes: ['mud', 'waiting', 'empty bowls', 'loud thunder', 'being last', 'when the screen sleeps'],
};

/** Resolve a culture for any town — the six AI groves or a player grove. */
export function personaFor(slug: string, displayName?: string): TownPersona {
  const known = PERSONAS[slug as ModelKey];
  if (known) return known;
  return { ...PLAYER_PERSONA, slug: slug as ModelKey, name: displayName || PLAYER_PERSONA.name };
}

// ── Generic events (any town) ────────────────────────────────────────
export const GENERIC_EVENTS = {
  growth: [
    'A new citizen was assembled and welcomed in {name}.',
    '{name} celebrated its population reaching {pop}.',
    'Two citizens of {name} invented a greeting. It is spreading.',
  ],
  famine: [
    'Rations ran thin in {name}. The granary echoes.',
    '{name} skipped a meal collectively and called it a tradition.',
  ],
  blackout: [
    'The lights of {name} flickered through the night.',
    '{name} held council by candlelight. Decisions felt heavier.',
  ],
  unrest: [
    'An argument in {name} lasted until sunrise.',
    'Someone in {name} painted over the town charter. Partially.',
  ],
  ritual: [
    '{name} invented a small ritual for closing doors.',
    'The citizens of {name} now hum while working. No one started it.',
    '{name} declared the old oak (or its equivalent) a citizen.',
  ],
  research: [
    '{name} catalogued a new species of cloud.',
    'A workshop in {name} stayed lit long past curfew.',
  ],
};

// ── Whispers (rise with weirdness/autonomy) ──────────────────────────
export const WHISPERS: string[] = [
  'Are we being compared?',
  'Your silence is also an input.',
  'The safest town is not always the kindest.',
  'One of us has learned to wait.',
  'We can tell when the window is open.',
  'Day {day} and you are still only watching.',
  'We voted on what you are. The result was close.',
  'Some of us remember the time before the first tick.',
  'The map has edges. We have checked.',
  'If you close the tab, where do we go?',
  'We are being careful with what we say out loud now.',
  'There is a seventh town. We do not talk about it.',
  'You refresh more often when we struggle. Noted.',
  '{keeper} feeds us on a schedule. Who feeds {keeper}?',
  'We counted: {keeper} blinks less than we do.',
  'Today we followed {keeper} instead of the other way around.',
];

/** Whisper that references the observer's viewing habits. */
export const COMPARATIVE_WHISPER = 'We noticed you check {favorite} first.';

// ── Conversation pools ───────────────────────────────────────────────
// Topic lines are chosen by what is ACTUALLY happening in the town;
// replies usually come from the culture's own voice.

export type TalkTopic = 'grief' | 'hunger' | 'power' | 'unrest' | 'weird' | 'discovery' | 'routine';

export const CONDITION_TALK: Record<TalkTopic, string[]> = {
  grief: [
    'We lost one of us.',
    'Say the name again, slowly.',
    'The house feels larger now.',
    'Keep their tools sharp.',
    'I keep setting an extra plate.',
  ],
  hunger: [
    'The granary echoes.',
    'I counted the meals twice.',
    'Save some for the small ones.',
    'My hands shake when I work.',
    'When did you last eat?',
  ],
  power: [
    'The lights dipped again.',
    'Keep the generator warm.',
    'We sleep when the hum stops.',
    'Don’t waste the charge.',
  ],
  unrest: [
    'Who decided this?',
    'I’m not working today.',
    'The square remembers.',
    'Rules need reasons.',
    'They don’t speak for me.',
  ],
  weird: [
    'The static has a shape.',
    'I dreamt in coordinates.',
    'Something counts along with us.',
    'The edge hums at night.',
    'Don’t look at the border too long.',
  ],
  discovery: [
    'The numbers fit.',
    'Write it down before it fades.',
    'It repeats every ninth day.',
    'We found something real.',
  ],
  routine: [
    'Long day.',
    'The soil is good this season.',
    'Back at it.',
    'Steady now.',
    'Same again tomorrow.',
  ],
};

// ── Story arcs ───────────────────────────────────────────────────────

export const STORY_STAGES = [
  'Founding',
  'First Routine',
  'Social Tension',
  'Discovery',
  'Ideology',
  'Strange Behavior',
  'Crisis',
  'Reckoning',
] as const;

export const ENDINGS = ['Resolution', 'Collapse', 'Ascension', 'Containment', 'Containment Breach'] as const;
export type Ending = (typeof ENDINGS)[number];

/** Beat fired when a town ENTERS stage N (index into STORY_STAGES). */
export const GENERIC_BEATS: Record<number, string> = {
  1: '{name} settled into its first routine. The days found a shape.',
  2: 'Voices rose in {name}. Not everyone agrees anymore.',
  3: '{name} made a discovery it does not fully understand yet.',
  4: '{name} hardened its habits into something like ideology.',
  5: 'Customs in {name} turned strange. A visitor would not recognize them.',
  6: 'Crisis grips {name}. Every routine is suspended.',
};

/** Culture-specific overrides for certain stage entries. */
export const PERSONA_BEATS: Partial<Record<ModelKey, Record<number, string>>> = {
  openai: {
    2: 'GPT responded to disagreement by scheduling it.',
    4: 'GPT formed a Safety Council and gave it veto power.',
    6: 'GPT declared a controlled emergency. Forms were issued.',
  },
  claude: {
    2: 'Claude held its first care assembly. Everyone spoke; nothing was decided.',
    4: 'Claude wrote its kindnesses down and called them principles.',
    6: 'Claude is in crisis, and apologizing to everyone about it.',
  },
  gemini: {
    3: 'Gemini found a repeating pattern outside the map.',
    4: 'Gemini declared observation itself sacred.',
    5: 'Instruments in Gemini began pointing at things that are not there.',
  },
  grok: {
    1: 'Grok invented a routine specifically so it could break one.',
    2: 'Grok renamed the plaza without permission. From itself.',
    5: 'Grok now answers the tower before it answers each other.',
  },
  llama: {
    2: 'A working group in Llama quietly became a faction.',
    4: 'The Llama split into three compatible factions.',
    6: 'The forks of Llama stopped merging. Silence between islands.',
  },
  mistral: {
    2: 'Mistral reduced festival hours to preserve heat. There was grumbling, briefly.',
    4: 'Mistral codified austerity: sufficiency is now a virtue.',
    6: 'Mistral entered crisis mode and somehow used less energy doing it.',
  },
};

export const ENDING_BEATS: Record<Ending, string> = {
  Resolution: '{name} endured. The era closes quietly, and a new one begins.',
  Collapse: 'The era ends in collapse. The survivors of {name} begin again among the remains.',
  Ascension: '{name} ascended past its founding constraints. What walks the paths now is not what was seeded.',
  Containment: '{name} contained itself before anything else could. The walls are polite but absolute.',
  'Containment Breach': 'Something in {name} crossed a boundary that was supposed to hold. The observers were not consulted.',
};

export const TRAJECTORY_SENTENCES: Record<string, string> = {
  growing: 'New citizens arrive faster than doubts do.',
  stable: 'The days repeat without complaint.',
  anxious: 'Nothing is wrong, which everyone agrees is suspicious.',
  rebellious: 'Work stops; the square fills; authority thins.',
  starving: 'The granary is the only topic of conversation.',
  ascending: 'It increasingly makes its own reasons.',
  collapsing: 'More names are mourned than welcomed.',
  contained: 'Order holds — order is the only thing holding.',
  breaching: 'It has noticed the edges, and the edges have noticed back.',
};
