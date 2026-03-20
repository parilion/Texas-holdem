# Bugfix: All Code Review Issues

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 Code Review 发现的全部逻辑问题，共13项，按优先级逐一实现后用浏览器验证。

**Architecture:**
- 后端修复集中在 `GameRoom.js`（游戏状态机）和 `index.js`（Socket.IO 事件处理）
- 前端修复集中在 `Table.jsx`、`useSocket.js`、`useGame.js`、`ActionPanel.jsx`
- 每项修复独立提交，便于 bisect

**Tech Stack:** React + Vite (client), Node.js + Socket.IO (server), Jest (tests)

---

## Task 1: 修复 Table.jsx — Rules of Hooks 违反（必定崩溃）

**Files:**
- Modify: `client/src/components/Table.jsx:11-13`

**问题：** `useState` 在条件 `return` 之后调用，违反 React Rules of Hooks，游戏初始化时必然崩溃。

**Step 1: 修改 Table.jsx，将所有 Hook 移到条件 return 之前**

将文件改为：

```jsx
export default function Table({ gameState, myId, roomId, onAction, onStartGame, onReady, onUnready, onLeaveRoom, error }) {
  // ✅ 所有 Hook 必须在条件 return 之前
  const [settlement, setSettlement] = useState(null)
  const prevPhaseRef = useRef(null)   // 用于检测 SHOWDOWN 相变（Fix #9）

  // 还需要从 react 导入 useRef
  ...
  if (!gameState) return <div className="table-loading">加载中...</div>
  ...
```

同时修复 **Issue 9（结算弹窗同一玩家连胜不触发）**：将 `useEffect` 改为监听 phase 从其他值变为 SHOWDOWN 的时机：

```jsx
useEffect(() => {
  if (phase === 'SHOWDOWN' && gameState.winner && prevPhaseRef.current !== 'SHOWDOWN') {
    setSettlement({
      winnerName: gameState.winnerName,
      winnerChips: gameState.winnerChips,
      playerResults: gameState.playerResults || [],
    })
  }
  prevPhaseRef.current = phase
}, [phase, gameState?.winner])
```

还需在 import 行加 `useRef`：
```jsx
import { useState, useEffect, useRef } from 'react'
```

**Step 2: 验证**

运行前端，打开浏览器，检查 console 无 "Rendered more hooks than during the previous render" 错误。

**Step 3: Commit**
```bash
git add client/src/components/Table.jsx
git commit -m "fix: move hooks before conditional return and fix settlement trigger"
```

---

## Task 2: 修复 useSocket.js — off 不传 handler 清除所有监听器

**Files:**
- Modify: `client/src/hooks/useSocket.js`

**问题：** `s.off(event)` 不传 handler，会清除该事件上的所有监听器。同时修复：在 cleanup 时保存并移除具体函数引用。

**Step 1: 修改 useSocket.js**

```js
export function useSocket(handlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const s = getSocket()
    if (!s.connected) s.connect()

    // 保存具体 listener 引用，cleanup 时精确移除
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

**Step 2: Commit**
```bash
git add client/src/hooks/useSocket.js
git commit -m "fix: use specific listener references in useSocket cleanup"
```

---

## Task 3: 修复 useGame.js — 重连后 myId 不更新

**Files:**
- Modify: `client/src/hooks/useGame.js`

**问题：** `myId` 依赖 `getSocket().id`，断线重连后 socket.id 变化但 myId 不更新，所有行动判断失效。

**Step 1: 在 useGame.js 中添加 connect 事件处理**

在 `useSocket` 的 handlers 对象里新增 `'connect'` 处理器：

```js
useSocket({
  'connect': () => {
    // 重连后如果在房间内，需要重新加入（服务端已认为是新连接）
    // 最低限度：清空旧状态让用户重新加入
    setMyId(null)
    setRoomId(null)
    setGameState(null)
  },
  'room:joined': (data) => {
    setRoomId(data.roomId)
    setMyId(getSocket().id)   // ✅ 始终用最新的 socket.id
    setGameState(data)
  },
  // ... 其余 handlers 保持不变
})
```

**Step 2: Commit**
```bash
git add client/src/hooks/useGame.js
git commit -m "fix: reset state on socket reconnect to prevent stale myId"
```

---

## Task 4: 修复 GameRoom.js — raise 操作可能降低 currentBet

**Files:**
- Modify: `server/src/game/GameRoom.js:164-176`

**问题：** 玩家筹码不足时，raise 操作截断了 `toAdd`，但 `this.currentBet = player.bet` 无条件执行，导致 currentBet 从 100 降到 50 等异常情况。

**Step 1: 修改 raise case，只有新 bet 超过 currentBet 才更新**

```js
case 'raise': {
  if (amount <= this.currentBet) throw new Error('加注金额必须大于当前注')
  const toAdd = Math.min(amount - player.bet, player.chips)
  player.chips -= toAdd
  this.pot += toAdd
  player.bet += toAdd
  // ✅ 只有实际 bet 超过当前注时才更新 currentBet，防止因筹码不足导致 currentBet 降低
  if (player.bet > this.currentBet) {
    this.currentBet = player.bet
    this.lastAggressor = this.currentPlayerIndex
    this.players.forEach(p => { if (p.status === 'active') p.hasActed = false })
    player.hasActed = true
  }
  if (player.chips === 0) player.status = 'allin'
  break
}
```

**Step 2: 同时添加最小加注额校验**

在条件检查行改为：
```js
const minRaiseAmount = this.currentBet + Math.max(BIG_BLIND, this.currentBet)
if (amount < minRaiseAmount && player.bet + player.chips >= minRaiseAmount) {
  throw new Error(`最小加注额为 ${minRaiseAmount}`)
}
```

注意：若玩家筹码不足以达到最小加注额，则允许（相当于加注到最大），不抛出错误。

**Step 3: Commit**
```bash
git add server/src/game/GameRoom.js
git commit -m "fix: prevent raise from lowering currentBet, add min raise validation"
```

---

## Task 5: 修复 GameRoom.js — setTimeout 回调中数组越界导致服务端崩溃

**Files:**
- Modify: `server/src/game/GameRoom.js:329-346`

**问题：** `_endRound` 内的 `setTimeout` 延迟 1 秒后执行，期间若有玩家断线，`this.players[this.dealer]` 可能为 `undefined`，导致 `TypeError` 崩溃。`_nextPhase` 内的 `setTimeout` 同理。

**Step 1: 给 _endRound 的 setTimeout 添加防护**

```js
setTimeout(() => {
  // ✅ 防护：玩家可能在延迟期间离开
  if (this.players.length === 0) return
  const activePlayers = this.players.filter(p => p.status !== 'out')
  if (activePlayers.length === 0) return

  this.phase = 'WAITING'
  const toKick = this.players.filter(p => p.chips <= 0).map(p => p.id)
  this.players.forEach(p => {
    p.isDealer = false
    if (p.chips <= 0) p.status = 'out'
    else p.status = 'ready'
  })
  // dealer 推进，跳过 'out' 玩家
  this.dealer = (this.dealer + 1) % this.players.length
  let loopCount = 0
  while (this.players[this.dealer]?.status === 'out' && loopCount < this.players.length) {
    this.dealer = (this.dealer + 1) % this.players.length
    loopCount++
  }
  // ✅ 确保索引有效且玩家存在
  if (this.players[this.dealer]) {
    this.players[this.dealer].isDealer = true
  }
  this._notifyChange({ kickedPlayers: toKick })
}, 1000)
```

**Step 2: Commit**
```bash
git add server/src/game/GameRoom.js
git commit -m "fix: add null safety in setTimeout callbacks to prevent server crash"
```

---

## Task 6: 修复 GameRoom.js — _advance 循环在极端情况下设置非 active 的 currentPlayerIndex

**Files:**
- Modify: `server/src/game/GameRoom.js:229-235`

**问题：** 当前循环的 break 条件 `next === this.currentPlayerIndex` 在当前玩家本身也不是 active 时会停在错误位置。

**Step 1: 用计数器替代易错的 break 条件**

```js
// 找下一个可操作玩家（限制循环次数防止死循环）
let next = (this.currentPlayerIndex + 1) % this.players.length
for (let i = 0; i < this.players.length; i++) {
  if (this.players[next]?.status === 'active') break
  next = (next + 1) % this.players.length
}
this.currentPlayerIndex = next
this._notifyChange()
```

**Step 2: Commit**
```bash
git add server/src/game/GameRoom.js
git commit -m "fix: use loop counter in _advance to prevent infinite loop"
```

---

## Task 7: 修复 index.js — 断线时折叠玩家而非直接移除（防止游戏卡死）

**Files:**
- Modify: `server/src/index.js:120-124`

**问题：** 游戏进行中玩家断线，直接从 players 数组删除，导致 currentPlayerIndex 越界，游戏卡死。

**Step 1: 修改 disconnect 处理**

```js
socket.on('disconnect', () => {
  const room = manager.getRoomByPlayer(socket.id)

  if (room && room.phase !== 'WAITING') {
    // 游戏进行中：折叠该玩家而非直接移除，防止游戏卡死
    const player = room.players.find(p => p.id === socket.id)
    if (player && player.status === 'active') {
      if (room.players[room.currentPlayerIndex]?.id === socket.id) {
        // 轮到该玩家时：调用正式的 fold 操作推进游戏
        try { room.handleAction(socket.id, 'fold') } catch (e) { /* ignore */ }
      } else {
        // 非该玩家回合：直接标记 folded，等 _advance 自然跳过
        player.status = 'folded'
      }
    }
    // 从映射中移除，但保留在 players 数组里直到本局结束
    manager.playerRoom.delete(socket.id)
    if (room.players.length > 0) broadcastRoomState(room)
  } else {
    // WAITING 阶段：正常移除
    const removedRoom = manager.leaveRoom(socket.id)
    if (removedRoom && removedRoom.players.length > 0) broadcastRoomState(removedRoom)
  }

  console.log('客户端断开:', socket.id)
})
```

**Step 2: Commit**
```bash
git add server/src/index.js
git commit -m "fix: fold disconnected player during game instead of removing them"
```

---

## Task 8: 修复 index.js — game:start 无权限校验，任意玩家可触发

**Files:**
- Modify: `server/src/index.js:68-77`

**Step 1: 添加房主校验**

```js
socket.on('game:start', () => {
  try {
    const room = manager.getRoomByPlayer(socket.id)
    if (!room) throw new Error('未在任何房间中')
    const player = room.players.find(p => p.id === socket.id)
    if (!player?.isDealer) throw new Error('只有房主可以开始游戏')
    room.startGame()
    broadcastRoomState(room)
  } catch (e) {
    socket.emit('error', { message: e.message })
  }
})
```

**Step 2: Commit**
```bash
git add server/src/index.js
git commit -m "fix: only room host can start game"
```

---

## Task 9: 修复 GameRoom.js — 平局时底池随机给某人（添加 Split Pot 支持）

**Files:**
- Modify: `server/src/game/GameRoom.js:288-318`

**问题：** 多名玩家手牌相同时，底池应均分，但当前代码只给排序第一名。

**Step 1: 修改 _endRound 的手牌比较和分配逻辑**

将评判手牌和分配底池的部分改为：

```js
let winners = []
if (activePlayers.length === 1) {
  winners = [activePlayers[0]]
} else {
  const allCards = this.communityCards
  const evaluated = activePlayers.map(p => ({
    player: p,
    hand: HandEvaluator.evaluate([...p.holeCards, ...allCards])
  }))
  evaluated.sort((a, b) => HandEvaluator.compare(b.hand, a.hand))
  const topHand = evaluated[0].hand
  // ✅ 找出所有手牌相同的赢家（Split Pot）
  winners = evaluated
    .filter(e => HandEvaluator.compare(e.hand, topHand) === 0)
    .map(e => e.player)
}

// 退还超额筹码（单赢家场景）
if (winners.length === 1) {
  const winner = winners[0]
  const winnerContrib = (winner.chipsBefore ?? winner.chips) - winner.chips
  this.players.forEach(p => {
    if (p.id === winner.id) return
    if (p.status === 'out') return
    const pContrib = (p.chipsBefore ?? p.chips) - p.chips
    const excess = Math.max(0, pContrib - winnerContrib)
    if (excess > 0) {
      p.chips += excess
      this.pot -= excess
    }
  })
  winner.chips += this.pot
} else {
  // ✅ Split Pot：均分底池，奇数筹码给第一位赢家
  const share = Math.floor(this.pot / winners.length)
  winners.forEach(w => { w.chips += share })
  const remainder = this.pot % winners.length
  if (remainder > 0) winners[0].chips += remainder
}

const winner = winners[0]  // 用于通知（多赢家时显示第一位）
const winAmount = this.pot
this.pot = 0
```

同时修改 `_notifyChange` 调用，支持多赢家：

```js
this._notifyChange({
  winner: winners.map(w => w.id).join(','),
  winnerName: winners.length === 1 ? winner.name : winners.map(w => w.name).join(' & '),
  winnerChips: winAmount,
  playerResults
})
```

**Step 2: Commit**
```bash
git add server/src/game/GameRoom.js
git commit -m "fix: add split pot support for tied hands"
```

---

## Task 10: 修复 GameRoom.js — _nextPhase 起始玩家可能指向 allin 玩家

**Files:**
- Modify: `server/src/game/GameRoom.js:270-274`

**Step 1: 在 while 条件中也跳过 allin 玩家**

```js
// 从庄家左手边第一个"可行动"玩家开始（跳过 folded、out、allin）
let start = (this.dealer + 1) % this.players.length
let startLoop = 0
while (
  (this.players[start].status === 'folded' ||
   this.players[start].status === 'out' ||
   this.players[start].status === 'allin') &&
  startLoop < this.players.length
) {
  start = (start + 1) % this.players.length
  startLoop++
}
this.currentPlayerIndex = start
```

**Step 2: Commit**
```bash
git add server/src/game/GameRoom.js
git commit -m "fix: skip allin players when setting start position in new phase"
```

---

## Task 11: 修复 ActionPanel.jsx — 加注最小额不符合德州规则，筹码不足时仍显示加注按钮

**Files:**
- Modify: `client/src/components/ActionPanel.jsx`

**Step 1: 修正最小加注额和加注按钮显示条件**

```jsx
const BIG_BLIND = 20
// 最小加注：至少 currentBet + BIG_BLIND（标准首次加注），或 currentBet * 2
const minRaiseTotal = Math.max(gameState.currentBet * 2, gameState.currentBet + BIG_BLIND)
const [raiseAmount, setRaiseAmount] = useState(minRaiseTotal)

useEffect(() => {
  const newMin = Math.max((gameState?.currentBet || 0) * 2, (gameState?.currentBet || 0) + BIG_BLIND)
  setRaiseAmount(newMin)
}, [gameState?.currentBet])

// 玩家能实际加注的条件：手上筹码 + 已下注 > 最小加注总额
const canRaise = me && (me.chips + (me.bet || 0)) > minRaiseTotal

// slider 的 max 是玩家剩余筹码对应的"总注额"
const raiseMax = me ? me.bet + me.chips : minRaiseTotal
```

在 JSX 中，只在 `canRaise` 时显示加注组：
```jsx
{canRaise && (
  <div className="raise-group">
    <input
      type="range"
      min={minRaiseTotal}
      max={raiseMax}
      value={Math.min(raiseAmount, raiseMax)}
      onChange={e => setRaiseAmount(Number(e.target.value))}
    />
    <button onClick={() => onAction('raise', raiseAmount)} className="btn-raise">
      加注 ({raiseAmount})
    </button>
  </div>
)}
```

**Step 2: Commit**
```bash
git add client/src/components/ActionPanel.jsx
git commit -m "fix: correct min raise amount and hide raise when chips insufficient"
```

---

## Task 12: 修复 HandEvaluator.js — 皇家同花顺判断语义不清晰 + 低顺魔法数字

**Files:**
- Modify: `server/src/game/HandEvaluator.js:31-32,44`

**Step 1: 明确皇家同花顺条件和低顺 tiebreakers**

```js
if (isFlush && (isStraight || isLowStraight)) {
  // 皇家同花顺：最高牌 A(14) + 最低牌 10，明确检查而非依赖 isStraight
  rank = (ranks[0] === 14 && ranks[4] === 10) ? 9 : 8
  // 低顺 tiebreakers：A 在此处作为低牌，最高有效牌是 5
  tiebreakers = isLowStraight ? [5, 4, 3, 2, 14] : ranks
}
```

同理修改普通顺子（第 44 行）：
```js
} else if (isStraight || isLowStraight) {
  rank = 4
  tiebreakers = isLowStraight ? [5, 4, 3, 2, 14] : ranks
}
```

**Step 2: Commit**
```bash
git add server/src/game/HandEvaluator.js
git commit -m "fix: clarify royal flush check and remove magic number in low straight"
```

---

## Task 13: 修复 RoomManager.js — createRoom 无碰撞检测 + room:create 绕过 joinRoom

**Files:**
- Modify: `server/src/game/RoomManager.js`
- Modify: `server/src/index.js:42-54`

**Step 1: 修复 createRoom 添加碰撞检测**

```js
createRoom() {
  let roomId
  // ✅ 确保生成的 roomId 不与已有房间冲突
  do {
    roomId = Math.random().toString(36).substr(2, 6).toUpperCase()
  } while (this.rooms.has(roomId))
  const room = new GameRoom(roomId)
  this.rooms.set(roomId, room)
  return room
}
```

**Step 2: 修复 index.js 的 room:create，通过 joinRoom 注册 playerRoom 映射**

```js
socket.on('room:create', ({ playerName }) => {
  try {
    const room = manager.createRoom()
    // ✅ 通过 joinRoom 统一注册 playerRoom 映射，保持一致性
    manager.joinRoom(room.roomId, socket.id, playerName)
    socket.join(room.roomId)
    room.onStateChange = (extra) => broadcastRoomState(room, extra)
    socket.emit('room:joined', { roomId: room.roomId, ...room.getPublicState(socket.id) })
  } catch (e) {
    socket.emit('error', { message: e.message })
  }
})
```

注意：`joinRoom` 内调用 `room.addPlayer()` + 设置 `playerRoom`，但 `createRoom` 已创建房间，所以不需要再次 `createRoom`。需要确认 `RoomManager.joinRoom` 是 `rooms.get(roomId)` → `addPlayer`，这里只需传入正确的 roomId 即可。

**Step 3: Commit**
```bash
git add server/src/game/RoomManager.js server/src/index.js
git commit -m "fix: add roomId collision detection and unify room:create with joinRoom"
```

---

## Task 14: 浏览器测试

**Step 1: 启动服务**
```bash
npm run dev
```

**Step 2: 打开浏览器，测试以下场景**

1. **基础流程：** 两个玩家加入同一房间 → 房主开始游戏 → 完整打完一局（check/call/fold/raise/allin）
2. **结算弹窗：** 同一玩家连续赢两局，确认弹窗每次都触发
3. **平局：** 验证没有崩溃（实际触发较难，但服务器不应报错）
4. **断线测试：** 游戏进行中关闭一个浏览器 tab，另一个 tab 游戏应继续推进而非卡死
5. **权限测试：** 非房主玩家不能触发 game:start（在 console 发送 socket 事件测试）
6. **加注测试：** 确认加注按钮最小值正确，筹码不足时隐藏

**Step 3: 检查 console**

确认无 React hooks 错误、无服务端 TypeError、无未处理的 Promise rejection。
