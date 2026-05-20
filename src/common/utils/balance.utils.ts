export interface TierBalance {
  h50: number;
  h60: number;
  h100: number;
  nightHours: number;
  totalExtra: number;
  financeiro: {
    v50: number;
    v60: number;
    v100: number;
    vNight: number;
    total: number;
  };
}

function buildTierBalance(
  h50: number,
  h60: number,
  h100: number,
  nightHours: number,
  hourlyRate: number,
  nightMultiplier: number,
): TierBalance {
  const v50 = +(h50 * hourlyRate * 1.5).toFixed(2);
  const v60 = +(h60 * hourlyRate * 1.6).toFixed(2);
  const v100 = +(h100 * hourlyRate * 2.0).toFixed(2);
  const vNight = +(nightHours * hourlyRate * nightMultiplier).toFixed(2);
  return {
    h50: +h50.toFixed(2),
    h60: +h60.toFixed(2),
    h100: +h100.toFixed(2),
    nightHours: +nightHours.toFixed(2),
    totalExtra: +(h50 + h60 + h100).toFixed(2),
    financeiro: { v50, v60, v100, vNight, total: +(v50 + v60 + v100 + vNight).toFixed(2) },
  };
}

export function computeGross(
  saidas: Array<{ extraHours50: number; extraHours60?: number; extraHours100: number; nightHours: number }>,
  hourlyRate: number,
  nightMultiplier: number,
): TierBalance {
  const h50 = saidas.reduce((s, r) => s + Number(r.extraHours50), 0);
  const h60 = saidas.reduce((s, r) => s + Number((r as any).extraHours60 ?? 0), 0);
  const h100 = saidas.reduce((s, r) => s + Number(r.extraHours100), 0);
  const nightHours = saidas.reduce((s, r) => s + Number(r.nightHours), 0);
  return buildTierBalance(h50, h60, h100, nightHours, hourlyRate, nightMultiplier);
}

// Deduz horas na ordem 100% → 60% → 50%.
// nightHours é deduzido proporcionalmente ao overtime quitado
// (ex: pagar 50% das extras → 50% do adicional noturno deduzido).
export function deductFromTiers(
  gross: Pick<TierBalance, 'h50' | 'h60' | 'h100' | 'nightHours'>,
  toDeduct: number,
  hourlyRate: number,
  nightMultiplier: number,
): { disponivel: TierBalance; valorDeducido: number } {
  let rem = Math.max(0, toDeduct);
  const cut100 = Math.min(gross.h100, rem); rem -= cut100;
  const cut60 = Math.min(gross.h60, rem); rem -= cut60;
  const cut50 = Math.min(gross.h50, rem);

  const totalOvertime = gross.h50 + gross.h60 + gross.h100;
  const deductedOvertime = cut50 + cut60 + cut100;
  const nightRatio = totalOvertime > 0 ? deductedOvertime / totalOvertime : 0;
  const cutNight = +(gross.nightHours * nightRatio).toFixed(4);

  const valorDeducido = +(
    cut100 * hourlyRate * 2.0 +
    cut60 * hourlyRate * 1.6 +
    cut50 * hourlyRate * 1.5 +
    cutNight * hourlyRate * nightMultiplier
  ).toFixed(2);

  return {
    disponivel: buildTierBalance(
      gross.h50 - cut50,
      gross.h60 - cut60,
      gross.h100 - cut100,
      +(gross.nightHours - cutNight).toFixed(4),
      hourlyRate,
      nightMultiplier,
    ),
    valorDeducido,
  };
}
