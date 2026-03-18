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

  socket.on('room:leave', () => {
    const room = manager.leaveRoom(socket.id)
    if (room && room.players.length > 0) broadcastRoomState(room)
  })

  socket.on('disconnect', () => {
    const room = manager.getRoomByPlayer(socket.id)

    if (room && room.phase !== 'WAITING') {
      // 游戏进行中：折叠该玩家而非直接移除，防止游戏卡死
      const player = room.players.find(p => p.id === socket.id)
      if (player && player.status === 'active') {
        if (room.players[room.currentPlayerIndex]?.id === socket.id) {
          // 轮到该玩家时：通过正式 fold 操作推进游戏
          try { room.handleAction(socket.id, 'fold') } catch (e) { /* 忽略 */ }
        } else {
          // 非该玩家回合：直接标记 folded，等 _advance 自然跳过
          player.status = 'folded'
        }
      }
      // 从映射中移除（不再响应此 socket），但保留在 players 数组里直到本局结束
      manager.playerRoom.delete(socket.id)
      if (room.players.length > 0) broadcastRoomState(room)
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
