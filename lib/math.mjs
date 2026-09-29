export function simulate({
  entry,
  margin,
  leverage,
  side,
  exit,
  mode = "isolated",
  extraCollateral = 0,
  maintenanceRate = 0.005,
  feeRate = 0.0005,
}) {
  const values = [
    entry,
    margin,
    leverage,
    exit,
    extraCollateral,
    maintenanceRate,
    feeRate,
  ];
  if (
    values.some((v) => !Number.isFinite(v)) ||
    entry <= 0 ||
    margin <= 0 ||
    leverage < 1 ||
    leverage > 150 ||
    exit < 0 ||
    extraCollateral < 0 ||
    maintenanceRate < 0 ||
    feeRate < 0 ||
    maintenanceRate + feeRate >= 1
  )
    return null;
  const notional = margin * leverage;
  const quantity = notional / entry;
  const collateral = margin + (mode === "cross" ? extraCollateral : 0);
  const openingFee = notional * feeRate;
  const signed = side === "short" ? -1 : 1;
  const liquidation =
    side === "short"
      ? (quantity * entry + collateral - openingFee) /
        (quantity * (1 + maintenanceRate + feeRate))
      : (quantity * entry - collateral + openingFee) /
        (quantity * (1 - maintenanceRate - feeRate));
  const validLiquidation =
    liquidation > 0 &&
    ((side === "long" && liquidation < entry) ||
      (side === "short" && liquidation > entry));
  const reachedLiquidation =
    validLiquidation &&
    (side === "long" ? exit <= liquidation : exit >= liquidation);
  const grossPnl = signed * quantity * (exit - entry);
  const fees = openingFee + quantity * exit * feeRate;
  const netPnl = reachedLiquidation ? -collateral : grossPnl - fees;
  return {
    notional,
    quantity,
    collateral,
    openingFee,
    liquidation: validLiquidation ? liquidation : null,
    liquidationDistance: validLiquidation
      ? (Math.abs(entry - liquidation) / entry) * 100
      : null,
    reachedLiquidation,
    grossPnl,
    fees,
    netPnl,
    roi: (netPnl / margin) * 100,
    move: ((exit - entry) / entry) * 100,
    equityAtExit: reachedLiquidation ? 0 : collateral + netPnl,
  };
}
