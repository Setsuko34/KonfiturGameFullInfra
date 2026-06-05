'use client'

import { useState } from 'react'
import CountdownTimer from '@/components/CountdownTimer'

interface Props {
  initialStatus: 'upcoming' | 'ongoing' | 'ended'
  startDate: Date
  endDate: Date
}

export default function JamCountdownClient({ initialStatus, startDate, endDate }: Props) {
  const [status, setStatus] = useState(initialStatus)

  const handleUpcomingExpired = () => {
    setStatus('ongoing')
  }

  const handleOngoingExpired = () => {
    setStatus('ended')
  }

  if (status === 'ended') return null

  return (
    <div
      className="p-6 border w-full lg:w-auto lg:min-w-[280px]"
      style={{ background: 'var(--surface-elevated)', borderColor: 'var(--border)' }}
    >
      {status === 'upcoming' ? (
        <CountdownTimer
          targetDate={startDate}
          size="md"
          label="COMMENCE DANS"
          onExpired={handleUpcomingExpired}
        />
      ) : (
        <>
          <p className="label-tech mb-3" style={{ color: 'var(--secondary)' }}>EN COURS</p>
          <CountdownTimer
            targetDate={endDate}
            size="md"
            label="TEMPS RESTANT"
            onExpired={handleOngoingExpired}
          />
        </>
      )}
    </div>
  )
}
