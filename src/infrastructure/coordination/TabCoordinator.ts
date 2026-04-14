import { injectable } from 'tsyringe';

@injectable()
export class TabCoordinator {
  isLeaderTab(): boolean {
    return true;
  }
  dispose(): void {}
}
