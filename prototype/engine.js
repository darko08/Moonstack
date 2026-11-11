/* Moonstack prototype engine: one ward, one lunar cycle. Pure logic, no DOM.
   Time unit = game day. Works in the browser (window.MoonEngine) and in Node (module.exports). */
(function (root) {
  'use strict';
  const FH = 9.33;                 // meters per floor
  const SEASON = 29.53;            // one lunar cycle, full moon to full moon
  const PLOTS = 9;

  const TYPES = {
    'Quarry Hoist':   { k: 'Q', desc: '+190 Stone/day' },
    'Brick Kiln':     { k: 'K', desc: '+25% Bricks' },
    'Gas Still':      { k: 'G', desc: '+90 Gas/day' },
    'Dust Nets':      { k: 'N', desc: 'Moondust at night, more when higher (60 m+)' },
    'Archer Gallery': { k: 'A', desc: '−6% enemy catapult hit chance' },
    'Barracks':       { k: 'B', desc: '+2 unit capacity' },
    'Lightning Rod':  { k: 'L', desc: 'Absorbs lightning' },
  };

  function titleOf(m) { return m >= 100 ? 'Moon-Eater' : m >= 50 ? 'Wolf' : m >= 25 ? 'Owl' : m >= 10 ? 'Crane' : m >= 5 ? 'Hare' : m >= 2 ? 'Toad' : 'Moth'; }
  function rngOf(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  const moonline = (d) => 225 + 600 * Math.pow(Math.max(0, 1 - d / SEASON), 1.6);
  const moonAge = (d) => (14.765 + d) % SEASON;               // season starts at full moon
  const isFull = (d) => { const a = moonAge(d); return a > 13.77 && a < 15.77; };
  const isNew = (d) => { const a = moonAge(d); return a < 1.5 || a > SEASON - 1.5; };
  function phaseName(d) { const a = moonAge(d); return a < 1.85 ? 'New Moon' : a < 5.54 ? 'Waxing Crescent' : a < 9.23 ? 'First Quarter' : a < 12.92 ? 'Waxing Gibbous' : a < 16.61 ? 'Full Moon' : a < 20.3 ? 'Waning Gibbous' : a < 23.99 ? 'Last Quarter' : a < 27.68 ? 'Waning Crescent' : 'New Moon'; }
  const hourOf = (d) => (d % 1) * 24;
  const isNight = (d) => { const h = hourOf(d); return h < 5 || h >= 19; };

  /* ---------- tower math ---------- */
  const T = {
    height: (t) => t.floors.length * FH,
    safe: (t) => Math.floor(t.fLv * 24 / FH),
    over: (t) => Math.max(0, t.floors.length - T.safe(t)),
    count: (t, k) => t.floors.reduce((n, f) => n + (f === k ? 1 : 0), 0),
    maxInt: (t) => 100 + 10 * t.buttress,
    stress: (t) => T.over(t) ? Math.min(85, T.over(t) * 7 * t.lev / 2) : 0,
    integrity: (t) => T.maxInt(t) - T.stress(t) - t.dmg,
    dmgPerHit: (t) => T.over(t) ? 10 + 4 * t.lev : 8,
    hitsLeft: (t) => T.over(t) ? Math.max(0, Math.ceil(T.integrity(t) / T.dmgPerHit(t))) : Infinity,
    cap: (t) => 2 + 2 * T.count(t, 'Barracks') + (t.title === 'Moth' ? 2 : 0),
    minSap: (t) => t.title === 'Moth' ? 2 : 3,
    speedUp: (lev) => ({ 1: 1, 2: 1.5, 3: 2, 5: 3 }[lev] || 1),
    bricksPerDay: (t) => (150 + t.masons * 40) * (1 + 0.25 * T.count(t, 'Brick Kiln')),
    stonePerDay: (t) => 420 + 12 * t.masons + 190 * T.count(t, 'Quarry Hoist'),
    gasPerDay: (t) => 220 + 90 * T.count(t, 'Gas Still'),
    dustPerNight: (t, d) => { const h = T.height(t); if (h < 60) return 0; return T.count(t, 'Dust Nets') * 4 * Math.pow(h / 100, 1.3) * (isFull(d) ? 3 : 1) * (t.title === 'Moth' ? 1.25 : 1); },
    floorCost: (n) => ({ bricks: Math.round(200 * Math.pow(1.09, n)), stone: Math.round(300 * Math.pow(1.11, n)) }),
    buildTime: (t, n) => 0.12 * Math.pow(1.045, n) / (n > T.safe(t) ? T.speedUp(t.lev) : 1),
    foundCost: (t) => ({ bricks: Math.round(400 * Math.pow(1.3, t.fLv - 4)), stone: Math.round(900 * Math.pow(1.45, t.fLv - 4)) }),
    buttressCost: (t) => ({ bricks: 0, stone: 500 * (t.buttress + 1) }),
    netCost: (t) => ({ bricks: 0, stone: 250 * (t.nets + 1) }),
    upkeep: (t) => t && t.title === 'Moon-Eater' ? 1.35 : t && t.title === 'Wolf' ? 1.2 : 1,
    unitCost: (kind, t) => { const m = T.upkeep(t); return kind === 'cat' ? { bricks: Math.round(150 * m), stone: Math.round(200 * m) } : { bricks: Math.round(80 * m), stone: Math.round(60 * m) }; },
  };
  const afford = (t, c) => t.bricks >= c.bricks && t.stone >= c.stone;
  const pay = (t, c) => { t.bricks -= c.bricks; t.stone -= c.stone; };

  /* ---------- setup ---------- */
  const BOTS = [
    { name: 'Moth Lantern', masons: 1, ai: 'careful' },
    { name: 'Tadpole Bank', masons: 3, ai: 'balanced' },
    { name: 'Ironhare', masons: 7, ai: 'balanced' },
    { name: 'Nightglass', masons: 30, ai: 'careful' },
    null, // player plot
    { name: 'Paperwing', masons: 15, ai: 'degen' },
    { name: 'Greyhowl', masons: 60, ai: 'balanced' },
    { name: 'Old Lantern', masons: 6, ai: 'careful' },
    { name: 'Tiangou', masons: 120, ai: 'degen' },
  ];
  const AI = { careful: { lev: 1, maxOver: 0 }, balanced: { lev: 2, maxOver: 4 }, degen: { lev: 5, maxOver: 8 } };
  const START = ['Quarry Hoist', 'Brick Kiln', 'Gas Still', 'Barracks', 'Archer Gallery', 'Quarry Hoist'];

  function mkTower(id, name, masons, isPlayer, ai) {
    return { id, plot: id, name, masons, title: titleOf(masons), isPlayer, ai: ai ? { kind: ai, ...AI[ai], nextAtk: 1 + id * 0.17, tick: 0 } : null,
      floors: START.slice(), fLv: 4, lev: 1, buttress: 0, nets: 0, dmg: 0,
      bricks: 1000 * Math.min(masons, 30), stone: 1500, gas: 600, cat: 1, sap: 2, catOut: 0, sapOut: 0,
      dustRoof: 0, dustBank: 0, ath: START.length * FH, topple: 0, raidPts: 0, build: null, mcWarned: false };
  }

  function createGame(opts) {
    opts = opts || {};
    const g = { d: 0, rng: rngOf(opts.seed || 7), towers: [], raids: [], debris: [], haulers: [], log: [], events: [], wardFee: 1, nextStorm: 1.2, pileId: 1, ended: false, lastDawnDay: 0 };
    BOTS.forEach((b, i) => { g.towers.push(b ? mkTower(i, b.name, b.masons, false, b.ai) : mkTower(i, opts.playerName || 'You', opts.playerMasons || 12, true, opts.autoplay ? 'balanced' : null)); });
    g.player = g.towers[4];
    log(g, `Season starts at Full Moon. Moonline ${Math.round(moonline(0))} m. Reach it by Perigee Night.`, 'info');
    return g;
  }

  function log(g, msg, kind, forPlayer) { g.log.push({ d: g.d, msg, kind: kind || 'info', p: !!forPlayer }); if (g.log.length > 120) g.log.shift(); }
  const dist = (a, b) => Math.abs(a.plot - b.plot);

  /* ---------- actions (player and bots) ---------- */
  function startBuild(g, t, type) {
    if (t.build) return 'Already building.';
    const n = t.floors.length + 1;
    if (n > T.safe(t) && t.lev === 1) return 'Above safe height: set Leverage first.';
    const c = T.floorCost(n); if (!afford(t, c)) return 'Not enough Bricks or Stone.';
    pay(t, c); t.build = { kind: 'floor', type, left: T.buildTime(t, n), total: T.buildTime(t, n) }; return null;
  }
  function startFoundation(g, t) {
    if (t.build) return 'Already building.';
    const c = T.foundCost(t); if (!afford(t, c)) return 'Not enough Bricks or Stone.';
    pay(t, c); t.build = { kind: 'found', type: 'Foundation', left: 0.5, total: 0.5 }; return null;
  }
  function addButtress(g, t) { if (t.buttress >= 4) return 'Max 4 buttresses.'; const c = T.buttressCost(t); if (!afford(t, c)) return 'Not enough Stone.'; pay(t, c); t.buttress++; return null; }
  function addNet(g, t) { if (t.nets >= 4) return 'Max 4 Stop-Loss nets.'; const c = T.netCost(t); if (!afford(t, c)) return 'Not enough Stone.'; pay(t, c); t.nets++; return null; }
  function setLev(g, t, lev) { if (lev === 1 && T.over(t) > 0) return 'Remove scaffold first.'; t.lev = lev; checkLiq(g, t, null); return null; }
  function removeScaffold(g, t) {
    const s = T.safe(t), n = T.over(t); if (!n) return 'No scaffold floors.';
    for (let i = s + 1; i <= t.floors.length; i++) { const c = T.floorCost(i); t.bricks += c.bricks * 0.5; t.stone += c.stone * 0.5; }
    t.floors.length = s; t.dmg = Math.min(t.dmg, 20); t.mcWarned = false;
    if (t.build && t.build.kind === 'floor') { /* keep queue */ }
    log(g, `${t.name} took down ${n} scaffold floor${n > 1 ? 's' : ''} (50% refunded).`, 'info', t.isPlayer); return null;
  }
  function train(g, t, kind) {
    const have = kind === 'cat' ? t.cat + t.catOut : t.sap + t.sapOut; if (have >= T.cap(t)) return 'Barracks full. Build Barracks.';
    const c = T.unitCost(kind, t); if (!afford(t, c)) return 'Not enough Bricks or Stone.'; pay(t, c); if (kind === 'cat') t.cat++; else t.sap++; return null;
  }
  const gasFee = (g, a, b, n) => Math.round(30 * n * (1 + dist(a, b) * 0.5) * g.wardFee);
  function attack(g, a, b, kind) {
    if (a === b) return 'Pick another tower.';
    const n = kind === 'cat' ? a.cat : a.sap; if (n < 1) return kind === 'cat' ? 'No catapults at home.' : 'No sappers at home.';
    if (kind === 'sap' && n < T.minSap(a)) return `Need at least ${T.minSap(a)} sappers.`;
    const fee = gasFee(g, a, b, n); if (a.gas < fee) return `Gas fee is ${fee}. Not enough Gas.`;
    a.gas -= fee; g.wardFee *= 1.125;
    if (kind === 'cat') { a.cat = 0; a.catOut += n; } else { a.sap = 0; a.sapOut += n; }
    const travel = 0.05 + 0.04 * dist(a, b);
    g.raids.push({ from: a.id, to: b.id, kind, n, sent: n, launched: g.d, arrive: g.d + travel, back: g.d + 2 * travel, state: 'out' });
    if (a.isPlayer) log(g, `${kind === 'cat' ? 'Catapult barrage' : 'Sappers'} (${n}) sent to ${b.name}. Gas fee ${fee}.`, 'raid', true);
    return null;
  }
  function haul(g, t, pileId) {
    const p = g.debris.find((x) => x.id === pileId); if (!p) return 'Debris is gone.';
    if (g.haulers.some((h) => h.from === t.id && h.pile === pileId)) return 'Haulers already on the way.';
    g.haulers.push({ from: t.id, pile: pileId, arrive: g.d + 0.03 + 0.03 * Math.abs(t.plot - p.plot) + (t.isPlayer ? 0 : 0.1) });
    if (t.isPlayer) log(g, `Haulers sent to debris at plot ${p.plot + 1}.`, 'info', true); return null;
  }

  /* ---------- combat & collapse ---------- */
  function applyHit(g, t, dmg, att, why) {
    if (!T.over(t)) { t.dmg = Math.min(t.dmg + dmg, T.maxInt(t) - 20); return; }
    t.dmg += dmg; checkLiq(g, t, att, why);
  }
  function checkLiq(g, t, att, why) {
    if (T.over(t) > 0 && T.integrity(t) <= 0) { liquidate(g, t, att, why); return true; }
    if (t.isPlayer && T.over(t) > 0 && T.hitsLeft(t) <= 2 && !t.mcWarned) { t.mcWarned = true; g.events.push({ type: 'margin', hits: T.hitsLeft(t) }); log(g, `MARGIN CALL: ${T.hitsLeft(t)} hit${T.hitsLeft(t) === 1 ? '' : 's'} to Liquidation.`, 'warn', true); }
    if (T.hitsLeft(t) > 2) t.mcWarned = false;
    return false;
  }
  function liquidate(g, t, att, why) {
    const s = T.safe(t), removed = t.floors.slice(s), n = removed.length;
    let b = 0, st = 0; for (let i = s + 1; i <= t.floors.length; i++) { const c = T.floorCost(i); b += c.bricks; st += c.stone; }
    b *= 0.35; st *= 0.35;
    const saved = t.dustRoof * Math.min(0.6, t.nets * 0.15); const lostDust = t.dustRoof - saved; t.dustBank += saved; t.dustRoof = 0;
    t.floors.length = s; t.dmg = 0; t.mcWarned = false; t.nets = Math.max(0, t.nets - 1);
    if (t.build && t.build.kind === 'floor') t.build = null;
    const dir = g.rng() < 0.5 ? -1 : 1; const r = Math.min(3, 1 + Math.floor(n / 3));
    const plots = []; for (let k = 1; k <= r; k++) { let p = t.plot + dir * k; if (p < 0 || p >= PLOTS) p = t.plot - dir * k; if (p >= 0 && p < PLOTS && !plots.includes(p)) plots.push(p); }
    const share = 1 / plots.length;
    plots.forEach((p) => {
      const pile = { id: g.pileId++, plot: p, bricks: b * share * 0.9, stone: st * share * 0.9, dust: lostDust * share * 0.9, expires: g.d + (n >= 6 ? 1.6 : 1), from: t.id };
      const owner = g.towers[p]; owner.bricks += b * share * 0.1; owner.stone += st * share * 0.1; owner.dustBank += lostDust * share * 0.1;
      g.debris.push(pile);
    });
    if (att) { const pts = n * 100 * (t.title === 'Moon-Eater' ? 2 : 1); att.topple += pts; }
    g.events.push({ type: 'fall', tower: t.id, floors: removed, from: s, dir, att: att ? att.id : null });
    const who = att ? att.name : (why || 'its own weight');
    log(g, `TOWER FALL: ${t.name} liquidated (${n} floor${n > 1 ? 's' : ''}) by ${who}. Debris on ${plots.length} plot${plots.length > 1 ? 's' : ''}.`, 'fall', t.isPlayer || (att && att.isPlayer));
  }
  const SMALL = { Moth: 1, Toad: 1, Hare: 1 }, BIG = { Wolf: 1, 'Moon-Eater': 1 };
  // Hidden Raid: a Moth that launches at night arrives unseen. Lantern bonus: small titles hit big ones harder.
  const hidden = (a, r) => a.title === 'Moth' && isNight(r.launched);
  const raidBonus = (g, a, b, r) => (hidden(a, r) ? 0.2 : 0) + (SMALL[a.title] && BIG[b.title] ? 0.12 : 0);
  function resolveRaid(g, r) {
    const a = g.towers[r.from], b = g.towers[r.to];
    if (r.kind === 'cat') {
      const gal = T.count(b, 'Archer Gallery'); const p = Math.min(0.95, Math.max(0.25, 0.72 - 0.06 * gal) + raidBonus(g, a, b, r)); let hits = 0;
      for (let i = 0; i < r.n; i++) if (g.rng() < p) { hits++; applyHit(g, b, T.dmgPerHit(b), a); }
      let lost = 0; for (let i = 0; i < r.n; i++) if (g.rng() < 0.12 + 0.02 * gal) lost++;
      r.n -= lost; a.raidPts += hits * 5;
      g.events.push({ type: 'impact', tower: b.id, hits, kind: 'cat' });
      if (a.isPlayer || b.isPlayer) log(g, `${a.name} → ${b.name}: ${hits} catapult hit${hits === 1 ? '' : 's'}${lost ? `, ${lost} lost` : ''}.`, b.isPlayer ? 'hit' : 'raid', true);
    } else {
      const hid = hidden(a, r); let succ = 0; for (let i = 0; i < r.n; i++) if (g.rng() < 0.5 + raidBonus(g, a, b, r)) succ++;
      const lv = Math.floor(succ / 3), raidLv = Math.floor(succ / T.minSap(a)); let lost = 0; for (let i = 0; i < r.n; i++) if (g.rng() < (hid ? 0.12 : 0.3)) lost++; r.n -= lost;
      if (lv) { b.fLv = Math.max(1, b.fLv - lv); a.raidPts += lv * 20; }
      g.events.push({ type: 'impact', tower: b.id, hits: lv, kind: 'sap' });
      if (raidLv && hid) { const k = Math.min(0.18, 0.06 * raidLv), loot = b.dustBank * k, lb = b.bricks * k, ls = b.stone * k; b.dustBank -= loot; b.bricks -= lb; b.stone -= ls; a.dustBank += loot; a.bricks += lb; a.stone += ls; a.raidPts += Math.round(loot); r.loot = { dust: loot, bricks: lb, stone: ls }; }
      if (a.isPlayer || b.isPlayer) log(g, `${a.name} undermined ${b.name}: foundation −${lv} (safe height ${Math.round(T.safe(b) * FH)} m).`, b.isPlayer ? 'hit' : 'raid', true);
      checkLiq(g, b, a);
    }
  }

  /* ---------- bots ---------- */
  const PATTERN = ['Dust Nets', 'Quarry Hoist', 'Archer Gallery', 'Dust Nets', 'Brick Kiln', 'Barracks', 'Dust Nets', 'Lightning Rod', 'Quarry Hoist', 'Dust Nets', 'Gas Still', 'Archer Gallery'];
  function botTick(g, t) {
    const ai = t.ai, h = T.height(t);
    // defend
    if (T.over(t) && T.hitsLeft(t) <= 2) {
      if (ai.kind === 'degen') { if (t.nets < 2) addNet(g, t); else addButtress(g, t); }
      else if (addButtress(g, t) && T.hitsLeft(t) <= 1) removeScaffold(g, t);
    }
    // build
    if (!t.build) {
      const n = t.floors.length + 1; let type = PATTERN[t.floors.length % PATTERN.length];
      if (type === 'Dust Nets' && h < 50) type = 'Quarry Hoist';
      if (n <= T.safe(t)) startBuild(g, t, type);
      else if (ai.lev > 1 && T.over(t) < ai.maxOver && (T.hitsLeft(t) > 3 || ai.kind === 'degen')) { t.lev = ai.lev; startBuild(g, t, type); }
      else startFoundation(g, t);
    }
    // army
    const reserve = T.floorCost(t.floors.length + 1);
    if (t.title === 'Moth' ? t.sap + t.sapOut < 4 && t.bricks > 100 : t.bricks > reserve.bricks * 1.6 && t.stone > reserve.stone * 1.3) train(g, t, t.title === 'Moth' || t.masons < 10 && g.rng() < 0.7 || g.rng() < 0.4 ? 'sap' : 'cat');
    if (t.nets < 1 && T.over(t) && t.stone > reserve.stone * 2) addNet(g, t);
    // attack
    if (g.d >= ai.nextAtk) {
      ai.nextAtk = g.d + 0.5 + g.rng() * 0.9;
      let best = null, bs = -1;
      g.towers.forEach((o) => { if (o === t) return; let s = T.height(o) / 100 + (T.over(o) ? 3 / Math.max(1, T.hitsLeft(o)) : 0) + (o.masons > t.masons * 3 ? 1 : 0) + (o.title === 'Wolf' ? 0.5 : o.title === 'Moon-Eater' ? 0.2 : o.title === 'Moth' && T.height(o) < 160 ? -1.5 : 0) + (o.isPlayer ? 0.5 : 0) - dist(t, o) * 0.15 + g.rng() * 1.2; if (s > bs) { bs = s; best = o; } });
      if (t.title === 'Moth') { best = g.towers.filter((o) => o !== t).reduce((x, o) => (o.bricks + o.stone + o.dustBank * 5) / (1 + dist(t, o) * 0.1) > (x.bricks + x.stone + x.dustBank * 5) / (1 + dist(t, x) * 0.1) ? o : x); if (!isNight(g.d)) ai.nextAtk = g.d + 0.08; }
      if (best) { if (t.sap >= T.minSap(t) && (t.title === 'Moth' ? isNight(g.d) : T.over(best) || g.rng() < 0.3)) attack(g, t, best, 'sap'); else if (t.cat >= 2) attack(g, t, best, 'cat'); }
    }
  }

  /* ---------- simulation step ---------- */
  function step(g, dtTotal) {
    if (g.ended) return;
    while (dtTotal > 1e-9) {
      const dt = Math.min(0.01, dtTotal); dtTotal -= dt;
      const d0 = g.d; g.d += dt; const d = g.d;
      g.towers.forEach((t) => {
        t.bricks += T.bricksPerDay(t) * dt; t.stone += T.stonePerDay(t) * dt; t.gas += T.gasPerDay(t) * dt;
        if (isNight(d)) t.dustRoof += T.dustPerNight(t, d) / (10 / 24) * dt;
        t.dmg = Math.max(0, t.dmg - 6 * dt);
        if (t.build) { t.build.left -= dt; if (t.build.left <= 0) { const b = t.build; t.build = null;
          if (b.kind === 'floor') { t.floors.push(b.type); t.ath = Math.max(t.ath, T.height(t)); if (t.isPlayer) log(g, `Floor ${t.floors.length} done: ${b.type} (${Math.round(T.height(t))} m).`, 'build', true); checkLiq(g, t, null, 'overextension'); }
          else { t.fLv++; if (t.isPlayer) log(g, `Foundation Lv ${t.fLv}: safe height ${Math.round(T.safe(t) * FH)} m.`, 'build', true); } } }
      });
      // dawn: bank roof dust
      if (Math.floor(d0 - 0.25) !== Math.floor(d - 0.25)) { g.towers.forEach((t) => { if (t.dustRoof > 0) { if (t.isPlayer) log(g, `GM: ${Math.round(t.dustRoof)} Moondust banked at dawn.`, 'info', true); t.dustBank += t.dustRoof; t.dustRoof = 0; } }); }
      // raids
      g.raids.forEach((r) => { if (r.state === 'out' && d >= r.arrive) { resolveRaid(g, r); r.state = 'return'; } else if (r.state === 'return' && d >= r.back) r.state = 'done'; });
      g.raids.forEach((r) => { if (r.state === 'done' && !r.closed) { const a = g.towers[r.from]; if (r.kind === 'cat') { a.catOut = Math.max(0, a.catOut - r.sent); a.cat += r.n; } else { a.sapOut = Math.max(0, a.sapOut - r.sent); a.sap += r.n; } r.closed = true; } });
      g.raids = g.raids.filter((r) => !r.closed);
      // haulers
      g.haulers.forEach((h) => { if (d >= h.arrive && !h.done) { h.done = true; const p = g.debris.find((x) => x.id === h.pile); const t = g.towers[h.from];
        if (p) { t.bricks += p.bricks; t.stone += p.stone; t.dustBank += p.dust; g.debris = g.debris.filter((x) => x !== p); if (t.isPlayer) log(g, `Haulers grabbed debris: +${Math.round(p.bricks)} Bricks, +${Math.round(p.stone)} Stone, +${Math.round(p.dust)} Moondust.`, 'good', true); else g.events.push({ type: 'grab', tower: t.id, plot: p.plot }); }
        else if (t.isPlayer) log(g, 'Haulers arrived too late. Someone else took the debris.', 'info', true); } });
      g.haulers = g.haulers.filter((h) => !h.done);
      g.debris = g.debris.filter((p) => p.expires > d);
      g.wardFee = 1 + (g.wardFee - 1) * Math.exp(-dt * 1.5);
      // storms
      if (d >= g.nextStorm) {
        g.nextStorm = d + (isFull(d) ? 0.4 : 0.8) + g.rng() * 1.4;
        const tallest = g.towers.reduce((a, b) => T.height(b) > T.height(a) ? b : a);
        const rod = T.count(tallest, 'Lightning Rod') > 0 && !(tallest.title === 'Moon-Eater' && g.rng() < 0.34);
        g.events.push({ type: 'storm', tower: tallest.id, absorbed: rod });
        if (!rod) { applyHit(g, tallest, 15, null, 'lightning'); }
        log(g, `Storm: lightning strikes ${tallest.name}${rod ? ' (rod absorbed it)' : ' for 15 damage'}.`, 'storm', tallest.isPlayer);
      }
      // bots
      g.towers.forEach((t) => { if (t.ai) { t.ai.tick -= dt; if (t.ai.tick <= 0) { t.ai.tick = 0.05; botTick(g, t); } } });
      // bots race for debris
      g.debris.forEach((p) => { g.towers.forEach((t) => { if (!t.ai || g.haulers.some((h) => h.from === t.id && h.pile === p.id)) return; if (g.rng() < dt * (0.9 - Math.abs(t.plot - p.plot) * 0.1)) haul(g, t, p.id); }); });
      if (g.d >= SEASON) { endSeason(g); return; }
    }
  }
  function scoreOf(g, t) { const ml = moonline(SEASON); const landed = T.height(t) >= ml; const base = Math.round(t.dustBank + 20 * t.ath + t.topple + t.raidPts); return { landed, base, total: Math.round(base * (landed ? 1.25 : 1)) }; }
  function endSeason(g) {
    g.ended = true; g.d = SEASON;
    g.results = g.towers.map((t) => ({ t, ...scoreOf(g, t) })).sort((a, b) => b.total - a.total);
    g.events.push({ type: 'end' });
    log(g, 'PERIGEE NIGHT: snapshot taken. Towers above the Moonline land on the Moon.', 'info', true);
  }

  const API = { FH, SEASON, PLOTS, TYPES, T, moonline, moonAge, isFull, isNew, isNight, hourOf, phaseName, titleOf, createGame, step, scoreOf, dist, gasFee,
    act: { build: startBuild, foundation: startFoundation, buttress: addButtress, net: addNet, setLev, removeScaffold, train, attack, haul } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.MoonEngine = API;
})(typeof window !== 'undefined' ? window : globalThis);
