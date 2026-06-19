import { appConfig } from '../config/appConfig'

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export class ApiRequestError extends Error {
  constructor({ message = 'Request failed', detail, status }) {
    const detailText = formatErrorDetail(detail)
    super(detailText ? `${message}: ${detailText}` : message)
    this.name = 'ApiRequestError'
    this.detail = detail
    this.status = status
  }
}

export function formatErrorDetail(detail) {
  if (!detail) return ''
  if (typeof detail === 'string') return detail

  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

export async function apiRequest(path, { method = 'GET', body, token, isFormData = false } = {}) {
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    method,
    headers: isFormData
      ? { ...authHeaders(token) }
      : {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiRequestError({
      message: data.message || 'Request failed',
      detail: data.detail,
      status: response.status,
    })
  }
  return data
}
