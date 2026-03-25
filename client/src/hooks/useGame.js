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
  // 用 ref 同步追踪当前 roomId，避免 game:state 闭包读到旧值
  const currentRoomIdRef = useRef(null)

  useSocket({
    'connect': () => {
      setMyId(null)
      // 2s 超时兜底：若服务端无响应则回到大厅
      clearTimeout(restoreTimerRef.current)
      if (localStorage.getItem('playerId')) {
        restoreTimerRef.current = setTimeout(() => {
          setIsRestoring(false)
          currentRoomIdRef.current = null
          setRoomId(null)
          setGameState(null)
        }, 2000)
      }
    },
    'session:restored': (data) => {
      clearTimeout(restoreTimerRef.current)
      setIsRestoring(false)
      currentRoomIdRef.current = data.roomId
      setRoomId(data.roomId)
      setMyId(localStorage.getItem('playerId'))
      setGameState(data)
    },
    'session:expired': (data) => {
      clearTimeout(restoreTimerRef.current)
      setIsRestoring(false)
      currentRoomIdRef.current = null
      setRoomId(null)
      setGameState(null)
      setMyId(null)
      setKickMessage(data.reason || '上一局游戏已结束')
    },
    'room:joined': (data) => {
      clearTimeout(restoreTimerRef.current)
      setIsRestoring(false)
      currentRoomIdRef.current = data.roomId
      setRoomId(data.roomId)
      setMyId(localStorage.getItem('playerId'))
      setGameState(data)
    },
    'game:state': (data) => {
      // 严格匹配房间号，防止旧房间延迟消息闪回
      if (data.roomId !== currentRoomIdRef.current) return
      setGameState(data)
    },
    'player:kicked': (data) => {
      clearTimeout(restoreTimerRef.current)
      setKickMessage(data.message)
      currentRoomIdRef.current = null
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
    clearTimeout(restoreTimerRef.current)
    getSocket().emit('room:leave')
    currentRoomIdRef.current = null
    setRoomId(null)
    setGameState(null)
    setMyId(null)
  }, [])

  const doReplenish = useCallback((amount) => {
    getSocket().emit('player:replenish', { amount })
  }, [])

  return {
    gameState, roomId, myId, error, kickMessage, isRestoring,
    setKickMessage, createRoom, joinRoom, startGame, doAction, doReady, doUnready, leaveRoom, doReplenish,
  }
}
