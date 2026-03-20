# 补筹功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 玩家筹码归零后不踢出房间，弹出补筹页面，输入 1~1000 补筹后继续游玩

**Architecture:** 前端新增 ReplenishPanel 组件处理补筹 UI，后端新增 `player:replenish` socket 事件更新筹码和状态

**Tech Stack:** React (前端), Socket.IO (前后端通信), Node.js (后端)

---

## Task 1: 创建补筹面板组件

**Files:**
- Create: `client/src/components/ReplenishPanel.jsx`

**Step 1: 创建文件**

```jsx
import { useState } from 'react'

export default function ReplenishPanel({ onReplenish }) {
  const [amount, setAmount] = useState(1000)

  const handleChange = (e) => {
    const val = parseInt(e.target.value, 10)
    if (val > 1000) {
      setAmount(1000)
    } else if (val < 1) {
      setAmount(1)
    } else {
      setAmount(val)
    }
  }

  const handleSubmit = () => {
    if (amount >= 1 && amount <= 1000) {
      onReplenish(amount)
    }
  }

  return (
    <div className="replenish-overlay">
      <div className="replenish-panel">
        <div className="replenish-title">💰 补筹</div>
        <div className="replenish-form">
          <label>
            补筹金额:
            <input
              type="number"
              min={1}
              max={1000}
              value={amount}
              onChange={handleChange}
            />
          </label>
        </div>
        <button className="replenish-btn" onClick={handleSubmit}>
          补筹
        </button>
      </div>
    </div>
  )
}
```

**Step 2: 提交**

```bash
git add client/src/components/ReplenishPanel.jsx
git commit -m "feat: add ReplenishPanel component"
```

---

## Task 2: 添加 useGame 的 doReplenish 方法

**Files:**
- Modify: `client/src/hooks/useGame.js:89-95`

**Step 1: 添加 doReplenish**

在 `leaveRoom` 方法后添加:

```js
const doReplenish = useCallback((amount) => {
  getSocket().emit('player:replenish', { amount })
}, [])
```

在 return 语句中 `doUnready, leaveRoom` 后添加 `doReplenish`

**Step 2: 提交**

```bash
git add client/src/hooks/useGame.js
git commit -m "feat: add doReplenish to useGame"
```

---

## Task 3: 在 Table.jsx 集成补筹面板

**Files:**
- Modify: `client/src/components/Table.jsx:1-164`

**Step 1: 导入并使用 ReplenishPanel**

文件顶部添加:
```js
import ReplenishPanel from './ReplenishPanel'
```

组件内部添加 state:
```js
const [showReplenish, setShowReplenish] = useState(false)
```

**Step 2: 修改结算继续逻辑**

在 `settlement-continue` 按钮的 onClick 中修改：
```js
onClick={() => {
  setSettlement(null)
  if (myPlayer.chips === 0) {
    setShowReplenish(true)
  }
}}
```

**Step 3: 在 return 中添加 ReplenishPanel**

在 `{settlement && (` 结算弹窗之后添加:
```jsx
{showReplenish && (
  <ReplenishPanel onReplenish={(amount) => {
    doReplenish(amount)
    setShowReplenish(false)
  }} />
)}
```

**Step 4: 提交**

```bash
git add client/src/components/Table.jsx
git commit -m "feat: integrate ReplenishPanel into Table"
```

---

## Task 4: 后端处理 player:replenish 事件

**Files:**
- Modify: `server/src/index.js` (在 `player:unready` 事件处理后添加新事件)

**Step 1: 添加 socket 事件处理**

在 `socket.on('player:unready', ...)` 之后添加:

```js
socket.on('player:replenish', ({ amount }) => {
  try {
    const room = manager.getRoomByPlayer(playerId)
    if (!room) throw new Error('未在任何房间中')
    const player = room.players.find(p => p.id === playerId)
    if (!player) throw new Error('玩家不存在')
    const actualAmount = Math.min(Math.max(1, amount), 1000)
    player.chips = actualAmount
    player.status = 'waiting'
    io.to(playerId).emit('player:replenished', { chips: actualAmount })
    broadcastRoomState(room)
  } catch (e) {
    socket.emit('error', { message: e.message })
  }
})
```

**Step 2: 提交**

```bash
git add server/src/index.js
git commit -m "feat: handle player:replenish socket event"
```

---

## Task 5: 处理补筹后游戏状态的显示

**Files:**
- Modify: `client/src/components/Table.jsx`

**Step 1: 补筹面板关闭后，状态已更新为 waiting，界面会自动显示等待/准备按钮，无需额外改动**

（注：由于 `game:state` 事件会触发 `setGameState`，补筹后服务端广播新状态，前端自动渲染）

**Step 2: 提交**

```bash
git commit -m "fix: ensure game state updates after replenish"
```

---

## Task 6: 添加补筹面板样式

**Files:**
- Modify: `client/src/components/Table.css`

**Step 1: 添加样式**

```css
.replenish-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.replenish-panel {
  background: #1a1a2e;
  border: 2px solid #e94560;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  color: #fff;
  min-width: 280px;
}

.replenish-title {
  font-size: 1.5rem;
  margin-bottom: 20px;
}

.replenish-form label {
  display: block;
  margin-bottom: 16px;
  font-size: 1rem;
}

.replenish-form input {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 8px;
  font-size: 1.2rem;
  text-align: center;
  background: #16213e;
  border: 1px solid #e94560;
  color: #fff;
  border-radius: 6px;
}

.replenish-btn {
  width: 100%;
  padding: 12px;
  font-size: 1.1rem;
  background: #e94560;
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
}

.replenish-btn:hover {
  background: #ff6b6b;
}
```

**Step 2: 提交**

```bash
git add client/src/components/Table.css
git commit -m "feat: add ReplenishPanel styles"
```

---

**Plan complete.** Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
