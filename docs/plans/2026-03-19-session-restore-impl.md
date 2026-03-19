# 玩家刷新恢复（UUID 会话方案）实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 通过 localStorage 持久化 UUID 作为玩家身份，支持刷新后无缝恢复游戏状态（包括游戏进行中）。

**Architecture:** 前端生成 UUID 存入 localStorage，通过 Socket.IO `auth` 字段传入服务端；服务端新增 `PlayerSessionManager` 维护 `UUID → 会话` 映射，断线后保留 60s 宽限期，之后再保留 UUID 记录 10 分钟供过期通知使用；玩家断线时标记为 `disconnected` 状态，`_advance()` 推进时自动 fold；重连时恢复玩家状态并推送当前游戏局面。

**Tech Stack:** Node.js, Socket.IO 4.x, React 18, localStorage API, `crypto.randomUUID()`

---

## 关键约定

- 玩家唯一标识从 `socket.id`（每次连接变化）改为 `playerId`（UUID，持久化）
- `socket.join(playerId)` 使 `io.to(playerId).emit(...)` 可定向推送（替代原来对 socket.id 的依赖）
- `disconnected` 是新增玩家状态，游戏逻辑将其视同 `folded`（`_advance()` 遇到时自动 fold）
- 重连时恢复 `disconnected` → 原始状态（`_preDisconnectStatus` 字段临时保存）

---

## Task 1: 创建 PlayerSessionManager

**Files:**
- Create: `server/src/PlayerSessionManager.js`
- Create: `server/src/PlayerSessionManager.test.js`

**Step 1: 编写失败测试**

新建 `server/src/PlayerSessionManager.test.js`：

```js
import PlayerSessionManager from './PlayerSessionManager.js'

describe('PlayerSessionManager', () => {
  let mgr

  beforeEach(() => {
    mgr = new PlayerSessionManager()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('register 新玩家', () => {
    mgr.register('uuid-1', 'socket-1')
    expect(mgr.getByPlayerId('uuid-1').socketId).toBe('socket-1')
  })

  test('getBySocketId 反查', () => {
    mgr.register('uuid-1', 'socket-1')
    expect(mgr.getBySocketId('socket-1').playerId).toBe('uuid-1')
  })

  test('register 重连更新 socketId 并取消计时', () => {
    mgr.register('uuid-1', 'socket-old')
    const cb = jest.fn()
    mgr.onDisconnect('socket-old', cb)
    mgr.register('uuid-1', 'socket-new') // 模拟重连
    jest.advanceTimersByTime(60000)
    expect(cb).not.toHaveBeenCalled()
    expect(mgr.getByPlayerId('uuid-1').socketId).toBe('socket-new')
  })

  test('onDisconnect 60s 后触发回调', () => {
    mgr.register('uuid-1', 'socket-1')
    const cb = jest.fn()
    mgr.onDisconnect('socket-1', cb)
    expect(cb).not.toHaveBeenCalled()
    jest.advanceTimersByTime(60000)
    expect(cb).toHaveBeenCalledWith('uuid-1')
  })

  test('onDisconnect 超时后记录保留 10 分钟再清除', () => {
    mgr.register('uuid-1', 'socket-1')
    mgr.onDisconnect('socket-1', jest.fn())
    jest.advanceTimersByTime(60000)
    expect(mgr.getByPlayerId('uuid-1')).not.toBeNull()
    jest.advanceTimersByTime(10 * 60 * 1000)
    expect(mgr.getByPlayerId('uuid-1')).toBeNull()
  })

  test('setRoom / clearRoom', () => {
    mgr.register('uuid-1', 'socket-1')
    mgr.setRoom('uuid-1', 'ROOM01')
    expect(mgr.getByPlayerId('uuid-1').roomId).toBe('ROOM01')
    mgr.clearRoom('uuid-1')
    expect(mgr.getByPlayerId('uuid-1').roomId).toBeNull()
  })
})
```

**Step 2: 运行测试确认失败**

```bash
cd server && npm test -- PlayerSessionManager
```

预期：FAIL "Cannot find module './PlayerSessionManager.js'"

**Step 3: 实现 PlayerSessionManager**

新建 `server/src/PlayerSessionManager.js`：

```js
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

  // 断线时启动 60s 宽限期，超时后调用 onTimeout(playerId)
  // 超时后再保留会话数据 10 分钟（供 session:expired 通知使用）
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
```

**Step 4: 运行测试确认通过**

```bash
cd server && npm test -- PlayerSessionManager
```

预期：PASS（6 个测试全部通过）

**Step 5: Commit**

```bash
git add server/src/PlayerSessionManager.js server/src/PlayerSessionManager.test.js
git commit -m "feat: 添加 PlayerSessionManager 管理 UUID 会话生命周期"
```

---

## Task 2: 更新 GameRoom - 支持 disconnected 状态

**Files:**
- Modify: `server/src/game/GameRoom.js`（`_advance()` 方法，第 237-244 行）
- Modify: `server/src/game/GameRoom.test.js`（已存在，添加新测试）

**Step 1: 找到现有测试文件，新增断线自动 fold 的失败测试**

在 `server/src/game/GameRoom.test.js` 末尾添加：

```js
test('_advance 遇到 disconnected 玩家时自动 fold 并跳过', () => {
  const room = new GameRoom('R1')
  room.addPlayer('p1', 'Alice')
  room.addPlayer('p2', 'Bob')
  room.addPlayer('p3', 'Charlie')

  // 手动模拟 PREFLOP 阶段状态
  room.phase = 'PREFLOP'
  room.players[0].status = 'active'
  room.players[0].bet = 20
  room.players[0].hasActed = true
  room.players[1].status = 'disconnected' // Bob 断线
  room.players[1].bet = 0
  room.players[1].hasActed = false
  room.players[2].status = 'active'
  room.players[2].bet = 20
  room.players[2].hasActed = true
  room.currentBet = 20
  room.currentPlayerIndex = 0 // Alice 刚行动完

  room._advance()

  // Bob 应被自动 fold
  expect(room.players[1].status).toBe('folded')
  // 当前操作者应跳过 Bob，轮到 Charlie 或进入下一阶段
  expect(room.currentPlayerIndex).not.toBe(1)
})
```

**Step 2: 运行测试确认失败**

```bash
cd server && npm test -- GameRoom
```

预期：新增测试 FAIL

**Step 3: 修改 `GameRoom.js` 的 `_advance()` 方法**

找到 `server/src/game/GameRoom.js` 第 237-244 行：

```js
    // 找下一个可操作玩家（用计数器防止死循环）
    let next = (this.currentPlayerIndex + 1) % this.players.length
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[next]?.status === 'active') break
      next = (next + 1) % this.players.length
    }
    this.currentPlayerIndex = next
    this._notifyChange()
```

替换为：

```js
    // 找下一个可操作玩家（途中遇到 disconnected 玩家自动 fold）
    let next = (this.currentPlayerIndex + 1) % this.players.length
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[next]?.status === 'disconnected') {
        this.players[next].status = 'folded'
      }
      if (this.players[next]?.status === 'active') break
      next = (next + 1) % this.players.length
    }
    this.currentPlayerIndex = next
    this._notifyChange()
```

**Step 4: 运行测试确认全部通过**

```bash
cd server && npm test -- GameRoom
```

预期：所有测试 PASS（含新增测试）

**Step 5: Commit**

```bash
git add server/src/game/GameRoom.js server/src/game/GameRoom.test.js
git commit -m "feat: GameRoom _advance() 支持 disconnected 状态自动 fold"
```

---

## Task 3: 更新 index.js - 使用 UUID 作为玩家身份

这是最核心的改动，将 `socket.id` 全面替换为 `playerId`（UUID）。

**Files:**
- Modify: `server/src/index.js`（全量重写）

**注意：** `RoomManager.js` 不需要修改，其方法参数是泛型的，传入 `playerId` 即可正常工作。

**Step 1: 用以下内容替换 `server/src/index.js` 全部内容**

```js
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

  // ---- 广播辅助函数（定义在前，各事件处理共用）----
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
    sessionManager.register(playerId, socket.id) // 更新 socketId，取消宽限期计时
    const room = manager.getRoom(existingSession.roomId)
    if (room) {
      // 恢复 disconnected → 原状态
      const player = room.players.find(p => p.id === playerId)
      if (player?.status === 'disconnected') {
        player.status = player._preDisconnectStatus || 'waiting'
        delete player._preDisconnectStatus
      }
      socket.join(existingSession.roomId) // 重新加入 Socket.IO 房间
      room.onStateChange = (extra) => broadcastRoomState(room, extra)
      socket.emit('session:restored', { roomId: existingSession.roomId, ...room.getPublicState(playerId) })
      broadcastRoomState(room)
    } else {
      // 房间已解散
      sessionManager.clearRoom(playerId)
      socket.emit('session:expired', { reason: '房间已解散' })
    }
  } else if (existingSession && !existingSession.roomId) {
    // UUID 已知但已离开房间（10 分钟内的过期记录）
    sessionManager.register(playerId, socket.id)
    socket.emit('session:expired', { reason: '上一局游戏已结束' })
  } else {
    // 全新玩家
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
    sessionManager.clearRoom(playerId)
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
      // 标记玩家为 disconnected，其他玩家可见（所有阶段均适用）
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
        if (removedRoom?.players.length > 0) broadcastRoomState(removedRoom)
      }
    })
  })
})

httpServer.listen(3001, () => {
  console.log('服务器运行在 http://localhost:3001')
})
```

**Step 2: 启动服务端确认无报错**

```bash
cd server && npm run dev
```

预期：`服务器运行在 http://localhost:3001`，无报错、无崩溃

**Step 3: Commit**

```bash
git add server/src/index.js
git commit -m "feat: 服务端改用 UUID playerId 识别玩家，支持断线重连宽限期"
```

---

## Task 4: 前端 - UUID 生成与 Socket auth

**Files:**
- Modify: `client/src/hooks/useSocket.js`

**Step 1: 用以下内容替换 `client/src/hooks/useSocket.js` 全部内容**

```js
import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

let socket = null

export function getSocket() {
  if (!socket) {
    let playerId = localStorage.getItem('playerId')
    if (!playerId) {
      playerId = crypto.randomUUID()
      localStorage.setItem('playerId', playerId)
    }
    const serverUrl = import.meta.env.VITE_SERVER_URL || window.location.origin
    socket = io(serverUrl, {
      autoConnect: false,
      auth: { playerId },
    })
  }
  return socket
}

export function useSocket(handlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const s = getSocket()
    if (!s.connected) s.connect()

    const listeners = []
    Object.keys(handlersRef.current).forEach(event => {
      const listener = (...args) => handlersRef.current[event]?.(...args)
      s.on(event, listener)
      listeners.push([event, listener])
    })

    return () => {
      listeners.forEach(([event, listener]) => s.off(event, listener))
    }
  }, [])
}
```

**Step 2: 验证 UUID 生成**

启动前后端，在浏览器控制台执行：

```js
localStorage.getItem('playerId') // 应返回类似 "550e8400-e29b-41d4-a716-446655440000" 的 UUID
```

服务端控制台应显示：`客户端连接: xxx playerId: <uuid>`

**Step 3: Commit**

```bash
git add client/src/hooks/useSocket.js
git commit -m "feat: Socket.IO 连接携带 localStorage UUID 作为玩家身份"
```

---

## Task 5: 前端 - 会话恢复事件处理

**Files:**
- Modify: `client/src/hooks/useGame.js`

**Step 1: 用以下内容替换 `client/src/hooks/useGame.js` 全部内容**

```js
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

  useSocket({
    'connect': () => {
      setMyId(null)
      // 2s 超时兜底：若服务端无响应则回到大厅
      clearTimeout(restoreTimerRef.current)
      if (localStorage.getItem('playerId')) {
        restoreTimerRef.current = setTimeout(() => {
          setIsRestoring(false)
          setRoomId(null)
          setGameState(null)
        }, 2000)
      }
    },
    'session:restored': (data) => {
      clearTimeout(restoreTimerRef.current)
      setIsRestoring(false)
      setRoomId(data.roomId)
      setMyId(localStorage.getItem('playerId'))
      setGameState(data)
    },
    'session:expired': (data) => {
      clearTimeout(restoreTimerRef.current)
      setIsRestoring(false)
      setRoomId(null)
      setGameState(null)
      setMyId(null)
      setKickMessage(data.reason || '上一局游戏已结束')
    },
    'room:joined': (data) => {
      clearTimeout(restoreTimerRef.current)
      setIsRestoring(false)
      setRoomId(data.roomId)
      setMyId(localStorage.getItem('playerId'))
      setGameState(data)
    },
    'game:state': (data) => {
      setGameState(data)
    },
    'player:kicked': (data) => {
      setKickMessage(data.message)
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
    getSocket().emit('room:leave')
    setRoomId(null)
    setGameState(null)
    setMyId(null)
  }, [])

  return {
    gameState, roomId, myId, error, kickMessage, isRestoring,
    setKickMessage, createRoom, joinRoom, startGame, doAction, doReady, doUnready, leaveRoom,
  }
}
```

**Step 2: Commit**

```bash
git add client/src/hooks/useGame.js
git commit -m "feat: 前端处理 session:restored / session:expired 事件，支持刷新恢复"
```

---

## Task 6: 前端 - App.jsx 添加恢复中过渡状态

**Files:**
- Modify: `client/src/App.jsx`

**Step 1: 用以下内容替换 `client/src/App.jsx` 全部内容**

```jsx
import { useGame } from './hooks/useGame'
import Lobby from './components/Lobby'
import Table from './components/Table'
import './index.css'

export default function App() {
  const {
    gameState, roomId, myId, error, kickMessage, isRestoring,
    setKickMessage, createRoom, joinRoom, startGame, doAction, doReady, doUnready, leaveRoom,
  } = useGame()

  if (isRestoring) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontSize: '1.2rem', color: '#888',
      }}>
        正在恢复会话...
      </div>
    )
  }

  if (!roomId) {
    return (
      <Lobby
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        error={error}
        kickMessage={kickMessage}
        onClearKickMessage={() => setKickMessage(null)}
      />
    )
  }

  return (
    <Table
      gameState={gameState}
      myId={myId}
      roomId={roomId}
      onAction={doAction}
      onStartGame={startGame}
      onReady={doReady}
      onUnready={doUnready}
      onLeaveRoom={leaveRoom}
      error={error}
    />
  )
}
```

**Step 2: 全流程手动测试**

1. 启动前后端：`npm run dev`
2. 打开 `http://localhost:5173`，创建房间，开始游戏（需要 2 个浏览器标签）
3. 游戏进行中（PREFLOP/FLOP 阶段）**刷新当前标签页**
4. 预期：短暂显示"正在恢复会话..."后恢复到游戏桌，手牌和筹码完整
5. 另一个标签页刷新，确认两位玩家均能正常恢复
6. 断线超过 60 秒后重新打开（可将宽限期临时改为 5s 测试）
7. 预期：显示"上一局游戏已结束"消息，自动回到大厅

**Step 3: 运行所有服务端测试**

```bash
cd server && npm test
```

预期：所有测试 PASS

**Step 4: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: App 添加会话恢复中过渡状态，完成刷新恢复功能"
```

---

## 验收标准

| 场景 | 预期行为 |
|---|---|
| 首次访问 | localStorage 生成 UUID，正常进入大厅 |
| 等待阶段刷新 | 重连后自动回到等待房间 |
| 游戏中刷新 | 恢复到游戏桌，手牌和筹码完整 |
| 非当前玩家断线 | 其他玩家看到"断线"状态，游戏继续；轮到该玩家时自动 fold |
| 60s 内重连 | 无缝恢复，继续游戏（已被 fold 则作为观众） |
| 60s 后重连 | 提示"游戏已结束"，引导回大厅 |
| 服务器重启 | 提示"上一局游戏已结束"，引导回大厅 |
| 两个标签页同一 UUID | 第二个标签页连接时，旧标签页收到 session:expired |
