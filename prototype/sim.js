// Headless balance check: node prototype/sim.js [runs]
const E = require('./engine.js');
const runs = +process.argv[2] || 20; const agg = {};
for (let s = 1; s <= runs; s++) {
  const g = E.createGame({ seed: s, autoplay: true, playerName: 'Player(bot)' });
  let falls = 0; while (!g.ended) { E.step(g, 0.05); falls += g.events.filter(e => e.type === 'fall').length; g.events.length = 0; }
  g.results.forEach((r, i) => { const a = agg[r.t.name] = agg[r.t.name] || { title: r.t.title, rank: 0, h: 0, ath: 0, land: 0, score: 0, dust: 0, falls: 0 }; a.rank += i + 1; a.h += E.T.height(r.t); a.ath += r.t.ath; a.land += r.landed ? 1 : 0; a.score += r.total; a.dust += r.t.dustBank; });
  agg._falls = (agg._falls || 0) + falls;
  for (const t of g.towers) for (const k of ['bricks','stone','gas','cat','sap','dustBank']) if (!isFinite(t[k]) || t[k] < -1) throw new Error(`bad ${k} ${t[k]} ${t.name}`);
}
console.log('Moonline at Perigee:', Math.round(E.moonline(E.SEASON)), 'm | falls per season:', (agg._falls / runs).toFixed(1));
console.table(Object.entries(agg).filter(([k]) => k[0] !== '_').map(([n, a]) => ({ name: n, title: a.title, avgRank: (a.rank / runs).toFixed(1), height: Math.round(a.h / runs), ATH: Math.round(a.ath / runs), landed: Math.round(a.land / runs * 100) + '%', dust: Math.round(a.dust / runs), score: Math.round(a.score / runs) })).sort((a, b) => a.avgRank - b.avgRank));
