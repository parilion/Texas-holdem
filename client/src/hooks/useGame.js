import { useState, useCallback, useRef } from 'react'
import { getSocket, useSocket } from './useSocket'

export function useGame() {
  const [gameState, setGameState] = useState(null)
  const [roomId, setRoomId] = useState(null)
  const [myId, setMyId] = useState(null)
  const [error, setError] = useState(null)
  const [kickMessage, setKickMessage] = useState(null)
  // 若 localStorage 有 playerId，说明可能有旧会话，先显示"恢复中"
  const [isRestoring, setIsRestoring] = useState(() => !!localStorage.getItem('playerId'))
  const restoreTimerRef = useRef(null)

  useSocket({
    'connect': () => {
      setMyId(null)
      // 2s 超时兜底：若服务端无响应则回到大厅
      clearTimeout(restoreTimerRef.current)
      if (localStorage.getItem('playerId')) {
        restoreTimerRef.current = setTimeout(() => {
          setIsRestoring(false)
          setRoomId(null)
          setGameState(null)
        }, 2000)
      }
    },
    'session:restored': (data) => {
      clearTimeout(restoreTimerRef.current)
      setIsRestoring(false)
      setRoomId(data.roomId)
      setMyId(localStorage.getItem('playerId'))
      setGameState(data)
    },
    'session:expired': (data) => {
      clearTimeout(restoreTimerRef.current)
      setIsRestoring(false)
      setRoomId(null)
      setGameState(null)
      setMyId(null)
      setKickMessage(data.reason || '上一局游戏已结束')
    },
    'room:joined': (data) => {
      clearTimeout(restoreTimerRef.current)
      setIsRestoring(false)
      setRoomId(data.roomId)
      setMyId(localStorage.getItem('playerId'))
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

  return {
    gameState, roomId, myId, error, kickMessage, isRestoring,
    setKickMessage, createRoom, joinRoom, startGame, doAction, doReady, doUnready, leaveRoom,
  }
}
