import { useState } from 'react'
import { login } from './api.js'

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault() // stop the browser reloading the page
    setError('')
    setBusy(true)
    try {
      const token = await login(username, password)
      onLogin(token)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="card login" onSubmit={handleSubmit}>
      <h2>Log in</h2>

      <label htmlFor="username">Username</label>
      <input
        id="username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        autoComplete="username"
        required
      />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        required
      />

      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy}>
        {busy ? 'Logging in...' : 'Log in'}
      </button>
    </form>
  )
}

export default Login 