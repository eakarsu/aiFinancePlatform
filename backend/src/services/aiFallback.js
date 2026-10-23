'use strict';
// Deterministic offline fallbacks for holdings AI features.
// Used when no provider key is configured or the provider fails; never calls out.
// Every result is labelled aiGenerated:false. This is not tax or financial advice.

function enrich(holdings) {
  return (holdings || []).map((h) => {
    const currentPrice = h.currentPrice ?? h.avgCost ?? 0;
    const currentValue = (h.shares || 0) * currentPrice;
    const costBasis = (h.shares || 0) * (h.avgCost || 0);
    return { symbol: h.symbol, name: h.name, assetType: h.assetType, shares: h.shares, avgCost: h.avgCost, currentPrice, currentValue, costBasis, gainLoss: currentValue - costBasis };
  });
}

function labelled(summary, sections) {
  return { aiGenerated: false, source: 'deterministic-fallback', provider: 'deterministic-fallback', summary, sections, disclaimer: 'Deterministic summary computed locally from your holdings. This is not tax or financial advice.' };
}

function taxLossHarvestFallback(holdings) {
  const rows = enrich(holdings);
  const losers = rows.filter((r) => r.gainLoss < 0);
  const totalLoss = losers.reduce((sum, r) => sum + r.gainLoss, 0);
  return labelled(
    losers.length ? `${losers.length} positions hold ${Math.abs(totalLoss).toFixed(2)} of unrealized losses.` : 'No positions currently show an unrealized loss.',
    [
      { title: 'Harvestable losses', detail: losers.map((r) => `${r.symbol}: ${r.gainLoss.toFixed(2)}`) },
      { title: 'Estimated tax effect', detail: `Rough estimate at a 20% capital-gains rate: ${(Math.abs(totalLoss) * 0.2).toFixed(2)}. Confirm with a tax professional.` },
      { title: 'Wash-sale caution', detail: 'Do not repurchase a substantially identical security within 30 days before or after a harvest sale.' },
    ],
  );
}

function concentrationFallback(holdings) {
  const rows = enrich(holdings);
  const total = rows.reduce((sum, r) => sum + r.currentValue, 0);
  const sorted = [...rows].sort((a, b) => b.currentValue - a.currentValue);
  const top = total > 0 && sorted[0] ? `${sorted[0].symbol} is ${(sorted[0].currentValue / total * 100).toFixed(1)}% of portfolio value.` : 'No holdings to measure.';
  return labelled(top, [
    { title: 'Largest positions', detail: sorted.slice(0, 5).map((r) => `${r.symbol}: ${total > 0 ? (r.currentValue / total * 100).toFixed(1) : '0.0'}%`) },
    { title: 'Positions counted', detail: rows.length },
  ]);
}

function performanceFallback(holdings) {
  const rows = enrich(holdings);
  const gain = rows.reduce((sum, r) => sum + r.gainLoss, 0);
  const winners = rows.filter((r) => r.gainLoss > 0).length;
  return labelled(`Net unrealized gain/loss is ${gain.toFixed(2)} across ${rows.length} positions (${winners} in gain, ${rows.length - winners} not).`, [
    { title: 'Net unrealized gain/loss', detail: gain },
    { title: 'Positions in gain', detail: winners },
    { title: 'Positions counted', detail: rows.length },
  ]);
}

module.exports = { taxLossHarvestFallback, concentrationFallback, performanceFallback };
