import 'reflect-metadata';
import { container } from 'tsyringe';
import { EventBus } from './event-bus';
import { ILLMProvider } from '@/domain/ports/ILLMProvider';
import { IMemoryStore } from '@/domain/ports/IMemoryStore';
import { IToolExecutor } from '@/domain/ports/IToolExecutor';
import { IKeychain } from '@/domain/ports/IKeychain';
import { LocalLLMAdapter } from '@/infrastructure/adapters/llm/LocalLLMAdapter';
import { OpenAIAdapter } from '@/infrastructure/adapters/llm/providers/OpenAIAdapter';
import { AnthropicAdapter } from '@/infrastructure/adapters/llm/providers/AnthropicAdapter';
import { GeminiAdapter } from '@/infrastructure/adapters/llm/providers/GeminiAdapter';
import { IndexedDBAdapter } from '@/infrastructure/adapters/storage/IndexedDBAdapter';
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
import { selfModifySkill } from '@/domain/skills/SelfModifySkill';

export async function initializeContainer(): Promise<void> {
  // EventBus
  const eventBus = new EventBus();
  container.registerInstance('EventBus', eventBus);

  // Keychain
  const keychain = new WebCryptoKeychain();
  await keychain.initialize();
  container.registerInstance('IKeychain', keychain);

  // Local LLM
  const localLLM = new LocalLLMAdapter();
  container.registerInstance('LocalLLMAdapter', localLLM);
  container.registerInstance<ILLMProvider>('ILLMProvider', localLLM);

  // Storage
  const indexedDB = new IndexedDBAdapter();
  await indexedDB.initialize();
  container.registerInstance('IndexedDBAdapter', indexedDB);
  container.registerInstance<IMemoryStore>('IMemoryStore', indexedDB);

  // Tool Executor
  const toolExecutor = new ToolExecutorAdapter();
  container.registerInstance<IToolExecutor>('IToolExecutor', toolExecutor);

  // Monitoring services
  container.registerSingleton(ThermalMonitor);
  container.registerSingleton(AdaptiveScheduler);
  container.registerSingleton(TabCoordinator);
  container.registerSingleton(Profiler);

  // ProviderSelector
  container.register(ProviderSelector);

  // Orchestrator
  container.register(Orchestrator);

  // Skills
  const skillRegistry = new SkillRegistry(indexedDB);
  await skillRegistry.initialize();
  await skillRegistry.install(selfModifySkill); // Fragment 12 requirement
  container.registerInstance(SkillRegistry, skillRegistry);

  // StruggleLogger
  const struggleLogger = container.resolve(StruggleLogger);
  await struggleLogger.initialize();

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
