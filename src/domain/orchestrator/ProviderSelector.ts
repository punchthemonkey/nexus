import { injectable, inject } from 'tsyringe';
import { Message, Skill } from '../entities';
import { IKeychain } from '../ports/IKeychain';

export interface SystemMetrics {
  thermalState: 'nominal' | 'fair' | 'serious' | 'critical';
  batteryLevel: number;
  isCharging: boolean;
  networkType: string;
  gpuMemoryPressure: 'low' | 'moderate' | 'high';
  online: boolean;
}

export type ProviderType = 'local' | 'openai' | 'anthropic' | 'gemini';

@injectable()
export class ProviderSelector {
  constructor(
    @inject('IKeychain') private keychain: IKeychain
  ) {}

  async select(
    messages: Message[],
    metrics: SystemMetrics,
    activeSkill?: Skill | null
  ): Promise<ProviderType> {
    // 1. Skill override
    if (activeSkill?.preferredProvider) {
      return activeSkill.preferredProvider;
    }

    // 2. Offline -> local
    if (!metrics.online) {
      return 'local';
    }

    // 3. Thermal/Battery constraints -> local
    if (metrics.thermalState === 'critical' || metrics.batteryLevel < 0.15) {
      return 'local';
    }

    // 4. Check if cloud keys are available
    const hasOpenAI = await this.keychain.hasKey('openai').catch(() => false);
    const hasAnthropic = await this.keychain.hasKey('anthropic').catch(() => false);
    const hasGemini = await this.keychain.hasKey('gemini').catch(() => false);

    // 5. Complexity heuristic: >5 messages or tool usage -> cloud (prefer OpenAI)
    const hasToolUse = messages.some(m => m.role === 'tool' || m.toolCalls);
    if (messages.length > 5 || hasToolUse) {
      if (hasOpenAI) return 'openai';
      if (hasAnthropic) return 'anthropic';
      if (hasGemini) return 'gemini';
    }

    // Default: local
    return 'local';
  }
}
