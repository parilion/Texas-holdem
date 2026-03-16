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
    room.players.forEach(player => {
      io.to(player.id).emit('game:state', {
        ...room.getPublicState(player.id),
        ...extra
      })
    })
  }

  socket.on('room:create', ({ playerName }) => {
    try {
      const room = manager.createRoom()
      room.addPlayer(socket.id, playerName)
      manager.playerRoom = manager.playerRoom || new Map()
      manager.playerRoom.set(socket.id, room.roomId)
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
      room.startGame()
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

  socket.on('disconnect', () => {
    const room = manager.leaveRoom(socket.id)
    if (room && room.players.length > 0) broadcastRoomState(room)
    console.log('客户端断开:', socket.id)
  })
})

httpServer.listen(3001, () => {
  console.log('服务器运行在 http://localhost:3001')
})
