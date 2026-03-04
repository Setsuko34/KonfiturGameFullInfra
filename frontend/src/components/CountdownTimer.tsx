'use client'

import { useState, useEffect, useCallback } from 'react'

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

interface CountdownTimerProps {
  targetDate: Date
  size?: 'sm' | 'md' | 'lg' | 'xl'
  label?: string
  onExpired?: () => void
}

function calculateTimeLeft(target: Date): TimeLeft {
  const diff = target.getTime() - Date.now()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}

const sizeConfig = {
  sm: { digit: 'text-xl', label: 'text-[9px]', gap: 'gap-2' },
  md: { digit: 'text-3xl', label: 'text-[10px]', gap: 'gap-3' },
  lg: { digit: 'text-5xl', label: 'text-[10px]', gap: 'gap-4' },
  xl: { digit: 'text-7xl', label: 'text-xs', gap: 'gap-5' },
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function CountdownTimer({
  targetDate,
  size = 'md',
  label,
  onExpired,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(targetDate))
  const [expired, setExpired] = useState(false)

  const tick = useCallback(() => {
    const tl = calculateTimeLeft(targetDate)
    setTimeLeft(tl)
    if (tl.days === 0 && tl.hours === 0 && tl.minutes === 0 && tl.seconds === 0) {
      setExpired(true)
      onExpired?.()
    }
  }, [targetDate, onExpired])

  useEffect(() => {
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [tick])

  const isUrgent = !expired && timeLeft.days === 0 && timeLeft.hours < 2
  const cfg = sizeConfig[size]

  const segments = [
    { value: timeLeft.days, unit: 'JOURS' },
    { value: timeLeft.hours, unit: 'HEURES' },
    { value: timeLeft.minutes, unit: 'MIN' },
    { value: timeLeft.seconds, unit: 'SEC' },
  ]

  return (
    <div
      role="timer"
      aria-label={label ?? `Compte à rebours : ${timeLeft.days}j ${timeLeft.hours}h ${timeLeft.minutes}min ${timeLeft.seconds}s`}
      aria-live="off"
    >
      {label && (
        <p
          className="label-tech mb-2"
          style={{ color: 'var(--muted-foreground)' }}
          aria-hidden="true"
        >
          {label}
        </p>
      )}
      <div className={`flex items-end ${cfg.gap}`}>
        {segments.map((seg, i) => (
          <div key={seg.unit} className="flex items-end gap-1">
            {/* Digit */}
            <div className="flex flex-col items-center">
              <span
                className={`timer-font font-bold leading-none ${cfg.digit} ${isUrgent ? 'animate-pulse-urgent' : ''}`}
                style={{ color: isUrgent ? 'var(--secondary)' : 'var(--foreground)' }}
                aria-hidden="true"
              >
                {pad(seg.value)}
              </span>
              <span
                className={`label-tech mt-1 ${cfg.label}`}
                style={{ color: isUrgent ? 'var(--secondary)' : 'var(--muted-foreground)' }}
                aria-hidden="true"
              >
                {seg.unit}
              </span>
            </div>
            {/* Séparateur */}
            {i < segments.length - 1 && (
              <span
                className={`timer-font font-bold leading-none mb-5 ${cfg.digit}`}
                style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}
                aria-hidden="true"
              >
                :
              </span>
            )}
          </div>
        ))}
      </div>
      {expired && (
        <p className="label-tech mt-2" style={{ color: 'var(--secondary)' }}>
          TERMINÉ
        </p>
      )}
    </div>
  )
}
