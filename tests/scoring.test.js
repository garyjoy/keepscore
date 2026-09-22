import test from 'node:test';
import assert from 'node:assert/strict';
import { gameResult, needsThird, rubberResult, matchResult, lineupIssues, ORDER } from '../assets/js/scoring.js';
import { newMatch } from '../assets/js/repository.js';

test('all legal completed scores, symmetrically', () => {
  for (let h = 0; h <= 30; h++) for (let a = 0; a <= 30; a++) {
    // A terminal result must be reachable without the game having ended earlier.
    let expected = false;
    const high = Math.max(h,a), low = Math.min(h,a);
    if (high >= 21 && high <= 30 && high > low) {
      const winningNow = high - low >= 2 || high === 30;
      const alreadyWonBeforeLastPoint = high - 1 >= 21 && high - 1 - low >= 2;
      expected = winningNow && !alreadyWonBeforeLastPoint;
    }
    assert.equal(gameResult([String(h),String(a)]).status === 'valid', expected, `${h}–${a}`);
  }
});

test('blanks, malformed numbers and out-of-range scores never decide a game', () => {
  for (const score of [['','21'],['21',''],['',''],['-1','21'],['21.5','19'],['1e1','21'],['31','29'],[' 21','19'],['NaN','0']]) assert.equal(gameResult(score).winner, null);
  assert.equal(gameResult(['21','0']).winner, 0);
});

test('rubber requires two valid wins and a split before game three counts', () => {
  const scores = [['21','15'],['14','21'],['21','19']];
  assert.equal(needsThird(scores), true);
  assert.deepEqual(rubberResult(scores), { wins: [2,1], points: [56,55], winner: 0 });
  scores[1] = ['21','14'];
  assert.equal(needsThird(scores), false);
  assert.deepEqual(rubberResult(scores), { wins: [2,0], points: [42,29], winner: 0 });
  scores[1] = ['21','20'];
  assert.equal(rubberResult(scores).winner, null);
  assert.deepEqual(rubberResult(scores).wins, [1,0]);
});

test('all nine rubbers must be decided, even after a team has five wins', () => {
  const match = newMatch();
  for (let i = 0; i < 5; i++) match.scores[i] = [['21','0'],['21','0'],['','']];
  assert.equal(matchResult(match).winner, null);
  assert.equal(matchResult(match).decided, 5);
  for (let i = 5; i < 9; i++) match.scores[i] = [['0','21'],['0','21'],['','']];
  assert.deepEqual(matchResult(match), { rubbers: [5,4], games: [10,8], points: [210,168], decided: 9, winner: 0 });
  match.scores[0][0] = ['20','20'];
  assert.equal(matchResult(match).winner, null);
});

test('fixture order matches the supplied sheet and covers every pairing once', () => {
  assert.deepEqual(ORDER, [[0,0],[1,1],[2,2],[1,0],[2,1],[0,2],[2,0],[0,1],[1,2]]);
  assert.equal(new Set(ORDER.map(pair => pair.join(','))).size, 9);
});

test('independent match drafts and lineup validation', () => {
  const match = newMatch(), another = newMatch();
  match.scores[0][0][0] = '21';
  assert.equal(match.scores[1][0][0], '');
  assert.equal(another.scores[0][0][0], '');
  for (const side of ['home','away']) {
    match[side].name = side;
    match[side].teamId = side;
    match[side].pairs.flat().forEach((p,i) => { p.name = `Player ${i}`; });
  }
  assert.deepEqual(lineupIssues(match), []);
  match.home.pairs[1][0].name = ' PLAYER 0 ';
  assert.ok(lineupIssues(match).some(s => s.includes('only once')));
  match.away.teamId = 'home';
  assert.ok(lineupIssues(match).some(s => s.includes('different')));
});
