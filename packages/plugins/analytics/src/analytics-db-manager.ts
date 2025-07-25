import { AnalyticsEvent } from "./types";

const DB_NAME = "OnboardJSAnalyticsDB";
const STORE_NAME = "eventQueue";
const DB_VERSION = 1;

/**
 * Manages the IndexedDB for storing analytics events.
 * This allows events to be persisted when the device is offline and sent later.
 */
export class AnalyticsDBManager {
  private db: IDBDatabase | null = null;

  /**
   * Initializes the database connection and creates the object store if needed.
   */
  public async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        return resolve();
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        console.error("[AnalyticsDB] Database error:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Adds a batch of events to the database.
   */
  public async addEvents(events: AnalyticsEvent[]): Promise<void> {
    if (!this.db) throw new Error("Database is not initialized.");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      events.forEach((event) => store.put(event));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Retrieves a batch of events from the database.
   */
  public async getEvents(limit: number): Promise<AnalyticsEvent[]> {
    if (!this.db) throw new Error("Database is not initialized.");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll(undefined, limit);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Deletes events from the database by their IDs.
   */
  public async deleteEvents(eventIds: string[]): Promise<void> {
    if (!this.db) throw new Error("Database is not initialized.");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      eventIds.forEach((id) => store.delete(id));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}
