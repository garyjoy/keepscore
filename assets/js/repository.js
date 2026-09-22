// UI code only knows this repository contract. A future API adapter can replace it.
const DATABASE = 'keepscore';
const VERSION = 1;
const fresh = () => ({ schemaVersion: 1, teams: [], players: [], matches: [] });

export function createId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Local-network HTTP does not expose randomUUID; getRandomValues remains available.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export class LocalRepository {
  async open() {
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, VERSION);
      request.onupgradeneeded = () => request.result.createObjectStore('records');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close other KeepScore tabs and try again.'));
    });
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('records', 'readonly');
      const request = tx.objectStore('records').get('state');
      tx.oncomplete = () => {
        const state = request.result || fresh();
        if (state.schemaVersion !== 1) reject(new Error('This data needs a newer version of KeepScore.'));
        else resolve(state);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  save(state) {
    // IndexedDB serializes these transactions; every edit is queued immediately.
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('records', 'readwrite');
      tx.objectStore('records').put(structuredClone(state), 'state');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Save interrupted'));
    });
  }
}

export function newMatch() {
  const side = () => ({ teamId: '', name: '', pairs: Array.from({ length: 3 }, () => [{ playerId: '', name: '' }, { playerId: '', name: '' }]) });
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return { id: createId(), date: today.toISOString().slice(0, 10), home: side(), away: side(), notes: '', scores: Array.from({ length: 9 }, () => [['', ''], ['', ''], ['', '']]), updatedAt: new Date().toISOString() };
}
