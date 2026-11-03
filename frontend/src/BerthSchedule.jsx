import { useEffect, useState } from 'react'
import { apiGet } from './api.js'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// Kenya is UTC+3 all year (no daylight saving), so a fixed offset is safe.
const EAT_OFFSET = 3 * HOUR

// How wide one day is on the timeline, in pixels.
const DAY_WIDTH = 140

const STATUS_LABELS = {
  EXPECTED: 'Expected',
  ALONGSIDE: 'Alongside',
  DEPARTED: 'Departed',
}

// The API stores times in UTC. These two show them in Nairobi time.
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Nairobi',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Nairobi',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

function formatTime(iso) {
  return iso ? timeFormat.format(new Date(iso)) : '-'
}

// Midnight (Nairobi time) at the start of the day that contains this moment.
function startOfDay(ms) {
  return Math.floor((ms + EAT_OFFSET) / DAY) * DAY - EAT_OFFSET
}

// One row per berth (even an empty one, so you can see it is free),
// plus a last row for bookings that have no berth yet.
function groupByBerth(berths, calls) {
  const byArrival = [...calls].sort(
    (a, b) => Date.parse(a.eta) - Date.parse(b.eta),
  )
  const rows = berths.map((berth) => ({
    key: berth.id,
    label: berth.name,
    calls: byArrival.filter((call) => call.berth === berth.id),
  }))
  const unassigned = byArrival.filter((call) => call.berth === null)
  if (unassigned.length > 0) {
    rows.push({ key: 'none', label: 'No berth yet', calls: unassigned })
  }
  return rows
}

function Timeline({ rows, calls, now }) {
  // The timeline starts at midnight of the first day with a booking
  // and ends at the end of the last day with one.
  const moments = calls.flatMap((call) => [
    Date.parse(call.eta),
    Date.parse(call.etd),
  ])
  const start = startOfDay(Math.min(...moments))
  const end = startOfDay(Math.max(...moments) - 1) + DAY
  const dayCount = Math.round((end - start) / DAY)
  const trackWidth = dayCount * DAY_WIDTH

  const toPixels = (ms) => ((ms - start) / DAY) * DAY_WIDTH
  const nowIsVisible = now >= start && now <= end

  // aria-hidden: the table below holds the same information in a form
  // that screen readers can use, so this picture is only for the eyes.
  return (
    <div
      className="timeline"
      style={{ '--day-width': `${DAY_WIDTH}px` }}
      aria-hidden="true"
    >
      <div className="timeline-inner">
        <div className="t-row t-head">
          <div className="t-label">Berth</div>
          <div className="t-track" style={{ width: trackWidth }}>
            {Array.from({ length: dayCount }, (_, index) => (
              <div key={index} className="t-day" style={{ left: index * DAY_WIDTH }}>
                {dayFormat.format(new Date(start + index * DAY))}
              </div>
            ))}
          </div>
        </div>

        {rows.map((row) => (
          <div className="t-row" key={row.key}>
            <div className="t-label">{row.label}</div>
            <div className="t-track" style={{ width: trackWidth }}>
              {row.calls.map((call) => {
                const left = toPixels(Date.parse(call.eta))
                const width = Math.max(toPixels(Date.parse(call.etd)) - left, 24)
                const status = STATUS_LABELS[call.status] ?? call.status
                return (
                  <div
                    key={call.id}
                    className={`bar ${call.status.toLowerCase()}`}
                    style={{ left, width }}
                    title={`${call.vessel_name}: ${formatTime(call.eta)} to ${formatTime(call.etd)} (${status})`}
                  >
                    {call.vessel_name}
                  </div>
                )
              })}
              {nowIsVisible && (
                <div className="now-line" style={{ left: toPixels(now) }} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Planned time on top, the actual time underneath once it has happened.
// Keeping both in one cell makes a delay easy to see, and keeps the
// table narrow enough to fit without scrolling sideways.
function PlannedAndActual({ planned, actual }) {
  return (
    <>
      <div>{formatTime(planned)}</div>
      <div className="hint">
        {actual ? `actual ${formatTime(actual)}` : 'actual: not yet'}
      </div>
    </>
  )
}

function CallsTable({ rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Berth</th>
            <th>Vessel</th>
            <th>Arrival</th>
            <th>Departure</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((row) =>
            row.calls.map((call) => (
              <tr key={call.id}>
                <td>{row.label}</td>
                <td>{call.vessel_name}</td>
                <td>
                  <PlannedAndActual planned={call.eta} actual={call.ata} />
                </td>
                <td>
                  <PlannedAndActual planned={call.etd} actual={call.atd} />
                </td>
                <td>
                  <span className={`badge ${call.status.toLowerCase()}`}>
                    {STATUS_LABELS[call.status] ?? call.status}
                  </span>
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  )
}

function BerthSchedule({ token, onUnauthorized }) {
  // null means "still loading"
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    // Two requests at once: the berths, and the bookings.
    Promise.all([
      apiGet('/api/berths/', token),
      apiGet('/api/vessel-calls/', token),
    ])
      .then(([berths, calls]) => {
        // "now" is taken here, when the data arrives, so the red line
        // matches the moment the data was fetched.
        if (!cancelled) setData({ berths, calls, now: Date.now() })
      })
      .catch((err) => {
        if (cancelled) return
        if (err.status === 401) {
          onUnauthorized()
        } else {
          setError(err.message)
        }
      })

    return () => {
      cancelled = true
    }
  }, [token, onUnauthorized])

  if (error) return <p className="notice error">{error}</p>
  if (data === null) return <p className="notice">Loading the schedule...</p>
  if (data.calls.length === 0) {
    return (
      <p className="notice">No bookings yet. Add a vessel call in the admin.</p>
    )
  }

  const rows = groupByBerth(data.berths, data.calls)

  return (
    <>
      <p className="notice">
        Bars run from planned arrival to planned departure. Times are Nairobi
        time (EAT). The red line is now.
      </p>
      <Timeline rows={rows} calls={data.calls} now={data.now} />
      <h3>All bookings</h3>
      <p className="notice">
        Each time is the plan. The actual time appears underneath once it has
        happened.
      </p>
      <CallsTable rows={rows} />
    </>
  )
}

export default BerthSchedule  