# 德州扑克多人游戏 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建支持 2-9 人实时对战的 Web 德州扑克游戏（MVP）

**Architecture:** Monorepo，服务端 Node.js + Socket.IO 权威管理游戏状态，客户端 React + Vite 订阅状态渲染。所有操作合法性由服务端验证。

**Tech Stack:** Node.js 18+, Express, Socket.IO 4, React 18, Vite 5, Jest (服务端测试)

---

## Task 1: 初始化 Monorepo 项目结构

**Files:**
- Create: `package.json`
- Create: `server/package.json`
- Create: `server/src/index.js`
- Create: `client/package.json`
- Create: `client/index.html`
- Create: `client/vite.config.js`
- Create: `client/src/main.jsx`
- Create: `client/src/App.jsx`

**Step 1: 在项目根目录创建根级 package.json**

```json
{
  "name": "texas-holdem",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev --prefix server\" \"npm run dev --prefix client\"",
    "install:all": "npm install && npm install --prefix server && npm install --prefix client"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

**Step 2: 创建 server/package.json**

```json
{
  "name": "texas-server",
  "type": "module",
  "scripts": {
    "dev": "node --watch src/index.js",
    "test": "node --experimental-vm-modules node_modules/.bin/jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.4",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

**Step 3: 创建 client/package.json**

```json
{
  "name": "texas-client",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "socket.io-client": "^4.7.4"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.1.4"
  }
}
```

**Step 4: 创建 client/vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
})
```

**Step 5: 创建 client/index.html**

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>德州扑克</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

**Step 6: 创建 client/src/main.jsx**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

**Step 7: 创建 client/src/App.jsx（占位）**

```jsx
export default function App() {
  return <div>德州扑克游戏加载中...</div>
}
```

**Step 8: 创建 server/src/index.js（占位）**

```js
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

const app = express()
app.use(cors())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] }
})

io.on('connection', (socket) => {
  console.log('客户端连接:', socket.id)
  socket.on('disconnect', () => console.log('客户端断开:', socket.id))
})

httpServer.listen(3001, () => {
  console.log('服务器运行在 http://localhost:3001')
})
```

**Step 9: 安装依赖**

```bash
cd G:/demo/Texas
npm install
npm install --prefix server
npm install --prefix client
```

**Step 10: 启动验证**

```bash
npm run dev
```
预期：server 输出「服务器运行在 http://localhost:3001」，client 输出 Vite 开发服务器地址。浏览器访问看到「德州扑克游戏加载中...」。

**Step 11: Commit**

```bash
git init
git add .
git commit -m "feat: 初始化 Monorepo 项目结构"
```

---

## Task 2: 实现 Deck.js（牌组）

**Files:**
- Create: `server/src/game/Deck.js`
- Create: `server/src/game/Deck.test.js`

**Step 1: 写失败测试 server/src/game/Deck.test.js**

```js
import Deck from './Deck.js'

test('牌组有 52 张牌', () => {
  const deck = new Deck()
  expect(deck.cards.length).toBe(52)
})

test('洗牌后顺序发生改变', () => {
  const deck = new Deck()
  const before = [...deck.cards]
  deck.shuffle()
  // 极低概率相同，可接受
  expect(deck.cards).not.toEqual(before)
})

test('发牌减少牌组数量', () => {
  const deck = new Deck()
  deck.shuffle()
  deck.deal(5)
  expect(deck.cards.length).toBe(47)
})

test('发出的牌格式正确', () => {
  const deck = new Deck()
  const cards = deck.deal(1)
  expect(cards[0]).toHaveProperty('suit')
  expect(cards[0]).toHaveProperty('rank')
})
```

**Step 2: 运行测试确认失败**

```bash
cd server && npm test -- --testPathPattern=Deck
```
预期：FAIL「Cannot find module './Deck.js'」

**Step 3: 实现 server/src/game/Deck.js**

```js
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades']
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']

export default class Deck {
  constructor() {
    this.cards = []
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push({ suit, rank })
      }
    }
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]]
    }
    return this
  }

  deal(n) {
    if (this.cards.length < n) throw new Error('牌组中牌不足')
    return this.cards.splice(0, n)
  }
}
```

**Step 4: 运行测试确认通过**

```bash
npm test -- --testPathPattern=Deck
```
预期：PASS，4 tests passed

**Step 5: Commit**

```bash
git add server/src/game/Deck.js server/src/game/Deck.test.js
git commit -m "feat: 实现 Deck 牌组类"
```

---

## Task 3: 实现 HandEvaluator.js（手牌评判）

**Files:**
- Create: `server/src/game/HandEvaluator.js`
- Create: `server/src/game/HandEvaluator.test.js`

**Step 1: 写失败测试**

```js
import HandEvaluator from './HandEvaluator.js'

const card = (rank, suit) => ({ rank, suit })

test('识别皇家同花顺', () => {
  const cards = [
    card('A','hearts'), card('K','hearts'), card('Q','hearts'),
    card('J','hearts'), card('T','hearts'), card('2','clubs'), card('3','spades')
  ]
  const result = HandEvaluator.evaluate(cards)
  expect(result.rank).toBe(9) // 最高级
  expect(result.name).toBe('皇家同花顺')
})

test('识别同花顺', () => {
  const cards = [
    card('9','hearts'), card('8','hearts'), card('7','hearts'),
    card('6','hearts'), card('5','hearts'), card('2','clubs'), card('A','spades')
  ]
  const result = HandEvaluator.evaluate(cards)
  expect(result.rank).toBe(8)
  expect(result.name).toBe('同花顺')
})

test('识别四条', () => {
  const cards = [
    card('A','hearts'), card('A','diamonds'), card('A','clubs'),
    card('A','spades'), card('K','hearts'), card('2','clubs'), card('3','spades')
  ]
  expect(HandEvaluator.evaluate(cards).name).toBe('四条')
})

test('识别葫芦', () => {
  const cards = [
    card('A','hearts'), card('A','diamonds'), card('A','clubs'),
    card('K','spades'), card('K','hearts'), card('2','clubs'), card('3','spades')
  ]
  expect(HandEvaluator.evaluate(cards).name).toBe('葫芦')
})

test('识别同花', () => {
  const cards = [
    card('A','hearts'), card('K','hearts'), card('J','hearts'),
    card('8','hearts'), card('3','hearts'), card('2','clubs'), card('4','spades')
  ]
  expect(HandEvaluator.evaluate(cards).name).toBe('同花')
})

test('识别顺子', () => {
  const cards = [
    card('9','hearts'), card('8','diamonds'), card('7','clubs'),
    card('6','spades'), card('5','hearts'), card('2','clubs'), card('A','spades')
  ]
  expect(HandEvaluator.evaluate(cards).name).toBe('顺子')
})

test('识别三条', () => {
  const cards = [
    card('A','hearts'), card('A','diamonds'), card('A','clubs'),
    card('K','spades'), card('Q','hearts'), card('2','clubs'), card('3','spades')
  ]
  expect(HandEvaluator.evaluate(cards).name).toBe('三条')
})

test('识别两对', () => {
  const cards = [
    card('A','hearts'), card('A','diamonds'), card('K','clubs'),
    card('K','spades'), card('Q','hearts'), card('2','clubs'), card('3','spades')
  ]
  expect(HandEvaluator.evaluate(cards).name).toBe('两对')
})

test('识别一对', () => {
  const cards = [
    card('A','hearts'), card('A','diamonds'), card('K','clubs'),
    card('Q','spades'), card('J','hearts'), card('2','clubs'), card('3','spades')
  ]
  expect(HandEvaluator.evaluate(cards).name).toBe('一对')
})

test('识别高牌', () => {
  const cards = [
    card('A','hearts'), card('K','diamonds'), card('Q','clubs'),
    card('J','spades'), card('9','hearts'), card('2','clubs'), card('3','spades')
  ]
  expect(HandEvaluator.evaluate(cards).name).toBe('高牌')
})

test('比较两手牌大小', () => {
  const flush = HandEvaluator.evaluate([
    card('A','hearts'), card('K','hearts'), card('J','hearts'),
    card('8','hearts'), card('3','hearts'), card('2','clubs'), card('4','spades')
  ])
  const pair = HandEvaluator.evaluate([
    card('A','hearts'), card('A','diamonds'), card('K','clubs'),
    card('Q','spades'), card('J','hearts'), card('2','clubs'), card('3','spades')
  ])
  expect(HandEvaluator.compare(flush, pair)).toBeGreaterThan(0)
})
```

**Step 2: 运行测试确认失败**

```bash
npm test -- --testPathPattern=HandEvaluator
```

**Step 3: 实现 server/src/game/HandEvaluator.js**

```js
const RANK_ORDER = ['2','3','4','5','6','7','8','9','T','J','Q','K','A']
const RANK_VALUE = Object.fromEntries(RANK_ORDER.map((r, i) => [r, i + 2]))

const HAND_NAMES = ['高牌','一对','两对','三条','顺子','同花','葫芦','四条','同花顺','皇家同花顺']

function getCombinations(arr, k) {
  if (k === 0) return [[]]
  if (arr.length === 0) return []
  const [first, ...rest] = arr
  const withFirst = getCombinations(rest, k - 1).map(c => [first, ...c])
  const withoutFirst = getCombinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

function evaluateFive(cards) {
  const ranks = cards.map(c => RANK_VALUE[c.rank]).sort((a, b) => b - a)
  const suits = cards.map(c => c.suit)
  const isFlush = suits.every(s => s === suits[0])
  const isStraight = ranks[0] - ranks[4] === 4 && new Set(ranks).size === 5
  // 低顺 A-2-3-4-5
  const isLowStraight = JSON.stringify(ranks) === JSON.stringify([14, 5, 4, 3, 2])

  const counts = {}
  ranks.forEach(r => { counts[r] = (counts[r] || 0) + 1 })
  const groups = Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const groupCounts = groups.map(g => g[1])

  let rank, tiebreakers

  if (isFlush && (isStraight || isLowStraight)) {
    rank = ranks[0] === 14 && isStraight ? 9 : 8
    tiebreakers = isLowStraight ? [5, 4, 3, 2, 1] : ranks
  } else if (groupCounts[0] === 4) {
    rank = 7
    tiebreakers = groups.flatMap(([v, c]) => Array(c).fill(Number(v)))
  } else if (groupCounts[0] === 3 && groupCounts[1] === 2) {
    rank = 6
    tiebreakers = groups.flatMap(([v, c]) => Array(c).fill(Number(v)))
  } else if (isFlush) {
    rank = 5
    tiebreakers = ranks
  } else if (isStraight || isLowStraight) {
    rank = 4
    tiebreakers = isLowStraight ? [5, 4, 3, 2, 1] : ranks
  } else if (groupCounts[0] === 3) {
    rank = 3
    tiebreakers = groups.flatMap(([v, c]) => Array(c).fill(Number(v)))
  } else if (groupCounts[0] === 2 && groupCounts[1] === 2) {
    rank = 2
    tiebreakers = groups.flatMap(([v, c]) => Array(c).fill(Number(v)))
  } else if (groupCounts[0] === 2) {
    rank = 1
    tiebreakers = groups.flatMap(([v, c]) => Array(c).fill(Number(v)))
  } else {
    rank = 0
    tiebreakers = ranks
  }

  return { rank, name: HAND_NAMES[rank], tiebreakers }
}

export default class HandEvaluator {
  static evaluate(sevenCards) {
    const combos = getCombinations(sevenCards, 5)
    let best = null
    for (const combo of combos) {
      const result = evaluateFive(combo)
      if (!best || HandEvaluator.compare(result, best) > 0) {
        best = result
      }
    }
    return best
  }

  static compare(a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank
    for (let i = 0; i < a.tiebreakers.length; i++) {
      if (a.tiebreakers[i] !== b.tiebreakers[i]) return a.tiebreakers[i] - b.tiebreakers[i]
    }
    return 0
  }
}
```

**Step 4: 运行测试确认通过**

```bash
npm test -- --testPathPattern=HandEvaluator
```
预期：PASS，11 tests passed

**Step 5: Commit**

```bash
git add server/src/game/HandEvaluator.js server/src/game/HandEvaluator.test.js
git commit -m "feat: 实现 HandEvaluator 手牌评判"
```

---

## Task 4: 实现 GameRoom.js（游戏状态机）

**Files:**
- Create: `server/src/game/GameRoom.js`
- Create: `server/src/game/GameRoom.test.js`

**Step 1: 写失败测试**

```js
import GameRoom from './GameRoom.js'

function makeRoom(playerCount = 2) {
  const room = new GameRoom('TEST01')
  for (let i = 0; i < playerCount; i++) {
    room.addPlayer(`player${i}`, `玩家${i}`)
  }
  return room
}

test('创建房间初始状态', () => {
  const room = new GameRoom('TEST01')
  expect(room.phase).toBe('WAITING')
  expect(room.players.length).toBe(0)
})

test('添加玩家', () => {
  const room = makeRoom(2)
  expect(room.players.length).toBe(2)
})

test('开始游戏发手牌', () => {
  const room = makeRoom(2)
  room.startGame()
  expect(room.phase).toBe('PREFLOP')
  room.players.forEach(p => expect(p.holeCards.length).toBe(2))
})

test('大小盲注自动下注', () => {
  const room = makeRoom(2)
  room.startGame()
  const bets = room.players.map(p => p.bet)
  expect(bets).toContain(10) // small blind
  expect(bets).toContain(20) // big blind
})

test('合法的 call 操作', () => {
  const room = makeRoom(2)
  room.startGame()
  const actingPlayer = room.players[room.currentPlayerIndex]
  const chipsBefore = actingPlayer.chips
  room.handleAction(actingPlayer.id, 'call')
  // 玩家已跟注，筹码减少
  expect(actingPlayer.chips).toBeLessThan(chipsBefore + actingPlayer.bet)
})

test('fold 使玩家状态变为 folded', () => {
  const room = makeRoom(2)
  room.startGame()
  const actingPlayer = room.players[room.currentPlayerIndex]
  room.handleAction(actingPlayer.id, 'fold')
  expect(actingPlayer.status).toBe('folded')
})

test('非当前玩家操作被拒绝', () => {
  const room = makeRoom(3)
  room.startGame()
  const wrongPlayer = room.players[(room.currentPlayerIndex + 1) % room.players.length]
  expect(() => room.handleAction(wrongPlayer.id, 'call')).toThrow()
})

test('getPublicState 隐藏他人手牌', () => {
  const room = makeRoom(2)
  room.startGame()
  const state = room.getPublicState('player0')
  const otherPlayer = state.players.find(p => p.id === 'player1')
  expect(otherPlayer.holeCards).toBeNull()
  const self = state.players.find(p => p.id === 'player0')
  expect(self.holeCards).not.toBeNull()
})
```

**Step 2: 运行测试确认失败**

```bash
npm test -- --testPathPattern=GameRoom
```

**Step 3: 实现 server/src/game/GameRoom.js**

```js
import Deck from './Deck.js'
import HandEvaluator from './HandEvaluator.js'

const SMALL_BLIND = 10
const BIG_BLIND = 20
const STARTING_CHIPS = 1000
const TURN_TIMEOUT = 30000

const PHASES = ['WAITING', 'PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN']

export default class GameRoom {
  constructor(roomId) {
    this.roomId = roomId
    this.phase = 'WAITING'
    this.players = []
    this.communityCards = []
    this.pot = 0
    this.currentBet = 0
    this.currentPlayerIndex = 0
    this.dealer = 0
    this.deck = null
    this.turnTimer = null
    this.onStateChange = null // 回调：状态变更时通知外部
  }

  addPlayer(id, name) {
    if (this.phase !== 'WAITING') throw new Error('游戏已开始，无法加入')
    if (this.players.length >= 9) throw new Error('房间已满')
    if (this.players.find(p => p.id === id)) return
    this.players.push({
      id, name,
      chips: STARTING_CHIPS,
      bet: 0,
      holeCards: [],
      status: 'waiting', // waiting | active | folded | allin | out
      isDealer: false,
    })
  }

  removePlayer(id) {
    this.players = this.players.filter(p => p.id !== id)
  }

  startGame() {
    if (this.players.length < 2) throw new Error('至少需要 2 名玩家')
    if (this.phase !== 'WAITING') throw new Error('游戏已在进行中')

    this.deck = new Deck().shuffle()
    this.communityCards = []
    this.pot = 0
    this.currentBet = BIG_BLIND

    // 重置玩家状态
    this.players.forEach(p => {
      p.holeCards = []
      p.bet = 0
      p.status = 'active'
      p.isDealer = false
    })

    // 设置庄家
    this.dealer = this.dealer % this.players.length
    this.players[this.dealer].isDealer = true

    // 发手牌（每人 2 张）
    this.players.forEach(p => {
      p.holeCards = this.deck.deal(2)
    })

    // 收盲注
    const sbIndex = (this.dealer + 1) % this.players.length
    const bbIndex = (this.dealer + 2) % this.players.length
    this._postBlind(sbIndex, SMALL_BLIND)
    this._postBlind(bbIndex, BIG_BLIND)

    // preflop 第一个操作者是 bb 之后
    this.currentPlayerIndex = (bbIndex + 1) % this.players.length
    this.phase = 'PREFLOP'

    this._notifyChange()
  }

  _postBlind(index, amount) {
    const player = this.players[index]
    const actual = Math.min(amount, player.chips)
    player.chips -= actual
    player.bet = actual
    this.pot += actual
    if (player.chips === 0) player.status = 'allin'
  }

  handleAction(playerId, action, amount = 0) {
    const player = this.players[this.currentPlayerIndex]
    if (player.id !== playerId) throw new Error('不是你的回合')
    if (player.status !== 'active') throw new Error('玩家状态不允许操作')

    switch (action) {
      case 'fold':
        player.status = 'folded'
        break
      case 'check':
        if (this.currentBet > player.bet) throw new Error('当前有注，无法 check')
        break
      case 'call': {
        const toCall = Math.min(this.currentBet - player.bet, player.chips)
        player.chips -= toCall
        this.pot += toCall
        player.bet += toCall
        if (player.chips === 0) player.status = 'allin'
        break
      }
      case 'raise': {
        if (amount <= this.currentBet) throw new Error('加注金额必须大于当前注')
        const toAdd = Math.min(amount - player.bet, player.chips)
        player.chips -= toAdd
        this.pot += toAdd
        player.bet += toAdd
        this.currentBet = player.bet
        if (player.chips === 0) player.status = 'allin'
        break
      }
      case 'allin': {
        const allInAmount = player.chips
        this.pot += allInAmount
        player.bet += allInAmount
        player.chips = 0
        if (player.bet > this.currentBet) this.currentBet = player.bet
        player.status = 'allin'
        break
      }
      default:
        throw new Error('未知操作: ' + action)
    }

    this._advance()
  }

  _advance() {
    // 检查是否只剩一人活跃
    const active = this.players.filter(p => p.status === 'active' || p.status === 'allin')
    const canAct = this.players.filter(p => p.status === 'active')

    if (canAct.length <= 1 && active.length <= 1) {
      return this._endRound()
    }

    // 判断本轮是否下注结束（所有 active 玩家 bet 相同且都行动过）
    if (this._bettingRoundComplete()) {
      return this._nextPhase()
    }

    // 找下一个可操作玩家
    let next = (this.currentPlayerIndex + 1) % this.players.length
    while (this.players[next].status !== 'active') {
      next = (next + 1) % this.players.length
      if (next === this.currentPlayerIndex) break
    }
    this.currentPlayerIndex = next
    this._notifyChange()
  }

  _bettingRoundComplete() {
    return this.players
      .filter(p => p.status === 'active')
      .every(p => p.bet === this.currentBet)
  }

  _nextPhase() {
    // 重置本轮 bet
    this.players.forEach(p => { if (p.status === 'active') p.bet = 0 })
    this.currentBet = 0

    const phaseOrder = ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN']
    const idx = phaseOrder.indexOf(this.phase)
    this.phase = phaseOrder[idx + 1] || 'SHOWDOWN'

    if (this.phase === 'FLOP') {
      this.communityCards.push(...this.deck.deal(3))
    } else if (this.phase === 'TURN' || this.phase === 'RIVER') {
      this.communityCards.push(...this.deck.deal(1))
    } else if (this.phase === 'SHOWDOWN') {
      return this._endRound()
    }

    // 从庄家左手边第一个活跃玩家开始
    let start = (this.dealer + 1) % this.players.length
    while (this.players[start].status === 'folded' || this.players[start].status === 'out') {
      start = (start + 1) % this.players.length
    }
    this.currentPlayerIndex = start
    this._notifyChange()
  }

  _endRound() {
    this.phase = 'SHOWDOWN'
    const activePlayers = this.players.filter(p => p.status === 'active' || p.status === 'allin')

    let winner
    if (activePlayers.length === 1) {
      winner = activePlayers[0]
    } else {
      // 评判手牌
      const allCards = this.communityCards
      const evaluated = activePlayers.map(p => ({
        player: p,
        hand: HandEvaluator.evaluate([...p.holeCards, ...allCards])
      }))
      evaluated.sort((a, b) => HandEvaluator.compare(b.hand, a.hand))
      winner = evaluated[0].player
    }

    winner.chips += this.pot
    this.pot = 0

    this._notifyChange({ winner: winner.id, winnerName: winner.name })

    // 准备下局
    setTimeout(() => {
      this.phase = 'WAITING'
      this.dealer = (this.dealer + 1) % this.players.length
      this.players.forEach(p => {
        if (p.chips <= 0) p.status = 'out'
        else p.status = 'waiting'
      })
      this._notifyChange()
    }, 5000)
  }

  getPublicState(viewerId) {
    return {
      roomId: this.roomId,
      phase: this.phase,
      pot: this.pot,
      communityCards: this.communityCards,
      currentBet: this.currentBet,
      currentPlayerIndex: this.currentPlayerIndex,
      dealer: this.dealer,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        status: p.status,
        isDealer: p.isDealer,
        holeCards: (p.id === viewerId || this.phase === 'SHOWDOWN') ? p.holeCards : null,
        cardCount: p.holeCards.length,
      }))
    }
  }

  _notifyChange(extra = {}) {
    if (this.onStateChange) this.onStateChange(extra)
  }
}
```

**Step 4: 运行测试确认通过**

```bash
npm test -- --testPathPattern=GameRoom
```
预期：PASS，7 tests passed

**Step 5: Commit**

```bash
git add server/src/game/GameRoom.js server/src/game/GameRoom.test.js
git commit -m "feat: 实现 GameRoom 游戏状态机"
```

---

## Task 5: 实现 RoomManager.js + Socket.IO 事件

**Files:**
- Create: `server/src/game/RoomManager.js`
- Modify: `server/src/index.js`

**Step 1: 创建 server/src/game/RoomManager.js**

```js
import GameRoom from './GameRoom.js'

export default class RoomManager {
  constructor() {
    this.rooms = new Map() // roomId -> GameRoom
    this.playerRoom = new Map() // socketId -> roomId
  }

  createRoom() {
    const roomId = Math.random().toString(36).substr(2, 6).toUpperCase()
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
```

**Step 2: 更新 server/src/index.js，注册所有 Socket.IO 事件**

```js
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import RoomManager from './game/RoomManager.js'

const app = express()
app.use(cors())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] }
})

const manager = new RoomManager()

io.on('connection', (socket) => {
  console.log('客户端连接:', socket.id)

  function broadcastRoomState(room, extra = {}) {
    room.players.forEach(player => {
      io.to(player.id).emit('game:state', {
        ...room.getPublicState(player.id),
        ...extra
      })
    })
  }

  socket.on('room:create', ({ playerName }) => {
    try {
      const room = manager.createRoom()
      room.addPlayer(socket.id, playerName)
      manager.playerRoom = manager.playerRoom || new Map()
      manager.playerRoom.set(socket.id, room.roomId)
      socket.join(room.roomId)
      room.onStateChange = (extra) => broadcastRoomState(room, extra)
      socket.emit('room:joined', { roomId: room.roomId, ...room.getPublicState(socket.id) })
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  socket.on('room:join', ({ roomId, playerName }) => {
    try {
      const room = manager.joinRoom(roomId, socket.id, playerName)
      socket.join(roomId)
      room.onStateChange = (extra) => broadcastRoomState(room, extra)
      socket.emit('room:joined', { roomId, ...room.getPublicState(socket.id) })
      broadcastRoomState(room)
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  socket.on('game:start', () => {
    try {
      const room = manager.getRoomByPlayer(socket.id)
      if (!room) throw new Error('未在任何房间中')
      room.startGame()
      broadcastRoomState(room)
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  const ACTIONS = ['check', 'call', 'raise', 'fold', 'allin']
  ACTIONS.forEach(action => {
    socket.on(`action:${action}`, (data = {}) => {
      try {
        const room = manager.getRoomByPlayer(socket.id)
        if (!room) throw new Error('未在任何房间中')
        room.handleAction(socket.id, action, data.amount || 0)
        broadcastRoomState(room)
      } catch (e) {
        socket.emit('error', { message: e.message })
      }
    })
  })

  socket.on('disconnect', () => {
    const room = manager.leaveRoom(socket.id)
    if (room && room.players.length > 0) broadcastRoomState(room)
    console.log('客户端断开:', socket.id)
  })
})

httpServer.listen(3001, () => {
  console.log('服务器运行在 http://localhost:3001')
})
```

**Step 3: 启动服务器验证无报错**

```bash
cd server && node src/index.js
```
预期：输出「服务器运行在 http://localhost:3001」无报错

**Step 4: Commit**

```bash
git add server/src/game/RoomManager.js server/src/index.js
git commit -m "feat: 实现 RoomManager 和 Socket.IO 事件处理"
```

---

## Task 6: 前端 — useSocket & useGame Hooks

**Files:**
- Create: `client/src/hooks/useSocket.js`
- Create: `client/src/hooks/useGame.js`

**Step 1: 创建 client/src/hooks/useSocket.js**

```js
import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

let socket = null

export function getSocket() {
  if (!socket) {
    socket = io('http://localhost:3001', { autoConnect: false })
  }
  return socket
}

export function useSocket(handlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const s = getSocket()
    if (!s.connected) s.connect()

    const entries = Object.entries(handlersRef.current)
    entries.forEach(([event, handler]) => {
      s.on(event, (...args) => handlersRef.current[event]?.(...args))
    })

    return () => {
      entries.forEach(([event]) => s.off(event))
    }
  }, [])
}
```

**Step 2: 创建 client/src/hooks/useGame.js**

```js
import { useState, useCallback } from 'react'
import { getSocket, useSocket } from './useSocket'

export function useGame() {
  const [gameState, setGameState] = useState(null)
  const [roomId, setRoomId] = useState(null)
  const [myId, setMyId] = useState(null)
  const [error, setError] = useState(null)

  useSocket({
    'room:joined': (data) => {
      setRoomId(data.roomId)
      setMyId(getSocket().id)
      setGameState(data)
    },
    'game:state': (data) => {
      setGameState(data)
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

  return { gameState, roomId, myId, error, createRoom, joinRoom, startGame, doAction }
}
```

**Step 3: Commit**

```bash
git add client/src/hooks/
git commit -m "feat: 实现 useSocket 和 useGame Hooks"
```

---

## Task 7: 前端 — Lobby 大厅组件

**Files:**
- Create: `client/src/components/Lobby.jsx`
- Create: `client/src/components/Lobby.css`

**Step 1: 创建 client/src/components/Lobby.jsx**

```jsx
import { useState } from 'react'
import './Lobby.css'

export default function Lobby({ onCreateRoom, onJoinRoom, error }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState(null) // 'create' | 'join'

  const handleCreate = () => {
    if (!name.trim()) return alert('请输入昵称')
    onCreateRoom(name.trim())
  }

  const handleJoin = () => {
    if (!name.trim()) return alert('请输入昵称')
    if (!code.trim()) return alert('请输入房间号')
    onJoinRoom(code.trim().toUpperCase(), name.trim())
  }

  return (
    <div className="lobby">
      <h1>♠ 德州扑克 ♠</h1>
      {error && <div className="error">{error}</div>}
      <div className="input-group">
        <input
          placeholder="输入你的昵称"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={12}
        />
      </div>
      {!mode && (
        <div className="buttons">
          <button onClick={() => setMode('create')}>创建房间</button>
          <button onClick={() => setMode('join')}>加入房间</button>
        </div>
      )}
      {mode === 'create' && (
        <div className="buttons">
          <button onClick={handleCreate}>确认创建</button>
          <button onClick={() => setMode(null)}>返回</button>
        </div>
      )}
      {mode === 'join' && (
        <div className="join-form">
          <input
            placeholder="输入房间号（6位）"
            value={code}
            onChange={e => setCode(e.target.value)}
            maxLength={6}
          />
          <div className="buttons">
            <button onClick={handleJoin}>加入</button>
            <button onClick={() => setMode(null)}>返回</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: 创建 client/src/components/Lobby.css**

```css
.lobby {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #1a472a;
  color: #fff;
  font-family: 'Segoe UI', sans-serif;
}

.lobby h1 {
  font-size: 3rem;
  margin-bottom: 2rem;
  text-shadow: 2px 2px 8px rgba(0,0,0,0.5);
}

.input-group, .join-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 280px;
}

.lobby input {
  padding: 0.8rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  text-align: center;
  background: rgba(255,255,255,0.15);
  color: #fff;
  outline: none;
}

.lobby input::placeholder { color: rgba(255,255,255,0.6); }

.buttons {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
  justify-content: center;
}

.lobby button {
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  background: #f4c430;
  color: #1a1a1a;
  font-weight: bold;
  transition: transform 0.1s;
}

.lobby button:hover { transform: scale(1.05); }

.error {
  background: rgba(255,50,50,0.8);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}
```

**Step 3: Commit**

```bash
git add client/src/components/Lobby.jsx client/src/components/Lobby.css
git commit -m "feat: 实现 Lobby 大厅组件"
```

---

## Task 8: 前端 — PlayerSeat & ActionPanel 组件

**Files:**
- Create: `client/src/components/PlayerSeat.jsx`
- Create: `client/src/components/ActionPanel.jsx`
- Create: `client/src/components/Card.jsx`

**Step 1: 创建 client/src/components/Card.jsx**

```jsx
const SUIT_SYMBOL = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
const RED = ['hearts', 'diamonds']

export default function Card({ card, faceDown = false }) {
  if (faceDown || !card) {
    return <div className="card face-down">🂠</div>
  }
  const isRed = RED.includes(card.suit)
  return (
    <div className={`card ${isRed ? 'red' : 'black'}`}>
      <span>{card.rank}</span>
      <span>{SUIT_SYMBOL[card.suit]}</span>
    </div>
  )
}
```

**Step 2: 创建 client/src/components/PlayerSeat.jsx**

```jsx
import Card from './Card'

export default function PlayerSeat({ player, isCurrentPlayer, isMe, position }) {
  if (!player) return <div className={`seat empty seat-${position}`} />

  const statusLabel = {
    active: '',
    folded: '弃牌',
    allin: 'ALL IN',
    out: '出局',
    waiting: '等待',
  }[player.status] || ''

  return (
    <div className={`seat seat-${position} ${isCurrentPlayer ? 'active' : ''} ${player.status}`}>
      <div className="player-name">
        {player.isDealer && <span className="dealer-btn">D</span>}
        {player.name}
        {isMe && ' (我)'}
      </div>
      <div className="player-chips">💰 {player.chips}</div>
      {player.bet > 0 && <div className="player-bet">注: {player.bet}</div>}
      {statusLabel && <div className="player-status">{statusLabel}</div>}
      <div className="player-cards">
        {player.holeCards
          ? player.holeCards.map((c, i) => <Card key={i} card={c} />)
          : player.cardCount > 0
          ? Array(player.cardCount).fill(null).map((_, i) => <Card key={i} faceDown />)
          : null
        }
      </div>
    </div>
  )
}
```

**Step 3: 创建 client/src/components/ActionPanel.jsx**

```jsx
import { useState } from 'react'

export default function ActionPanel({ gameState, myId, onAction }) {
  const [raiseAmount, setRaiseAmount] = useState(gameState?.currentBet * 2 || 40)

  const me = gameState?.players?.find(p => p.id === myId)
  const isMyTurn = gameState?.players?.[gameState.currentPlayerIndex]?.id === myId
  const canCheck = isMyTurn && (gameState.currentBet === 0 || me?.bet === gameState.currentBet)
  const callAmount = gameState ? Math.min(gameState.currentBet - (me?.bet || 0), me?.chips || 0) : 0

  if (!isMyTurn || !me || me.status !== 'active') {
    return <div className="action-panel waiting">等待其他玩家操作...</div>
  }

  return (
    <div className="action-panel">
      <button onClick={() => onAction('fold')} className="btn-fold">弃牌</button>
      {canCheck
        ? <button onClick={() => onAction('check')} className="btn-check">过牌</button>
        : <button onClick={() => onAction('call')} className="btn-call">跟注 ({callAmount})</button>
      }
      <div className="raise-group">
        <input
          type="range"
          min={gameState.currentBet > 0 ? gameState.currentBet + 1 : 1}
          max={me.chips}
          value={raiseAmount}
          onChange={e => setRaiseAmount(Number(e.target.value))}
        />
        <button onClick={() => onAction('raise', raiseAmount)} className="btn-raise">
          加注 ({raiseAmount})
        </button>
      </div>
      <button onClick={() => onAction('allin')} className="btn-allin">ALL IN ({me.chips})</button>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add client/src/components/
git commit -m "feat: 实现 Card、PlayerSeat、ActionPanel 组件"
```

---

## Task 9: 前端 — Table 桌面组件 + 主 CSS

**Files:**
- Create: `client/src/components/Table.jsx`
- Create: `client/src/index.css`

**Step 1: 创建 client/src/components/Table.jsx**

```jsx
import PlayerSeat from './PlayerSeat'
import ActionPanel from './ActionPanel'
import Card from './Card'
import './Table.css'

const POSITIONS = ['bottom', 'bottom-left', 'left', 'top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom2']

export default function Table({ gameState, myId, roomId, onAction, onStartGame, error }) {
  if (!gameState) return <div className="table-loading">加载中...</div>

  const { players, phase, pot, communityCards, currentBet } = gameState
  const myIndex = players.findIndex(p => p.id === myId)
  const isHost = myIndex === 0

  // 以自己为底部重新排列座位
  const orderedPlayers = Array(9).fill(null)
  players.forEach((player, i) => {
    const relativePos = (i - myIndex + 9) % players.length
    orderedPlayers[relativePos] = { ...player, originalIndex: i }
  })

  const isMyTurn = players[gameState.currentPlayerIndex]?.id === myId

  return (
    <div className="table-wrapper">
      <div className="room-info">房间号: <strong>{roomId}</strong></div>
      {error && <div className="error-toast">{error}</div>}

      <div className="table">
        {orderedPlayers.map((player, pos) => (
          <PlayerSeat
            key={pos}
            player={player}
            isCurrentPlayer={player && players[gameState.currentPlayerIndex]?.id === player.id}
            isMe={player?.id === myId}
            position={POSITIONS[pos]}
          />
        ))}

        <div className="table-center">
          <div className="community-cards">
            {Array(5).fill(null).map((_, i) => (
              <Card key={i} card={communityCards[i] || null} faceDown={!communityCards[i]} />
            ))}
          </div>
          <div className="pot">底池: 💰{pot}</div>
          <div className="phase">{phase}</div>
          {currentBet > 0 && <div className="current-bet">当前注: {currentBet}</div>}
        </div>
      </div>

      {phase === 'WAITING' && isHost && players.length >= 2 && (
        <button className="start-btn" onClick={onStartGame}>开始游戏</button>
      )}

      {phase !== 'WAITING' && phase !== 'SHOWDOWN' && (
        <ActionPanel gameState={gameState} myId={myId} onAction={onAction} />
      )}
    </div>
  )
}
```

**Step 2: 创建 client/src/components/Table.css**

```css
.table-wrapper {
  min-height: 100vh;
  background: #1a472a;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  font-family: 'Segoe UI', sans-serif;
  color: #fff;
}

.room-info {
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: rgba(0,0,0,0.5);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
}

.table {
  position: relative;
  width: 700px;
  height: 400px;
  background: radial-gradient(ellipse at center, #2d6a4f 0%, #1a472a 70%);
  border-radius: 50%;
  border: 8px solid #8B6914;
  box-shadow: 0 0 40px rgba(0,0,0,0.6), inset 0 0 60px rgba(0,0,0,0.3);
  margin: 2rem auto;
}

.table-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.community-cards {
  display: flex;
  gap: 0.3rem;
}

.card {
  width: 45px;
  height: 63px;
  background: white;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.9rem;
  box-shadow: 1px 1px 4px rgba(0,0,0,0.4);
  color: #111;
}

.card.red { color: #cc0000; }
.card.face-down { background: #2355a0; color: #fff; font-size: 1.5rem; }

.pot { font-size: 1.1rem; font-weight: bold; }
.phase { font-size: 0.8rem; opacity: 0.7; text-transform: uppercase; }
.current-bet { font-size: 0.85rem; }

/* 座位位置 */
.seat { position: absolute; text-align: center; font-size: 0.75rem; width: 90px; }
.seat-bottom { bottom: -80px; left: 50%; transform: translateX(-50%); }
.seat-bottom-left { bottom: -20px; left: 5%; }
.seat-left { top: 50%; left: -110px; transform: translateY(-50%); }
.seat-top-left { top: -20px; left: 5%; }
.seat-top { top: -80px; left: 50%; transform: translateX(-50%); }
.seat-top-right { top: -20px; right: 5%; }
.seat-right { top: 50%; right: -110px; transform: translateY(-50%); }
.seat-bottom-right { bottom: -20px; right: 5%; }
.seat-bottom2 { bottom: -80px; left: 30%; }

.seat.active { outline: 3px solid #f4c430; border-radius: 8px; }
.seat.folded { opacity: 0.4; }

.player-name { font-weight: bold; white-space: nowrap; }
.player-chips { color: #f4c430; }
.player-bet { color: #ff9; font-size: 0.7rem; }
.player-status { color: #f88; font-size: 0.7rem; }
.player-cards { display: flex; gap: 2px; justify-content: center; margin-top: 2px; }
.dealer-btn {
  background: #f4c430; color: #000; border-radius: 50%;
  width: 16px; height: 16px; display: inline-flex;
  align-items: center; justify-content: center;
  font-size: 0.65rem; font-weight: bold; margin-right: 3px;
}

/* 操作面板 */
.action-panel {
  display: flex;
  gap: 0.8rem;
  align-items: center;
  background: rgba(0,0,0,0.5);
  padding: 1rem 1.5rem;
  border-radius: 12px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 2rem;
}

.action-panel button {
  padding: 0.7rem 1.2rem;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.1s;
}
.action-panel button:hover { transform: scale(1.05); }

.btn-fold { background: #e74c3c; color: #fff; }
.btn-check { background: #3498db; color: #fff; }
.btn-call { background: #27ae60; color: #fff; }
.btn-raise { background: #f39c12; color: #fff; }
.btn-allin { background: #8e44ad; color: #fff; }

.raise-group { display: flex; gap: 0.5rem; align-items: center; }
.raise-group input { width: 100px; }

.start-btn {
  padding: 1rem 3rem;
  background: #f4c430;
  border: none;
  border-radius: 12px;
  font-size: 1.2rem;
  font-weight: bold;
  cursor: pointer;
  margin-top: 2rem;
}

.error-toast {
  position: fixed;
  top: 4rem;
  right: 1rem;
  background: rgba(200,50,50,0.9);
  color: #fff;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  z-index: 100;
}
```

**Step 3: 创建 client/src/index.css（全局重置）**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #1a472a; }
```

**Step 4: Commit**

```bash
git add client/src/components/Table.jsx client/src/components/Table.css client/src/index.css
git commit -m "feat: 实现 Table 桌面组件和样式"
```

---

## Task 10: 组装 App.jsx 完成集成

**Files:**
- Modify: `client/src/App.jsx`

**Step 1: 更新 client/src/App.jsx**

```jsx
import { useGame } from './hooks/useGame'
import Lobby from './components/Lobby'
import Table from './components/Table'
import './index.css'

export default function App() {
  const { gameState, roomId, myId, error, createRoom, joinRoom, startGame, doAction } = useGame()

  if (!roomId) {
    return <Lobby onCreateRoom={createRoom} onJoinRoom={joinRoom} error={error} />
  }

  return (
    <Table
      gameState={gameState}
      myId={myId}
      roomId={roomId}
      onAction={doAction}
      onStartGame={startGame}
      error={error}
    />
  )
}
```

**Step 2: 启动完整应用测试**

```bash
# 终端1
cd server && node src/index.js

# 终端2
cd client && npx vite
```

**Step 3: 手动测试流程**

1. 浏览器打开两个标签页，均访问 http://localhost:5173
2. 标签页A：输入「玩家A」→ 创建房间 → 记录房间号
3. 标签页B：输入「玩家B」→ 加入房间 → 输入房间号
4. 标签页A（房主）：点击「开始游戏」
5. 验证两人各自看到自己手牌，对方手牌背面朝上
6. 依次操作 check/call/raise/fold，验证回合切换正确
7. 等待摊牌，验证胜者获得底池

**Step 4: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: 组装 App.jsx，完成德州扑克 MVP 集成"
```

---

## Task 11: Jest 配置修复（ESM 支持）

**Files:**
- Modify: `server/package.json`

**Step 1: 在 server/package.json 添加 Jest ESM 配置**

```json
{
  "jest": {
    "transform": {},
    "testEnvironment": "node"
  }
}
```

**Step 2: 运行全部测试**

```bash
cd server && npm test
```
预期：所有测试通过

**Step 3: Commit**

```bash
git add server/package.json
git commit -m "chore: 配置 Jest 支持 ESM 模块"
```

---

## 完成标准

- [ ] `npm run dev` 启动无报错
- [ ] 两个浏览器标签可以建房/加入
- [ ] 完整牌局流程可以跑通（PREFLOP→FLOP→TURN→RIVER→SHOWDOWN）
- [ ] 自己手牌可见，对方手牌背面朝上
- [ ] 摊牌后胜者获得底池，可开始下一局
- [ ] 全部服务端单元测试通过
