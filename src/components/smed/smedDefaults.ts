export function calculateDurationFromTimes(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  let diffMin = (eh * 60 + em) - (sh * 60 + sm);
  if (diffMin < 0) diffMin += 1440; // wrap around midnight
  return diffMin;
}
