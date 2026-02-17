const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050'

let authToken = ''

export function setAuthToken(token) {
  authToken = token || ''
}

async function parseResponse(response) {
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed with ${response.status}`)
  }
  return payload
}

function withAuth(headers = {}) {
  if (!authToken) return headers
  return {
    ...headers,
    Authorization: `Bearer ${authToken}`,
  }
}

export async function login(input) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseResponse(response)
}

export async function register(input) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseResponse(response)
}

export async function loginWithGoogle(idToken) {
  const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  return parseResponse(response)
}

export async function verifyEmailOtp(email, otp) {
  const response = await fetch(`${API_BASE_URL}/api/auth/verify-email-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  })
  return parseResponse(response)
}

export async function resendEmailOtp(email) {
  const response = await fetch(`${API_BASE_URL}/api/auth/resend-email-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  return parseResponse(response)
}

export async function requestPasswordResetOtp(email) {
  const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  return parseResponse(response)
}

export async function resetPasswordWithOtp(email, otp, newPassword) {
  const response = await fetch(`${API_BASE_URL}/api/auth/reset-password-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp, newPassword }),
  })
  return parseResponse(response)
}

export async function fetchLoginEvents() {
  const response = await fetch(`${API_BASE_URL}/api/auth/events`, {
    headers: withAuth(),
  })
  return parseResponse(response)
}

export async function fetchUsers() {
  const response = await fetch(`${API_BASE_URL}/api/auth/users`, {
    headers: withAuth(),
  })
  return parseResponse(response)
}

export async function deleteUser(userId) {
  const response = await fetch(`${API_BASE_URL}/api/auth/users/${userId}`, {
    method: 'DELETE',
    headers: withAuth(),
  })
  return parseResponse(response)
}

export async function updateUserRole(userId, role) {
  const response = await fetch(`${API_BASE_URL}/api/auth/users/${userId}/role`, {
    method: 'PATCH',
    headers: withAuth({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ role }),
  })
  return parseResponse(response)
}

export async function fetchUserSearches() {
  const response = await fetch(`${API_BASE_URL}/api/auth/searches`, {
    headers: withAuth(),
  })
  return parseResponse(response)
}

export async function runAnalysis(input) {
  const response = await fetch(`${API_BASE_URL}/api/run`, {
    method: 'POST',
    headers: withAuth({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  })
  return parseResponse(response)
}

export async function fetchHistory() {
  const response = await fetch(`${API_BASE_URL}/api/history`, {
    headers: withAuth(),
  })
  return parseResponse(response)
}

export async function fetchDataRange() {
  const response = await fetch(`${API_BASE_URL}/api/data-range`, {
    headers: withAuth(),
  })
  return parseResponse(response)
}

export async function fetchArchivePredictions() {
  const response = await fetch(`${API_BASE_URL}/api/archive-predictions`, {
    headers: withAuth(),
  })
  return parseResponse(response)
}
