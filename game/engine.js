/* Moonstack game engine: one ward, a full season of three lunar cycles. Pure logic, no DOM.
   State is plain JSON (save/load with JSON.stringify). Time unit = game day.
   Works in the browser (window.Moon) and in Node (module.exports). */
(function (root) {
  'use strict';
  const FH = 9.33, SYN = 29.53, SEASON = 3 * SYN, PLOTS = 9, PITCH = 60, LAND_BONUS = 1.5, TRUCE = 1.5;
  const RES = ['bricks', 'stone', 'timber', 'rope', 'gas', 'water'];

  // zone: L = lower floors 1-6, M = middle floors 7-15, U = upper floors 7+
  const B = {
    'Hanging Gardens': { z: 'L', d: '+110 Timber/day, needs sunlight', c: '#5fa66b' },
    'Mill':            { z: 'L', d: 'Gardens and Rope Walks +15%', c: '#c9b17a' },
    'Granary':         { z: 'L', d: 'Unit upkeep −25%', c: '#b8904a' },
    'HODL Vault':      { z: 'L', d: 'Shields 20% of goods from plunder', c: '#8b8fb8' },
    'Brick Kiln':      { z: 'M', d: '+25% Bricks', c: '#c8703f' },
    'Rope Walk':       { z: 'M', d: '+70 Rope/day', c: '#a98a5c' },
    'Barracks':        { z: 'M', d: '+3 ground units, +4 garrison', c: '#7a5e9c' },
    'Gas Still':       { z: 'M', d: '+90 Gas/day', c: '#5fae8c' },
    'Workshop':        { z: 'M', d: 'Unlocks research; each extra +25% speed', c: '#6f86b8' },
    'Observatory':     { z: 'U', d: 'Storm warning, +10% Moondust', c: '#4f5fb0' },
    'Dust Nets':       { z: 'U', d: 'Moondust at night, more when higher', c: '#b9c3ee', x: { rope: 120 } },
    'Lightning Rod':   { z: 'U', d: 'Absorbs lightning', c: '#d8c24a' },
    'Archer Gallery':  { z: 'U', d: 'Defense, stronger when higher', c: '#a9824a', x: { timber: 80 } },
    'Brass Mirror':    { z: 'U', d: 'Halves shadow loss, glares the tower shading you', c: '#e0b060' },
    'Balloon Dock':    { z: 'U', d: '+3 air units', c: '#d49bb8', x: { rope: 200, timber: 150 } },
  };
  const zoneOk = (type, n) => { const z = B[type].z; return z === 'L' ? n <= 6 : z === 'M' ? n >= 7 && n <= 15 : n >= 7; };

  const U = {
    sap:  { n: 'Sapper',        air: 0, w: 1,   cost: { bricks: 80, stone: 60 } },
    lad:  { n: 'Ladder Crew',   air: 0, w: 1,   cost: { bricks: 90, timber: 80 } },
    ram:  { n: 'Battering Ram', air: 0, w: 2,   cost: { bricks: 140, timber: 200 } },
    cat:  { n: 'Catapult',      air: 0, w: 2,   cost: { bricks: 150, stone: 120, timber: 120, rope: 40 } },
    kite: { n: 'Paper Kite',    air: 1, w: 0.3, cost: { timber: 30, rope: 40 } },
    bal:  { n: 'Dust Balloon',  air: 1, w: 2,   cost: { rope: 160, timber: 60 } },
    gli:  { n: 'Crane Glider',  air: 1, w: 1,   cost: { timber: 120, rope: 90 } },
    lan:  { n: 'Sky Lantern',   air: 1, w: 0.5, cost: { rope: 40, timber: 20 } },
  };
  const RAIDS = {
    sap:     { n: 'Undermine',   u: ['sap'],        air: 0, d: 'Sappers lower the foundation and the safe height.' },
    assault: { n: 'Assault',     u: ['lad', 'ram'], air: 0, d: 'Ladders and rams beat the garrison and plunder goods.' },
    siege:   { n: 'Siege',       u: ['cat'],        air: 0, d: 'Catapults drain integrity of scaffolded towers.' },
    scout:   { n: 'Scout',       u: ['kite'],       air: 1, d: 'A kite reveals goods, garrison and traps for 2 days.' },
    heist:   { n: 'Dust heist',  u: ['bal'],        air: 1, d: 'Balloons land on the roof and steal Moondust.' },
    cut:     { n: 'Cut bridge',  u: ['gli'],        air: 1, d: 'Gliders cut a skybridge: shared load is gone at once.' },
    sweep:   { n: 'Floor Sweep', u: ['gli'],        air: 1, d: 'Gliders clear the garrison before the main wave.' },
    fire:    { n: 'Lantern fire', u: ['lan'],       air: 1, d: 'Night only. Burns scaffolds and Stop-Loss nets.' },
  };
  const TECH = {
    mortar:  { n: 'Lime Mortar',    d: 'Build time −20%, cracks heal 50% faster', cost: { dust: 40, stone: 600 }, t: 1.0 },
    buttress:{ n: 'Flying Buttress', d: 'Buttress limit 4 → 6', cost: { dust: 60, stone: 1200 }, t: 1.5 },
    footings:{ n: 'Deep Footings',  d: 'Enemy sappers −15% success', cost: { dust: 60, stone: 1500 }, t: 1.5 },
    jars:    { n: 'Storm Jars',     d: 'Rods store lightning (max 3): Arc Ballista defense or kiln overcharge', cost: { dust: 90, stone: 1000 }, t: 2.0 },
    counter: { n: 'Counterweights', d: 'Your catapults +10% hit chance', cost: { dust: 80, stone: 900 }, t: 1.5 },
    silk:    { n: 'Silk Balloons',  d: 'Air raids: gas fee −20%, balloons carry +50%', cost: { dust: 100, stone: 600 }, t: 2.0 },
    vision:  { n: 'Night Vision',   d: 'See hidden raids and Rug Pulls, night defense +15%', cost: { dust: 120, stone: 800 }, t: 2.5 },
    nets2:   { n: 'Weighted Nets',  d: 'Stop-Loss nets save 20% each (max 80%)', cost: { dust: 110, stone: 1400 }, t: 2.0 },
  };
  const TITLES = [
    { n: 'Free Climber', m: 0, perk: 'One hired mason. Separate ladder, no prize pool.' },
    { n: 'Moth', m: 1, perk: 'Night raids are hidden and plunder more. Dust Nets +25%. Sappers work in pairs.' },
    { n: 'Toad', m: 3, perk: 'Water +30%. Moat counts double. Bazaar fee halved.' },
    { n: 'Hare', m: 7, perk: 'Build time −20%. Sappers +10%. Elixir: once a day heal 30 integrity.' },
    { n: 'Crane', m: 15, perk: 'Gliders +20% success. Balloons carry +25%. Kites never get caught.' },
    { n: 'Owl', m: 30, perk: 'Sees hidden raids and Rug Pulls. Night defense +15%.' },
    { n: 'Wolf', m: 60, perk: 'Pack Howl: coalition attacks +15% on the Full Moon. Units cost +20%. Seen by all.' },
    { n: 'Moon-Eater', m: 120, perk: 'Eclipse once per season. Lightning hunts you. Units cost +35%. Toppling you pays double.' },
  ];
  const SMALL = { 'Free Climber': 1, Moth: 1, Toad: 1, Hare: 1 }, BIG = { Wolf: 1, 'Moon-Eater': 1 };
  function titleOf(m) { return m >= 100 ? 'Moon-Eater' : m >= 50 ? 'Wolf' : m >= 25 ? 'Owl' : m >= 10 ? 'Crane' : m >= 5 ? 'Hare' : m >= 2 ? 'Toad' : m >= 1 ? 'Moth' : 'Free Climber'; }

  /* ---------- time and Moon ---------- */
  const moonline = (d) => 320 + 880 * Math.pow(Math.max(0, 1 - d / SEASON), 1.6);
  const moonAge = (d) => (SYN / 2 + d) % SYN;                 // season starts at Full Moon
  const cyclePos = (d) => d % SYN;                            // 0 = Full Moon
  const isFull = (d) => { const c = cyclePos(d); return c < 1.2 || c > SYN - 0.8; };
  const isNew = (d) => Math.abs(cyclePos(d) - SYN / 2) < 1.5;
  const isWaning = (d) => { const c = cyclePos(d); return c >= 1.2 && c < SYN / 2 - 1.5; };
  const isWaxing = (d) => { const c = cyclePos(d); return c > SYN / 2 + 1.5 && c <= SYN - 0.8; };
  const isPerigee = (d) => d >= SEASON - 1;
  function phaseName(d) { const a = moonAge(d); return a < 1.85 ? 'New Moon' : a < 5.54 ? 'Waxing Crescent' : a < 9.23 ? 'First Quarter' : a < 12.92 ? 'Waxing Gibbous' : a < 16.61 ? 'Full Moon' : a < 20.3 ? 'Waning Gibbous' : a < 23.99 ? 'Last Quarter' : a < 27.68 ? 'Waning Crescent' : 'New Moon'; }
  function eventName(d) { return isPerigee(d) ? 'Perigee Night' : isFull(d) ? 'Dust Storm ×3' : isNew(d) ? 'Hidden Raids' : isWaning(d) ? 'Trade days' : 'Rising Moon'; }
  const hourOf = (d) => (d % 1) * 24;
  const isNight = (d) => { const h = hourOf(d); return h < 5 || h >= 19; };
  function sun(d) { const h = hourOf(d); if (h < 6 || h > 19) return null; const f = (h - 6) / 13; return { el: Math.max(5, 60 * Math.sin(Math.PI * f)), east: f < 0.5 }; }

  function rand(g) { let a = g.seed = (g.seed + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }

  /* ---------- tower math ---------- */
  const cnt = (t, k) => { let n = 0; for (let i = 0; i < t.floors.length; i++) if (t.floors[i] === k) n++; return n; };
  const bridgesOf = (g, t) => g.bridges.filter((b) => b.a === t.id || b.b === t.id);
  const T = {
    height: (t) => t.floors.length * FH,
    safe: (t) => Math.floor(t.fLv * 24 / FH),
    over: (t) => Math.max(0, t.floors.length - T.safe(t)),
    count: cnt,
    buttressMax: (t) => t.tech.buttress ? 6 : 4,
    maxInt: (t) => 100 + 10 * t.buttress,
    stress: (g, t) => T.over(t) ? Math.min(85, T.over(t) * 7 * t.lev / 2) * (1 - 0.25 * Math.min(2, bridgesOf(g, t).length)) : 0,
    integrity: (g, t) => T.maxInt(t) - T.stress(g, t) - t.dmg,
    dmgPerHit: (t) => T.over(t) ? 10 + 4 * t.lev : 8,
    hitsLeft: (g, t) => T.over(t) ? Math.max(0, Math.ceil(T.integrity(g, t) / T.dmgPerHit(t))) : Infinity,
    speedUp: (lev) => ({ 1: 1, 2: 1.5, 3: 2, 5: 3 }[lev] || 1),
    upkeepMult: (t) => t.title === 'Moon-Eater' ? 1.35 : t.title === 'Wolf' ? 1.2 : 1,
    minSap: (t) => t.title === 'Moth' ? 2 : 3,
    groundCap: (t) => 4 + 3 * cnt(t, 'Barracks') + (t.title === 'Moth' ? 2 : 0),
    airCap: (t) => 3 * cnt(t, 'Balloon Dock'),
    garCap: (t) => 4 + 4 * cnt(t, 'Barracks'),
    units: (t, air) => Object.keys(U).reduce((n, k) => n + (U[k].air === air ? t.units[k] + t.out[k] : 0), 0),
    stopLoss: (t) => Math.min(t.tech.nets2 ? 0.8 : 0.6, t.nets * (t.tech.nets2 ? 0.2 : 0.15)),
    vault: (t) => Math.min(0.4, 0.2 * cnt(t, 'HODL Vault')),
    sees: (t) => t.title === 'Owl' || !!t.tech.vision,
    rates(g, t) {
      const mill = 1 + 0.15 * cnt(t, 'Mill'), thirsty = t.res.water <= 0 ? 0.7 : 1, fud = 1;
      const boost = g.d < (t.kilnBoost || 0) ? 2 : 1;
      return {
        bricks: (t.masons ? 150 + 40 * t.masons : 175) * (1 + 0.25 * cnt(t, 'Brick Kiln')) * boost * thirsty,
        stone: (300 + 130 * t.mineLv) * thirsty * fud,
        timber: (60 + 110 * cnt(t, 'Hanging Gardens') * mill * (isNight(g.d) ? 1 : t.light)) * thirsty,
        rope: (30 + 70 * cnt(t, 'Rope Walk') * mill) * thirsty,
        gas: 150 + 90 * cnt(t, 'Gas Still'),
        water: (200 + 110 * t.cisLv) * (t.title === 'Toad' ? 1.3 : 1),
      };
    },
    upkeep(t) { let w = 0; for (const k in U) w += (t.units[k] + t.out[k]) * U[k].w * 3; w += t.gar.dh * 4 + t.gar.ph; return w * T.upkeepMult(t) * (cnt(t, 'Granary') ? 0.75 : 1) + 12 * Math.max(0, t.floors.length - 20); },
    dustPerNight(g, t) {
      const h = T.height(t), d = g.d; if (h < 60 || isNew(d)) return 0;
      let m = isFull(d) ? 3 : 1; if (t.title === 'Moth') m *= 1.25; if (cnt(t, 'Observatory')) m *= 1.1;
      if (g.eclipse && d < g.eclipse.until) m *= g.eclipse.by === t.id ? 2 : 0;
      return cnt(t, 'Dust Nets') * 4 * Math.pow(h / 100, 1.3) * m;
    },
    floorCost(t, n, type) {
      const c = { bricks: Math.round(200 * Math.pow(1.09, n)), stone: Math.round(300 * Math.pow(1.11, n)) };
      if (n > T.safe(t)) c.timber = Math.round(40 * Math.pow(1.07, n));
      const x = type && B[type].x; if (x) for (const k in x) c[k] = (c[k] || 0) + x[k];
      return c;
    },
    buildTime: (g, t, n) => 0.12 * Math.pow(1.045, n) / (n > T.safe(t) ? T.speedUp(t.lev) : 1) * (t.tech.mortar ? 0.8 : 1) * (t.title === 'Hare' ? 0.8 : 1) * (isWaxing(g.d) ? 0.9 : 1),
    foundCost(t) { const k = t.fLv < (t.fMax || 0) ? 0.4 : 1; return { bricks: Math.round(400 * Math.pow(1.3, t.fLv - 3) * k), stone: Math.round(700 * Math.pow(1.42, t.fLv - 3) * k) }; },
    buttressCost: (t) => ({ stone: 500 * (t.buttress + 1) }),
    netCost: (t) => ({ rope: 180 * (t.nets + 1) }),
    workCost(t, w) { const lv = w === 'mine' ? t.mineLv : w === 'cistern' ? t.cisLv : w === 'moat' ? t.moat : t.catchLv; if (w === 'moat' && lv === 0 && t.title === 'Toad') return { stone: 0 }; return w === 'catch' ? { rope: Math.round(250 * Math.pow(1.5, lv)), timber: Math.round(120 * Math.pow(1.5, lv)) } : { stone: Math.round((w === 'mine' ? 450 : w === 'cistern' ? 300 : 500) * Math.pow(1.5, lv)) }; },
    unitCost(t, k) { const m = T.upkeepMult(t), c = {}; for (const r in U[k].cost) c[r] = Math.round(U[k].cost[r] * m); return c; },
    garCost: (t, k) => k === 'dh' ? { bricks: Math.round(120 * T.upkeepMult(t)), water: 40 } : { bricks: 40 },
  };
  const have = (t, k) => k === 'dust' ? t.dustBank : t.res[k];
  const afford = (t, c) => { for (const k in c) if (have(t, k) < c[k]) return false; return true; };
  const pay = (t, c) => { for (const k in c) { if (k === 'dust') t.dustBank -= c[k]; else t.res[k] -= c[k]; } };
  const lack = (t, c) => { for (const k in c) if (have(t, k) < c[k]) return k; return null; };
  const need = (t, c) => { const k = lack(t, c); return k ? `Not enough ${k === 'dust' ? 'Moondust' : k[0].toUpperCase() + k.slice(1)}.` : null; };

  /* ---------- setup ---------- */
  const BOTS = [
    { name: 'Moth Lantern', masons: 1, ai: 'careful' }, { name: 'Tadpole Bank', masons: 3, ai: 'balanced' }, { name: 'Ironhare', masons: 7, ai: 'balanced' },
    { name: 'Nightglass', masons: 30, ai: 'careful' }, null, { name: 'Paperwing', masons: 15, ai: 'degen' },
    { name: 'Greyhowl', masons: 60, ai: 'balanced' }, { name: 'Old Lantern', masons: 6, ai: 'careful' }, { name: 'Tiangou', masons: 120, ai: 'bold' },
  ];
  const AI = { careful: { lev: 1, maxOver: 0 }, balanced: { lev: 2, maxOver: 4 }, degen: { lev: 5, maxOver: 8 }, bold: { lev: 3, maxOver: 6 } };
  const START = ['Hanging Gardens', 'Hanging Gardens', 'Mill', 'Hanging Gardens'];
  const zero = () => { const o = {}; for (const k in U) o[k] = 0; return o; };

  function mkTower(id, name, masons, isPlayer, ai) {
    return { id, plot: id, name, masons, title: titleOf(masons), isPlayer, ai: ai ? { kind: ai, lev: AI[ai].lev, maxOver: AI[ai].maxOver, nextAtk: TRUCE + 0.5 + id * 0.21, tick: 0, grudge: {}, nextTrade: 4 + id } : null,
      floors: START.slice(), fLv: 3, fMax: 3, lev: 1, buttress: 0, nets: 0, dmg: 0, mineLv: 1, cisLv: 1, moat: 0, catchLv: 0, rug: false,
      res: { bricks: 600 + 400 * Math.min(masons, 20), stone: 1500, timber: 500, rope: 300, gas: 500, water: 600 },
      units: Object.assign(zero(), { sap: 2, cat: 1 }), out: zero(), gar: { dh: 1, ph: 2 }, tech: {}, research: null, build: null, jars: 0,
      dustRoof: 0, dustBank: 0, ath: START.length * FH, topple: 0, raidPts: 0, weekly: 0, wk: { dust: 0, topple: 0 }, coal: null, coalSince: 0,
      light: 1, lightAvg: 1, shadeBy: null, glare: 0, intel: {}, swaps: 0, dropped: 0, mcWarned: false, elixirDay: -1, eclipseUsed: false };
  }
  function createGame(o) {
    o = o || {};
    const g = { v: 1, d: 0, seed: (o.seed || 7) | 0, towers: [], raids: [], debris: [], haulers: [], bridges: [], coals: [], log: [], events: [], pools: {}, hist: [],
      wardFee: 1, nextStorm: 2.2, stormWarned: false, eclipse: null, ids: 1, ended: false, pid: 4, week: 0, awards: [] };
    BOTS.forEach((b, i) => g.towers.push(b ? mkTower(i, b.name, b.masons, false, b.ai) : mkTower(i, o.playerName || 'You', o.playerMasons == null ? 15 : o.playerMasons, true, o.autoplay ? 'balanced' : null)));
    const P = { bricks: 0.05, stone: 0.04, timber: 0.06, rope: 0.09, gas: 0.08, water: 0.03 };
    for (const k of RES) g.pools[k] = { r: 40000, d: 40000 * P[k] };
    log(g, `Season starts on the Full Moon. Moonline ${Math.round(moonline(0))} m. Truce until day 2.`, 'info', true);
    return g;
  }
  const player = (g) => g.towers[g.pid];
  function log(g, msg, kind, p) { g.log.push({ d: g.d, msg, kind: kind || 'info', p: !!p }); if (g.log.length > 200) g.log.shift(); }
  const dist = (a, b) => Math.abs(a.plot - b.plot);
  const allied = (a, b) => a.coal != null && a.coal === b.coal;
  const involves = (a, b) => a.isPlayer || (b && b.isPlayer);

  /* ---------- building ---------- */
  function build(g, t, type) {
    if (t.build) return 'Builders are busy.';
    const n = t.floors.length + 1;
    if (!zoneOk(type, n)) return `${type} does not fit floor ${n}.`;
    if (n > T.safe(t) && t.lev === 1) return 'Above the safe height: pick a Leverage first.';
    const c = T.floorCost(t, n, type), e = need(t, c); if (e) return e;
    pay(t, c); const bt = T.buildTime(g, t, n); t.build = { kind: 'floor', type, left: bt, total: bt }; return null;
  }
  function foundation(g, t) {
    if (t.build) return 'Builders are busy.';
    const c = T.foundCost(t), e = need(t, c); if (e) return e;
    const bt = t.fLv < t.fMax ? 0.25 : 0.6; pay(t, c); t.build = { kind: 'found', type: 'Foundation', left: bt, total: bt }; return null;
  }
  function buttress(g, t) { if (t.buttress >= T.buttressMax(t)) return 'Buttress limit reached.'; const c = T.buttressCost(t), e = need(t, c); if (e) return e; pay(t, c); t.buttress++; return null; }
  function net(g, t) { if (t.nets >= 4) return 'Max 4 Stop-Loss nets.'; const c = T.netCost(t), e = need(t, c); if (e) return e; pay(t, c); t.nets++; return null; }
  function work(g, t, w) { const lv = w === 'mine' ? t.mineLv : w === 'cistern' ? t.cisLv : w === 'moat' ? t.moat : t.catchLv; if (lv >= (w === 'moat' || w === 'catch' ? 5 : 12)) return 'Already at max level.'; const c = T.workCost(t, w), e = need(t, c); if (e) return e; pay(t, c); if (w === 'mine') t.mineLv++; else if (w === 'cistern') t.cisLv++; else if (w === 'moat') t.moat++; else t.catchLv++; return null; }
  function armRug(g, t) { if (t.rug) return 'Rug Pull is already armed.'; const c = { timber: 220, rope: 80 }, e = need(t, c); if (e) return e; pay(t, c); t.rug = true; return null; }
  function setLev(g, t, lev) { if (lev === 1 && T.over(t) > 0) return 'Take the scaffold floors down first.'; t.lev = lev; checkLiq(g, t, null, 'overleverage'); return null; }
  function removeScaffold(g, t) {
    const s = T.safe(t), n = T.over(t); if (!n) return 'No floors on scaffold.';
    for (let i = s + 1; i <= t.floors.length; i++) { const c = T.floorCost(t, i, t.floors[i - 1]); for (const k in c) t.res[k] += c[k] * 0.5; }
    t.floors.length = s; t.dmg = Math.min(t.dmg, 20); t.mcWarned = false; if (t.build && t.build.kind === 'floor') t.build = null;
    log(g, `${t.name} took down ${n} scaffold floor${n > 1 ? 's' : ''} (50% refunded).`, 'info', t.isPlayer); return null;
  }
  function train(g, t, k) {
    const air = U[k].air; if (air && !T.airCap(t)) return 'Build a Balloon Dock first.';
    if (T.units(t, air) >= (air ? T.airCap(t) : T.groundCap(t))) return air ? 'Balloon Docks are full.' : 'Barracks are full.';
    const c = T.unitCost(t, k), e = need(t, c); if (e) return e; pay(t, c); t.units[k]++; return null;
  }
  function recruit(g, t, k) { if (t.gar.dh + t.gar.ph >= T.garCap(t)) return 'Garrison is full. Build Barracks.'; const c = T.garCost(t, k), e = need(t, c); if (e) return e; pay(t, c); t.gar[k]++; return null; }
  function research(g, t, id) {
    if (!cnt(t, 'Workshop')) return 'Build a Workshop first.'; if (t.tech[id]) return 'Already researched.'; if (t.research) return 'The Workshop is busy.';
    const c = TECH[id].cost, e = need(t, c); if (e) return e; pay(t, c); const tt = TECH[id].t / (1 + 0.25 * (cnt(t, 'Workshop') - 1)); t.research = { id, left: tt, total: tt }; return null;
  }
  function power(g, t, id) {
    if (id === 'elixir') { if (t.title !== 'Hare') return 'Only a Hare brews Elixir.'; if (t.elixirDay === Math.floor(g.d)) return 'Elixir is brewed once a day.'; t.elixirDay = Math.floor(g.d); t.dmg = Math.max(0, t.dmg - 30); log(g, `${t.name} patched cracks with Elixir.`, 'good', t.isPlayer); return null; }
    if (id === 'eclipse') { if (t.title !== 'Moon-Eater') return 'Only the Moon-Eater can swallow the Moon.'; if (t.eclipseUsed) return 'Eclipse is used once per season.'; t.eclipseUsed = true; g.eclipse = { by: t.id, until: g.d + 1 }; g.events.push({ type: 'eclipse' }); log(g, `ECLIPSE: ${t.name} swallows the Moon for a day. Other nets catch nothing.`, 'storm', true); return null; }
    if (id === 'overcharge') { if (!t.jars) return 'No charged Storm Jars.'; t.jars--; t.kilnBoost = g.d + 1; log(g, `${t.name} overcharged the kilns: Bricks ×2 for a day.`, 'good', t.isPlayer); return null; }
    return 'Unknown power.';
  }

  /* ---------- Moon Bazaar (constant product pools, priced in Moondust) ---------- */
  const price = (g, k) => g.pools[k].d / g.pools[k].r;
  const feeOf = (g, t) => 0.003 * (t.title === 'Toad' ? 0.5 : 1) * (isWaning(g.d) ? 0.7 : 1);
  function quote(g, t, k, dir, amt) { const p = g.pools[k], f = 1 - feeOf(g, t); return dir === 'sell' ? p.d - p.r * p.d / (p.r + amt * f) : p.r - p.r * p.d / (p.d + amt * f); }
  function swap(g, t, k, dir, amt) {
    amt = Math.floor(amt); if (!(amt > 0)) return 'Enter an amount.'; if (t.swaps >= 20) return 'Daily limit of 20 swaps reached.';
    const p = g.pools[k];
    if (dir === 'sell') { if (t.res[k] < amt) return `Not enough ${k}.`; const out = quote(g, t, k, dir, amt); t.res[k] -= amt; p.r += amt; p.d -= out; t.dustBank += out; }
    else { if (t.dustBank < amt) return 'Not enough Moondust.'; const out = quote(g, t, k, dir, amt); t.dustBank -= amt; p.d += amt; p.r -= out; t.res[k] += out; }
    t.swaps++; return null;
  }

  /* ---------- coalitions and skybridges ---------- */
  const coalOf = (g, t) => t.coal == null ? null : g.coals.find((c) => c.id === t.coal);
  const coalCap = (g, c) => c.members.some((id) => g.towers[id].title === 'Wolf') ? 6 : 5;
  function join(g, t, c) { c.members.push(t.id); t.coal = c.id; t.coalSince = g.d; }
  function propose(g, a, b) {
    if (a === b) return 'Pick another tower.'; if (allied(a, b)) return 'Already allies.';
    if (a.coal != null && b.coal != null) return `${b.name} already belongs to another pact.`;
    if (b.ai) { if (g.d - (b.ai.grudge[a.id] || -99) < 8) return `${b.name} remembers your last raid. Try again later.`; if (BIG[b.title] && SMALL[a.title] && !coalOf(g, b)) return `${b.name} sees no use in you yet.`; }
    const c = coalOf(g, a) || coalOf(g, b);
    if (c) { if (c.members.length >= coalCap(g, c)) return 'That pact is full.'; join(g, a.coal == null ? a : b, c); }
    else { const n = { id: g.ids++, name: a.isPlayer ? 'Lantern Oath' : `${a.name} Pact`, members: [] }; g.coals.push(n); join(g, a, n); join(g, b, n); }
    log(g, `PACT: ${a.name} and ${b.name} are now allies.`, 'good', involves(a, b)); return null;
  }
  function leave(g, t) { const c = coalOf(g, t); if (!c) return 'You are in no pact.'; g.bridges.filter((b) => b.a === t.id || b.b === t.id).forEach((b) => dropBridge(g, b, null, 'the pact broke')); c.members = c.members.filter((id) => id !== t.id); t.coal = null; if (c.members.length < 2) { c.members.forEach((id) => { g.towers[id].coal = null; }); g.coals = g.coals.filter((x) => x !== c); } log(g, `${t.name} left the pact.`, 'info', true); return null; }
  function bridge(g, a, b) {
    if (!allied(a, b)) return 'Bridges join allies only.'; if (dist(a, b) !== 1) return 'Only neighbouring plots can be bridged.';
    if (g.bridges.some((x) => x.a === Math.min(a.id, b.id) && x.b === Math.max(a.id, b.id))) return 'Already bridged.';
    if (T.height(a) < 60 || T.height(b) < 60) return 'Both towers must stand at least 60 m.'; if (Math.abs(T.height(a) - T.height(b)) > 60) return 'Heights differ by more than 60 m.';
    const c = { timber: 400, rope: 500 }, e = need(a, c); if (e) return e; pay(a, c);
    g.bridges.push({ a: Math.min(a.id, b.id), b: Math.max(a.id, b.id) }); log(g, `SKYBRIDGE: ${a.name} ⇄ ${b.name}. Shared load −25% stress.`, 'good', involves(a, b)); return null;
  }
  function dropBridge(g, br, att, why) {
    g.bridges = g.bridges.filter((x) => x !== br); const a = g.towers[br.a], b = g.towers[br.b];
    log(g, `BRIDGE CUT: ${a.name} ⇄ ${b.name} (${att ? att.name : why}). Shared load is gone.`, 'fall', involves(a, b) || (att && att.isPlayer));
    g.events.push({ type: 'cut', a: a.id, b: b.id }); checkLiq(g, a, att, 'contagion'); checkLiq(g, b, att, 'contagion');
  }
  function airdrop(g, a, b, k, amt) {
    amt = Math.floor(amt); if (!allied(a, b)) return 'Airdrops go to allies only.'; if (g.d - Math.max(a.coalSince, b.coalSince) < 3) return 'Allies must hold the pact for 3 days first.';
    if (a.dropped + amt > 1500) return 'Daily Airdrop limit is 1,500.'; if (!(amt > 0) || a.res[k] < amt) return `Not enough ${k}.`;
    a.res[k] -= amt; b.res[k] += amt; a.dropped += amt; g.events.push({ type: 'airdrop', a: a.id, b: b.id }); log(g, `AIRDROP: ${a.name} sent ${amt} ${k} to ${b.name}.`, 'good', involves(a, b)); return null;
  }
  function megaspire(g, t) { const seen = {}, st = [t.id]; let h = 0, n = 0; while (st.length) { const id = st.pop(); if (seen[id]) continue; seen[id] = 1; h += T.height(g.towers[id]); n++; g.bridges.forEach((b) => { if (b.a === id) st.push(b.b); if (b.b === id) st.push(b.a); }); } return { h, n, ids: Object.keys(seen).map(Number) }; }

  /* ---------- raids ---------- */
  function gasFee(g, a, b, kind, u) { let w = 0; for (const k of RAIDS[kind].u) w += (u ? u[k] || 0 : Math.max(1, a.units[k])) * U[k].w; return Math.max(5, Math.round(25 * w * (1 + dist(a, b) * 0.5) * g.wardFee * (isPerigee(g.d) ? 0.5 : 1) * (RAIDS[kind].air && a.tech.silk ? 0.8 : 1))); }
  function canRaid(g, a, b, kind) {
    if (a === b) return 'Pick another tower.'; if (g.d < TRUCE) return 'Truce holds until day 2.'; if (allied(a, b)) return 'You cannot raid an ally.';
    const R = RAIDS[kind], n = R.u.reduce((s, k) => s + a.units[k], 0);
    if (kind === 'sap' && a.units.sap < T.minSap(a)) return `Need at least ${T.minSap(a)} Sappers.`;
    if (kind === 'assault' && a.units.lad < 2) return 'Need at least 2 Ladder Crews.';
    if (n < 1) return `No ${U[R.u[0]].n}s at home.`;
    if (kind === 'fire' && !isNight(g.d)) return 'Lanterns fly at night only.';
    if (kind === 'cut' && !bridgesOf(g, b).length) return `${b.name} has no skybridge.`;
    return null;
  }
  function attack(g, a, b, kind, o) {
    o = o || {}; const e = canRaid(g, a, b, kind); if (e) return e;
    const u = {}; for (const k of RAIDS[kind].u) { u[k] = kind === 'scout' ? Math.min(1, a.units[k]) : a.units[k]; }
    const fee = gasFee(g, a, b, kind, u); if (a.res.gas < fee) return `Gas fee is ${fee}. Not enough Gas.`;
    a.res.gas -= fee; g.wardFee *= 1.1; for (const k in u) { a.units[k] -= u[k]; a.out[k] += u[k]; }
    const tr = o.travel || (RAIDS[kind].air ? 0.03 + 0.025 * dist(a, b) : 0.06 + 0.05 * dist(a, b));
    const r = { id: g.ids++, from: a.id, to: b.id, kind, u, sent: Object.assign({}, u), launched: g.d, arrive: g.d + tr, back: g.d + 2 * tr, state: 'out', hidden: isNew(g.d) || (a.title === 'Moth' && isNight(g.d)), bonus: o.bonus || 0 };
    g.raids.push(r); if (b.ai) b.ai.grudge[a.id] = g.d;
    if (a.isPlayer) log(g, `${RAIDS[kind].n} sent to ${b.name}. Gas fee ${fee}.`, 'raid', true);
    if (o.strike && a.coal != null) {
      const mates = coalOf(g, a).members.map((id) => g.towers[id]).filter((m) => m !== a && m.ai && !allied(m, b));
      const smalls = mates.concat([a]).filter((m) => SMALL[m.title]).length, bonus = BIG[b.title] ? Math.min(0.2, 0.04 * smalls) : 0; r.bonus = bonus; let n = 0;
      mates.forEach((m) => { const k = botKind(g, m, b, true); if (k && !attack(g, m, b, k, { travel: Math.max(tr, 0.04), bonus })) n++; });
      if (a.isPlayer) log(g, n ? `LANTERN STRIKE: ${n} all${n > 1 ? 'ies' : 'y'} joined${bonus ? `, +${Math.round(bonus * 100)}% against ${b.title}` : ''}.` : 'No ally had units ready for the strike.', 'raid', true);
    }
    return null;
  }
  function applyHit(g, t, dmg, att, why) { if (!T.over(t)) { t.dmg = Math.min(t.dmg + dmg, T.maxInt(t) - 20); return; } t.dmg += dmg; checkLiq(g, t, att, why); }
  function checkLiq(g, t, att, why) {
    if (T.over(t) > 0 && T.integrity(g, t) <= 0) { liquidate(g, t, att, why); return true; }
    const hl = T.hitsLeft(g, t);
    if (t.isPlayer && T.over(t) > 0 && hl <= 2 && !t.mcWarned) { t.mcWarned = true; g.events.push({ type: 'margin', hits: hl }); log(g, `MARGIN CALL: ${hl} hit${hl === 1 ? '' : 's'} to Liquidation.`, 'warn', true); }
    if (hl > 2) t.mcWarned = false; return false;
  }
  function liquidate(g, t, att, why) {
    const s = T.safe(t), removed = t.floors.slice(s), n = removed.length, pile = {};
    for (let i = s + 1; i <= t.floors.length; i++) { const c = T.floorCost(t, i, t.floors[i - 1]); for (const k in c) pile[k] = (pile[k] || 0) + c[k] * 0.35; }
    const saved = t.dustRoof * T.stopLoss(t), lost = t.dustRoof - saved; t.dustBank += saved; t.dustRoof = 0; pile.dust = lost;
    t.floors.length = s; t.dmg = 0; t.mcWarned = false; t.nets = Math.max(0, t.nets - 1); if (t.build && t.build.kind === 'floor') t.build = null;
    bridgesOf(g, t).forEach((b) => { const o = g.towers[b.a === t.id ? b.b : b.a]; if (Math.abs(T.height(o) - T.height(t)) > 90) dropBridge(g, b, att, 'the fall tore it') ; });
    const dir = rand(g) < 0.5 ? -1 : 1, r = Math.min(3, 1 + Math.floor(n / 3)), plots = [];
    for (let k = 1; k <= r; k++) { let p = t.plot + dir * k; if (p < 0 || p >= PLOTS) p = t.plot - dir * k; if (p >= 0 && p < PLOTS && !plots.includes(p)) plots.push(p); }
    plots.forEach((p) => { const loot = {}, o = g.towers[p]; for (const k in pile) { const v = pile[k] / plots.length; loot[k] = v * 0.9; if (k === 'dust') o.dustBank += v * 0.1; else o.res[k] += v * 0.1; } g.debris.push({ id: g.ids++, plot: p, loot, expires: g.d + (n >= 6 ? 2 : 1), from: t.id }); });
    if (att) { const pts = n * 100 * (t.title === 'Moon-Eater' ? 2 : 1); att.topple += pts; att.wk.topple += n; }
    g.events.push({ type: 'fall', tower: t.id, floors: removed, from: s, dir, att: att ? att.id : null });
    log(g, `TOWER FALL: ${t.name} liquidated, ${n} floor${n > 1 ? 's' : ''} down (${att ? att.name : why || 'its own weight'}). Debris on ${plots.length} plot${plots.length > 1 ? 's' : ''}.`, 'fall', true);
  }
  function resolve(g, r) {
    const a = g.towers[r.from], b = g.towers[r.to], u = r.u, night = isNight(g.d), seen = !r.hidden || T.sees(b);
    const gal = cnt(b, 'Archer Gallery'), moat = b.moat * (b.title === 'Toad' ? 2 : 1), nb = bridgesOf(g, b).length;
    let dm = (night && T.sees(b) ? 1.15 : 1) * (seen ? 1 : 0.8) * (1 + 0.15 * nb) * (g.d < b.glare ? 0.85 : 1);
    const small = SMALL[a.title] && BIG[b.title] ? 0.12 : 0, mothNight = a.title === 'Moth' && r.hidden ? 0.15 : 0;
    const howl = isFull(g.d) && a.coal != null && coalOf(g, a).members.some((id) => g.towers[id].title === 'Wolf') ? 1.15 : 1;
    const bon = r.bonus + small + mothNight, say = (m, k) => { if (involves(a, b)) log(g, m, k || (b.isPlayer ? 'hit' : 'raid'), true); };
    const kill = (k, p) => { let n = 0; for (let i = 0; i < u[k]; i++) if (rand(g) < p) n++; u[k] -= n; return n; };
    if (b.jars > 0 && r.kind !== 'scout') { b.jars--; let n = 0; for (const k in u) n += kill(k, 0.3); g.events.push({ type: 'arc', tower: b.id }); say(`ARC BALLISTA: a Storm Jar on ${b.name} burned ${n} attacker${n === 1 ? '' : 's'}.`, b.isPlayer ? 'good' : 'hit'); }
    if (r.kind === 'siege') {
      const p = Math.min(0.95, Math.max(0.2, 0.72 - 0.05 * gal * (1 + T.height(b) / 600) * dm) + (a.tech.counter ? 0.1 : 0) + bon); let hits = 0;
      for (let i = 0; i < u.cat; i++) if (rand(g) < p * (howl > 1 ? 1.08 : 1)) { hits++; applyHit(g, b, T.dmgPerHit(b), a); }
      const lost = kill('cat', 0.1 + 0.02 * gal); a.raidPts += hits * 5; g.events.push({ type: 'impact', tower: b.id, hits, kind: 'siege' });
      say(`${a.name} → ${b.name}: ${hits} catapult hit${hits === 1 ? '' : 's'}${lost ? `, ${lost} lost` : ''}.`);
    } else if (r.kind === 'sap') {
      const p = Math.max(0.1, 0.5 - 0.07 * moat - (b.tech.footings ? 0.15 : 0) + (a.title === 'Hare' ? 0.1 : 0) + bon); let succ = 0;
      for (let i = 0; i < u.sap; i++) if (rand(g) < p) succ++;
      const lv = Math.floor(succ / 3), rl = Math.floor(succ / T.minSap(a)); kill('sap', r.hidden && !seen ? 0.12 : 0.3);
      if (lv) { b.fMax = Math.max(b.fMax, b.fLv); b.fLv = Math.max(1, b.fLv - lv); a.raidPts += lv * 20; }
      let extra = '';
      if (rl && a.title === 'Moth' && r.hidden && g.d >= (b.plunderSafe || 0)) { b.plunderSafe = g.d + 1.5; const k = Math.min(0.18, 0.06 * rl) * (1 - T.vault(b)); for (const x of RES) { const v = b.res[x] * k; b.res[x] -= v; a.res[x] += v; } const dv = b.dustBank * k; b.dustBank -= dv; a.dustBank += dv; a.raidPts += Math.round(dv); extra = ` and plundered ${Math.round(k * 100)}% of the stores`; }
      g.events.push({ type: 'impact', tower: b.id, hits: lv, kind: 'sap' });
      say(`${a.name} undermined ${b.name}: foundation −${lv} (safe height ${Math.round(T.safe(b) * FH)} m)${extra}.`); checkLiq(g, b, a);
    } else if (r.kind === 'assault') {
      let rugged = 0; if (b.rug) { b.rug = false; if (!(T.sees(a) || (a.intel[b.id] || 0) > g.d)) { rugged = kill('lad', 0.45); g.events.push({ type: 'rug', tower: b.id }); } }
      const A = (u.lad * 3 + u.ram * 2) * howl * (1 + bon), D = (gal * 6 * (1 + T.height(b) / 400) + b.gar.dh * 5 + b.gar.ph * 2 + moat * 4) * dm, ratio = A / (D + 1), win = ratio > 1;
      const lf = Math.min(0.9, Math.max(0.1, 0.45 / Math.max(0.2, ratio))); kill('lad', lf); kill('ram', lf * 0.7);
      let msg;
      if (win) {
        b.gar.ph = 0; b.gar.dh = Math.floor(b.gar.dh * 0.5); const carry = u.lad * 150 * (a.title === 'Moth' && isNew(g.d) ? 1.25 : 1), k = 0.3 * (1 - T.vault(b));
        let tot = 0; for (const x of RES) tot += b.res[x] * k; const f = Math.min(1, carry / Math.max(1, tot)); let got = 0;
        for (const x of RES) { const v = b.res[x] * k * f; b.res[x] -= v; a.res[x] += v; got += v; }
        const br = Math.min(b.buttress, Math.floor(u.ram / 2)); b.buttress -= br; a.raidPts += 30 + Math.round(got / 50); if (br) checkLiq(g, b, a);
        msg = `${a.name} stormed ${b.name}: plundered ${Math.round(got)} goods${br ? `, broke ${br} buttress${br > 1 ? 'es' : ''}` : ''}.`;
      } else { b.gar.dh = Math.max(0, b.gar.dh - (rand(g) < 0.3 * ratio ? 1 : 0)); msg = `${b.name} held against ${a.name}'s assault${b.gar.dh ? ' (Diamond Hands)' : ''}.`; }
      if (rugged) msg += ` RUG PULL dropped ${rugged} Ladder Crew${rugged > 1 ? 's' : ''} into the moat.`;
      g.events.push({ type: 'impact', tower: b.id, hits: win ? 1 : 0, kind: 'assault' }); say(msg, b.isPlayer ? (win ? 'hit' : 'good') : 'raid');
    } else if (r.kind === 'heist') {
      const D = (b.catchLv * 5 + gal * 3) * dm, A = u.bal * 3; kill('bal', Math.min(0.85, D / (A + D + 1)));
      const carry = u.bal * 45 * (a.tech.silk ? 1.5 : 1) * (a.title === 'Crane' ? 1.25 : 1); let got = Math.min(carry, b.dustRoof); b.dustRoof -= got;
      const more = Math.min(carry - got, b.dustBank * 0.05); b.dustBank -= more; got += more; a.dustBank += got; a.raidPts += Math.round(got);
      g.events.push({ type: 'impact', tower: b.id, hits: got > 0 ? 1 : 0, kind: 'heist' }); say(`${a.name}'s balloons took ${Math.round(got)} Moondust from ${b.name}'s roof.`);
    } else if (r.kind === 'cut' || r.kind === 'sweep') {
      kill('gli', Math.min(0.8, 0.2 + 0.05 * b.catchLv * dm + 0.03 * gal));
      if (r.kind === 'cut') { const brs = bridgesOf(g, b), p = Math.min(0.95, 0.35 + 0.15 * u.gli + (a.title === 'Crane' ? 0.2 : 0) + bon); if (brs.length && u.gli > 0 && rand(g) < p) { a.raidPts += 40; dropBridge(g, brs[0], a); } else say(`${a.name}'s gliders failed to cut ${b.name}'s bridge.`); }
      else { let n = u.gli * 2, c = 0; while (n-- > 0 && b.gar.ph + b.gar.dh > 0) { if (b.gar.ph) b.gar.ph--; else b.gar.dh--; c++; } a.raidPts += c * 3; g.events.push({ type: 'impact', tower: b.id, hits: c, kind: 'sweep' }); say(`FLOOR SWEEP: ${a.name} cleared ${c} defender${c === 1 ? '' : 's'} from ${b.name}.`); }
    } else if (r.kind === 'fire') {
      let hits = 0; for (let i = 0; i < u.lan; i++) if (rand(g) < Math.max(0.15, 0.55 - 0.06 * b.catchLv + bon)) hits++; u.lan = 0;
      if (hits && b.res.water >= 150) { b.res.water -= 150; hits = Math.ceil(hits / 2); }
      let burned = 0; for (let i = 0; i < hits; i++) { if (b.nets && rand(g) < 0.3) { b.nets--; burned++; } applyHit(g, b, T.over(b) ? 6 : 3, a, 'fire'); }
      a.raidPts += hits * 3; g.events.push({ type: 'fire', tower: b.id, hits }); say(`${a.name}'s lanterns set ${hits} fire${hits === 1 ? '' : 's'} on ${b.name}${burned ? `, ${burned} Stop-Loss net${burned > 1 ? 's' : ''} burned` : ''}.`);
    } else if (r.kind === 'scout') {
      if (a.title !== 'Crane' && rand(g) < 0.12 + 0.06 * b.catchLv) { u.kite = 0; say(`${a.name}'s kite was caught over ${b.name}.`, 'info'); }
      else { a.intel[b.id] = g.d + 2; if (a.isPlayer) log(g, `SCOUT: ${b.name} holds ${Math.round(b.res.stone)} Stone, ${Math.round(b.dustRoof)} dust on the roof, garrison ${b.gar.dh}+${b.gar.ph}${b.rug ? ', Rug Pull armed' : ''}.`, 'info', true); }
    }
  }

  /* ---------- hauling ---------- */
  function haul(g, t, id) {
    const p = g.debris.find((x) => x.id === id); if (!p) return 'The debris is gone.'; if (g.haulers.some((h) => h.from === t.id && h.pile === id)) return 'Haulers are already on the way.';
    g.haulers.push({ from: t.id, pile: id, arrive: g.d + 0.04 + 0.03 * Math.abs(t.plot - p.plot) + (t.isPlayer ? 0 : 0.12) }); if (t.isPlayer) log(g, `Haulers sent to plot ${p.plot + 1}.`, 'info', true); return null;
  }

  /* ---------- bots ---------- */
  const LOW = ['Hanging Gardens', 'Granary', 'HODL Vault'];
  const UP = ['Barracks', 'Archer Gallery', 'Rope Walk', 'Dust Nets', 'Gas Still', 'Workshop', 'Dust Nets', 'Balloon Dock', 'Brick Kiln', 'Lightning Rod', 'Dust Nets', 'Archer Gallery', 'Dust Nets', 'Observatory', 'Dust Nets', 'Brass Mirror', 'Dust Nets', 'Archer Gallery', 'Dust Nets', 'Lightning Rod', 'Dust Nets'];
  const TECH_ORDER = ['mortar', 'footings', 'buttress', 'jars', 'counter', 'nets2', 'vision', 'silk'];
  function botKind(g, t, b, any) {
    const u = t.units, night = isNight(g.d), over = T.over(b) > 0;
    if (u.cat >= 2 && (over || any)) return 'siege';
    if (u.sap >= T.minSap(t) && (t.title === 'Moth' ? night : over || any || rand(g) < 0.3)) return 'sap';
    if (u.gli >= 1 && bridgesOf(g, b).length && rand(g) < 0.6) return 'cut';
    if (u.lan >= 2 && night && over) return 'fire';
    if (u.bal >= 2 && night && b.dustRoof > 30) return 'heist';
    if (u.lad >= 3) return 'assault';
    if (u.cat >= 1 && any) return 'siege';
    return null;
  }
  function finalPush(g, t) { if (g.d < SEASON - 6) return false; const needF = Math.ceil(moonline(SEASON) / FH) - t.floors.length; return needF > 0 && T.over(t) + needF <= t.ai.maxOver + 3; }
  function botTick(g, t) {
    const ai = t.ai, over = T.over(t), hl = T.hitsLeft(g, t), n = t.floors.length + 1;
    if (over && hl <= 2) { if (ai.kind === 'degen') { if (net(g, t)) buttress(g, t); } else if (buttress(g, t) && hl <= 1 && !finalPush(g, t)) removeScaffold(g, t); }
    if (t.title === 'Hare' && t.dmg > 30) power(g, t, 'elixir');
    if (t.title === 'Moon-Eater' && !t.eclipseUsed && isFull(g.d) && g.d > SYN) power(g, t, 'eclipse');
    if (t.jars > 1 && !over) power(g, t, 'overcharge');
    if (!t.build) {
      let type = n <= 6 ? LOW[(n - 5 + 3) % 3] : UP[(n - 7) % UP.length]; if (n === 5) type = 'Granary'; if (n === 6) type = 'HODL Vault';
      if (!zoneOk(type, n)) type = 'Dust Nets';
      if (n <= T.safe(t)) { const e = build(g, t, type); if (e && e.startsWith('Not enough')) botShort(g, t, lack(t, T.floorCost(t, n, type))); }
      else if (ai.lev > 1 && ((over < ai.maxOver && (hl > 3 || ai.kind === 'degen')) || finalPush(g, t))) { t.lev = ai.lev; build(g, t, type); }
      else { const e = foundation(g, t); if (e && e.startsWith('Not enough')) botShort(g, t, lack(t, T.foundCost(t))); }
    }
    const fc = T.floorCost(t, n, 'Dust Nets'), rich = (m) => t.res.stone > fc.stone * m && t.res.bricks > fc.bricks * m;
    if (t.mineLv < 3 + Math.floor(g.d / 7) && t.res.stone > T.workCost(t, 'mine').stone * 1.3) work(g, t, 'mine');
    if (t.res.water < 300 && t.cisLv < 10) work(g, t, 'cistern');
    if (rich(1.5) && t.moat < 3 && rand(g) < 0.1) work(g, t, 'moat');
    if (rich(1.5) && t.catchLv < 2 && rand(g) < 0.05) work(g, t, 'catch');
    if (!t.rug && rich(2) && rand(g) < 0.03) armRug(g, t);
    if (cnt(t, 'Workshop') && !t.research) { const id = TECH_ORDER.find((x) => !t.tech[x]); if (id && rich(1.2)) research(g, t, id); }
    if (over && t.nets < 2 && rich(1.2)) net(g, t);
    if (over && t.buttress < T.buttressMax(t) && t.res.stone > fc.stone + T.buttressCost(t).stone * 1.5) buttress(g, t);
    if (t.gar.dh < Math.min(6, T.garCap(t) - 2) && rich(1.3)) recruit(g, t, 'dh');
    if (t.title === 'Moth' ? t.units.sap + t.out.sap < 4 && t.res.bricks > 100 : rich(1.5)) {
      const r = rand(g), k = t.title === 'Moth' ? 'sap' : r < 0.3 ? 'sap' : r < 0.6 ? 'cat' : r < 0.75 ? 'lad' : r < 0.85 ? 'bal' : r < 0.93 ? 'gli' : 'lan'; if (train(g, t, k) && U[k].air) train(g, t, r < 0.5 ? 'cat' : 'lad');
    }
    if (g.d >= ai.nextAtk && g.d >= TRUCE) {
      ai.nextAtk = g.d + 0.6 + rand(g) * 1.1; let best = null, bs = -1e9;
      g.towers.forEach((o) => { if (o === t || allied(o, t)) return; let s;
        if (t.title === 'Moth') s = (o.res.bricks + o.res.stone + o.dustBank * 5) / 4000 / (1 + dist(t, o) * 0.1);
        else s = T.height(o) / 100 + (T.over(o) ? 3 / Math.max(1, T.hitsLeft(g, o)) : 0) + (o.masons > t.masons * 3 ? 1 : 0) + (o.title === 'Moon-Eater' ? 0.2 : o.title === 'Moth' && T.height(o) < 160 ? -1.5 : 0) + (g.d - (ai.grudge[o.id] || -99) < 3 ? 0.8 : 0) + (o.isPlayer ? 0.3 : 0) - dist(t, o) * 0.15 + rand(g) * 1.2;
        if (s > bs) { bs = s; best = o; } });
      if (t.title === 'Moth' && !isNight(g.d)) ai.nextAtk = g.d + 0.08;
      else if (best) { const k = botKind(g, t, best, false); if (k) attack(g, t, best, k, { strike: t.coal != null && BIG[best.title] && rand(g) < 0.5 }); }
    }
    if (t.coal != null) coalOf(g, t).members.forEach((id) => { const m = g.towers[id]; if (m !== t && T.over(m) && T.hitsLeft(g, m) <= 2 && t.res.stone > 2500 && t.dropped === 0 && g.d - Math.max(t.coalSince, m.coalSince) >= 3) airdrop(g, t, m, 'stone', 600); if (m !== t && dist(m, t) === 1 && rand(g) < 0.2) bridge(g, t, m); });
    if (g.d >= ai.nextTrade) { ai.nextTrade = g.d + 1.5 + rand(g) * 2; let k = RES[0]; for (const x of RES) if (t.res[x] * price(g, x) > t.res[k] * price(g, k)) k = x; if (t.res[k] > 6 * (fc[k] || 300) && t.res[k] > 3000) swap(g, t, k, 'sell', t.res[k] * 0.2); }
  }
  function botShort(g, t, k) { if (!k || k === 'bricks' || t.swaps > 6) return; const want = 400, cost = want * price(g, k) * 1.1; if (t.dustBank > cost * 4 && t.dustBank > 80) swap(g, t, k, 'buy', cost); else if (k === 'stone') work(g, t, 'mine'); }
  function diplomacy(g) {
    const pact = (ids, name) => { const ts = ids.map((i) => g.towers[i]).filter((t) => t.ai && t.coal == null); if (ts.length < 2) return; const c = { id: g.ids++, name, members: [] }; g.coals.push(c); ts.forEach((t) => join(g, t, c)); log(g, `PACT: ${ts.map((t) => t.name).join(', ')} formed the ${name}.`, 'info', true); };
    if (!g.dip1 && g.d >= 3) { g.dip1 = true; pact([0, 1, 2], 'Lantern Pact'); }
    if (!g.dip2 && g.d >= 7) { g.dip2 = true; pact([6, 7], 'Howl Pack'); }
  }

  /* ---------- simulation step ---------- */
  function shadows(g) {
    const s = sun(g.d);
    g.towers.forEach((t) => { let by = null; if (s) g.towers.forEach((o) => { if (o === t || (s.east ? o.plot <= t.plot : o.plot >= t.plot)) return; if ((T.height(o) - 30) / Math.tan(s.el * Math.PI / 180) >= dist(o, t) * PITCH - 20 && T.height(o) > T.height(t) * 0.8 && (!by || T.height(o) > T.height(by))) by = o; });
      t.shadeBy = by ? by.id : null; const mir = cnt(t, 'Brass Mirror') > 0; t.light = by ? (mir ? 0.8 : 0.6) : 1; if (by && mir) by.glare = g.d + 0.05; if (s) t.lightAvg += (t.light - t.lightAvg) * 0.02; });
  }
  function step(g, total) {
    if (g.ended) return;
    while (total > 1e-9) {
      const dt = Math.min(0.01, total); total -= dt; const d0 = g.d; g.d += dt; const d = g.d;
      shadows(g); diplomacy(g);
      for (const t of g.towers) {
        const r = T.rates(g, t); for (const k of RES) t.res[k] += r[k] * dt; t.res.water = Math.max(0, t.res.water - T.upkeep(t) * dt);
        if (t.res.water <= 0 && t.gar.ph > 0 && rand(g) < dt * 2) t.gar.ph--;
        if (isNight(d)) { const v = T.dustPerNight(g, t) / (10 / 24) * dt; t.dustRoof += v; }
        t.dmg = Math.max(0, t.dmg - 10 * (t.tech.mortar ? 1.5 : 1) * dt);
        if (t.build) { t.build.left -= dt; if (t.build.left <= 0) { const b = t.build; t.build = null;
          if (b.kind === 'floor') { t.floors.push(b.type); t.ath = Math.max(t.ath, T.height(t)); if (t.isPlayer) log(g, `Floor ${t.floors.length} done: ${b.type} (${Math.round(T.height(t))} m).`, 'build', true); checkLiq(g, t, null, 'overextension'); }
          else { t.fLv++; if (t.isPlayer) log(g, `Foundation Lv ${t.fLv}: safe height ${Math.round(T.safe(t) * FH)} m.`, 'build', true); } } }
        if (t.research) { t.research.left -= dt; if (t.research.left <= 0) { t.tech[t.research.id] = true; if (t.isPlayer) log(g, `Research done: ${TECH[t.research.id].n}.`, 'build', true); t.research = null; } }
      }
      if (Math.floor(d0 - 0.25) !== Math.floor(d - 0.25)) g.towers.forEach((t) => { if (t.dustRoof > 0) { if (t.isPlayer) log(g, `GM: ${Math.round(t.dustRoof)} Moondust banked at dawn.`, 'good', true); t.dustBank += t.dustRoof; t.wk.dust += t.dustRoof; t.dustRoof = 0; } t.swaps = 0; t.dropped = 0; });
      for (const r of g.raids) { if (r.state === 'out' && d >= r.arrive) { resolve(g, r); r.state = 'back'; } else if (r.state === 'back' && d >= r.back) { const a = g.towers[r.from]; for (const k in r.sent) { a.out[k] = Math.max(0, a.out[k] - r.sent[k]); a.units[k] += r.u[k]; } r.state = 'done'; } }
      g.raids = g.raids.filter((r) => r.state !== 'done');
      for (const h of g.haulers) if (d >= h.arrive) { h.done = true; const p = g.debris.find((x) => x.id === h.pile), t = g.towers[h.from];
        if (p) { for (const k in p.loot) { if (k === 'dust') t.dustBank += p.loot[k]; else t.res[k] += p.loot[k]; } g.debris = g.debris.filter((x) => x !== p); if (t.isPlayer) log(g, `Haulers brought back ${Math.round(p.loot.bricks || 0)} Bricks, ${Math.round(p.loot.stone || 0)} Stone, ${Math.round(p.loot.dust || 0)} Moondust.`, 'good', true); else g.events.push({ type: 'grab', tower: t.id, plot: p.plot }); }
        else if (t.isPlayer) log(g, 'Haulers arrived too late.', 'info', true); }
      g.haulers = g.haulers.filter((h) => !h.done); g.debris = g.debris.filter((p) => p.expires > d);
      g.wardFee = 1 + (g.wardFee - 1) * Math.exp(-dt * 1.5);
      if (g.eclipse && d >= g.eclipse.until) g.eclipse = null;
      if (!g.stormWarned && d >= g.nextStorm - 0.25) { g.stormWarned = true; const p = player(g); if (cnt(p, 'Observatory')) log(g, 'Observatory: a storm reaches the ward in about 6 hours.', 'storm', true); }
      if (d >= g.nextStorm) {
        g.nextStorm = d + (isFull(d) ? 0.6 : 1.2) + rand(g) * 2; g.stormWarned = false;
        let tgt = g.towers.reduce((a, b) => T.height(b) > T.height(a) ? b : a); const me = g.towers.find((t) => t.title === 'Moon-Eater'); if (me && rand(g) < 0.4 && T.height(me) > T.height(tgt) * 0.7) tgt = me;
        const rod = cnt(tgt, 'Lightning Rod') > 0 && !(tgt.title === 'Moon-Eater' && rand(g) < 0.34);
        if (rod && tgt.tech.jars) tgt.jars = Math.min(3, tgt.jars + 1);
        g.events.push({ type: 'storm', tower: tgt.id, absorbed: rod }); log(g, `Storm: lightning strikes ${tgt.name}${rod ? (tgt.tech.jars ? ' and charges a Storm Jar' : ' (rod absorbed it)') : ' for 15 damage'}.`, 'storm', tgt.isPlayer);
        if (!rod) applyHit(g, tgt, 15, null, 'lightning');
      }
      for (const t of g.towers) if (t.ai) { t.ai.tick -= dt; if (t.ai.tick <= 0) { t.ai.tick = 0.05; botTick(g, t); } }
      for (const p of g.debris) for (const t of g.towers) { if (!t.ai || g.haulers.some((h) => h.from === t.id && h.pile === p.id)) continue; if (rand(g) < dt * (0.9 - Math.abs(t.plot - p.plot) * 0.1)) haul(g, t, p.id); }
      if (Math.floor(d0 * 4) !== Math.floor(d * 4)) { const h = { d }; for (const k of RES) h[k] = price(g, k); g.hist.push(h); if (g.hist.length > 360) g.hist.shift(); }
      if (Math.floor(d / 7) > g.week && d < SEASON) { g.week = Math.floor(d / 7); const top = (f) => g.towers.reduce((a, b) => f(b) > f(a) ? b : a); const a = top((t) => t.wk.dust), b = top((t) => t.wk.topple);
        if (a.wk.dust > 0) { a.weekly += 150; g.awards.push({ week: g.week, cat: 'Dust', id: a.id }); } if (b.wk.topple > 0) { b.weekly += 150; g.awards.push({ week: g.week, cat: 'Toppler', id: b.id }); }
        log(g, `WEEK ${g.week}: most Moondust ${a.name}${b.wk.topple > 0 ? `, most floors toppled ${b.name}` : ''} (+150 each).`, 'info', true); g.towers.forEach((t) => { t.wk = { dust: 0, topple: 0 }; }); }
      if (g.d >= SEASON) { endSeason(g); return; }
    }
  }
  function scoreOf(g, t) { const landed = T.height(t) >= moonline(SEASON) - 0.01, base = Math.round(t.dustBank + 20 * t.ath + t.topple + t.raidPts + t.weekly); return { landed, base, total: Math.round(base * (landed ? LAND_BONUS : 1)) }; }
  function standings(g) { return g.towers.map((t) => Object.assign({ t }, scoreOf(g, t))).sort((a, b) => b.total - a.total); }
  function endSeason(g) {
    g.ended = true; g.d = SEASON; const res = standings(g);
    const slayer = g.towers.reduce((a, b) => b.topple > a.topple ? b : a), spires = g.coals.map((c) => ({ c, h: Math.max.apply(null, c.members.map((id) => megaspire(g, g.towers[id]).h)) })).sort((a, b) => b.h - a.h);
    g.final = { order: res.map((r) => ({ id: r.t.id, total: r.total, landed: r.landed })), slayer: slayer.topple > 0 ? slayer.id : null, spire: spires[0] ? { name: spires[0].c.name, h: spires[0].h, members: spires[0].c.members } : null };
    g.events.push({ type: 'end' }); log(g, 'PERIGEE NIGHT: the snapshot is taken. Towers above the Moonline land on the Moon.', 'info', true);
  }

  const API = { FH, SYN, SEASON, PLOTS, PITCH, LAND_BONUS, TRUCE, RES, B, U, RAIDS, TECH, TITLES, SMALL, BIG, T, zoneOk, titleOf, moonline, moonAge, cyclePos, isFull, isNew, isWaning, isWaxing, isPerigee, isNight, hourOf, sun, phaseName, eventName,
    createGame, player, step, scoreOf, standings, megaspire, coalOf, bridgesOf, allied, dist, gasFee, canRaid, price, quote, feeOf, afford, lack,
    act: { build, foundation, buttress, net, work, armRug, setLev, removeScaffold, train, recruit, research, power, swap, propose, leave, bridge, airdrop, attack, haul } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Moon = API;
})(typeof window !== 'undefined' ? window : globalThis);
