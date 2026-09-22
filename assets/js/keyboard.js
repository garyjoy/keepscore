// Keep score entry inside the visible rubbers, in match order. Native Tab remains
// untouched so browser and accessibility navigation retain their normal behaviour.
export function handleScoreEnter(event, root, doc = document) {
  const enter = event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter';
  if (!enter || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || doc.querySelector('dialog[open]')) return;
  const current = doc.activeElement;
  if (!current?.matches('input[data-score]') || !root.contains(current)) return;
  event.preventDefault();
  if (event.repeat) return;
  const fields = [...root.querySelectorAll('input[data-score]')].filter(field => !field.disabled && field.getClientRects().length);
  const index = fields.indexOf(current);
  const next = index < 0 ? null : fields[index + (event.shiftKey ? -1 : 1)];
  if (!next) return;
  next.focus();
  // Moving focus can trigger the existing game-three correction confirmation.
  if (!doc.querySelector('dialog[open]') && doc.activeElement === next) next.select();
}
