const TOKEN_KEY = 'mersal_token'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let payload
  if (form) {
    payload = form
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(path, { method, headers, body: payload })
  } catch {
    throw new ApiError('تعذّر الاتصال بالخادم، تحقّق من الشبكة', 0)
  }

  if (response.status === 401) {
    clearToken()
    window.dispatchEvent(new Event('mersal:logout'))
  }

  const isJson = (response.headers.get('content-type') || '').includes('application/json')
  const data = isJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    const detail = data?.detail
    const message = typeof detail === 'string' ? detail : 'تعذّر إكمال الطلب'
    throw new ApiError(message, response.status)
  }
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  upload: (file) => {
    const form = new FormData()
    form.append('file', file)
    return request('/api/media', { method: 'POST', form })
  },
}

export function mediaUrl(mediaId) {
  if (!mediaId) return ''
  return `/api/media/${mediaId}?token=${encodeURIComponent(getToken())}`
}

export function backupDownloadUrl() {
  return `/api/backup/export?token=${encodeURIComponent(getToken())}`
}
