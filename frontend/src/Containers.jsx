import { useEffect, useState } from 'react'
import { apiGet } from './api.js'

const STATUS_LABELS = {
  ON_VESSEL: 'On vessel',
  IN_YARD: 'In yard',
  GATED_OUT: 'Gated out',
}

function money(amount) {
  return `KES ${Number(amount).toLocaleString('en-US')}`
}

function Containers({ token, onUnauthorized }) {
  // null means "still loading"
  const [containers, setContainers] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    // "cancelled" stops a slow answer from updating a screen that has moved on
    let cancelled = false

    apiGet('/api/containers/', token)
      .then((data) => {
        if (!cancelled) setContainers(data)
      })
      .catch((err) => {
        if (cancelled) return
        if (err.status === 401) {
          onUnauthorized() // token no longer valid: back to the login page
        } else {
          setError(err.message)
        }
      })

    return () => {
      cancelled = true
    }
  }, [token, onUnauthorized])

  if (error) return <p className="notice error">{error}</p>
  if (containers === null) return <p className="notice">Loading containers...</p>
  if (containers.length === 0) {
    return <p className="notice">No containers yet. Add some in the admin.</p>
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Container</th>
            <th>Size</th>
            <th>Status</th>
            <th>Yard slot</th>
            <th className="num">Days stored</th>
            <th className="num">Storage fee</th>
          </tr>
        </thead>
        <tbody>
          {containers.map((container) => {
            const charge = container.storage_charge // null if it cannot be worked out
            return (
              <tr key={container.id}>
                <td className="mono">{container.number}</td>
                <td>{container.size_ft} ft</td>
                <td>
                  <span className={`badge ${container.status.toLowerCase()}`}>
                    {STATUS_LABELS[container.status] ?? container.status}
                  </span>
                </td>
                <td>{container.slot_label ?? '-'}</td>
                <td className="num">{charge ? charge.days_stored : '-'}</td>
                <td className="num">
                  {charge ? money(charge.amount_kes) : '-'}
                  {charge?.still_in_yard && (
                    <span className="hint"> still counting</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default Containers 