import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import RoomManager from './game/RoomManager.js'
import PlayerSessionManager from './PlayerSessionManager.js'

const app = express()
app.use(cors())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

const manager = new RoomManager()
const sessionManager = new PlayerSessionManager()

io.on('connection', (socket) => {
  const playerId = socket.handshake.auth?.playerId
  if (!playerId) {
    socket.emit('error', { message: '缺少玩家身份标识' })
    socket.disconnect()
    return
  }

  console.log('客户端连接:', socket.id, 'playerId:', playerId)

  // Socket 加入以 playerId 命名的私有房间，用于 io.to(playerId) 定向推送
  socket.join(playerId)

  // ---- 广播辅助函数 ----
  function broadcastRoomState(room, extra = {}) {
    const { kickedPlayers = [], ...stateExtra } = extra

    if (kickedPlayers.length > 0) {
      kickedPlayers.forEach(pid => {
        io.to(pid).emit('player:kicked', { message: '你的筹码为零，已被自动踢出房间' })
        sessionManager.clearRoom(pid)
        manager.leaveRoom(pid)
      })
    }

    room.players
      .filter(p => !kickedPlayers.includes(p.id))
      .forEach(player => {
        io.to(player.id).emit('game:state', {
          ...room.getPublicState(player.id),
          ...stateExtra
        })
      })
  }

  // ---- 会话恢复逻辑 ----
  const existingSession = sessionManager.getByPlayerId(playerId)

  if (existingSession?.roomId) {
    // 玩家仍在某个房间（断线重连）
    sessionManager.register(playerId, socket.id)
    const room = manager.getRoom(existingSession.roomId)
    if (room) {
      const otherPlayers = room.players.filter(p => p.id !== playerId)
      if (room.phase === 'WAITING' && otherPlayers.length === 0) {
        // 房间里只剩自己，无意义，解散房间并回大厅
        manager.leaveRoom(playerId)
        sessionManager.clearRoom(playerId)
        socket.emit('session:expired', { reason: '房间内无其他玩家，已自动解散' })
      } else {
        const player = room.players.find(p => p.id === playerId)
        if (player?.status === 'disconnected') {
          player.status = player._preDisconnectStatus || 'waiting'
          delete player._preDisconnectStatus
        }
        socket.join(existingSession.roomId)
        room.onStateChange = (extra) => broadcastRoomState(room, extra)
        socket.emit('session:restored', { roomId: existingSession.roomId, ...room.getPublicState(playerId) })
        broadcastRoomState(room)
      }
    } else {
      sessionManager.clearRoom(playerId)
      socket.emit('session:expired', { reason: '房间已解散' })
    }
  } else if (existingSession && !existingSession.roomId) {
    sessionManager.register(playerId, socket.id)
    socket.emit('session:expired', { reason: '上一局游戏已结束' })
  } else {
    sessionManager.register(playerId, socket.id)
  }

  // ---- 房间事件 ----
  socket.on('room:create', ({ playerName }) => {
    try {
      const room = manager.createRoom()
      manager.joinRoom(room.roomId, playerId, playerName)
      sessionManager.setRoom(playerId, room.roomId)
      socket.join(room.roomId)
      room.onStateChange = (extra) => broadcastRoomState(room, extra)
      socket.emit('room:joined', { roomId: room.roomId, ...room.getPublicState(playerId) })
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  socket.on('room:join', ({ roomId, playerName }) => {
    try {
      const room = manager.joinRoom(roomId, playerId, playerName)
      sessionManager.setRoom(playerId, roomId)
      socket.join(roomId)
      room.onStateChange = (extra) => broadcastRoomState(room, extra)
      socket.emit('room:joined', { roomId, ...room.getPublicState(playerId) })
      broadcastRoomState(room)
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  socket.on('game:start', () => {
    try {
      const room = manager.getRoomByPlayer(playerId)
      if (!room) throw new Error('未在任何房间中')
      const player = room.players.find(p => p.id === playerId)
      if (!player?.isDealer) throw new Error('只有房主可以开始游戏')
      room.startGame()
      broadcastRoomState(room)
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  socket.on('player:ready', () => {
    try {
      const room = manager.getRoomByPlayer(playerId)
      if (!room) throw new Error('未在任何房间中')
      room.setReady(playerId, true)
      broadcastRoomState(room)
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  socket.on('player:unready', () => {
    try {
      const room = manager.getRoomByPlayer(playerId)
      if (!room) throw new Error('未在任何房间中')
      room.setReady(playerId, false)
      broadcastRoomState(room)
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  const ACTIONS = ['check', 'call', 'raise', 'fold', 'allin']
  ACTIONS.forEach(action => {
    socket.on(`action:${action}`, (data = {}) => {
      try {
        const room = manager.getRoomByPlayer(playerId)
        if (!room) throw new Error('未在任何房间中')
        room.handleAction(playerId, action, data.amount || 0)
        broadcastRoomState(room)
      } catch (e) {
        socket.emit('error', { message: e.message })
      }
    })
  })

  // 游戏中途玩家离开的公共逻辑（宽限期超时 / 主动离开均适用）
  function handleMidGameLeave(room, pid) {
    const player = room.players.find(p => p.id === pid)
    if (player && (player.status === 'active' || player.status === 'disconnected')) {
      if (room.players[room.currentPlayerIndex]?.id === pid) {
        try { room.handleAction(pid, 'fold') } catch (e) { /* 忽略 */ }
      } else {
        player.status = 'folded'
      }
    }
    manager.playerRoom.delete(pid)
    sessionManager.clearRoom(pid)

    const connected = room.players.filter(p => manager.playerRoom.has(p.id))
    if (connected.length <= 1 && room.phase !== 'WAITING') {
      if (connected.length === 1) {
        const survivor = room.players.find(p => p.id === connected[0].id)
        if (survivor) { survivor.chips += room.pot; room.pot = 0 }
      }
      room.resetToWaiting(connected.map(p => p.id))
    }

    if (room.players.length > 0) broadcastRoomState(room)
  }

  socket.on('room:leave', () => {
    const room = manager.getRoomByPlayer(playerId)
    sessionManager.delete(playerId)
    if (room && room.phase !== 'WAITING') {
      handleMidGameLeave(room, playerId)
      socket.leave(room.roomId)
    } else {
      const removedRoom = manager.leaveRoom(playerId)
      if (removedRoom?.players.length > 0) broadcastRoomState(removedRoom)
    }
  })

  socket.on('disconnect', () => {
    console.log('客户端断开:', socket.id, 'playerId:', playerId)
    const room = manager.getRoomByPlayer(playerId)

    if (room) {
      const player = room.players.find(p => p.id === playerId)
      if (player && ['active', 'waiting', 'ready'].includes(player.status)) {
        player._preDisconnectStatus = player.status
        player.status = 'disconnected'
        broadcastRoomState(room)
      }
    }

    // 启动 60s 宽限期，超时后执行真正的离开逻辑
    sessionManager.onDisconnect(socket.id, (disconnectedPlayerId) => {
      const currentRoom = manager.getRoomByPlayer(disconnectedPlayerId)
      if (currentRoom && currentRoom.phase !== 'WAITING') {
        handleMidGameLeave(currentRoom, disconnectedPlayerId)
      } else if (currentRoom) {
        const removedRoom = manager.leaveRoom(disconnectedPlayerId)
        sessionManager.clearRoom(disconnectedPlayerId)
        if (removedRoom?.players.length > 0) broadcastRoomState(removedRoom)
      }
    })
  })
})

httpServer.listen(3001, () => {
  console.log('服务器运行在 http://localhost:3001')
})
