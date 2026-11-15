// A row of summary cards at the top of a page.
// items: [{ label: 'In the yard', value: 12, tone: 'teal' }, ...]
// tone picks the colour of the card's edge: teal, amber, slate, blue, orange.
function Stats({ items }) {
  return (
    <div className="stats">
      {items.map((item) => (
        <div key={item.label} className={`stat ${item.tone ?? 'teal'}`}>
          <div className="stat-value">{item.value}</div>
          <div className="stat-label">{item.label}</div>
        </div>
      ))}
    </div>
  )
}

export default Stats  