import { VERSION_LABEL, announceLoadedVersion, watchForUpdate } from './releases.js';
import { createNavigation } from './navigation.js';
import { attachNamePicker, playerSuggestions, teamSuggestions } from './players.js';
import { ORDER, gameResult, needsThird, rubberResult, matchResult, lineupIssues } from './scoring.js';
import { LocalRepository, newMatch, createId } from './repository.js';

const app = document.querySelector('#app');
const repository = new LocalRepository();
let navigation, state, current, view = 'matches', filter = '', teamFilter = '', saved = 'Saved on this device', saveError = '', revision = 0, offlineReady = false, playersCollapsed = false;
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const id = createId;
const activeTeams = () => state.teams.filter(t => !t.archived).sort((a,b) => a.name.localeCompare(b.name));
const dateLabel = date => date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not set';
const teamName = teamId => state.teams.find(t => t.id === teamId)?.name || 'Unknown team';
const field = (label, content, extra = '') => `<label class="field ${extra}"><span>${label}</span>${content}</label>`;
const draftKey = el => el.dataset.team ? `team-${el.dataset.team}` : `player-${el.dataset.player}-${el.dataset.pair}-${el.dataset.slot}`;
const draftValue = (key, fallback) => current.setupDrafts?.[key] ?? fallback;

async function persist() {
  const thisRevision = ++revision;
  saved = 'Saving…';
  updateStatus();
  try {
    await repository.save(state);
    if (thisRevision === revision) { saved = 'Saved on this device'; saveError = ''; updateStatus(); }
  } catch (error) {
    saved = 'Not saved';
    saveError = `Your latest changes could not be saved. Keep this page open and retry. ${error.message || ''}`;
    updateStatus();
  }
}

function updateStatus() {
  document.querySelectorAll('[data-save-status]').forEach(el => { el.textContent = saved; el.classList.toggle('unsaved', saved === 'Not saved'); });
  const banner = document.querySelector('#save-error');
  if (banner) { banner.hidden = !saveError; banner.innerHTML = `${escape(saveError)} <button data-action="retry">Retry save</button>`; }
  document.querySelectorAll('[data-connection]').forEach(el => { el.textContent = !navigator.onLine ? 'Offline' : offlineReady ? 'Ready offline' : 'On this device'; });
}

function touch() { if (current) current.updatedAt = new Date().toISOString(); persist(); }

function shell(content) {
  app.classList.toggle('match-view', view === 'sheet');
  app.innerHTML = `<header class="app-header" ${view === 'sheet' ? 'hidden' : ''}><a href="#matches" class="brand" aria-label="KeepScore home"><span class="brand-mark" aria-hidden="true">K<span>•</span></span><span>KeepScore<small>BADMINTON</small></span></a><nav aria-label="Main navigation">${['matches','teams','players'].map(name => `<button type="button" data-action="navigate" data-view="${name}" ${view === name || (view === 'sheet' && name === 'matches') ? 'aria-current="page"' : ''}>${name[0].toUpperCase()+name.slice(1)}</button>`).join('')}</nav><div class="header-status"><span class="app-version">${escape(VERSION_LABEL)}</span><span class="connection"><i></i><span data-connection></span></span></div></header><div id="save-error" class="error-banner" role="alert" hidden></div><main>${content}</main><footer><span>KeepScore · 3 × 3 doubles · ${escape(VERSION_LABEL)}</span><span data-save-status>${saved}</span></footer><dialog id="modal"></dialog>`;
  updateStatus();
}

function render() {
  if (view === 'sheet' && current) renderSheet();
  else if (view === 'teams') renderTeams();
  else if (view === 'players') renderPlayers();
  else renderMatches();
}

function renderMatches() {
  const matches = [...state.matches].sort((a,b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  const completed = matches.filter(m => matchResult(m).winner !== null).length;
  shell(`<section class="page-heading"><div><div class="eyebrow">YOUR COURTSIDE COMPANION</div><h1>Matches</h1><p>Every game. Every point. All in one place.</p></div><button class="primary" data-action="new-match"><span aria-hidden="true">＋</span> New match</button></section>
  <div class="history-top"><div class="tabs" role="group" aria-label="Filter matches">${[['','All matches'],['progress','In progress'],['complete','Completed']].map(([value,label]) => `<button class="${filter === value ? 'selected' : ''}" data-action="filter" data-value="${value}" aria-pressed="${filter === value}">${label}</button>`).join('')}</div><span class="muted">${matches.length} match${matches.length === 1 ? '' : 'es'} · ${completed} completed</span></div>
  <div class="match-list">${matches.filter(m => !filter || (filter === 'complete' ? matchResult(m).winner !== null : matchResult(m).winner === null)).map(m => {
    const result = matchResult(m);
    return `<a class="match-card" href="#match/${m.id}"><div class="match-date">${escape(dateLabel(m.date))}<span class="badge ${result.winner !== null ? 'complete' : ''}">${result.winner !== null ? 'Completed' : 'In progress'}</span></div><div class="match-teams"><span><i class="team-dot home-dot"></i>${escape(m.home.name || 'Home team')}</span><strong>${result.rubbers[0]} <span>–</span> ${result.rubbers[1]}</strong><span><i class="team-dot away-dot"></i>${escape(m.away.name || 'Away team')}</span></div><div class="match-detail"><span>${result.winner === null ? `${result.decided} of 9 rubbers decided` : `${escape(result.winner === 0 ? m.home.name : m.away.name)} won`}</span><span>View score sheet <b aria-hidden="true">↗</b></span></div></a>`;
  }).join('') || `<section class="empty-state"><div class="empty-symbol" aria-hidden="true">21<span>–</span>19</div><h2>${matches.length ? 'No matches in this view' : 'A fresh score sheet awaits'}</h2><p>${matches.length ? 'Choose another filter to see your matches.' : 'Set up your teams, choose your pairs,<br>and leave the paperwork off court.'}</p>${!matches.length ? '<button class="primary" data-action="new-match">Create your first match</button><span class="empty-note">Automatically saved. Ready to pick up later.</span>' : ''}</section>`}</div>`);
}

function teamPanel(side) {
  const team = current[side], home = side === 'home', prefix = home ? 'H' : 'A';
  return `<section class="team-panel ${side}"><div class="team-heading"><span class="eyebrow">${home ? 'HOME' : 'AWAY'} TEAM</span><span>3 pairs · 6 players</span></div><div class="name-field"><label class="sr-only" for="${side}-team">${side} team</label><input id="${side}-team" class="team-input" data-team="${side}" role="combobox" aria-autocomplete="list" aria-expanded="false" spellcheck="false" placeholder="Choose or add a team" autocomplete="off" maxlength="100" value="${escape(draftValue(`team-${side}`, team.name))}"></div><div class="pairs" id="${side}-lineup">${team.pairs.map((pair,pairIndex) => `<div class="pair-row"><span class="pair-label">${prefix}${pairIndex+1}</span>${pair.map((player,playerIndex) => `<div class="name-field"><input aria-label="${side} pair ${pairIndex+1}, player ${playerIndex+1}" role="combobox" aria-autocomplete="list" aria-expanded="false" data-player="${side}" data-pair="${pairIndex}" data-slot="${playerIndex}" placeholder="${team.teamId ? 'Choose or add player' : 'Choose team first'}" value="${escape(draftValue(`player-${side}-${pairIndex}-${playerIndex}`, player.name))}" ${!team.teamId ? 'disabled' : ''} maxlength="100" autocomplete="off" spellcheck="false"></div>`).join('')}</div>`).join('')}</div></section>`;
}

function rubberCard(index) {
  const [h,a] = ORDER[index], games = current.scores[index], result = rubberResult(games);
  const third = needsThird(games), retained = games[2].some(s => s !== '');
  return `<article id="rubber-${index}" class="rubber ${result.winner === 0 ? 'home-winner' : result.winner === 1 ? 'away-winner' : ''}" style="--row:${h+2};--col:${a+2}" aria-label="Rubber ${index+1}, home pair ${h+1} versus away pair ${a+1}"><div class="rubber-heading"><span class="rubber-number">${index+1}</span><strong>H${h+1}</strong><span class="pair-versus">vs</span><strong>A${a+1}</strong><span class="rubber-status">${result.winner === null ? 'To play' : result.winner === 0 ? 'Home won' : 'Away won'}</span></div>${games.map((g,gameIndex) => `<div class="game-row" ${gameIndex === 2 && !third ? 'hidden' : ''}><span>G${gameIndex+1}</span><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" aria-label="Rubber ${index+1}, game ${gameIndex+1}, home score" aria-describedby="validation-${index}-${gameIndex}" data-score="${index}" data-game="${gameIndex}" data-side="0" value="${escape(g[0])}"><span class="score-dash">–</span><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" aria-label="Rubber ${index+1}, game ${gameIndex+1}, away score" aria-describedby="validation-${index}-${gameIndex}" data-score="${index}" data-game="${gameIndex}" data-side="1" value="${escape(g[1])}"><small class="validation" id="validation-${index}-${gameIndex}"></small></div>`).join('')}<p class="third-note">${!third && retained ? 'Game 3 kept until games 1 and 2 are resolved.' : ''}</p></article>`;
}

function renderSheet() {
  shell(`<section class="sheet-heading"><div><a class="back-link" href="#matches">← Matches</a><h1>Score sheet <span class="format-label">3 × 3 doubles</span></h1></div><div class="sheet-actions"><span class="app-version">${escape(VERSION_LABEL)}</span><span class="save-label" data-save-status>${saved}</span><button class="quiet danger" data-action="delete-match">Delete match</button></div></section>
  <section class="summary" aria-label="Match summary">${field('Match date', `<input type="date" id="match-date" value="${escape(current.date)}" aria-label="Match date">`, 'stat date-stat')}<div class="stat result-stat"><span>Result</span><strong id="match-winner"></strong></div>${['Rubbers','Games','Points'].map(label => `<div class="stat"><span>${label}</span><strong id="total-${label.toLowerCase()}"></strong></div>`).join('')}<button class="stat notes-button" data-action="notes"><span>Notes</span><strong id="notes-indicator">${current.notes ? 'View notes' : '＋ Add note'}</strong></button></section>
  <div class="team-panels">${teamPanel('home')}<div class="lineup-toolbar" hidden><button class="lineup-toggle" data-action="toggle-players" title="Hide players" aria-expanded="true" aria-controls="home-lineup away-lineup"><span class="lineup-chevron" aria-hidden="true"></span><span class="sr-only" data-lineup-label>Hide players</span></button></div>${teamPanel('away')}</div>
  <div id="lineup-message" class="lineup-message" role="status"></div><div class="score-sheet-top"><div><h2>Rubbers <span id="progress-count"></span></h2></div></div>
  <section class="score-grid" aria-label="Nine rubbers">${[0,1,2].map(i => `<div class="axis column-axis" style="--col:${i+2}">A${i+1}</div><div class="axis row-axis" style="--row:${i+2}">H${i+1}</div>`).join('')}${ORDER.map((_,i) => rubberCard(i)).join('')}</section><p class="scoring-help">Best of 3 games to 21 · Win by 2 · Maximum 30 <span>Totals count valid games. The final result appears after all 9 rubbers.</span></p>`);
  refreshScores();
}

function allPlayersNamed() {
  return Boolean(current) && ['home', 'away'].every(side => current[side].pairs.every((pair, p) =>
    pair.every((player, slot) => player.name.trim() && draftValue(`player-${side}-${p}-${slot}`, player.name).trim())));
}

function refreshPlayerVisibility() {
  const complete = allPlayersNamed();
  if (!complete) playersCollapsed = false;
  const toolbar = document.querySelector('.lineup-toolbar');
  toolbar.hidden = !complete;
  const toggle = toolbar.querySelector('button');
  toggle.setAttribute('aria-expanded', String(!playersCollapsed));
  const label = playersCollapsed ? 'Show players' : 'Hide players';
  toggle.querySelector('[data-lineup-label]').textContent = label;
  toggle.title = label;
  for (const side of ['home', 'away']) document.querySelector(`#${side}-lineup`).hidden = playersCollapsed;
}

function refreshScores() {
  if (view !== 'sheet') return;
  refreshPlayerVisibility();
  const totals = matchResult(current);
  document.querySelector('#match-winner').textContent = totals.winner === null ? 'No result yet' : current[totals.winner === 0 ? 'home' : 'away'].name || (totals.winner === 0 ? 'Home' : 'Away');
  for (const key of ['rubbers','games','points']) document.querySelector(`#total-${key}`).textContent = `${totals[key][0]}–${totals[key][1]}`;
  document.querySelector('#progress-count').textContent = `${totals.decided} / 9 decided`;
  const issues = lineupIssues(current);
  document.querySelector('#lineup-message').textContent = issues.join(' ');
  document.querySelector('#lineup-message').hidden = !issues.length;
  const showScores = !issues.length || current.scores.some(rubber => rubber.flat().some(score => score !== ''));
  for (const selector of ['.score-grid', '.score-sheet-top', '.scoring-help']) document.querySelector(selector).hidden = !showScores;
  ORDER.forEach((_,i) => {
    const card = document.querySelector(`#rubber-${i}`), scores = current.scores[i], result = rubberResult(scores), third = needsThird(scores);
    card.classList.toggle('home-winner', result.winner === 0);
    card.classList.toggle('away-winner', result.winner === 1);
    card.querySelector('.rubber-status').textContent = result.winner === 0 ? 'Home won' : result.winner === 1 ? 'Away won' : scores.flat().some(s => s !== '') ? 'In progress' : 'To play';
    card.querySelectorAll('.game-row').forEach((row,g) => {
      row.hidden = g === 2 && !third;
      const invalid = gameResult(scores[g]).status === 'invalid';
      row.querySelector('.validation').textContent = invalid ? 'Enter a finished score: 21–19, 22–20… up to 30.' : '';
      row.querySelectorAll('input').forEach(input => input.setAttribute('aria-invalid', String(invalid)));
    });
    card.querySelector('.third-note').textContent = third ? '' : scores[2].some(s => s !== '') ? 'Game 3 kept until games 1 and 2 are resolved.' : '';
  });
}

function renderTeams() {
  shell(`<section class="page-heading"><div><div class="eyebrow">YOUR CLUBS & OPPONENTS</div><h1>Teams</h1><p>A familiar lineup starts here.</p></div><button class="primary" data-action="add-team">＋ Add team</button></section><div class="directory-grid">${activeTeams().map(team => `<article class="directory-card"><div class="team-monogram">${escape(team.name.slice(0,2).toUpperCase())}</div><h2>${escape(team.name)}</h2><p>${state.players.filter(p => p.teamId === team.id && !p.archived).length} players</p><div class="card-actions"><button data-action="team-players" data-id="${team.id}">View players →</button><button class="quiet" data-action="edit-team" data-id="${team.id}">Rename</button><button class="quiet danger" data-action="archive-team" data-id="${team.id}">Remove</button></div></article>`).join('') || '<section class="empty-state"><h2>Meet your teams</h2><p>Add your team and the clubs you play against.<br>You can also add them while setting up a match.</p><button class="primary" data-action="add-team">Add your first team</button></section>'}</div>`);
}

function renderPlayers() {
  const teams = activeTeams();
  const players = state.players.filter(p => !p.archived && teams.some(t => t.id === p.teamId) && (!teamFilter || p.teamId === teamFilter)).sort((a,b) => a.name.localeCompare(b.name));
  shell(`<section class="page-heading"><div><div class="eyebrow">THE PEOPLE ON COURT</div><h1>Players</h1><p>Keep your squad ready for the next match.</p></div><button class="primary" data-action="add-player">＋ Add player</button></section><div class="directory-toolbar">${field('Team', `<select id="player-team-filter"><option value="">All teams</option>${teams.map(t => `<option value="${t.id}" ${teamFilter === t.id ? 'selected' : ''}>${escape(t.name)}</option>`).join('')}</select>`)}<span class="muted">${players.length} players</span></div><div class="player-list">${players.map(player => `<article class="player-card"><span class="avatar">${escape(player.name.split(/\s+/).map(n => n[0]).slice(0,2).join('').toUpperCase())}</span><div><h2>${escape(player.name)}</h2><p>${escape(teamName(player.teamId))}</p></div><button class="quiet" data-action="edit-player" data-id="${player.id}">Rename</button><button class="quiet danger" data-action="archive-player" data-id="${player.id}">Remove</button></article>`).join('') || '<section class="empty-state"><h2>Your next lineup starts here</h2><p>Add players to a team, then select them<br>when you set up a match.</p><button class="primary" data-action="add-player">Add a player</button></section>'}</div>`);
}

function modal(content) {
  const dialog = document.querySelector('#modal');
  dialog.innerHTML = content;
  dialog.returnValue = '';
  dialog.showModal();
  return dialog;
}

function confirmAction(title, description, label, action) {
  const dialog = modal(`<form method="dialog"><h2>${escape(title)}</h2><p>${escape(description)}</p><div class="dialog-actions"><button value="cancel">Cancel</button><button class="primary" value="confirm">${escape(label)}</button></div></form>`);
  dialog.addEventListener('close', () => { if (dialog.returnValue === 'confirm') action(); }, { once: true });
}

function editTeam(team) {
  const dialog = modal(`<form id="team-form"><h2>${team ? 'Rename team' : 'Add team'}</h2><p>${team ? 'Names recorded in existing matches will stay as they are.' : 'Players will belong to this team.'}</p>${field('Team name', `<input name="name" value="${escape(team?.name || '')}" required maxlength="100" autofocus autocomplete="off">`)}<p class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" data-action="close-modal">Cancel</button><button class="primary">${team ? 'Save name' : 'Add team'}</button></div></form>`);
  dialog.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const name = new FormData(e.target).get('name').trim();
    if (!name || activeTeams().some(t => t.id !== team?.id && t.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { dialog.querySelector('.form-error').textContent = 'Enter a unique team name.'; return; }
    if (team) team.name = name; else state.teams.push({ id: id(), name });
    persist(); dialog.close(); render();
  };
}

function editPlayer(player) {
  if (!activeTeams().length) { editTeam(); return; }
  const dialog = modal(`<form><h2>${player ? 'Rename player' : 'Add player'}</h2><p>${player ? 'Names recorded in existing matches will stay as they are.' : 'Choose their team. Pairings are selected for each match.'}</p>${field('Player name', `<input name="name" value="${escape(player?.name || '')}" required maxlength="100" autofocus autocomplete="off">`)}${field('Team', `<select name="teamId" ${player ? 'disabled' : ''}>${activeTeams().map(t => `<option value="${t.id}" ${(player?.teamId || teamFilter) === t.id ? 'selected' : ''}>${escape(t.name)}</option>`).join('')}</select>`)}<p class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" data-action="close-modal">Cancel</button><button class="primary">${player ? 'Save name' : 'Add player'}</button></div></form>`);
  dialog.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const data = new FormData(e.target), name = data.get('name').trim(), teamId = player?.teamId || data.get('teamId');
    if (!name || state.players.some(p => !p.archived && p.id !== player?.id && p.teamId === teamId && p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { dialog.querySelector('.form-error').textContent = 'Enter a unique player name for this team.'; return; }
    if (player) player.name = name; else state.players.push({ id: id(), name, teamId });
    persist(); dialog.close(); render();
  };
}

function setTeam(side, rawName) {
  const name = rawName.trim(), previous = current[side];
  if (current.setupDrafts) delete current.setupDrafts[`team-${side}`];
  if (name === previous.name) { touch(); return; }
  const otherSide = side === 'home' ? 'away' : 'home';
  if (name && name.toLocaleLowerCase() === current[otherSide].name.toLocaleLowerCase()) {
    document.querySelector(`#${side}-team`).value = previous.name;
    touch();
    modal('<form method="dialog"><h2>Choose a different team</h2><p>The home and away teams must be different.</p><div class="dialog-actions"><button class="primary">OK</button></div></form>');
    return;
  }
  const apply = () => {
    let team = activeTeams().find(t => t.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (!team && name) { team = { id: id(), name }; state.teams.push(team); }
    for (const key of Object.keys(current.setupDrafts || {})) if (key.startsWith(`player-${side}-`)) delete current.setupDrafts[key];
    current[side] = { teamId: team?.id || '', name: team?.name || '', pairs: Array.from({ length: 3 }, () => [{ playerId: '', name: '' }, { playerId: '', name: '' }]) };
    touch(); renderSheet();
  };
  if (previous.pairs.flat().some(p => p.name)) {
    document.querySelector(`#${side}-team`).value = previous.name;
    touch();
    confirmAction('Change this team?', 'The players on this side will be cleared. Existing scores will stay on the sheet.', 'Change team', apply);
  } else apply();
}

app.addEventListener('input', e => {
  const el = e.target;
  if (el.matches('[data-team], [data-player]')) {
    current.setupDrafts ||= {};
    current.setupDrafts[draftKey(el)] = el.value;
    refreshPlayerVisibility();
    touch();
  }
  if (el.matches('[data-score]')) {
    current.scores[Number(el.dataset.score)][Number(el.dataset.game)][Number(el.dataset.side)] = el.value;
    touch(); refreshScores();
  }
  if (el.id === 'match-notes') { current.notes = el.value; touch(); document.querySelector('#notes-indicator').textContent = current.notes ? 'View notes' : '＋ Add note'; }
});

// A restored draft may be unchanged since focus, so the browser will not emit
// change itself. Commit it on leaving the field as well.
app.addEventListener('focusout', e => {
  const el = e.target;
  if (current && el.matches('[data-team], [data-player]') && Object.hasOwn(current.setupDrafts || {}, draftKey(el))) el.dispatchEvent(new Event('change', { bubbles: true }));
});


app.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'match-date') { current.date = el.value; touch(); }
  if (el.id === 'player-team-filter') { teamFilter = el.value; renderPlayers(); }
  if (el.matches('[data-team]')) setTeam(el.dataset.team, el.value);
  if (el.matches('[data-player]')) {
    const side = current[el.dataset.player], name = el.value.trim();
    const pairIndex = Number(el.dataset.pair), slot = Number(el.dataset.slot);
    if (current.setupDrafts) delete current.setupDrafts[draftKey(el)];
    if (name && side.pairs.some((pair,p) => pair.some((player,s) => (p !== pairIndex || s !== slot) && player.name.toLocaleLowerCase() === name.toLocaleLowerCase()))) {
      el.value = side.pairs[pairIndex][slot].name;
      touch();
      modal('<form method="dialog"><h2>Player already selected</h2><p>Each player can appear only once in this team’s lineup.</p><div class="dialog-actions"><button class="primary">OK</button></div></form>');
      return;
    }
    let player = state.players.find(p => !p.archived && p.teamId === side.teamId && p.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (!player && name) { player = { id: id(), name, teamId: side.teamId }; state.players.push(player); }
    side.pairs[Number(el.dataset.pair)][Number(el.dataset.slot)] = { playerId: player?.id || '', name: player?.name || '' };
    el.value = player?.name || '';
    touch(); refreshScores();
  }
  if (el.matches('[data-score]')) {
    const scores = current.scores[Number(el.dataset.score)];
    if (Number(el.dataset.game) < 2 && scores[2].some(s => s !== '') && rubberResult(scores).winner !== null && !needsThird(scores)) {
      confirmAction('Clear game 3?', 'The first two games now decide this rubber. Game 3 no longer counts towards the result. Clear its scores?', 'Clear game 3', () => {
        scores[2] = ['', '']; touch(); renderSheet();
      });
    }
  }
});

app.addEventListener('click', e => {
  const link = e.target.closest('a[href^="#"]');
  if (link && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
    e.preventDefault();
    navigation.navigate(link.getAttribute('href'));
    return;
  }
  const button = e.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action, itemId = button.dataset.id;
  if (action === 'navigate') { navigation.navigate(button.dataset.view); return; }
  if (action === 'new-match') { const match = newMatch(); state.matches.push(match); persist(); navigation.navigate(`match/${match.id}`); }
  if (action === 'filter') { filter = button.dataset.value; renderMatches(); }
  if (action === 'retry') persist();
  if (action === 'toggle-players') { playersCollapsed = !playersCollapsed; refreshPlayerVisibility(); }
  if (action === 'close-modal') document.querySelector('#modal').close();
  if (action === 'add-team') editTeam();
  if (action === 'edit-team') editTeam(state.teams.find(t => t.id === itemId));
  if (action === 'add-player') editPlayer();
  if (action === 'edit-player') editPlayer(state.players.find(p => p.id === itemId));
  if (action === 'team-players') { teamFilter = itemId; navigation.navigate('players'); }
  if (action === 'archive-team' || action === 'archive-player') {
    const item = (action === 'archive-team' ? state.teams : state.players).find(item => item.id === itemId);
    confirmAction(`Remove ${item.name}?`, 'This removes it from future selections. Existing match records are kept.', 'Remove', () => { item.archived = true; persist(); render(); });
  }
  if (action === 'delete-match') confirmAction('Delete this match?', 'The score sheet and its scores will be permanently removed from this device.', 'Delete match', () => { state.matches = state.matches.filter(m => m.id !== current.id); current = null; persist(); navigation.navigate('matches'); });
  if (action === 'notes') modal(`<form method="dialog"><h2>Match notes</h2><p>Anything to remember about this match.</p>${field('Notes', `<textarea id="match-notes" rows="7" placeholder="Court details, a memorable rally…">${escape(current.notes)}</textarea>`)}<div class="dialog-actions"><span class="muted" data-save-status>${saved}</span><button class="primary">Done</button></div></form>`);
});

function route() {
  const [page, matchId] = location.hash.slice(1).split('/');
  current = page === 'match' ? state.matches.find(m => m.id === matchId) : null;
  playersCollapsed = allPlayersNamed();
  view = current ? 'sheet' : ['teams', 'players'].includes(page) ? page : 'matches';
  render(); window.scrollTo(0, 0);
}

attachNamePicker(app, input => {
  if (!current) return [];
  if (input.dataset.team) {
    const opponent = current[input.dataset.team === 'home' ? 'away' : 'home'];
    return teamSuggestions(state.teams, opponent.teamId, input.value);
  }
  return playerSuggestions(state.players, current[input.dataset.player], Number(input.dataset.pair), Number(input.dataset.slot), input.value);
});

window.addEventListener('online', updateStatus);
window.addEventListener('offline', updateStatus);
window.addEventListener('beforeunload', e => { if (saveError || saved === 'Saving…') { e.preventDefault(); e.returnValue = ''; } });

try {
  state = await repository.open();
  navigation = createNavigation(window, route);
  navigation.start();
  announceLoadedVersion();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(registration => { watchForUpdate(registration); return navigator.serviceWorker.ready; }).then(() => { offlineReady = true; updateStatus(); }).catch(() => { offlineReady = false; updateStatus(); });
  }
} catch (error) {
  app.innerHTML = `<section class="empty-state"><h1>We couldn’t open your local records</h1><p>${escape(error.message)}<br>Check that browser storage is allowed, then reload.</p><button onclick="location.reload()">Try again</button></section>`;
}
