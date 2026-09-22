export const APP_VERSION = globalThis.document?.querySelector('meta[name="app-version"]')?.content || 'development';
const LOCAL = globalThis.document?.querySelector('meta[name="app-local"]')?.content !== 'false';
export const VERSION_LABEL = APP_VERSION === 'development' ? 'Local preview' : `v${APP_VERSION}${LOCAL ? ' · local preview' : ''}`;

export function loadedVersionMessage(version, previous) {
  if (version === previous) return null;
  return previous ? `KeepScore updated to version ${version}.` : `KeepScore version ${version} loaded.`;
}

function notice(id, message) {
  if (document.getElementById(id)) return;
  const box = document.createElement('div');
  box.id = id;
  box.className = 'release-notice';
  box.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = message;
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.textContent = 'Dismiss';
  dismiss.addEventListener('click', () => box.remove());
  box.append(text, dismiss);
  let notices = document.getElementById('release-notices');
  if (!notices) {
    notices = document.createElement('aside');
    notices.id = 'release-notices';
    document.body.append(notices);
  }
  notices.append(box);
}

export function announceLoadedVersion() {
  if (LOCAL || APP_VERSION === 'development') return;
  let previous;
  try { previous = localStorage.getItem('keepscore.loaded-version'); } catch { /* Notification still works when storage is unavailable. */ }
  const message = loadedVersionMessage(APP_VERSION, previous);
  if (message) notice('version-loaded', message);
  try { localStorage.setItem('keepscore.loaded-version', APP_VERSION); } catch { /* Match storage handles its own failures. */ }
}

export function watchForUpdate(registration) {
  const ready = () => {
    if (registration.waiting && navigator.serviceWorker.controller) {
      notice('version-ready', 'A KeepScore update is ready. When you’ve finished, close all KeepScore tabs and reopen the app to load it.');
    }
  };
  ready();
  const watchInstalling = () => {
    const worker = registration.installing;
    if (worker) worker.addEventListener('statechange', () => { if (worker.state === 'installed') ready(); });
  };
  watchInstalling();
  registration.addEventListener('updatefound', watchInstalling);
}
