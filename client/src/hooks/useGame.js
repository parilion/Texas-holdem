import { useState, useCallback } from 'react'
import { getSocket, useSocket } from './useSocket'

export function useGame() {
  const [gameState, setGameState] = useState(null)
  const [roomId, setRoomId] = useState(null)
  const [myId, setMyId] = useState(null)
  const [error, setError] = useState(null)
  const [kickMessage, setKickMessage] = useState(null)

  useSocket({
    'connect': () => {
      // 断线重连后 socket.id 变化，清空旧状态让用户重新加入
      setMyId(null)
      setRoomId(null)
      setGameState(null)
    },
    'room:joined': (data) => {
      setRoomId(data.roomId)
      setMyId(getSocket().id)
      setGameState(data)
    },
    'game:state': (data) => {
      setGameState(data)
    },
    'player:kicked': (data) => {
      setKickMessage(data.message)
      setRoomId(null)
      setGameState(null)
      setMyId(null)
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

  const doReady = useCallback(() => {
    getSocket().emit('player:ready')
  }, [])

  const doUnready = useCallback(() => {
    getSocket().emit('player:unready')
  }, [])

  const leaveRoom = useCallback(() => {
    getSocket().emit('room:leave')
    setRoomId(null)
    setGameState(null)
    setMyId(null)
  }, [])

  return { gameState, roomId, myId, error, kickMessage, setKickMessage, createRoom, joinRoom, startGame, doAction, doReady, doUnready, leaveRoom }
}
