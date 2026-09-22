export const ORDER = [[0,0],[1,1],[2,2],[1,0],[2,1],[0,2],[2,0],[0,1],[1,2]];

export function gameResult(game) {
  const [a, b] = game;
  if (a === '' || b === '' || a == null || b == null) return { status: 'empty', winner: null };
  if (!/^\d{1,2}$/.test(String(a)) || !/^\d{1,2}$/.test(String(b))) return { status: 'invalid', winner: null };
  const home = Number(a), away = Number(b);
  const high = Math.max(home, away), low = Math.min(home, away);
  const valid = (high === 21 && low <= 19) || (high >= 22 && high <= 29 && high - low === 2) || (high === 30 && (low === 28 || low === 29));
  return { status: valid ? 'valid' : 'invalid', winner: valid ? (home > away ? 0 : 1) : null };
}

export function needsThird(games) {
  const a = gameResult(games[0]), b = gameResult(games[1]);
  return a.status === 'valid' && b.status === 'valid' && a.winner !== b.winner;
}

export function rubberResult(games) {
  const active = games.slice(0, needsThird(games) ? 3 : 2);
  const wins = [0, 0], points = [0, 0];
  for (const game of active) {
    const result = gameResult(game);
    if (result.status === 'valid') {
      wins[result.winner]++;
      points[0] += Number(game[0]);
      points[1] += Number(game[1]);
    }
  }
  return { wins, points, winner: wins[0] === 2 ? 0 : wins[1] === 2 ? 1 : null };
}

export function matchResult(match) {
  const rubbers = [0, 0], games = [0, 0], points = [0, 0];
  for (const scores of match.scores) {
    const result = rubberResult(scores);
    if (result.winner !== null) rubbers[result.winner]++;
    for (let i = 0; i < 2; i++) { games[i] += result.wins[i]; points[i] += result.points[i]; }
  }
  const decided = rubbers[0] + rubbers[1];
  return { rubbers, games, points, decided, winner: decided === 9 ? (rubbers[0] > rubbers[1] ? 0 : 1) : null };
}

export function lineupIssues(match) {
  const issues = [];
  if (!match.home.name.trim() || !match.away.name.trim()) issues.push('Choose both teams.');
  if (match.home.teamId && match.home.teamId === match.away.teamId) issues.push('Choose different home and away teams.');
  for (const side of ['home', 'away']) {
    const names = match[side].pairs.flat().map(p => p.name.trim().toLocaleLowerCase());
    if (names.some(n => !n)) issues.push(`Complete the ${side} lineup.`);
    const filled = names.filter(Boolean);
    if (new Set(filled).size !== filled.length) issues.push(`Use each ${side} player only once.`);
  }
  return issues;
}
