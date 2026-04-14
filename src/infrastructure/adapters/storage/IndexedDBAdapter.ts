import { openDB, IDBPDatabase } from 'idb';
import { injectable } from 'tsyringe';
import { IMemoryStore } from '@/domain/ports/IMemoryStore';
import { Conversation, Message, StruggleLog } from '@/domain/entities';

interface NexusDBSchema {
  conversations: {
    key: string;
    value: Conversation;
    indexes: { 'by-updated': number };
  };
  messages: {
    key: string;
    value: Message & { conversationId: string };
    indexes: { 'by-conversation': string };
  };
  skills: {
    key: string;
    value: any;
  };
  struggleLogs: {
    key: string;
    value: StruggleLog;
    indexes: { 'by-timestamp': number };
  };
  keychain: {
    key: string;
    value: { iv: Uint8Array; ciphertext: Uint8Array };
  };
  settings: {
    key: string;
    value: any;
  };
  syncQueue: {
    key: string;
    value: any;
    indexes: { 'by-timestamp': number };
  };
}

@injectable()
export class IndexedDBAdapter implements IMemoryStore {
  private db: IDBPDatabase<NexusDBSchema> | null = null;
  private readonly DB_NAME = 'nexus-db';
  private readonly VERSION = 2; // Incremented for struggleLogs addition

  async initialize(): Promise<void> {
    this.db = await openDB<NexusDBSchema>(this.DB_NAME, this.VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Conversations store
        if (!db.objectStoreNames.contains('conversations')) {
          const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
          convStore.createIndex('by-updated', 'updatedAt');
        }

        // Messages store
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('by-conversation', 'conversationId');
        }

        // Skills store
        if (!db.objectStoreNames.contains('skills')) {
          db.createObjectStore('skills', { keyPath: 'id' });
        }

        // Struggle logs store (added in Fragment 12)
        if (!db.objectStoreNames.contains('struggleLogs')) {
          const logStore = db.createObjectStore('struggleLogs', { keyPath: 'id' });
          logStore.createIndex('by-timestamp', 'timestamp');
        }

        // Keychain store (may be used separately but defined for completeness)
        if (!db.objectStoreNames.contains('keychain')) {
          db.createObjectStore('keychain', { keyPath: 'provider' });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }

  private ensureDB(): IDBPDatabase<NexusDBSchema> {
    if (!this.db) throw new Error('Database not initialized. Call initialize() first.');
    return this.db;
  }

  async getDB(): Promise<IDBPDatabase<NexusDBSchema>> {
    if (!this.db) await this.initialize();
    return this.db!;
  }

  // --- Conversation operations ---
  async saveConversation(conversation: Conversation): Promise<void> {
    const db = this.ensureDB();
    await db.put('conversations', {
      ...conversation,
      messages: [], // Messages stored separately
    });
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const db = this.ensureDB();
    const conv = await db.get('conversations', id);
    if (!conv) return null;
    
    const messages = await db.getAllFromIndex('messages', 'by-conversation', id);
    conv.messages = messages.sort((a, b) => a.timestamp - b.timestamp);
    return conv;
  }

  async listConversations(limit = 20): Promise<Conversation[]> {
    const db = this.ensureDB();
    const index = db.transaction('conversations').store.index('by-updated');
    const convs: Conversation[] = [];
    let cursor = await index.openCursor(null, 'prev');
    while (cursor && convs.length < limit) {
      const conv = cursor.value;
      // Load messages (could be optimized to batch load)
      const messages = await db.getAllFromIndex('messages', 'by-conversation', conv.id);
      conv.messages = messages.sort((a, b) => a.timestamp - b.timestamp);
      convs.push(conv);
      cursor = await cursor.continue();
    }
    return convs;
  }

  async deleteConversation(id: string): Promise<void> {
    const db = this.ensureDB();
    const tx = db.transaction(['conversations', 'messages'], 'readwrite');
    
    // Delete all messages for this conversation
    const msgIndex = tx.objectStore('messages').index('by-conversation');
    let cursor = await msgIndex.openCursor(id);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    
    await tx.objectStore('conversations').delete(id);
    await tx.done;
  }

  // --- Message operations ---
  async saveMessage(conversationId: string, message: Message): Promise<void> {
    const db = this.ensureDB();
    
    // Ensure conversation exists
    let conv = await db.get('conversations', conversationId);
    if (!conv) {
      conv = {
        id: conversationId,
        title: 'New Conversation',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      };
      await db.put('conversations', conv);
    }
    
    // Save message with conversationId field
    await db.put('messages', {
      ...message,
      conversationId,
    } as any);
    
    // Update conversation updatedAt
    conv.updatedAt = Date.now();
    await db.put('conversations', conv);
  }

  // --- Struggle log operations (Fragment 12) ---
  async saveStruggleLog(log: StruggleLog): Promise<void> {
    const db = this.ensureDB();
    await db.put('struggleLogs', log);
  }

  async getStruggleLogs(limit?: number): Promise<StruggleLog[]> {
    const db = this.ensureDB();
    const index = db.transaction('struggleLogs').store.index('by-timestamp');
    const logs: StruggleLog[] = [];
    let cursor = await index.openCursor(null, 'prev');
    while (cursor) {
      logs.push(cursor.value);
      if (limit && logs.length >= limit) break;
      cursor = await cursor.continue();
    }
    return logs;
  }
}
