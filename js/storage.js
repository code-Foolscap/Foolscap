// IndexedDB wrapper for saved drafts. The only persistence layer.
// DB "foolscap" v1, store "drafts" keyed by autoincrement id,
// index "updatedAt" so the drafts list can show most-recent first.

const DB_NAME = "foolscap";
const VERSION = 1;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("drafts")) {
        const s = db.createObjectStore("drafts", {
          keyPath: "id",
          autoIncrement: true,
        });
        s.createIndex("updatedAt", "updatedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode) {
  return db.transaction("drafts", mode).objectStore("drafts");
}

export async function saveDraft(draft) {
  const db = await open();
  const now = Date.now();
  const record = {
    ...draft,
    createdAt: draft.createdAt || now,
    updatedAt: now,
  };
  return new Promise((resolve, reject) => {
    const req = tx(db, "readwrite").put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listDrafts() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const out = [];
    const cursor = tx(db, "readonly").index("updatedAt").openCursor(null, "prev");
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) {
        out.push(c.value);
        c.continue();
      } else {
        resolve(out);
      }
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

export async function deleteDraft(id) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = tx(db, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
