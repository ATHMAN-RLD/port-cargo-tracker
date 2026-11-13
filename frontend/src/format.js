// Small helpers for showing values on screen.

// The API stores times in UTC. This shows them in Nairobi time.
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Nairobi',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function formatTime(iso) {
  return iso ? timeFormat.format(new Date(iso)) : '-'
}

export function money(amount) {
  return `KES ${Number(amount).toLocaleString('en-US')}`
}  