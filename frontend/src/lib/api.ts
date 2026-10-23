let csrfToken: string | null = null

export function setCsrfToken(token: string | null) {
  csrfToken = token
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const method = (init.method || 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers.set('X-CSRF-Token', csrfToken)
  }
  return fetch(input, { ...init, headers, credentials: 'same-origin' }).then((response) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
    if (response.status === 401 && !path.includes('/auth/')) {
      csrfToken = null
      window.dispatchEvent(new Event('cloud-host:unauthorized'))
    }
    return response
  })
}
