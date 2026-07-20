import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'default'
  const title = searchParams.get('title') ?? 'KonfiturGame'
  const subtitle = searchParams.get('theme') ?? searchParams.get('jam') ?? ''
  const status = searchParams.get('status') ?? ''

  const statusLabel: Record<string, string> = {
    ongoing: 'EN COURS',
    upcoming: 'À VENIR',
    ended: 'TERMINÉ',
  }

  const accentColor = status === 'ongoing' ? '#EF233C' : '#4F6AFF'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0C1018',
          padding: '48px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Bordure accent top */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: accentColor,
        }} />

        {/* Brand */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: 'auto',
        }}>
          <span style={{ fontSize: '14px', color: '#4F6AFF', fontWeight: '700', letterSpacing: '4px' }}>
            KONFITURGAME
          </span>
          {status && (
            <span style={{
              fontSize: '11px',
              color: accentColor,
              fontWeight: '700',
              letterSpacing: '3px',
              marginLeft: '16px',
            }}>
              {statusLabel[status]}
            </span>
          )}
        </div>

        {/* Titre principal */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto' }}>
          {subtitle && (
            <span style={{
              fontSize: '22px',
              color: '#4F6AFF',
              fontWeight: '600',
              marginBottom: '12px',
              letterSpacing: '1px',
            }}>
              {type === 'jam' ? `Thème : ${subtitle}` : subtitle}
            </span>
          )}
          <span style={{
            fontSize: title.length > 40 ? '48px' : '64px',
            fontWeight: '700',
            color: '#FFFFFF',
            lineHeight: '1.1',
            letterSpacing: '-1px',
          }}>
            {title}
          </span>
          <span style={{
            fontSize: '16px',
            color: '#6B7280',
            marginTop: '16px',
            letterSpacing: '2px',
          }}>
            La plateforme française de game jams
          </span>
        </div>

        {/* Grid decoration */}
        <div style={{
          position: 'absolute',
          right: '48px',
          top: '48px',
          bottom: '48px',
          width: '200px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          opacity: 0.08,
        }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{
              height: '1px',
              background: '#FFFFFF',
              width: i % 2 === 0 ? '100%' : '60%',
            }} />
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
