import { getToken } from './api'

let socket = null
let retryTimer = null
const listeners = new Set()

function socketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws?token=${encodeURIComponent(getToken())}`
}

function dispatch(event) {
  listeners.forEach((listener) => {
    try {
      listener(event)
    } catch (error) {
      console.error('socket listener failed', error)
    }
  })
}

export function connectSocket() {
  if (!getToken()) return null
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return socket
  }

  socket = new WebSocket(socketUrl())

  socket.onopen = () => dispatch({ type: 'socket:open' })
  socket.onmessage = (message) => {
    try {
      dispatch(JSON.parse(message.data))
    } catch {
      /* ignore malformed frames */
    }
  }
  socket.onclose = () => {
    dispatch({ type: 'socket:closed' })
    if (getToken() && !retryTimer) {
      retryTimer = setTimeout(() => {
        retryTimer = null
        connectSocket()
      }, 2500)
    }
  }
  socket.onerror = () => {
    /* onclose handles reconnection */
  }
  return socket
}

export function disconnectSocket() {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  if (socket) {
    socket.onclose = null
    socket.close()
    socket = null
  }
}

export function socketSend(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload))
    return true
  }
  return false
}

export function onSocket(handler) {
  listeners.add(handler)
  return () => listeners.delete(handler)
}

export function isSocketOpen() {
  return Boolean(socket && socket.readyState === WebSocket.OPEN)
}
