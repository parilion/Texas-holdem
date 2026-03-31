# 历史结算记录持久化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将结算历史持久化到服务端，刷新后仍能查看历史记录

**Architecture:** 与聊天消息处理方式一致，存储在 RoomManager.settlements Map 中，房间解散时清除。SHOWDOWN 结算时保存最近一局。

**Tech Stack:** Node.js + Socket.IO (后端) / React (前端)

---

## Task 1: RoomManager 添加 settlements 存储

**Files:**
- Modify: `server/src/game/RoomManager.js`

**Step 1: 添加 settlements Map 和相关方法**

```javascript
// RoomManager.js 构造函数中添加
this.settlements = new Map() // roomId -> settlementData

// 添加方法
getRoomSettlement(roomId) {
  return this.settlements.get(roomId) || null
}

setRoomSettlement(roomId, settlement) {
  this.settlements.set(roomId, settlement)
}

clearRoomSettlement(roomId) {
  this.settlements.delete(roomId)
}
```

**Step 2: 房间解散时同步清除 settlement（修改 leaveRoom）**

```javascript
leaveRoom(socketId) {
  const roomId = this.playerRoom.get(socketId)
  if (!roomId) return null
  const room = this.rooms.get(roomId)
  if (room) {
    room.removePlayer(socketId)
    if (room.players.length === 0) {
      this.clearRoomMessages(roomId)
      this.clearRoomSettlement(roomId)  // 添加这行
      this.rooms.delete(roomId)
    }
  }
  this.playerRoom.delete(socketId)
  return room
}
```

**Step 3: 提交**

```bash
git add server/src/game/RoomManager.js
git commit -m "feat: add settlements storage to RoomManager"
```

---

## Task 2: GameRoom 结算时通知 RoomManager 保存

**Files:**
- Modify: `server/src/game/GameRoom.js`

**Step 1: 修改 _endRound 中 _notifyChange 调用**

找到 `_endRound` 方法中 `_notifyChange({...})` 的位置，需要同时通知 RoomManager 保存。

在 GameRoom 中需要持有对 RoomManager 的引用，或者通过回调传递。

最简单的方案：在 `onStateChange` 回调参数中传递 settlement，由 index.js 在 broadcastRoomState 时保存到 RoomManager。

修改 `_endRound` 中的 `_notifyChange` 调用，在 extra 参数中加入 `settlement` 字段：

```javascript
// GameRoom.js _endRound() 中，_notifyChange 调用处
// 已有 extra 参数包含 winner 等信息
// 确保 extra 包含完整的 settlementData
```

实际上看现有代码，`_notifyChange` 已经在 `extra` 中传递了 `winner`, `winnerName`, `playerResults` 等字段，这些正好是前端 `SettlementContent` 需要的。所以 Task 2 实际上无需修改 GameRoom，只需在后端接收端保存即可。

**Step 2: 提交**

```bash
git add server/src/game/GameRoom.js
git commit -m "refactor: settlement data already in extra from _endRound"
```
（无实际变更，仅文档说明）

---

## Task 3: index.js 接收结算数据并保存到 RoomManager

**Files:**
- Modify: `server/src/index.js`

**Step 1: 修改 broadcastRoomState 函数保存 settlement**

在 `broadcastRoomState` 函数中，当 `extra` 包含结算数据时，保存到 RoomManager：

```javascript
function broadcastRoomState(room, extra = {}) {
  const { kickedPlayers = [], settlement, ...stateExtra } = extra

  // 保存结算历史到 RoomManager
  if (settlement) {
    manager.setRoomSettlement(room.roomId, settlement)
  }

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
```

**Step 2: 确保 session:restored 和 room:joined 返回 lastSettlement**

检查现有代码，`room:join` 和 `session:restored` 已经返回了 `messages`。需要确认 `lastSettlement` 也一并返回。

在 `session:restored` 处理中：
```javascript
const messages = manager.getRoomMessages(existingSession.roomId)
const lastSettlement = manager.getRoomSettlement(existingSession.roomId)
socket.emit('session:restored', { roomId: existingSession.roomId, messages, lastSettlement, ...room.getPublicState(playerId) })
```

在 `room:join` 处理中：
```javascript
const room = manager.getRoom(roomId)
// ... existing code ...
const lastSettlement = manager.getRoomSettlement(roomId)
socket.emit('room:joined', { roomId, lastSettlement, ...room.getPublicState(playerId) })
```

在 `room:create` 处理中：
```javascript
const lastSettlement = manager.getRoomSettlement(room.roomId)
socket.emit('room:joined', { roomId: room.roomId, lastSettlement, ...room.getPublicState(playerId) })
```

**Step 3: 提交**

```bash
git add server/src/index.js
git commit -m "feat: save and broadcast settlement history"
```

---

## Task 4: Table.jsx 使用服务端 lastSettlement

**Files:**
- Modify: `client/src/components/Table.jsx`

**Step 1: 修改 lastSettlement 初始化逻辑**

将：
```javascript
const [lastSettlement, setLastSettlement] = useState(null)
```

改为用 `gameState.lastSettlement` 初始化：
```javascript
const [lastSettlement, setLastSettlement] = useState(gameState?.lastSettlement || null)
```

**Step 2: 保留 showdown 结算保存逻辑（用于实时显示）**

`useEffect` 中监听 `phase === 'SHOWDOWN'` 时设置 `setLastSettlement` 的逻辑保留，但改用函数式更新合并服务端数据：

```javascript
// 监听结算数据 - 用于实时显示
useEffect(() => {
  if (phase === 'SHOWDOWN' && gameState.winner && prevPhaseRef.current !== 'SHOWDOWN') {
    const isByFold = (gameState.players || []).filter(
      p => p.holeCards && p.holeCards.length > 0 && p.status !== 'folded' && p.status !== 'out'
    ).length <= 1

    const settlementData = {
      winner: gameState.winner,
      winnerName: gameState.winnerName,
      winnerChips: gameState.winnerChips,
      playerResults: gameState.playerResults || [],
      communityCards: gameState.communityCards || [],
      winningCommunityCards: gameState.winningCommunityCards || [],
      showdownPlayers: isByFold ? [] : (gameState.showdownPlayers || []),
    }
    setSettlement(settlementData)
    setLastSettlement(settlementData)  // 实时显示时更新
  }
  prevPhaseRef.current = phase
}, [phase, gameState])
```

**Step 3: 提交**

```bash
git add client/src/components/Table.jsx
git commit -m "feat: use server-side settlement history"
```

---

## Task 5: 验证功能

**Step 1: 启动服务端和客户端**

```bash
npm run dev
```

**Step 2: 测试场景**

1. 创建房间并加入
2. 开始游戏，完成一局
3. 观察 SHOWDOWN 结算弹框
4. 点击"继续"关闭弹框
5. 点击"历史"按钮，验证能看到上一局结算
6. **刷新页面**
7. 验证"历史"按钮仍然可用，点击能看到上一局结算

**Step 3: 测试聊天记录一致性**

1. 房间内发送聊天消息
2. 刷新页面
3. 验证聊天记录仍然存在
4. 退出房间
5. 验证聊天记录和结算历史同时清除
