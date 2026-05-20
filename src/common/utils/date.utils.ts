const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Retorna a data LOCAL no formato YYYY-MM-DD.
 * Usar no lugar de new Date().toISOString().split('T')[0], que retorna UTC
 * e diverge do horário local em fusos como UTC-3 (Brasil) após as 21h.
 */
export function localDateString(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Retorna a hora LOCAL no formato HH:MM.
 */
export function localTimeString(date = new Date()): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
