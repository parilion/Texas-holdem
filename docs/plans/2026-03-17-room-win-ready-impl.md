# 房间区分、胜利展示、自动准备流程 - 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 实现房间创建/加入的视觉区分、胜利展示、准备系统

**Architecture:** 后端增加 ready 状态和事件，前端增加相应 UI 和动画

**Tech Stack:** React, Socket.IO, Node.js

---

## Task 1: 后端 - 添加 ready 状态支持

**Files:**
- Modify: `server/src/game/GameRoom.js`
- Modify: `server/src/index.js`

### Step 1: 修改 GameRoom.js 添加 ready 状态

在 `server/src/game/GameRoom.js` 中：

1. 添加 `ready` 状态到玩家状态
```javascript
// 第36行附近，将 'waiting' 改为支持 ready
player.status: 'ready' | 'waiting' | 'active' | 'folded' | 'allin' | 'out'
```

2. 修改 `_endRound` 方法，游戏结束后设置玩家为 ready 状态
```javascript
// 在 _endRound 方法中，约第247行
// 原来：
if (p.chips <= 0) p.status = 'out'
else p.status = 'waiting'

// 改为：
if (p.chips <= 0) p.status = 'out'
else p.status = 'ready'  // 改为 ready 状态
```

3. 添加 `setReady` 方法
```javascript
setReady(playerId, ready) {
  const player = this.players.find(p => p.id === playerId)
  if (!player) return
  if (player.status !== 'ready' && player.status !== 'waiting') return
  player.status = ready ? 'ready' : 'waiting'
  this._notifyChange()
}
```

4. 修改 `getPublicState` 确保 ready 状态发送给前端
```javascript
// 在 getPublicState 中，players 映射保持不变
// ready 状态会直接发送给前端
```

### Step 2: 修改 index.js 添加 ready 事件

在 `server/src/index.js` 中，添加 ready 事件处理：

```javascript
// 在 ACTIONS 定义之后添加
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
```

---

## Task 2: 前端 - Lobby 视觉区分

**Files:**
- Modify: `client/src/components/Lobby.jsx`
- Modify: `client/src/components/Lobby.css`

### Step 1: 修改 Lobby.jsx 添加颜色 class

```javascript
// 第34行
<button className="btn-create" onClick={() => setMode('create')}>创建房间</button>

// 第35行
<button className="btn-join" onClick={() => setMode('join')}>加入房间</button>
```

### Step 2: 修改 Lobby.css 添加颜色样式

```css
.lobby .buttons button:first-child {
  background: #27ae60; /* 绿色 */
}

.lobby .buttons button:last-child {
  background: #3498db; /* 蓝色 */
}
```

---

## Task 3: 前端 - Table 胜利展示和准备按钮

**Files:**
- Modify: `client/src/components/Table.jsx`
- Modify: `client/src/components/Table.css`
- Modify: `client/src/hooks/useGame.js`

### Step 1: 修改 useGame.js 添加 ready 方法

在 `client/src/hooks/useGame.js` 中：

```javascript
// 在 doAction 定义之后添加
const doReady = useCallback(() => {
  getSocket().emit('player:ready')
}, [])

const doUnready = useCallback(() => {
  getSocket().emit('player:unready')
}, [])

// 在 return 中添加
return { gameState, roomId, myId, error, createRoom, joinRoom, startGame, doAction, doReady, doUnready }
```

### Step 2: 修改 Table.jsx 显示准备按钮和胜利

在 `client/src/components/Table.jsx` 中：

1. 导入 useState
```javascript
import { useState, useEffect } from 'react'
```

2. 添加 winner 显示状态
```javascript
const [showWinner, setShowWinner] = useState(false)
const [winnerInfo, setWinnerInfo] = useState(null)

// 监听 phase 变化来显示胜利
useEffect(() => {
  if (phase === 'SHOWDOWN' && gameState.winner) {
    setWinnerInfo({ name: gameState.winnerName, chips: gameState.winnerChips })
    setShowWinner(true)
    setTimeout(() => {
      setShowWinner(false)
      setWinnerInfo(null)
    }, 1000)
  }
}, [phase, gameState.winner])
```

3. 获取当前玩家状态
```javascript
const myPlayer = players[myIndex]
const isHost = myIndex === 0
const isReady = myPlayer?.status === 'ready'
const allReady = players.filter(p => p.status !== 'out').every(p => p.status === 'ready')
```

4. 修改 WAITING 阶段的按钮显示
```javascript
{phase === 'WAITING' && isHost && (
  <button className="start-btn" onClick={onStartGame}>开始游戏</button>
)}

{phase === 'WAITING' && !isHost && !isReady && (
  <button className="ready-btn" onClick={onReady}>准备</button>
)}

{phase === 'WAITING' && !isHost && isReady && (
  <button className="ready-btn ready" onClick={onUnready}>已准备</button>
)}
```

5. 在 table-center 中添加胜利显示
```javascript
{showWinner && winnerInfo && (
  <div className="winner-display">
    <div className="winner-name">🏆 {winnerInfo.name} 获胜！</div>
    <div className="winner-chips">+{winnerInfo.chips} 筹码</div>
  </div>
)}
```

### Step 3: 修改 Table.css 添加胜利和准备按钮样式

```css
/* 准备按钮 */
.ready-btn {
  padding: 1rem 3rem;
  background: #27ae60;
  border: none;
  border-radius: 12px;
  font-size: 1.2rem;
  font-weight: bold;
  cursor: pointer;
  margin-top: 2rem;
  color: #fff;
}

.ready-btn.ready {
  background: #7f8c8d;
}

/* 胜利展示 */
.winner-display {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.85);
  padding: 2rem 3rem;
  border-radius: 16px;
  text-align: center;
  z-index: 100;
  animation: winnerPop 0.3s ease-out;
}

.winner-name {
  font-size: 2rem;
  font-weight: bold;
  color: #f4c430;
  margin-bottom: 0.5rem;
}

.winner-chips {
  font-size: 1.2rem;
  color: #2ecc71;
}

@keyframes winnerPop {
  from {
    transform: translate(-50%, -50%) scale(0.5);
    opacity: 0;
  }
  to {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}
```

---

## Task 4: 修改 App.jsx 传递新方法

**Files:**
- Modify: `client/src/App.jsx`

### Step 1: 更新 App.jsx

```javascript
// 解构新增的 doReady, doUnready
const { gameState, roomId, myId, error, createRoom, joinRoom, startGame, doAction, doReady, doUnready } = useGame()

// 传递给 Table 组件
<Table
  gameState={gameState}
  myId={myId}
  roomId={roomId}
  onAction={doAction}
  onStartGame={startGame}
  onReady={doReady}
  onUnready={doUnready}
  error={error}
/>
```

### Step 2: 更新 Table.jsx 接收新 props

```javascript
export default function Table({ gameState, myId, roomId, onAction, onStartGame, onReady, onUnready, error }) {
```

---

## Task 5: 测试验证

### 启动服务器测试
```bash
cd server && npm run dev
```

### 启动客户端测试
```bash
cd client && npm run dev
```

### 验证步骤
1. 创建房间按钮为绿色，加入房间按钮为蓝色
2. 创建房间后，房间号醒目显示
3. 开始游戏后，一局结束显示胜利信息 1 秒
4. 胜者显示后，玩家变为"准备"状态
5. 非房主显示"准备"按钮，点击后变为"已准备"
6. 房主显示"开始游戏"按钮，点击后开始新局

---

## 执行方式

**Plan complete and saved to `docs/plans/2026-03-17-room-win-ready-design.md`. Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
