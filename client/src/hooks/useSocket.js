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

    // 保存具体 listener 引用，cleanup 时精确移除
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
