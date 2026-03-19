import GameRoom from './GameRoom.js'

export default class RoomManager {
  constructor() {
    this.rooms = new Map() // roomId -> GameRoom
    this.playerRoom = new Map() // socketId -> roomId
    this.chatMessages = new Map() // roomId -> messages[]
  }

  createRoom() {
    let roomId
    do {
      roomId = Math.random().toString(36).substr(2, 6).toUpperCase()
    } while (this.rooms.has(roomId))
    const room = new GameRoom(roomId)
    this.rooms.set(roomId, room)
    return room
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null
  }

  joinRoom(roomId, socketId, playerName) {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error('房间不存在')
    room.addPlayer(socketId, playerName)
    this.playerRoom.set(socketId, roomId)
    const messages = this.getRoomMessages(room.roomId)
    return { ...room.getPublicState(socketId), messages }
  }

  leaveRoom(socketId) {
    const roomId = this.playerRoom.get(socketId)
    if (!roomId) return null
    const room = this.rooms.get(roomId)
    if (room) {
      room.removePlayer(socketId)
      if (room.players.length === 0) {
        this.clearRoomMessages(roomId)
        this.rooms.delete(roomId)
      }
    }
    this.playerRoom.delete(socketId)
    return room
  }

  getRoomByPlayer(socketId) {
    const roomId = this.playerRoom.get(socketId)
    return roomId ? this.rooms.get(roomId) : null
  }

  // 获取房间消息历史
  getRoomMessages(roomId) {
    return this.chatMessages.get(roomId) || []
  }

  // 添加消息到房间
  addRoomMessage(roomId, message) {
    if (!this.chatMessages.has(roomId)) {
      this.chatMessages.set(roomId, [])
    }
    const messages = this.chatMessages.get(roomId)
    messages.push(message)
    // 限制最多50条
    if (messages.length > 50) {
      messages.shift()
    }
  }

  // 清除房间消息（房间解散时调用）
  clearRoomMessages(roomId) {
    this.chatMessages.delete(roomId)
  }
}
