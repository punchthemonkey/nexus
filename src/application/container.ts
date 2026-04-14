import 'reflect-metadata';
import { container } from 'tsyringe';
import { EventBus, IEventBus } from './event-bus';
import { ILLMProvider } from '@/domain/ports/ILLMProvider';
import { IMemoryStore } from '@/domain/ports/IMemoryStore';
import { IToolExecutor } from '@/domain/ports/IToolExecutor';
import { IKeychain } from '@/domain/ports/IKeychain';
import { LocalLLMAdapter } from '@/infrastructure/adapters/llm/LocalLLMAdapter';
import { OpenAIAdapter } from '@/infrastructure/adapters/llm/providers/OpenAIAdapter';
import { AnthropicAdapter } from '@/infrastructure/adapters/llm/providers/AnthropicAdapter';
import { GeminiAdapter } from '@/infrastructure/adapters/llm/providers/GeminiAdapter';
import { IndexedDBAdapter } from '@/infrastructure/adapters/storage/IndexedDBAdapter';
import { TursoSyncAdapter } from '@/infrastructure/adapters/storage/TursoSyncAdapter';
import { ToolExecutorAdapter } from '@/infrastructure/adapters/tools/ToolExecutorAdapter';
import { WebCryptoKeychain } from '@/infrastructure/adapters/keychain/WebCryptoKeychain';
import { Orchestrator } from '@/domain/orchestrator/Orchestrator';
import { ProviderSelector } from '@/domain/orchestrator/ProviderSelector';
import { SkillRegistry } from '@/domain/skills/SkillRegistry';
import { StruggleLogger } from './services/StruggleLogger';
import { ThermalMonitor } from '@/infrastructure/monitoring/ThermalMonitor';
import { AdaptiveScheduler } from '@/infrastructure/monitoring/AdaptiveScheduler';
import { TabCoordinator } from '@/infrastructure/coordination/TabCoordinator';
import { Profiler } from '@/infrastructure/monitoring/Profiler';
import { getTursoConfig } from '@/infrastructure/config/turso.config';

export async function initializeContainer(): Promise<void> {
  // EventBus
  const eventBus = new EventBus();
  container.registerInstance<IEventBus>('EventBus', eventBus);

  // Keychain
  const keychain = new WebCryptoKeychain();
  await keychain.initialize();
  container.registerInstance<IKeychain>('IKeychain', keychain);

  // Local LLM (default)
  const localLLM = new LocalLLMAdapter();
  container.registerInstance('LocalLLMAdapter', localLLM);
  container.registerInstance<ILLMProvider>('ILLMProvider', localLLM);

  // Storage
  const indexedDB = new IndexedDBAdapter();
  await indexedDB.initialize();
  container.registerInstance('IndexedDBAdapter', indexedDB);

  const tursoConfig = getTursoConfig();
  let memoryStore: IMemoryStore = indexedDB;
  if (tursoConfig) {
    const tursoAdapter = new TursoSyncAdapter(indexedDB, eventBus);
    await tursoAdapter.initialize(tursoConfig);
    memoryStore = tursoAdapter;
  }
  container.registerInstance<IMemoryStore>('IMemoryStore', memoryStore);

  // Tool Executor
  const toolExecutor = new ToolExecutorAdapter();
  container.registerInstance<IToolExecutor>('IToolExecutor', toolExecutor);

  // Monitoring services
  container.registerSingleton(ThermalMonitor);
  container.registerSingleton(AdaptiveScheduler);
  container.registerSingleton(TabCoordinator);
  container.registerSingleton(Profiler);

  // Application services
  container.register(ProviderSelector);
  container.register(Orchestrator);
  container.registerSingleton(StruggleLogger);
  
  // Initialize StruggleLogger (rehydrate logs)
  const logger = container.resolve(StruggleLogger);
  await logger.initialize();

  // Skills
  const skillRegistry = new SkillRegistry(memoryStore);
  await skillRegistry.initialize();
  container.registerInstance(SkillRegistry, skillRegistry);

  // LLM Provider Factory
  container.registerFactory<ILLMProvider>('LLMProviderFactory', (c) => {
    return (type: 'local' | 'openai' | 'anthropic' | 'gemini') => {
      if (type === 'local') return c.resolve('LocalLLMAdapter');
      const keychain = c.resolve<IKeychain>('IKeychain');
      switch (type) {
        case 'openai': return new OpenAIAdapter(keychain);
        case 'anthropic': return new AnthropicAdapter(keychain);
        case 'gemini': return new GeminiAdapter(keychain);
        default: throw new Error(`Unknown provider: ${type}`);
      }
    };
  });
}

export { container };
