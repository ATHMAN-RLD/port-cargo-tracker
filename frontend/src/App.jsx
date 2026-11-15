import { useCallback, useState } from 'react'
import { clearToken, getToken, saveToken } from './api.js'
import { Icon, PortScene } from './Art.jsx'
import BerthSchedule from './BerthSchedule.jsx'
import Containers from './Containers.jsx'
import Gate from './Gate.jsx'
import Login from './Login.jsx'

// The pages in the menu bar. To add a page later: add a line here
// and one more case below.
const PAGES = [
  {
    id: 'containers',
    label: 'Containers',
    icon: 'containers',
    subtitle: 'Every container in the terminal: where it is and what it owes.',
  },
  {
    id: 'berths',
    label: 'Berth schedule',
    icon: 'berth',
    subtitle: 'Which vessel is at which berth, and when.',
  },
  {
    id: 'gate',
    label: 'Gate',
    icon: 'gate',
    subtitle: 'Release containers to the trucks that collect them.',
  },
]

function App() {
  // The token is the proof of login. No token means show the login page.
  const [token, setToken] = useState(getToken)
  const [page, setPage] = useState('containers')

  function handleLogin(newToken) {
    saveToken(newToken)
    setToken(newToken)
  }

  // useCallback keeps this function the same between renders,
  // so the pages do not reload their data every time.
  const handleLogout = useCallback(() => {
    clearToken()
    setToken(null)
    setPage('containers') // the next person to log in starts on the first page
  }, [])

  const currentPage = PAGES.find((item) => item.id === page)

  return (
    <div className="app">
      {/* The banner: a sky, a ship and a crane, with the app's name on top. */}
      <header className={token ? 'hero' : 'hero hero-tall'}>
        <PortScene />
        <div className="wrap hero-inner">
          <div className="brand">
            <span className="brand-mark">
              <Icon name="anchor" />
            </span>
            <div>
              <h1>Mombasa Port Cargo Tracker</h1>
              <p className="tagline">
                {token
                  ? 'Terminal operations'
                  : 'Berths, containers and the gate, in one place.'}
              </p>
            </div>
          </div>
          {token && (
            <button type="button" className="link" onClick={handleLogout}>
              <Icon name="logout" />
              Log out
            </button>
          )}
        </div>
      </header>

      {token && (
        <div className="tabbar">
          <nav className="wrap tabs" aria-label="Main">
            {PAGES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === page ? 'tab active' : 'tab'}
                aria-current={item.id === page ? 'page' : undefined}
                onClick={() => setPage(item.id)}
              >
                <Icon name={item.icon} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      <main className={token ? 'wrap' : 'wrap over-hero'}>
        {token ? (
          <>
            <div className="page-head">
              <span className="page-icon">
                <Icon name={currentPage.icon} />
              </span>
              <div>
                <h2>{currentPage.label}</h2>
                <p>{currentPage.subtitle}</p>
              </div>
            </div>
            {page === 'containers' && (
              <Containers token={token} onUnauthorized={handleLogout} />
            )}
            {page === 'berths' && (
              <BerthSchedule token={token} onUnauthorized={handleLogout} />
            )}
            {page === 'gate' && (
              <Gate token={token} onUnauthorized={handleLogout} />
            )}
          </>
        ) : (
          <Login onLogin={handleLogin} />
        )}
      </main>
    </div>
  )
}

export default App 