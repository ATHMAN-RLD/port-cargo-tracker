import { useEffect, useState } from 'react'
import { apiGet } from './api.js'
import { BoxIcon, EmptyState, Icon } from './Art.jsx'
import Stats from './Stats.jsx'

const STATUS_LABELS = {
  ON_VESSEL: 'On vessel',
  IN_YARD: 'In yard',
  GATED_OUT: 'Gated out',
}

// The buttons above the table. "ALL" is not a real status: it means no filter.
const FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'IN_YARD', label: 'In yard' },
  { id: 'ON_VESSEL', label: 'On vessel' },
  { id: 'GATED_OUT', label: 'Gated out' },
]

function money(amount) {
  return `KES ${Number(amount).toLocaleString('en-US')}`
}

// Does this container match what was typed? The container number and the
// yard slot are searched. Case and spaces do not matter, so "msku 123"
// finds MSKU1234567.
function matchesQuery(container, query) {
  const wanted = query.toLowerCase().replace(/\s+/g, '')
  if (wanted === '') return true
  const haystack = `${container.number} ${container.slot_label ?? ''}`
    .toLowerCase()
    .replace(/\s+/g, '')
  return haystack.includes(wanted)
}

function Containers({ token, onUnauthorized }) {
  // null means "still loading"
  const [containers, setContainers] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

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

  // Summary numbers for the cards. They always describe ALL containers,
  // whatever is typed in the search box. "Accruing" is what the containers
  // still in the yard owe right now.
  const count = (status) =>
    containers.filter((container) => container.status === status).length
  const accruing = containers
    .filter((container) => container.status === 'IN_YARD' && container.storage_charge)
    .reduce((sum, container) => sum + Number(container.storage_charge.amount_kes), 0)

  // The search happens here in the browser, on the list we already have.
  // Why not ask the server: the list is small, and filtering locally
  // answers instantly with every keystroke and costs no requests.
  const matching = containers.filter((container) => matchesQuery(container, query))
  const countFor = (id) =>
    id === 'ALL'
      ? matching.length
      : matching.filter((container) => container.status === id).length
  const visible =
    statusFilter === 'ALL'
      ? matching
      : matching.filter((container) => container.status === statusFilter)
  const filtering = query.trim() !== '' || statusFilter !== 'ALL'

  function clearFilters() {
    setQuery('')
    setStatusFilter('ALL')
  }

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

      <div className="toolbar">
        <div className="search">
          <label htmlFor="search" className="sr-only">
            Search containers
          </label>
          <Icon name="search" />
          <input
            id="search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search container or yard slot"
            autoComplete="off"
          />
        </div>

        <div className="chips" role="group" aria-label="Filter by status">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={filter.id === statusFilter ? 'chip active' : 'chip'}
              aria-pressed={filter.id === statusFilter}
              onClick={() => setStatusFilter(filter.id)}
            >
              {filter.label}
              <span className="chip-count">{countFor(filter.id)}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <>
          <EmptyState>No containers match your search.</EmptyState>
          <p className="empty-action">
            <button type="button" className="small" onClick={clearFilters}>
              Clear search and filters
            </button>
          </p>
        </>
      ) : (
        <>
          {filtering && (
            <p className="result-count" aria-live="polite">
              Showing {visible.length} of {containers.length} containers
            </p>
          )}
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
                {visible.map((container) => {
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
      )}
    </>
  )
}

export default Containers  