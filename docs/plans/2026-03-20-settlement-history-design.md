# 历史结算记录持久化设计方案

## 目标

将结算历史数据持久化到服务端，使刷新后仍能查看历史记录，与聊天记录处理方式保持一致。

## 架构决策

- **存储位置**: `RoomManager.settlements` (Map<roomId, settlementData>)
- **生命周期**: 房间解散时清除（与聊天消息一致）
- **保存数量**: 仅保留最近一局

## 变更点

### 1. RoomManager.js
- 新增 `settlements: Map<roomId, settlementData>`
- 新增 `getRoomSettlement(roomId)` - 获取房间结算历史
- 新增 `clearRoomSettlement(roomId)` - 清除房间结算历史
- 房间解散时同步调用 `clearRoomSettlement`

### 2. GameRoom.js
- `_endRound()` 触发 `_notifyChange({ settlementData })` 时，同步通知 RoomManager 保存

### 3. index.js
- `room:join` / `room:create` / `session:restored` 时，`getPublicState` 返回中附加 `lastSettlement`

### 4. Table.jsx
- 用 `gameState.lastSettlement` 初始化 `lastSettlement` state
- 简化前端逻辑，服务端数据作为单一数据源

## 数据流

```
SHOWDOWN结束 → GameRoom._endRound()
  → _notifyChange({ settlementData })
  → broadcastRoomState({ settlementData })
  → RoomManager 保存到 settlements[roomId]

玩家刷新重连 → session:restored
  → { ...room.getPublicState(playerId), lastSettlement, messages }
  → 前端直接使用服务端数据
```

## 兼容性

- 房间解散时同时清除聊天记录和结算历史
- 无结算历史时 "历史" 按钮保持置灰
