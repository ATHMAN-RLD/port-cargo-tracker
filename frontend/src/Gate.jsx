import { useEffect, useState } from 'react'
import { apiGet, apiPost, errorMessages } from './api.js'
import { formatTime, money } from './format.js'

const DIRECTION_LABELS = { IN: 'Gate in', OUT: 'Gate out' }

// The log can get long, so only the newest events are shown here.
const EVENTS_SHOWN = 15

// What the container owes right now, so the clerk sees it before it leaves.
function storageSummary(container) {
  const charge = container.storage_charge // null if it cannot be worked out
  if (!charge) {
    return 'No storage charge can be worked out yet. Set "Arrived at" and a tariff in the admin.'
  }
  const days = charge.days_stored === 1 ? 'day' : 'days'
  return `In the yard ${charge.days_stored} ${days} (${charge.free_days} free). Storage owed: ${money(charge.amount_kes)}.`
}

function GateOutForm({ token, containers, onUnauthorized, onChanged }) {
  const [containerId, setContainerId] = useState('')
  const [truckPlate, setTruckPlate] = useState('')
  const [appointmentRef, setAppointmentRef] = useState('')
  const [errors, setErrors] = useState([])
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  // Only containers that are in the yard can leave it.
  const inYard = containers.filter((container) => container.status === 'IN_YARD')
  const selected = inYard.find((container) => String(container.id) === containerId)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!selected) return

    const number = selected.number
    setErrors([])
    setSuccess('')
    setBusy(true) // also disables the button, so a double click cannot send twice

    try {
      await apiPost(
        '/api/gate-events/',
        {
          container: selected.id,
          direction: 'OUT',
          truck_plate: truckPlate.trim().toUpperCase(),
          appointment_ref: appointmentRef.trim(),
        },
        token,
      )
      setSuccess(`${number} has left the yard.`)
      setContainerId('')
      setTruckPlate('')
      setAppointmentRef('')
    } catch (err) {
      if (err.status === 401) {
        onUnauthorized()
        return
      }
      // The server's rules speak here: its refusal is shown word for word.
      setErrors(errorMessages(err))
    } finally {
      setBusy(false)
    }

    // Reload the lists after a success AND after a refusal: a refusal often
    // means the page was out of date (another clerk may have moved the container).
    onChanged()
  }

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      <h3>Gate out a container</h3>

      <label htmlFor="container">Container</label>
      <select
        id="container"
        value={selected ? containerId : ''}
        onChange={(event) => setContainerId(event.target.value)}
        disabled={inYard.length === 0}
        required
      >
        <option value="">
          {inYard.length === 0 ? 'No containers in the yard' : 'Choose a container...'}
        </option>
        {inYard.map((container) => (
          <option key={container.id} value={container.id}>
            {container.number}
            {container.slot_label ? ` (slot ${container.slot_label})` : ''}
          </option>
        ))}
      </select>

      {selected && <p className="summary">{storageSummary(selected)}</p>}

      <label htmlFor="plate">Truck plate</label>
      <input
        id="plate"
        value={truckPlate}
        onChange={(event) => setTruckPlate(event.target.value)}
        maxLength={15}
        placeholder="KDG 123A"
        autoComplete="off"
        required
      />

      <label htmlFor="appointment">Appointment reference (optional)</label>
      <input
        id="appointment"
        value={appointmentRef}
        onChange={(event) => setAppointmentRef(event.target.value)}
        maxLength={30}
        placeholder="APT-001"
        autoComplete="off"
      />

      {errors.length > 0 && (
        <div className="notice error" role="alert">
          {errors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      {/* a live region: screen readers announce text that appears inside it */}
      <div aria-live="polite">
        {success && <p className="notice success">{success}</p>}
      </div>

      <button
        type="submit"
        className="primary"
        disabled={busy || inYard.length === 0}
      >
        {busy ? 'Saving...' : 'Gate out'}
      </button>
    </form>
  )
}

function EventsTable({ events }) {
  if (events.length === 0) {
    return <p className="notice">No gate events yet.</p>
  }

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Container</th>
              <th>Direction</th>
              <th>Truck plate</th>
              <th>Appointment</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, EVENTS_SHOWN).map((event) => (
              <tr key={event.id}>
                <td>{formatTime(event.timestamp)}</td>
                <td className="mono">{event.container_number}</td>
                <td>
                  <span className={`badge ${event.direction.toLowerCase()}`}>
                    {DIRECTION_LABELS[event.direction] ?? event.direction}
                  </span>
                </td>
                <td className="mono">{event.truck_plate}</td>
                <td>{event.appointment_ref || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {events.length > EVENTS_SHOWN && (
        <p className="notice">
          Showing the latest {EVENTS_SHOWN} of {events.length} events.
        </p>
      )}
    </>
  )
}

function Gate({ token, onUnauthorized }) {
  // null means "still loading"
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  // Adding 1 to this number makes the effect below run again: a reload.
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      apiGet('/api/containers/', token),
      apiGet('/api/gate-events/', token),
    ])
      .then(([containers, events]) => {
        if (cancelled) return
        setData({ containers, events })
        setError('')
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
  }, [token, onUnauthorized, reloadCount])

  if (error) return <p className="notice error">{error}</p>
  if (data === null) return <p className="notice">Loading the gate...</p>

  return (
    <>
      <GateOutForm
        token={token}
        containers={data.containers}
        onUnauthorized={onUnauthorized}
        onChanged={() => setReloadCount((count) => count + 1)}
      />
      <h3>Recent gate events</h3>
      <EventsTable events={data.events} />
    </>
  )
}

export default Gate 