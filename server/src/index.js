import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import RoomManager from './game/RoomManager.js'
import PlayerSessionManager from './PlayerSessionManager.js'

// HTML 转义函数，防止 XSS 攻击
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

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
  // skipId: 跳过该玩家的 game:state 推送（适用于已收到 session:restored / room:joined 的玩家）
  function broadcastRoomState(room, extra = {}, skipId = null) {
    const { kickedPlayers = [], winner, winnerName, winnerChips, playerResults, communityCards, winningCommunityCards, showdownPlayers, ...stateExtra } = extra

    // 保存结算历史到 RoomManager (只有 SHOWDOWN 结束才有 winner)
    if (winner) {
      const settlement = {
        winner,
        winnerName,
        winnerChips,
        playerResults: playerResults || [],
        communityCards: room.communityCards || [],  // 用房间实际公共牌，extra 里不含此字段
        winningCommunityCards: winningCommunityCards || [],
        showdownPlayers: showdownPlayers || []
      }
      manager.setRoomSettlement(room.roomId, settlement)
    }

    // 如果 extra 没有 winner 信息但有 lastSettlement（进入 WAITING 阶段时），
    // 补充结算字段以保持前端 settlement 状态
    const lastSettlement = manager.getRoomSettlement(room.roomId)
    const shouldIncludeSettlement = lastSettlement && !winner

    if (kickedPlayers.length > 0) {
      kickedPlayers.forEach(pid => {
        io.to(pid).emit('player:kicked', { message: '你的筹码为零，已被自动踢出房间' })
        sessionManager.clearRoom(pid)
        manager.leaveRoom(pid)
      })
    }

    // 只取结算的非牌面字段，避免覆盖 publicState 中的实际 communityCards
    const { communityCards: _sc, winningCommunityCards: _swc, showdownPlayers: _ssp, ...settlementRest } =
      shouldIncludeSettlement ? lastSettlement : {}
    // SHOWDOWN 阶段将 winner 数据直接放入广播，供前端触发结算弹窗
    const winnerData = winner ? { winner, winnerName, winnerChips, playerResults, showdownPlayers, winningCommunityCards } : {}

    room.players
      .filter(p => !kickedPlayers.includes(p.id) && p.id !== skipId)
      .forEach(player => {
        io.to(player.id).emit('game:state', {
          ...room.getPublicState(player.id),
          ...stateExtra,
          ...settlementRest,
          ...winnerData
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
      const player = room.players.find(p => p.id === playerId)
      if (player?.status === 'disconnected') {
        player.status = player._preDisconnectStatus || 'waiting'
        delete player._preDisconnectStatus
      }
      socket.join(existingSession.roomId)
      room.onStateChange = (extra) => broadcastRoomState(room, extra)
      room.onOutTimeout = (pid) => handleMidGameLeave(room, pid)
      room.onOutStart = (pid, seconds) => io.to(pid).emit('player:out', { seconds })
      const messages = manager.getRoomMessages(existingSession.roomId)
      const lastSettlement = manager.getRoomSettlement(existingSession.roomId)
      socket.emit('session:restored', { roomId: existingSession.roomId, messages, lastSettlement, ...room.getPublicState(playerId) })
      // 若玩家已是 out 状态且计时器仍在运行，补发剩余倒计时
      if (room.outTimers.has(playerId)) {
        const startedAt = room.outTimerStarts.get(playerId) || Date.now()
        const elapsed = Math.floor((Date.now() - startedAt) / 1000)
        io.to(playerId).emit('player:out', { seconds: Math.max(1, 20 - elapsed) })
      }
      broadcastRoomState(room, {}, playerId) // 通知其他玩家该玩家重连，自身已由 session:restored 收到完整状态
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
      room.onOutTimeout = (pid) => handleMidGameLeave(room, pid)
      room.onOutStart = (pid, seconds) => io.to(pid).emit('player:out', { seconds })
      const lastSettlement = manager.getRoomSettlement(room.roomId)
      socket.emit('room:joined', { roomId: room.roomId, lastSettlement, ...room.getPublicState(playerId) })
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  socket.on('room:join', ({ roomId, playerName }) => {
    try {
      const roomData = manager.joinRoom(roomId, playerId, playerName)
      sessionManager.setRoom(playerId, roomId)
      socket.join(roomId)
      const room = manager.getRoom(roomId)
      room.onStateChange = (extra) => broadcastRoomState(room, extra)
      room.onOutTimeout = (pid) => handleMidGameLeave(room, pid)
      room.onOutStart = (pid, seconds) => io.to(pid).emit('player:out', { seconds })
      const lastSettlement = manager.getRoomSettlement(roomId)
      socket.emit('room:joined', { roomId, lastSettlement, ...roomData })
      broadcastRoomState(room, {}, playerId) // 通知其他玩家有新玩家加入，自身已由 room:joined 收到完整状态
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

  socket.on('player:replenish', ({ amount }) => {
    try {
      const room = manager.getRoomByPlayer(playerId)
      if (!room) throw new Error('未在任何房间中')
      const player = room.players.find(p => p.id === playerId)
      if (!player) throw new Error('玩家不存在')
      const actualAmount = Math.min(Math.max(1, amount), 1000)
      room._cancelOutTimer(playerId)
      player.chips = actualAmount
      player.status = 'waiting'
      io.to(playerId).emit('player:replenished', { chips: actualAmount })
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
        // handleAction 内部 _advance/_endRound/_nextPhase 均会调用 _notifyChange，
        // 已触发 broadcastRoomState，此处无需再次广播（否则 SHOWDOWN 时会丢失 winner 信息）
        room.handleAction(playerId, action, data.amount || 0)
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
      }
      // 退出玩家直接移除（不从 room.players 留下导致幽灵占位）
      room.removePlayer(pid)
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

  // ---- 聊天事件 ----
  socket.on('chat:send', ({ roomId, content }) => {
    try {
      const room = manager.getRoom(roomId)
      if (!room) return
      const player = room.players.find(p => p.id === playerId)
      if (!player) return

      // 消息长度限制
      const maxLength = 500
      if (!content?.trim() || content.trim().length > maxLength) return

      const message = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2),
        playerId,
        playerName: player.name,
        content: escapeHtml(content.trim()),
        timestamp: Date.now()
      }

      // 存储到房间消息列表
      manager.addRoomMessage(roomId, message)

      // 广播给同房间所有玩家
      io.to(roomId).emit('chat:receive', message)
    } catch (e) {
      socket.emit('error', { message: e.message })
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
