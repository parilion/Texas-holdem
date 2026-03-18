import GameRoom from './GameRoom.js'

export default class RoomManager {
  constructor() {
    this.rooms = new Map() // roomId -> GameRoom
    this.playerRoom = new Map() // socketId -> roomId
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
    return room
  }

  leaveRoom(socketId) {
    const roomId = this.playerRoom.get(socketId)
    if (!roomId) return null
    const room = this.rooms.get(roomId)
    if (room) {
      room.removePlayer(socketId)
      if (room.players.length === 0) this.rooms.delete(roomId)
    }
    this.playerRoom.delete(socketId)
    return room
  }

  getRoomByPlayer(socketId) {
    const roomId = this.playerRoom.get(socketId)
    return roomId ? this.rooms.get(roomId) : null
  }
}
