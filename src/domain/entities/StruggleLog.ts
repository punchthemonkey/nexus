export interface StruggleLog {
  id: string;
  timestamp: number;
  errorType: string;
  context: string;
  stackTrace?: string;
  codeContext?: string;
  resolved: boolean;
}
