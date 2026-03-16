import { useState, useCallback } from 'react'
import { getSocket, useSocket } from './useSocket'

export function useGame() {
  const [gameState, setGameState] = useState(null)
  const [roomId, setRoomId] = useState(null)
  const [myId, setMyId] = useState(null)
  const [error, setError] = useState(null)

  useSocket({
    'room:joined': (data) => {
      setRoomId(data.roomId)
      setMyId(getSocket().id)
      setGameState(data)
    },
    'game:state': (data) => {
      setGameState(data)
    },
    'error': (data) => {
      setError(data.message)
      setTimeout(() => setError(null), 3000)
    },
  })

  const createRoom = useCallback((playerName) => {
    getSocket().emit('room:create', { playerName })
  }, [])

  const joinRoom = useCallback((roomId, playerName) => {
    getSocket().emit('room:join', { roomId, playerName })
  }, [])

  const startGame = useCallback(() => {
    getSocket().emit('game:start')
  }, [])

  const doAction = useCallback((action, amount) => {
    getSocket().emit(`action:${action}`, amount ? { amount } : {})
  }, [])

  return { gameState, roomId, myId, error, createRoom, joinRoom, startGame, doAction }
}
