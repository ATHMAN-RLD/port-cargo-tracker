import { useState } from 'react'
import { apiPost, errorMessages } from './api.js'
import { formatTime } from './format.js'

// Kenya is UTC+3 all year (no daylight saving), so a fixed offset is safe.
const NAIROBI = '+03:00'

// The date boxes give text like "2026-11-14T08:00", with no time zone.
// Every time on these pages is Nairobi time, so we say so when we send it.
// This also means the result does not depend on the computer's own time zone.
function toApiTime(value) {
  const withSeconds = value.length === 16 ? `${value}:00` : value
  return `${withSeconds}${NAIROBI}`
}

function BookingForm({ token, vessels, berths, onUnauthorized, onChanged }) {
  const [vesselId, setVesselId] = useState('')
  const [berthId, setBerthId] = useState('')
  const [arrival, setArrival] = useState('')
  const [departure, setDeparture] = useState('')
  const [errors, setErrors] = useState([])
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  const vessel = vessels.find((item) => String(item.id) === vesselId)
  const berth = berths.find((item) => String(item.id) === berthId)
  const nothingToBook = vessels.length === 0 || berths.length === 0

  async function handleSubmit(event) {
    event.preventDefault()
    if (!vessel || !berth) return

    const eta = toApiTime(arrival)
    const etd = toApiTime(departure)
    setErrors([])
    setSuccess('')
    setBusy(true) // also disables the button, so a double click cannot book twice

    try {
      await apiPost(
        '/api/vessel-calls/',
        { vessel: vessel.id, berth: berth.id, eta, etd },
        token,
      )
      setSuccess(
        `${vessel.name} booked on ${berth.name}: ${formatTime(eta)} to ${formatTime(etd)}.`,
      )
      setVesselId('')
      setBerthId('')
      setArrival('')
      setDeparture('')
    } catch (err) {
      if (err.status === 401) {
        onUnauthorized()
        return
      }
      // The server's rules speak here: a clash or a bad date is shown word for word.
      setErrors(errorMessages(err))
    } finally {
      setBusy(false)
    }

    // Reload after a success AND after a refusal. After a refusal the page was
    // probably out of date, and the new bookings explain why it was refused.
    onChanged()
  }

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      <h3>Book a berth</h3>

      <label htmlFor="vessel">Vessel</label>
      <select
        id="vessel"
        value={vessel ? vesselId : ''}
        onChange={(event) => setVesselId(event.target.value)}
        disabled={vessels.length === 0}
        required
      >
        <option value="">
          {vessels.length === 0
            ? 'No vessels yet (add one in the admin)'
            : 'Choose a vessel...'}
        </option>
        {vessels.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>

      <label htmlFor="berth">Berth</label>
      <select
        id="berth"
        value={berth ? berthId : ''}
        onChange={(event) => setBerthId(event.target.value)}
        disabled={berths.length === 0}
        required
      >
        <option value="">
          {berths.length === 0
            ? 'No berths yet (add one in the admin)'
            : 'Choose a berth...'}
        </option>
        {berths.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>

      <label htmlFor="arrival">Planned arrival (Nairobi time)</label>
      <input
        id="arrival"
        type="datetime-local"
        value={arrival}
        onChange={(event) => setArrival(event.target.value)}
        required
      />

      <label htmlFor="departure">Planned departure (Nairobi time)</label>
      <input
        id="departure"
        type="datetime-local"
        value={departure}
        onChange={(event) => setDeparture(event.target.value)}
        required
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

      <button type="submit" className="primary" disabled={busy || nothingToBook}>
        {busy ? 'Saving...' : 'Book berth'}
      </button>
    </form>
  )
}

export default BookingForm  