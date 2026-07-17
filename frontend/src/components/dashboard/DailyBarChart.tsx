import type { DayCount } from '@/lib/dashboard-utils'

interface DailyBarChartProps {
  title: string
  data: DayCount[]
  total: number
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export default function DailyBarChart({ title, data, total }: DailyBarChartProps) {
  const max = Math.max(1, ...data.map(d => d.count))
  const barW = 100 / Math.max(1, data.length)

  return (
    <section className="p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
          {title}
        </h2>
        <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)' }}>{total}</span>
      </div>

      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="w-full h-24"
        role="img"
        aria-label={`${title} : ${total} au total sur ${data.length} jours`}
      >
        {data.map((d, i) => {
          const h = (d.count / max) * 36
          return (
            <rect
              key={d.date}
              x={i * barW + barW * 0.15}
              y={40 - h}
              width={barW * 0.7}
              height={h}
              fill="var(--primary)"
            >
              <title>{`${formatDay(d.date)} : ${d.count}`}</title>
            </rect>
          )
        })}
      </svg>

      {data.length > 1 && (
        <div
          className="flex justify-between mt-2 text-[9px]"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)' }}
          aria-hidden="true"
        >
          <span>{formatDay(data[0].date)}</span>
          <span>{formatDay(data[data.length - 1].date)}</span>
        </div>
      )}

      {/* Équivalent texte pour lecteurs d'écran */}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map(d => (
            <tr key={d.date}>
              <th scope="row">{formatDay(d.date)}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
