export type SimulationInput = { entry: number; margin: number; leverage: number; side: 'long' | 'short'; exit: number; mode?: 'isolated' | 'cross'; extraCollateral?: number; maintenanceRate?: number; feeRate?: number };
export type SimulationResult = { notional: number; quantity: number; collateral: number; openingFee: number; liquidation: number | null; liquidationDistance: number | null; reachedLiquidation: boolean; grossPnl: number; fees: number; netPnl: number; roi: number; move: number; equityAtExit: number };
export function simulate(input: SimulationInput): SimulationResult | null;
