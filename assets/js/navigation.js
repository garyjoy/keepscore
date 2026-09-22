export function createNavigation(browser, render) {
  let renderedHash;
  function sync() {
    if (renderedHash === browser.location.hash) return;
    renderedHash = browser.location.hash;
    render();
  }
  browser.addEventListener('popstate', sync);
  browser.addEventListener('hashchange', sync);
  return {
    start() {
      if (!browser.location.hash) browser.history.replaceState(null, '', '#matches');
      sync();
    },
    navigate(destination) {
      const hash = `#${destination.replace(/^#/, '')}`;
      if (browser.location.hash === hash) return;
      // Add history within the user gesture, then render immediately. pushState
      // does not emit hashchange; Back/Forward are handled by popstate above.
      browser.history.pushState(null, '', hash);
      sync();
    },
  };
}
