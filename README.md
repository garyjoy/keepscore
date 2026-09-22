# KeepScore

A local-first badminton 3×3 doubles score sheet, designed for a landscape iPad and laptops, with a sequential layout on phones. No accounts, remote database, dependencies, or external fonts.

## Run locally

With Node.js 22 or newer:

```sh
npm run dev
```

Open http://localhost:4173. Do not open `index.html` directly: modules, IndexedDB and the service worker need an HTTP origin. Use HTTPS when hosted.

For an iPad on the same network, open the `Network:` address printed by the server in Safari. Keep the Mac awake and the server running. If macOS asks, allow Node incoming network connections. The preview server listens on all IPv4 network interfaces.

Local-network HTTP supports match entry and storage, but offline installation needs HTTPS (such as GitHub Pages). Records on the iPad are separate from records in the Mac browser.

## Use

- Create a match in Matches. It is saved immediately, even before setup is complete.
- Choose an existing team, or type a new team name and leave the field to add it. Do the same for players. Players are associated with their selected team; pairs belong to the match. Once both lineups are complete, the score grid appears. Existing scores always remain accessible.
- Teams and Players also have dedicated management screens. Removing a directory entry excludes it from future selections and leaves historical matches intact.
- Enter finished scores directly into the grid, with home on the left. Score edits save immediately. Name fields commit when you leave the field, with unfinished typing also saved as a draft. Invalid scores remain editable and do not contribute to totals.
- Game 3 appears when the first two valid games are split. If corrections make it unnecessary, you are asked before its scores are cleared. Cancelling retains the scores but excludes them from totals; they reappear if the first two become split again.
- Matches can be left unfinished. The final winner appears only after all nine rubbers are decided. Concessions can be entered as 21–0 where appropriate to the club's rules.
- Field navigation uses the browser’s native tab order. There are no custom Enter or Tab shortcuts.
- Notes save while typing. Existing records are directly editable.

## Offline and storage

After the first successful online visit, “Ready offline” indicates that the app shell is cached. Reopen the same address without a connection. On iPad, Safari's Share → Add to Home Screen installs the app. A first visit requires a connection. App updates activate after old app tabs/windows close, avoiding a version change during score entry.

Records are in IndexedDB on this browser/device. Clearing website data also clears records. There is no backup, sync, import or export yet. Use one KeepScore tab at a time; simultaneous tab editing is not supported. A failed write produces a persistent Retry save banner. Unsaved changes prompt before leaving where the browser supports it.

## GitHub Pages

```sh
npm test
npm run build
```

Publish the **contents of `dist/`** with GitHub Pages (via a Pages deployment workflow, or copy them to a branch configured for Pages). All URLs are relative, so both `https://username.github.io/` and `https://username.github.io/KeepScore/` work. Hash navigation does not require server rewrite rules. The generated service worker cache name reflects the released assets. The source repository is https://github.com/garyjoy/keepscore. In repository Settings → Pages, choose **GitHub Actions** as the source. The included `.github/workflows/pages.yml` tests, builds and deploys on pushes to `main`; it can also be run manually from the Actions tab. Once enabled and deployed, the app is available at https://garyjoy.github.io/keepscore/.

## Structure and extension points

- `assets/js/scoring.js`: pure scoring and lineup validation; independent of UI and storage.
- `assets/js/navigation.js`: in-app view changes and browser Back/Forward handling.
- `assets/js/players.js`: shared team/player suggestions and field-attached pickers.
- `assets/js/repository.js`: asynchronous `open()` / `save(state)` adapter around IndexedDB. Schema version 1, stable UUIDs and ISO update timestamps provide a base for migrations, export/import, or an API adapter.
- `assets/js/app.js`: match history, directories and score-sheet UI. Matches snapshot names and lineups rather than deriving historical display from mutable directory records.
- `sw.js`: caches only the static application, never match data.
- `tests/scoring.test.js`: exhaustive 0–30 score validation plus match, rubber and lineup rules.
- `tests/players.test.js`: suggestion filtering, touch selection, scrolling, and trackpad selection.
- `tests/navigation.test.js`: browser history, Back/Forward, and direct match links.

Future multi-device storage should add record-level operations and conflict/version handling to the repository contract. The initial adapter saves a single state document atomically; it is intentionally for one device and one active editing tab.

## Validation

`npm test` runs the scoring, picker and browser-history navigation tests. `npm run build` produces the deployable static artifact. Browser and real-iPad checks are still recommended for touch keyboard, install and offline lifecycle behaviour.

## Application versions

Release versions are `1.<commit-count>.<short-commit-id>`, for example `1.12.a3b4c5d`. The count is the number of commits reachable from the built commit. This is a release identifier rather than strict semantic versioning, since the final component is a Git hash. Keep `main` history intact for an increasing count; rewriting history can reduce it. GitHub Actions fetches full history before building.

The build stamps the version into the cached HTML, so the displayed version identifies the app actually loaded, including offline. It appears in the top navigation bar, footer, and match heading. Uncommitted builds and the development server are marked as local previews.

A dismissible notice appears on the first release visit and whenever a different release loads. Reopening the same version does not repeat it (unless browser storage has been cleared). An update-ready notice explains when a newer offline app is waiting; close all KeepScore tabs/windows and reopen to activate it. The app never forces a reload during score entry. Version tracking uses a separate browser preference and does not change match records.
