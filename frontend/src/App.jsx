import { useCallback, useState } from 'react'
import { clearToken, getToken, saveToken } from './api.js'
import BerthSchedule from './BerthSchedule.jsx'
import Containers from './Containers.jsx'
import Login from './Login.jsx'

// The pages in the menu bar. To add a page later: add a line here
// and one more case below.
const PAGES = [
  { id: 'containers', label: 'Containers' },
  { id: 'berths', label: 'Berth schedule' },
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
    <main>
      <header className="topbar">
        <div className="topbar-row">
          <h1>Mombasa Port Cargo Tracker</h1>
          {token && (
            <button type="button" className="link" onClick={handleLogout}>
              Log out
            </button>
          )}
        </div>

        {token && (
          <nav className="tabs" aria-label="Main">
            {PAGES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === page ? 'tab active' : 'tab'}
                aria-current={item.id === page ? 'page' : undefined}
                onClick={() => setPage(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      {token ? (
        <>
          <h2>{currentPage.label}</h2>
          {page === 'containers' && (
            <Containers token={token} onUnauthorized={handleLogout} />
          )}
          {page === 'berths' && (
            <BerthSchedule token={token} onUnauthorized={handleLogout} />
          )}
        </>
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </main>
  )
}

export default App 