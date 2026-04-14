export interface SystemMetrics {
  thermalState: 'nominal' | 'fair' | 'serious' | 'critical';
  batteryLevel: number;        // 0.0 to 1.0
  isCharging: boolean;
  networkType: string;         // '4g', '5g', 'wifi', etc.
  gpuMemoryPressure: 'low' | 'moderate' | 'high';
  online: boolean;
}
