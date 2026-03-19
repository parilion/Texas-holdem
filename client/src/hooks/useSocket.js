import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

let socket = null

export function getSocket() {
  if (!socket) {
    let playerId = localStorage.getItem('playerId')
    if (!playerId) {
      playerId = crypto.randomUUID()
      localStorage.setItem('playerId', playerId)
    }
    const serverUrl = import.meta.env.VITE_SERVER_URL || window.location.origin
    socket = io(serverUrl, {
      autoConnect: false,
      auth: { playerId },
    })
  }
  return socket
}

export function useSocket(handlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const s = getSocket()
    if (!s.connected) s.connect()

    const listeners = []
    Object.keys(handlersRef.current).forEach(event => {
      const listener = (...args) => handlersRef.current[event]?.(...args)
      s.on(event, listener)
      listeners.push([event, listener])
    })

    return () => {
      listeners.forEach(([event, listener]) => s.off(event, listener))
    }
  }, [])
}
