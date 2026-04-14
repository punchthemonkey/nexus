export interface Skill {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[];
  preferredProvider?: 'local' | 'openai' | 'anthropic' | 'gemini';
  version: string;
  author?: string;
  icon?: string;
  installedAt?: number;
  updateUrl?: string;
  internal?: boolean; // from Fragment 12, selfModifySkill has internal flag
}
