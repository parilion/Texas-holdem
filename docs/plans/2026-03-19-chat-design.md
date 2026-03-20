# 聊天功能设计

## 概述
在牌桌左下角添加聊天框，支持文字和emoji聊天。消息通过服务器中转，同房间玩家可实时收发消息。房间解散后消息清除。

## 功能需求

### 消息类型
- 纯文本消息
- emoji 表情（内置预设列表）

### 消息管理
- 进入房间时拉取历史消息（最多最近50条）
- 消息按时间顺序显示，最新在底部
- 房间解散（所有玩家离开或房间销毁）时清除消息
- 玩家离开房间不断开消息连接，仅本房间消息消失

### UI 设计
- 位置：左下角固定
- 尺寸：宽度 280px，高度 320px
- 结构：消息列表区 + 输入区 + emoji选择器
- 输入框：支持文字输入 + emoji快捷按钮
- 消息气泡：显示玩家名字 + 消息内容 + 时间戳

## 技术方案

### 前端 (client)

**新增组件**
- `ChatBox.jsx` - 聊天组件，包含消息列表、输入框、emoji选择器

**消息格式**
```javascript
{
  id: string,          // 消息ID (UUID)
  playerId: string,    // 发送者ID
  playerName: string, // 发送者名字
  content: string,     // 消息内容 (文本+emoji)
  timestamp: number,   // 时间戳
}
```

**Emoji 列表** (20个常用)
```
😀 😃 😄 😁 🤣 😂 🙂 🙃 😉 😍
🤔 🤔 😎 🥳 😢 😡 😱 👋 👍 👎
```

**Socket 事件**
- `chat:send` - 客户端发送消息 `{ roomId, content }`
- `chat:receive` - 服务端广播消息 `{ id, playerId, playerName, content, timestamp }`
- `chat:history` - 进入房间时拉取历史 `chat:history` 返回 `{ messages: [] }`

### 后端 (server)

**新增逻辑**
- `index.js` 处理 `chat:send` 事件，转发到同房间所有玩家
- 房间对象增加 `messages: []` 存储消息（限制50条）
- 房间解散时清空消息

## 组件结构

```
Table.jsx
├── ChatBox (左下角)
│   ├── 消息列表 (可滚动)
│   │   └── 消息气泡 (name + content + time)
│   ├── 输入框 + 发送按钮
│   └── Emoji选择器 (点击插入emoji)
```

## 实施步骤

1. 后端：`index.js` 添加 chat 事件处理
2. 后端：`RoomManager.js` 或 `GameRoom.js` 添加消息存储
3. 前端：新建 `ChatBox.jsx` 组件
4. 前端：Table.css 添加聊天框样式
5. 前端：`App.jsx` 传入 socket 用于发送聊天消息
6. 前端：`Table.jsx` 引入 ChatBox 组件
