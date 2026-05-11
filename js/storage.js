// Wrapper de IndexedDB para persistencia local
// Almacena: sesiones, respuestas, racha, estado SRS, perfil del usuario

window.IIAPP = window.IIAPP || {};

window.IIAPP.Storage = (function() {
  const DB_NAME = 'iiapp_db';
  const DB_VERSION = 1;
  const STORES = {
    sessions: 'sessions',
    answers: 'answers',
    srs: 'srs',
    profile: 'profile',
    cache: 'cache'
  };

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORES.sessions)) {
          const store = db.createObjectStore(STORES.sessions, { keyPath: 'id' });
          store.createIndex('finishedAt', 'finishedAt');
        }
        if (!db.objectStoreNames.contains(STORES.answers)) {
          const store = db.createObjectStore(STORES.answers, { keyPath: 'id', autoIncrement: true });
          store.createIndex('sessionId', 'sessionId');
          store.createIndex('questionId', 'questionId');
          store.createIndex('answeredAt', 'answeredAt');
        }
        if (!db.objectStoreNames.contains(STORES.srs)) {
          db.createObjectStore(STORES.srs, { keyPath: 'questionId' });
        }
        if (!db.objectStoreNames.contains(STORES.profile)) {
          db.createObjectStore(STORES.profile, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORES.cache)) {
          db.createObjectStore(STORES.cache, { keyPath: 'key' });
        }
      };
    });
    return dbPromise;
  }

  async function tx(storeName, mode = 'readonly') {
    const db = await open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function promisify(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ----- SESSIONS -----
  async function saveSession(session) {
    const store = await tx(STORES.sessions, 'readwrite');
    return promisify(store.put(session));
  }

  async function getAllSessions() {
    const store = await tx(STORES.sessions);
    return promisify(store.getAll());
  }

  async function getSession(id) {
    const store = await tx(STORES.sessions);
    return promisify(store.get(id));
  }

  // ----- ANSWERS -----
  async function saveAnswer(answer) {
    const store = await tx(STORES.answers, 'readwrite');
    return promisify(store.add(answer));
  }

  async function getAnswersBySession(sessionId) {
    const store = await tx(STORES.answers);
    const idx = store.index('sessionId');
    return promisify(idx.getAll(sessionId));
  }

  async function getAllAnswers() {
    const store = await tx(STORES.answers);
    return promisify(store.getAll());
  }

  async function getAnswersByQuestion(questionId) {
    const store = await tx(STORES.answers);
    const idx = store.index('questionId');
    return promisify(idx.getAll(questionId));
  }

  // ----- SRS -----
  async function saveSrsState(state) {
    const store = await tx(STORES.srs, 'readwrite');
    return promisify(store.put(state));
  }

  async function getSrsState(questionId) {
    const store = await tx(STORES.srs);
    return promisify(store.get(questionId));
  }

  async function getAllSrsStates() {
    const store = await tx(STORES.srs);
    return promisify(store.getAll());
  }

  async function getSrsDue(now = Date.now()) {
    const all = await getAllSrsStates();
    return all.filter(s => (s.nextReviewAt || 0) <= now);
  }

  // ----- PROFILE -----
  async function setProfile(key, value) {
    const store = await tx(STORES.profile, 'readwrite');
    return promisify(store.put({ key, value }));
  }

  async function getProfile(key) {
    const store = await tx(STORES.profile);
    const result = await promisify(store.get(key));
    return result ? result.value : null;
  }

  async function getAllProfile() {
    const store = await tx(STORES.profile);
    const all = await promisify(store.getAll());
    return all.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
  }

  // ----- CACHE (genérico) -----
  async function setCache(key, value) {
    const store = await tx(STORES.cache, 'readwrite');
    return promisify(store.put({ key, value, timestamp: Date.now() }));
  }

  async function getCache(key) {
    const store = await tx(STORES.cache);
    const result = await promisify(store.get(key));
    return result ? result.value : null;
  }

  // ----- EXPORTACIÓN / IMPORTACIÓN -----
  async function exportAll() {
    const data = {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      sessions: await getAllSessions(),
      answers: await getAllAnswers(),
      srs: await getAllSrsStates(),
      profile: await getAllProfile()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iiapp-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return data;
  }

  async function importAll(data) {
    if (!data.sessions || !data.answers) throw new Error('Backup inválido');
    await clearAll(false);
    for (const s of data.sessions) await saveSession(s);
    for (const a of data.answers) {
      const { id, ...rest } = a;
      await saveAnswer(rest);
    }
    for (const r of (data.srs || [])) await saveSrsState(r);
    if (data.profile) {
      for (const [k, v] of Object.entries(data.profile)) await setProfile(k, v);
    }
  }

  async function clearAll(confirmFlag = true) {
    if (confirmFlag && !confirm('¿Borrar TODO el progreso local? Esta acción no se puede deshacer.')) return;
    const db = await open();
    const t = db.transaction([STORES.sessions, STORES.answers, STORES.srs, STORES.profile, STORES.cache], 'readwrite');
    t.objectStore(STORES.sessions).clear();
    t.objectStore(STORES.answers).clear();
    t.objectStore(STORES.srs).clear();
    t.objectStore(STORES.profile).clear();
    t.objectStore(STORES.cache).clear();
    return new Promise((res, rej) => {
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
    });
  }

  return {
    open,
    saveSession, getAllSessions, getSession,
    saveAnswer, getAnswersBySession, getAllAnswers, getAnswersByQuestion,
    saveSrsState, getSrsState, getAllSrsStates, getSrsDue,
    setProfile, getProfile, getAllProfile,
    setCache, getCache,
    exportAll, importAll, clearAll
  };
})();
