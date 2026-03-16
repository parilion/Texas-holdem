# 德州扑克多人游戏 — 设计文档

**日期：** 2026-03-16
**状态：** 已确认

---

## 1. 概述

基于 Web 浏览器的多人实时德州扑克游戏（MVP 版本）。玩家通过网页访问，使用 WebSocket 实时对战，支持 2-9 人同局。

---

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React + Vite + Socket.IO-client |
| 后端 | Node.js + Express + Socket.IO |
| 仓库结构 | Monorepo（单仓库） |

---

## 3. 项目结构

```
texas/
├── package.json              # 根级脚本
├── server/
│   ├── package.json
│   └── src/
│       ├── index.js              # Express + Socket.IO 入口
│       ├── game/
│       │   ├── Deck.js           # 牌组洗牌/发牌
│       │   ├── HandEvaluator.js  # 手牌评判（七选五）
│       │   ├── GameRoom.js       # 单局游戏状态机
│       │   └── RoomManager.js   # 管理所有房间
│       └── socket/
│           └── index.js          # Socket.IO 事件注册
└── client/
    ├── package.json
    └── src/
        ├── App.jsx
        ├── components/
        │   ├── Lobby.jsx         # 大厅：建房/加入
        │   ├── Table.jsx         # 游戏桌面
        │   ├── PlayerSeat.jsx    # 单个玩家座位
        │   └── ActionPanel.jsx   # 操作区
        └── hooks/
            ├── useSocket.js      # Socket.IO 连接管理
            └── useGame.js        # 游戏状态订阅
```

---

## 4. 游戏流程

### 阶段状态机

```
WAITING → PREFLOP → FLOP → TURN → RIVER → SHOWDOWN → WAITING
```

- **WAITING**：等待玩家加入，房主开始游戏
- **PREFLOP**：发手牌（每人2张），大小盲注，第一轮下注
- **FLOP**：翻牌（3张公共牌），第二轮下注
- **TURN**：转牌（第4张公共牌），第三轮下注
- **RIVER**：河牌（第5张公共牌），最终下注
- **SHOWDOWN**：摊牌，评判胜者，分配底池

---

## 5. 核心数据结构

### 游戏状态（服务端权威，广播给客户端）

```js
{
  roomId: "ABC123",
  phase: "FLOP",
  pot: 150,
  communityCards: [card, card, card],
  currentBet: 50,
  currentPlayerIndex: 2,
  dealer: 0,            // 庄家位索引
  smallBlind: 10,
  bigBlind: 20,
  players: [
    {
      id: "socket-id",
      name: "Alice",
      chips: 850,
      bet: 50,
      holeCards: [...], // 只发给本人，广播时对他人隐藏（null）
      status: "active", // active | folded | allin | out
      isDealer: true
    }
  ]
}
```

### 牌的表示

```js
{ suit: "hearts", rank: "A" }
// suit: hearts | diamonds | clubs | spades
// rank: 2-9 | T | J | Q | K | A
```

---

## 6. Socket.IO 事件协议

### 客户端 → 服务端

| 事件 | 数据 | 说明 |
|---|---|---|
| `room:create` | `{ playerName }` | 创建房间 |
| `room:join` | `{ roomId, playerName }` | 加入房间 |
| `game:start` | - | 房主开始游戏 |
| `action:check` | - | 过牌 |
| `action:call` | - | 跟注 |
| `action:raise` | `{ amount }` | 加注 |
| `action:fold` | - | 弃牌 |
| `action:allin` | - | 全押 |

### 服务端 → 客户端

| 事件 | 数据 | 说明 |
|---|---|---|
| `room:joined` | `{ roomId, gameState }` | 成功加入房间 |
| `room:updated` | `{ gameState }` | 房间状态更新 |
| `game:state` | `{ gameState }` | 游戏状态推送 |
| `game:ended` | `{ winner, pot }` | 局结束 |
| `error` | `{ message }` | 错误消息 |

---

## 7. UI 界面设计

### 大厅（Lobby）

- 输入昵称
- 「创建房间」→ 生成 6 位房间码
- 「加入房间」→ 输入房间码
- 等待室显示玩家列表，房主点击「开始游戏」

### 游戏桌面（Table）

```
┌─────────────────────────────────────────┐
│  [玩家3]           [玩家4]              │
│                                         │
│  [玩家2]   [ ][ ][ ][ ][ ]  [玩家5]   │
│            公共牌  底池: $150           │
│  [玩家1]                       [玩家6]  │
│                                         │
│         [我的手牌: ♠A ♥K]              │
│    [ CHECK ] [ CALL $50 ] [ RAISE ] [ FOLD ] │
└─────────────────────────────────────────┘
```

- 当前操作玩家高亮，显示 30 秒倒计时
- 操作面板仅轮到自己时启用
- Raise 使用滑块或输入框选择金额

---

## 8. 安全规则

- 手牌 `holeCards` 服务端只发给持有者本人
- 广播给其他玩家时替换为 `null`
- 仅在 SHOWDOWN 阶段揭示存活玩家手牌
- 所有操作合法性由服务端验证（防止客户端作弊）

---

## 9. MVP 范围

**包含：**
- 建房/加入房间
- 2-9 人对局
- 完整牌局流程（blind → preflop → flop → turn → river → showdown）
- check / call / raise / fold / all-in
- 自动手牌评判（七选五，标准德州扑克手型）
- 基本筹码管理（默认每人 1000 筹码）
- 30 秒超时自动 fold

**不包含（留待后续迭代）：**
- 用户注册/登录
- 多局排行榜
- 聊天功能
- 动画效果
- 边池（Side Pot）复杂计算
