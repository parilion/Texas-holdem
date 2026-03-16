import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

let socket = null

export function getSocket() {
  if (!socket) {
    socket = io('http://localhost:3001', { autoConnect: false })
  }
  return socket
}

export function useSocket(handlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const s = getSocket()
    if (!s.connected) s.connect()

    const entries = Object.entries(handlersRef.current)
    entries.forEach(([event, handler]) => {
      s.on(event, (...args) => handlersRef.current[event]?.(...args))
    })

    return () => {
      entries.forEach(([event]) => s.off(event))
    }
  }, [])
}
