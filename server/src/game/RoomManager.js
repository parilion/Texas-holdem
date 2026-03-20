import GameRoom from './GameRoom.js'

export default class RoomManager {
  constructor() {
    this.rooms = new Map() // roomId -> GameRoom
    this.playerRoom = new Map() // socketId -> roomId
    this.chatMessages = new Map() // roomId -> messages[]
    this.settlements = new Map() // roomId -> settlementData
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
        this.clearRoomSettlement(roomId)
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

  // Get room message history
  getRoomMessages(roomId) {
    return this.chatMessages.get(roomId) || []
  }

  // Add message to room
  addRoomMessage(roomId, message) {
    // Validate room exists
    if (!this.rooms.has(roomId)) {
      console.warn(`Attempted to add message to non-existent room: ${roomId}`)
      return
    }

    // Validate message structure
    if (!message || typeof message !== 'object' || !message.content || !message.playerId) {
      console.warn('Invalid message format')
      return
    }

    if (!this.chatMessages.has(roomId)) {
      this.chatMessages.set(roomId, [])
    }
    const messages = this.chatMessages.get(roomId)
    messages.push(message)
    // Limit to 50 messages max
    if (messages.length > 50) {
      messages.shift()
    }
  }

  // Clear room messages (called when room is disbanded)
  clearRoomMessages(roomId) {
    this.chatMessages.delete(roomId)
  }

  getRoomSettlement(roomId) {
    return this.settlements.get(roomId) || null
  }

  setRoomSettlement(roomId, settlement) {
    this.settlements.set(roomId, settlement)
  }

  clearRoomSettlement(roomId) {
    this.settlements.delete(roomId)
  }
}
