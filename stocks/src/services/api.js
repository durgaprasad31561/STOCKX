const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
const API_BASE_URL = configuredApiBaseUrl || ''

let authToken = ''

export function setAuthToken(token) {
  authToken = token || ''
}

function buildUrl(path) {
  return `${API_BASE_URL}${path}`
}

async function parseResponse(response) {
  const rawText = await response.text()
  let payload = null
  if (rawText) {
    try {
      payload = JSON.parse(rawText)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const fallbackMessage = rawText ? rawText.slice(0, 180) : `Request failed with ${response.status}`
    throw new Error(payload?.error ?? fallbackMessage)
  }
  return payload ?? {}
}

async function request(path, options = {}) {
  try {
    const response = await fetch(buildUrl(path), options)
    return parseResponse(response)
  } catch (error) {
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      throw new Error(
        'Unable to reach API server. Start backend server and verify VITE_API_BASE_URL if you are using a custom API host.',
      )
    }
    throw error
  }
}

function withAuth(headers = {}) {
  if (!authToken) return headers
  return {
    ...headers,
    Authorization: `Bearer ${authToken}`,
  }
}

export async function login(input) {
  return request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function register(input) {
  return request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function loginWithGoogle(idToken) {
  return request('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
}

export async function verifyEmailOtp(email, otp) {
  return request('/api/auth/verify-email-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  })
}

export async function resendEmailOtp(email) {
  return request('/api/auth/resend-email-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

export async function requestPasswordResetOtp(email) {
  return request('/api/auth/forgot-password-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

export async function resetPasswordWithOtp(email, otp, newPassword) {
  return request('/api/auth/reset-password-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp, newPassword }),
  })
}

export async function fetchLoginEvents() {
  return request('/api/auth/events', {
    headers: withAuth(),
  })
}

export async function fetchUsers() {
  return request('/api/auth/users', {
    headers: withAuth(),
  })
}

export async function deleteUser(userId) {
  return request(`/api/auth/users/${userId}`, {
    method: 'DELETE',
    headers: withAuth(),
  })
}

export async function updateUserRole(userId, role) {
  return request(`/api/auth/users/${userId}/role`, {
    method: 'PATCH',
    headers: withAuth({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ role }),
  })
}

export async function fetchUserSearches() {
  return request('/api/auth/searches', {
    headers: withAuth(),
  })
}

export async function runAnalysis(input) {
  return request('/api/run', {
    method: 'POST',
    headers: withAuth({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  })
}

export async function fetchHistory() {
  return request('/api/history', {
    headers: withAuth(),
  })
}

export async function fetchDataRange() {
  return request('/api/data-range', {
    headers: withAuth(),
  })
}

export async function fetchArchivePredictions() {
  return request('/api/archive-predictions', {
    headers: withAuth(),
  })
}
