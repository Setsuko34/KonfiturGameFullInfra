// Agrégation par jour pour les graphes du dashboard (heure locale serveur,
// même convention que l'affichage fr-FR du site).
export interface DayCount {
  date: string
  count: number
}

function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function aggregateByDay(isoDates: string[], days: number, now: Date = new Date()): DayCount[] {
  const counts = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    counts.set(dayKey(d), 0)
  }
  for (const isoDate of isoDates) {
    const key = dayKey(new Date(isoDate))
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].map(([date, count]) => ({ date, count }))
}
