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

// POST new data. If the server refuses it (status 400), the error carries
// the server's explanation in error.details, so the page can show it.
export async function apiPost(path, body, token) {
  let response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach the server.')
  }

  if (!response.ok) {
    let details = null
    try {
      details = await response.json()
    } catch {
      // the answer was not JSON: keep the plain message below
    }
    const error = new Error(`The server answered ${response.status}.`)
    error.status = response.status
    error.details = details
    throw error
  }
  return response.json()
}

// Names to show instead of the API's field names.
const FIELD_LABELS = {
  container: 'Container',
  direction: 'Direction',
  truck_plate: 'Truck plate',
  appointment_ref: 'Appointment reference',
  vessel: 'Vessel',
  berth: 'Berth',
  eta: 'Planned arrival',
  etd: 'Planned departure',
}

// Turn a refused request into a list of sentences a person can read.
// The API answers with shapes like
//   { "truck_plate": ["This field is required."] }
//   { "non_field_errors": ["Only a container that is in the yard can gate out."] }
export function errorMessages(error) {
  const details = error.details
  if (!details || typeof details !== 'object') return [error.message]

  const messages = []
  for (const [field, value] of Object.entries(details)) {
    const texts = Array.isArray(value) ? value : [String(value)]
    for (const text of texts) {
      const general = field === 'non_field_errors' || field === 'detail'
      messages.push(general ? text : `${FIELD_LABELS[field] ?? field}: ${text}`)
    }
  }
  return messages.length > 0 ? messages : [error.message]
}  