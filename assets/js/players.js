const normalize = value => value.trim().toLocaleLowerCase();

export function teamSuggestions(teams, opponentId, query) {
  const term = normalize(query);
  return teams.filter(team => !team.archived && team.id !== opponentId && normalize(team.name).includes(term))
    .sort((a, b) => Number(normalize(b.name).startsWith(term)) - Number(normalize(a.name).startsWith(term)) || a.name.localeCompare(b.name));
}

export function playerSuggestions(players, team, pairIndex, slot, query) {
  const used = new Set(team.pairs.flatMap((pair, p) => pair.filter((_, s) => p !== pairIndex || s !== slot).map(player => normalize(player.name))));
  const term = normalize(query);
  return players.filter(player => !player.archived && player.teamId === team.teamId && !used.has(normalize(player.name)) && normalize(player.name).includes(term))
    .sort((a, b) => Number(normalize(b.name).startsWith(term)) - Number(normalize(a.name).startsWith(term)) || a.name.localeCompare(b.name));
}

export function attachNamePicker(root, getOptions) {
  let input = null, list = null, options = [], selected = -1;
  let touch = null, ignoreClick = false;
  function close() {
    if (input) {
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      input.removeAttribute('aria-controls');
    }
    list?.remove();
    input = list = null;
    options = [];
    selected = -1;
  }
  function open(field) {
    close();
    input = field;
    options = getOptions(field);
    if (!options.length) return;
    list = document.createElement('div');
    list.className = 'name-options';
    list.id = field.dataset.team ? `teams-${field.dataset.team}` : `players-${field.dataset.player}-${field.dataset.pair}-${field.dataset.slot}`;
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', field.dataset.team ? 'Available teams' : 'Available players');
    options.forEach((player, index) => {
      const option = document.createElement('div');
      option.id = `${list.id}-${index}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.dataset.optionIndex = index;
      option.textContent = player.name;
      list.append(option);
    });
    field.parentElement.append(list);
    field.setAttribute('aria-controls', list.id);
    field.setAttribute('aria-expanded', 'true');
  }
  function choose(index) {
    const field = input, player = options[index];
    if (!field || !player) return;
    close();
    field.value = player.name;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    // The input event filters suggestions; close again after committing so a
    // selected name never leaves a one-option popup behind.
    close();
  }
  root.addEventListener('focusin', event => {
    if (event.target.matches('input[data-player], input[data-team]')) open(event.target);
  });
  root.addEventListener('input', event => {
    if (event.target.matches('input[data-player], input[data-team]')) open(event.target);
  });
  root.addEventListener('focusout', event => {
    // A finger can blur the field before pointerup. Keep the options alive until
    // we know whether this gesture was a tap or a scroll.
    if (event.target === input && !touch) close();
  });
  root.addEventListener('pointerdown', event => {
    ignoreClick = false;
    touch = null;
    const option = event.target.closest('.name-options [role="option"]');
    if (option && list?.contains(option)) {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        touch = { id: event.pointerId, option, x: event.clientX, y: event.clientY, scrollTop: list.scrollTop, moved: false };
      }
      // Selection is handled on pointerup for touch; suppress premature blur
      // so a team draft cannot rebuild the sheet before the tap is complete.
      event.preventDefault();
    } else if (event.target !== input) close();
  });
  root.addEventListener('pointermove', event => {
    if (touch?.id === event.pointerId && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 10) touch.moved = true;
  });
  root.addEventListener('pointerup', event => {
    if (touch?.id !== event.pointerId) return;
    const gesture = touch;
    touch = null;
    ignoreClick = true;
    const tapped = !gesture.moved && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) <= 10 && list?.scrollTop === gesture.scrollTop;
    if (tapped && list?.contains(gesture.option)) choose(Number(gesture.option.dataset.optionIndex));
  });
  root.addEventListener('pointercancel', event => {
    if (touch?.id !== event.pointerId) return;
    touch = null;
    ignoreClick = true;
  });
  root.addEventListener('click', event => {
    if (ignoreClick) return;
    const option = event.target.closest('.name-options [role="option"]');
    if (option && list?.contains(option)) choose(Number(option.dataset.optionIndex));
  });
  root.addEventListener('keydown', event => {
    const field = event.target;
    if (!field.matches('input[data-player], input[data-team]') || event.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (input !== field || !list) open(field);
      if (!list) return;
      selected = (selected + (event.key === 'ArrowDown' ? 1 : selected < 0 ? 0 : -1) + options.length) % options.length;
      [...list.children].forEach((option, index) => option.setAttribute('aria-selected', String(index === selected)));
      const option = list.children[selected];
      field.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (input === field && selected >= 0) choose(selected);
      else { close(); field.dispatchEvent(new Event('change', { bubbles: true })); }
    } else if (event.key === 'Tab') close();
  });
  window.addEventListener('hashchange', close);
  window.addEventListener('popstate', close);
}
