// All talking to the Django API goes through this file.

const TOKEN_KEY = 'port-cargo-token'

// Browser storage can be blocked (for example in private windows),
// so every access is wrapped: the app still works, it just forgets
// the login when the page is refreshed.
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function saveToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // nothing to do: the login lasts until the page is refreshed
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // nothing to clear
  }
}

// Send a username and password, get back a token.
export async function login(username, password) {
  let response
  try {
    response = await fetch('/api/auth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  } catch {
    throw new Error('Could not reach the server.')
  }

  if (response.status === 400) {
    throw new Error('Wrong username or password.')
  }
  if (!response.ok) {
    throw new Error(
      `The server answered ${response.status}. Is the Django server running?`,
    )
  }
  const data = await response.json()
  return data.token
}

// GET a page of data, proving who we are with the token.
// A 401 error carries status 401 so the caller can send the user to log in again.
export async function apiGet(path, token) {
  let response
  try {
    response = await fetch(path, {
      headers: { Authorization: `Token ${token}` },
    })
  } catch {
    throw new Error('Could not reach the server.')
  }

  if (!response.ok) {
    const error = new Error(`The server answered ${response.status}.`)
    error.status = response.status
    throw error
  }
  return response.json()
}