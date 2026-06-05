export function computeJamStatus(
  startDate: Date,
  endDate: Date,
  now: Date = new Date()
): 'upcoming' | 'ongoing' | 'ended' {
  if (now >= endDate) return 'ended'
  if (now >= startDate) return 'ongoing'
  return 'upcoming'
}
