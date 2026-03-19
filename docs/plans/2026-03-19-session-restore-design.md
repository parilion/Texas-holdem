# 设计文档：玩家刷新恢复（UUID 会话方案）

日期：2026-03-19

## 背景

当前玩家身份与 `socket.id` 绑定，刷新后 WebSocket 重连产生新的 `socket.id`，导致玩家数据（筹码、手牌、所在房间）丢失。目标是通过 localStorage 持久化 UUID，支持刷新后无缝恢复游戏状态，包括游戏进行中途。

## 需求

- 刷新后能恢复到游戏中途的座位，看到自己的手牌和筹码，继续游戏
- 玩家身份以 UUID 识别，不依赖名字或 socket.id
- 会话过期（房间不存在/数据已清理）时展示提示消息，引导回大厅

## 超时参数

- **断线宽限期**：60 秒（宽限期内保留玩家座位，等待重连）
- **UUID 会话数据保留**：玩家被移出房间后再保留 10 分钟（用于展示"游戏已结束"提示）

## 数据流

### 首次访问

```
前端生成 UUID → 存 localStorage('playerId')
Socket.IO 连接携带 auth: { playerId: uuid }
服务端建立映射: uuid → { socketId, roomId }
```

### 刷新/重连（玩家仍在房间）

```
前端从 localStorage 读取 uuid
Socket.IO 重连携带相同 uuid
服务端识别老玩家 → 更新 socketId → 推送 session:restored（含当前 game:state）
前端恢复 roomId / myId / gameState，进入游戏桌
```

### 断线宽限期（60s）

```
服务端标记玩家 status: 'disconnected'，暂不清理
其他玩家看到该玩家"断线"状态
60s 内回来 → onReconnect，恢复正常
60s 超时 → 执行原有掉线逻辑（fold/移出），开始 10min UUID 保留计时
```

### 会话已过期

```
服务端返回 session:expired 事件（携带原因）
前端清除 localStorage 中的 roomId，展示提示消息
引导回大厅
```

## 会话状态机

```
[在房间中] ←── 60s 内重连 ──── [断线中，宽限期]
    │                                  │
    │ 宽限期超时 / 游戏正常结束         │ 宽限期超时
    ▼                                  ▼
[已离开房间，保留 10min] ── 10min 后 ──▶ [UUID 记录清除]
    │
    └─ 10min 内重连 → 提示"上一局已结束" → 引导大厅
```

## 服务端架构

### 新增：`server/src/PlayerSessionManager.js`

统一管理 UUID → 会话生命周期：

```
PlayerSessionManager
  ├── sessions: Map<playerId, { socketId, roomId, playerName, disconnectTimer, expireTimer }>
  ├── register(playerId, socketId)       // 新连接或重连，更新 socketId
  ├── setRoom(playerId, roomId)          // 加入房间时记录
  ├── getBySocketId(socketId)            // 按 socketId 反查 playerId
  ├── onDisconnect(socketId)             // 断线时启动 60s 宽限计时
  ├── onReconnect(playerId, socketId)    // 重连时取消计时，更新 socketId
  └── cleanup(playerId)                  // 踢出/超时后延迟 10min 彻底删除
```

### `GameRoom.js` 改动

- `addPlayer(id, name)` 的 `id` 改为 `playerId`（UUID）
- 新增 `player.status = 'disconnected'`，断线宽限期内其他玩家可见
- 轮到 `disconnected` 玩家操作时，继续等（已有 30s 倒计时），超时自动 fold

### `index.js` 改动

- `connection` 事件读取 `socket.handshake.auth.playerId`
- 识别为老玩家时调用 `onReconnect`，推送当前 `game:state`（含手牌）
- `disconnect` 事件改为启动宽限期，而非立即移除

## 前端架构

### `useSocket.js` 改动

```js
const playerId = localStorage.getItem('playerId') || crypto.randomUUID()
localStorage.setItem('playerId', playerId)
socket = io(serverUrl, { auth: { playerId } })
```

### `useGame.js` 改动

- 新增 `session:restored` 事件：直接恢复 `roomId` / `myId` / `gameState`
- 新增 `session:expired` 事件：清除 localStorage roomId，展示提示，回大厅
- `connect` 事件不再立即清空状态，等待服务端响应后再决定

### `App.jsx` 改动

新增"恢复中"过渡状态（2s 超时兜底）：

```
刷新后 → 显示"正在恢复会话..."
  → session:restored  → 进入游戏桌
  → session:expired   → 提示消息 → 大厅
  → 2s 无响应         → 回大厅
```

## 边界情况

| 场景 | 处理方式 |
|---|---|
| 轮到断线玩家操作 | 30s 倒计时超时自动 fold；宽限期内回来可继续 |
| 断线玩家是庄家/盲注位 | 不影响，庄家/盲注是位置概念 |
| 宽限期内房间被解散（人数不足） | 玩家回来后收到 session:expired |
| 两个标签页用同一 UUID | 第二个连接覆盖 socketId，旧标签页收到 session:expired |
| 服务器重启（内存清空） | 服务端找不到记录，返回 session:expired，前端清理并回大厅 |
| 首次访问（无 localStorage） | 正常流程，无影响 |
