import { Conversation, Message, StruggleLog } from '../entities';

export interface IMemoryStore {
  // Conversation operations
  saveConversation(conversation: Conversation): Promise<void>;
  getConversation(id: string): Promise<Conversation | null>;
  listConversations(limit?: number): Promise<Conversation[]>;
  deleteConversation(id: string): Promise<void>;
  
  // Message operations
  saveMessage(conversationId: string, message: Message): Promise<void>;
  
  // Struggle log operations (added in Fragment 12)
  saveStruggleLog(log: StruggleLog): Promise<void>;
  getStruggleLogs(limit?: number): Promise<StruggleLog[]>;
}
