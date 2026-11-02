import { useCallback, useState } from 'react'
import { clearToken, getToken, saveToken } from './api.js'
import Containers from './Containers.jsx'
import Login from './Login.jsx'

function App() {
  // The token is the proof of login. No token means show the login page.
  const [token, setToken] = useState(getToken)

  function handleLogin(newToken) {
    saveToken(newToken)
    setToken(newToken)
  }

  // useCallback keeps this function the same between renders,
  // so the Containers page does not reload its data every time.
  const handleLogout = useCallback(() => {
    clearToken()
    setToken(null)
  }, [])

  return (
    <main>
      <header className="topbar">
        <h1>Mombasa Port Cargo Tracker</h1>
        {token && (
          <button type="button" className="link" onClick={handleLogout}>
            Log out
          </button>
        )}
      </header>

      {token ? (
        <>
          <h2>Containers</h2>
          <Containers token={token} onUnauthorized={handleLogout} />
        </>
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </main>
  )
}

export default App 