import { injectable, inject } from 'tsyringe';
import { Skill } from '../entities/Skill';
import { IMemoryStore } from '../ports/IMemoryStore';

@injectable()
export class SkillRegistry {
  private activeSkill: Skill | null = null;
  
  constructor(@inject('IMemoryStore') private memoryStore: IMemoryStore) {}
  
  async initialize(): Promise<void> {}
  
  getActiveSkill(): Skill | null {
    return this.activeSkill;
  }
  
  async activate(skillId: string): Promise<void> {}
  async deactivate(): Promise<void> {}
  async install(skill: Skill): Promise<void> {}
  listSkills(): Skill[] { return []; }
  getSkill(id: string): Skill | undefined { return undefined; }
}
