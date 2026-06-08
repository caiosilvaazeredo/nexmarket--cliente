/** Formatting helpers (BRL currency, distances, dates). */

export const brl = (value: number | undefined | null): string =>
  `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;

export const formatDistance = (meters: number): string => {
  if (!isFinite(meters) || meters < 0) return '--';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
};

/** Rough ETA assuming ~22 km/h average urban scooter speed. */
export const etaMinutes = (meters: number): number => {
  const speed = 22_000 / 60; // meters per minute
  return Math.max(1, Math.round(meters / speed));
};

export const formatTime = (ts: any): string => {
  const d = toDate(ts);
  if (!d) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (ts: any): string => {
  const d = toDate(ts);
  if (!d) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

export const formatDateTime = (ts: any): string => {
  const d = toDate(ts);
  if (!d) return '';
  return `${formatDate(ts)}, ${formatTime(ts)}`;
};

export function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts?.toDate === 'function') return ts.toDate();
  if (typeof ts === 'number') return new Date(ts);
  if (typeof ts?.seconds === 'number') return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

export const fullAddress = (a?: {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
}): string => {
  if (!a) return 'Endereço não informado';
  const line = [a.street, a.number].filter(Boolean).join(', ');
  const rest = [a.neighborhood, a.city].filter(Boolean).join(' - ');
  return [line, rest].filter(Boolean).join(' • ') || 'Endereço não informado';
};

/** Format a digits-only phone string to (DD) NNNNN-NNNN as the user types. */
export const formatPhone = (raw: string): string => {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

/** Format CEP as NNNNN-NNN. */
export const formatCep = (raw: string): string => {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
};

export const onlyDigits = (s: string): string => (s || '').replace(/\D/g, '');

/** Relative "x min atrás" style label. */
export const relativeTime = (ts: any): string => {
  const d = toDate(ts);
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return formatDate(ts);
};
