# Texas Hold'em

多人实时德州扑克，支持 2~9 人同桌，在浏览器里直接玩。

## 技术栈

- **前端**：React 18 + Vite，Socket.IO Client
- **后端**：Node.js + Express + Socket.IO
- **通信**：WebSocket 实时双向同步

## 功能

- 创建 / 加入房间（6 位房间码）
- 完整游戏流程：PREFLOP → FLOP → TURN → RIVER → SHOWDOWN
- 支持 Check、Call、Raise、Fold、All-In
- 自动收盲注（小盲 10 / 大盲 20）
- 结算弹窗展示赢家及各玩家盈亏
- 筹码归零自动踢出，庄家位自动轮转
- 断线自动弃牌，不卡游戏进程
- Split Pot（多人同牌型时均分底池）

## 快速开始

```bash
# 安装依赖
npm run install:all

# 启动（前后端同时）
npm run dev
```

前端运行在 `http://localhost:5173`，后端监听 `3001` 端口。

多开几个浏览器标签页模拟多个玩家即可测试。

## 项目结构

```
├── client/          # React 前端
│   └── src/
│       ├── components/   # Table、PlayerSeat、ActionPanel 等
│       └── hooks/        # useGame、useSocket
└── server/          # Node.js 后端
    └── src/
        └── game/         # GameRoom、Deck、HandEvaluator、RoomManager
```

## 运行测试

```bash
cd server && npm test
```

覆盖 Deck 洗牌发牌、HandEvaluator 牌型判断、GameRoom 游戏状态机等核心逻辑。
