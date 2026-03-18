import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import RoomManager from './game/RoomManager.js'

const app = express()
app.use(cors())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

const manager = new RoomManager()

io.on('connection', (socket) => {
  console.log('客户端连接:', socket.id)

  function broadcastRoomState(room, extra = {}) {
    const { kickedPlayers = [], ...stateExtra } = extra

    // 踢出筹码归零的玩家
    if (kickedPlayers.length > 0) {
      kickedPlayers.forEach(playerId => {
        io.to(playerId).emit('player:kicked', { message: '你的筹码为零，已被自动踢出房间' })
        manager.leaveRoom(playerId)
      })
    }

    // 向剩余玩家广播状态
    room.players
      .filter(p => !kickedPlayers.includes(p.id))
      .forEach(player => {
        io.to(player.id).emit('game:state', {
          ...room.getPublicState(player.id),
          ...stateExtra
        })
      })
  }

  socket.on('room:create', ({ playerName }) => {
    try {
      const room = manager.createRoom()
      manager.joinRoom(room.roomId, socket.id, playerName)
      socket.join(room.roomId)
      room.onStateChange = (extra) => broadcastRoomState(room, extra)
      socket.emit('room:joined', { roomId: room.roomId, ...room.getPublicState(socket.id) })
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  socket.on('room:join', ({ roomId, playerName }) => {
    try {
      const room = manager.joinRoom(roomId, socket.id, playerName)
      socket.join(roomId)
      room.onStateChange = (extra) => broadcastRoomState(room, extra)
      socket.emit('room:joined', { roomId, ...room.getPublicState(socket.id) })
      broadcastRoomState(room)
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  socket.on('game:start', () => {
    try {
      const room = manager.getRoomByPlayer(socket.id)
      if (!room) throw new Error('未在任何房间中')
      const player = room.players.find(p => p.id === socket.id)
      if (!player?.isDealer) throw new Error('只有房主可以开始游戏')
      room.startGame()
      broadcastRoomState(room)
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  socket.on('player:ready', () => {
    try {
      const room = manager.getRoomByPlayer(socket.id)
      if (!room) throw new Error('未在任何房间中')
      room.setReady(socket.id, true)
      broadcastRoomState(room)
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  socket.on('player:unready', () => {
    try {
      const room = manager.getRoomByPlayer(socket.id)
      if (!room) throw new Error('未在任何房间中')
      room.setReady(socket.id, false)
      broadcastRoomState(room)
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  const ACTIONS = ['check', 'call', 'raise', 'fold', 'allin']
  ACTIONS.forEach(action => {
    socket.on(`action:${action}`, (data = {}) => {
      try {
        const room = manager.getRoomByPlayer(socket.id)
        if (!room) throw new Error('未在任何房间中')
        room.handleAction(socket.id, action, data.amount || 0)
        broadcastRoomState(room)
      } catch (e) {
        socket.emit('error', { message: e.message })
      }
    })
  })

  // 游戏中途玩家离开的公共逻辑（断线/主动离开均适用）
  function handleMidGameLeave(room, playerId) {
    const player = room.players.find(p => p.id === playerId)
    if (player && player.status === 'active') {
      if (room.players[room.currentPlayerIndex]?.id === playerId) {
        try { room.handleAction(playerId, 'fold') } catch (e) { /* 忽略 */ }
      } else {
        player.status = 'folded'
      }
    }
    manager.playerRoom.delete(playerId)

    // 若只剩 1 名在线玩家，立即将底池给幸存者并重置回准备界面
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
    const room = manager.getRoomByPlayer(socket.id)
    if (room && room.phase !== 'WAITING') {
      // 游戏进行中：折叠后检查人数，必要时重置
      handleMidGameLeave(room, socket.id)
      socket.leave(room.roomId)
    } else {
      // 等待阶段：正常移除
      const removedRoom = manager.leaveRoom(socket.id)
      if (removedRoom && removedRoom.players.length > 0) broadcastRoomState(removedRoom)
    }
  })

  socket.on('disconnect', () => {
    const room = manager.getRoomByPlayer(socket.id)

    if (room && room.phase !== 'WAITING') {
      handleMidGameLeave(room, socket.id)
    } else {
      // WAITING 阶段：正常移除
      const removedRoom = manager.leaveRoom(socket.id)
      if (removedRoom && removedRoom.players.length > 0) broadcastRoomState(removedRoom)
    }

    console.log('客户端断开:', socket.id)
  })
})

httpServer.listen(3001, () => {
  console.log('服务器运行在 http://localhost:3001')
})
