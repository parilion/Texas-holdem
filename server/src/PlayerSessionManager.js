export default class PlayerSessionManager {
  constructor() {
    // playerId -> { socketId, roomId, disconnectTimer, expireTimer }
    this.sessions = new Map()
  }

  register(playerId, socketId) {
    const existing = this.sessions.get(playerId)
    if (existing) {
      clearTimeout(existing.disconnectTimer)
      clearTimeout(existing.expireTimer)
      existing.socketId = socketId
      existing.disconnectTimer = null
      existing.expireTimer = null
    } else {
      this.sessions.set(playerId, { socketId, roomId: null, disconnectTimer: null, expireTimer: null })
    }
  }

  getByPlayerId(playerId) {
    return this.sessions.get(playerId) || null
  }

  getBySocketId(socketId) {
    for (const [playerId, session] of this.sessions) {
      if (session.socketId === socketId) return { playerId, ...session }
    }
    return null
  }

  setRoom(playerId, roomId) {
    const s = this.sessions.get(playerId)
    if (s) s.roomId = roomId
  }

  clearRoom(playerId) {
    const s = this.sessions.get(playerId)
    if (s) s.roomId = null
  }

  onDisconnect(socketId, onTimeout) {
    const entry = this.getBySocketId(socketId)
    if (!entry) return
    const { playerId } = entry
    const s = this.sessions.get(playerId)
    s.disconnectTimer = setTimeout(() => {
      s.disconnectTimer = null
      onTimeout(playerId)
      s.expireTimer = setTimeout(() => {
        this.sessions.delete(playerId)
      }, 10 * 60 * 1000)
    }, 60 * 1000)
  }

  delete(playerId) {
    const s = this.sessions.get(playerId)
    if (s) {
      clearTimeout(s.disconnectTimer)
      clearTimeout(s.expireTimer)
    }
    this.sessions.delete(playerId)
  }
}
