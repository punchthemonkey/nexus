export interface IKeychain {
  unlock(masterPassword: string): Promise<void>;
  lock(): void;
  isUnlocked(): boolean;
  saveKey(provider: string, key: string): Promise<void>;
  getKey(provider: string): Promise<string>;
  deleteKey(provider: string): Promise<void>;
  hasKey(provider: string): Promise<boolean>;
}
