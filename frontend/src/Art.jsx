// Every picture and icon in the app is drawn here in code (SVG).
// Why: there is nothing to download, nothing can fail to load behind a
// firewall, and the colours can follow the light/dark theme through CSS.

// The colours of real shipping containers.
const BOX_COLORS = [
  '#e8772e', // orange
  '#2d6cdf', // blue
  '#2f9e75', // green
  '#d9453b', // red
  '#f2b134', // yellow
  '#7a52c7', // purple
  '#14a3b8', // teal
  '#8a97a3', // grey
]

// How many containers are stacked in each column on the ship's deck.
const DECK_STACKS = [3, 4, 4, 3, 4, 4, 2, 3, 4, 3]
// ...and on the quay (the harbour wall) beside the crane.
const QUAY_STACKS = Array.from(
  { length: 24 },
  (_, i) => [3, 2, 3, 1, 2, 3, 2, 1, 3, 2][i % 10],
)

// A row of gentle waves. It is drawn far wider than the picture itself, so
// on a very wide screen the sea simply carries on instead of stopping.
function wavePath(y, amplitude, period) {
  const from = -3000
  const to = 4200
  let d = `M${from} ${y}Q${from + period / 2} ${y - amplitude} ${from + period} ${y}`
  for (let x = from + 2 * period; x <= to; x += period) d += `T${x} ${y}`
  return `${d}V280H${from}Z`
}

function stackRects(stacks, startX, baseY, step, keyPrefix) {
  const rects = []
  stacks.forEach((height, column) => {
    for (let layer = 0; layer < height; layer++) {
      rects.push(
        <rect
          key={`${keyPrefix}-${column}-${layer}`}
          x={startX + column * step}
          y={baseY - (layer + 1) * 18 + 1}
          width={step - 2}
          height="16"
          rx="1.5"
          fill={BOX_COLORS[(column * 3 + layer * 5) % BOX_COLORS.length]}
        />,
      )
    }
  })
  return rects
}

// The picture at the top of the page: a container ship at a berth,
// a quay crane, and stacks of containers. All colours come from CSS.
export function PortScene() {
  return (
    <svg
      className="scene"
      viewBox="0 0 1200 280"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* thin vertical lines drawn over containers, like real corrugated steel */}
        <pattern id="port-ribs" width="6" height="16" patternUnits="userSpaceOnUse">
          <rect width="1.6" height="16" fill="#000" opacity="0.2" />
        </pattern>
      </defs>

      {/* sun (or moon, in the dark theme) */}
      <circle className="sun-glow" cx="800" cy="168" r="46" />
      <circle className="sun" cx="800" cy="168" r="22" />

      {/* gulls */}
      <g className="gull" fill="none" strokeWidth="2" strokeLinecap="round">
        <path d="M742 112q8-8 16 0q8-8 16 0" />
        <path d="M790 88q6-6 12 0q6-6 12 0" />
        <path d="M1090 120q6-6 12 0q6-6 12 0" />
      </g>

      {/* the sea behind the ship */}
      <rect className="sea-back" x="-3000" y="212" width="7200" height="68" />

      {/* the ship */}
      <g>
        <polygon className="hull" points="205,200 730,200 722,236 262,236" />
        <polygon className="hull-stripe" points="240,222 725,222 722,236 262,236" />
        <g>{stackRects(DECK_STACKS, 247, 200, 38, 'deck')}</g>
        <rect x="247" y="128" width="380" height="72" fill="url(#port-ribs)" />
        {/* bridge, windows and funnel at the stern */}
        <rect className="ship-white" x="650" y="150" width="68" height="50" />
        <rect className="ship-white" x="660" y="136" width="48" height="14" />
        <rect className="ship-glass" x="664" y="140" width="40" height="5" />
        <rect className="ship-glass" x="656" y="160" width="56" height="4" />
        <rect className="ship-glass" x="656" y="172" width="56" height="4" />
        <rect className="funnel" x="672" y="114" width="18" height="22" />
        <rect className="funnel-band" x="672" y="120" width="18" height="6" />
      </g>

      {/* the waves in front of the ship */}
      <path className="sea-mid" d={wavePath(236, 10, 150)} />
      <path className="sea-front" d={wavePath(254, 8, 120)} />

      {/* the quay with stacked containers */}
      <rect className="quay" x="880" y="205" width="3320" height="75" />
      <rect className="quay-top" x="880" y="205" width="3320" height="4" />
      <g>{stackRects(QUAY_STACKS, 990, 205, 38, 'quay')}</g>
      <rect x="990" y="141" width={QUAY_STACKS.length * 38} height="64" fill="url(#port-ribs)" opacity="0.9" />

      {/* the quay crane */}
      <g className="crane">
        <rect x="888" y="98" width="6" height="107" />
        <rect x="948" y="98" width="6" height="107" />
        <rect x="888" y="150" width="66" height="6" />
        <line x1="891" y1="156" x2="951" y2="100" strokeWidth="2.5" />
        <rect x="580" y="92" width="460" height="8" />
        <rect x="917" y="48" width="6" height="50" />
        <line x1="920" y1="48" x2="582" y2="94" strokeWidth="2" />
        <line x1="920" y1="48" x2="1038" y2="94" strokeWidth="2" />
        <rect x="900" y="84" width="40" height="14" rx="2" />
        {/* the trolley and the container it is lifting off the ship */}
        <rect x="602" y="96" width="26" height="8" rx="2" />
        <line x1="609" y1="104" x2="609" y2="116" strokeWidth="1.5" />
        <line x1="621" y1="104" x2="621" y2="116" strokeWidth="1.5" />
      </g>
      <rect x="598" y="116" width="34" height="16" rx="1.5" fill="#e8772e" />
      <rect x="598" y="116" width="34" height="16" fill="url(#port-ribs)" />
    </svg>
  )
}

// A little shipping container. The colour tells the size at a glance:
// 20 ft boxes are orange, 40 ft boxes are blue.
export function BoxIcon({ sizeFt }) {
  const color = sizeFt === 20 ? '#e8772e' : '#2d6cdf'
  return (
    <svg
      className="box-icon"
      viewBox="0 0 28 18"
      width="28"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0.5" y="0.5" width="27" height="17" rx="2.5" fill={color} />
      <path
        d="M6 3v12M10.5 3v12M15 3v12M19.5 3v12M24 3v12"
        stroke="#000"
        strokeOpacity="0.22"
        strokeWidth="1.4"
      />
      <rect x="0.5" y="0.5" width="27" height="3" rx="1.5" fill="#fff" fillOpacity="0.28" />
    </svg>
  )
}

// Simple line icons for the menu and the stat cards.
const ICON_PATHS = {
  containers: 'M3 7h18v11H3zM8 7v11M12 7v11M16 7v11M5 7l1.5-3h11L19 7',
  berth: 'M12 7v13M8.5 11h7M5 14a7 7 0 0 0 14 0M3.5 14.5 5 14l.5 1.7M20.5 14.5 19 14l-.5 1.7',
  gate: 'M2 7h11v9H2zM13 10h5l3 3v3h-8zM2 16h19',
  logout: 'M9 4H5v16h4M16 8l4 4-4 4M20 12H9',
  anchor: 'M12 7v13M8.5 11h7M5 14a7 7 0 0 0 14 0',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
}

export function Icon({ name }) {
  const wheels = name === 'gate'
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON_PATHS[name]} />
      {name === 'berth' || name === 'anchor' ? (
        <circle cx="12" cy="5" r="2" />
      ) : null}
      {wheels && (
        <>
          <circle cx="6.5" cy="18" r="1.8" fill="var(--surface)" />
          <circle cx="17" cy="18" r="1.8" fill="var(--surface)" />
        </>
      )}
    </svg>
  )
}

// Shown instead of an empty table: a small stack of containers and a sentence.
export function EmptyState({ children }) {
  return (
    <div className="empty">
      <svg viewBox="0 0 120 70" width="120" height="70" aria-hidden="true" focusable="false">
        <rect className="empty-ground" x="6" y="62" width="108" height="4" rx="2" />
        <rect x="14" y="42" width="44" height="20" rx="2" fill="#2d6cdf" />
        <rect x="62" y="42" width="44" height="20" rx="2" fill="#e8772e" />
        <rect x="38" y="20" width="44" height="20" rx="2" fill="#2f9e75" />
        <path
          d="M22 44v16M30 44v16M38 44v16M46 44v16M70 44v16M78 44v16M86 44v16M94 44v16M46 22v16M54 22v16M62 22v16M70 22v16"
          stroke="#000"
          strokeOpacity="0.2"
          strokeWidth="1.6"
        />
      </svg>
      <p className="notice">{children}</p>
    </div>
  )
} 