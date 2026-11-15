import { useEffect, useState } from 'react'
import { apiGet } from './api.js'
import { BoxIcon, EmptyState } from './Art.jsx'
import Stats from './Stats.jsx'

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
    return <EmptyState>No containers yet. Add some in the admin.</EmptyState>
  }

  // Summary numbers for the cards. "Accruing" is what the containers still
  // in the yard owe right now.
  const count = (status) =>
    containers.filter((container) => container.status === status).length
  const accruing = containers
    .filter((container) => container.status === 'IN_YARD' && container.storage_charge)
    .reduce((sum, container) => sum + Number(container.storage_charge.amount_kes), 0)

  return (
    <>
      <Stats
        items={[
          { label: 'In the yard', value: count('IN_YARD'), tone: 'teal' },
          { label: 'Still on a vessel', value: count('ON_VESSEL'), tone: 'amber' },
          { label: 'Gated out', value: count('GATED_OUT'), tone: 'slate' },
          { label: 'Storage accruing', value: money(accruing), tone: 'orange' },
        ]}
      />
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
                  <td>
                    <span className="box-cell">
                      <BoxIcon sizeFt={container.size_ft} />
                      <span className="mono">{container.number}</span>
                    </span>
                  </td>
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
    </>
  )
}

export default Containers 