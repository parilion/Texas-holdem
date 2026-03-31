# 房间积分榜功能设计

## Context

用户希望在牌桌界面增加积分榜功能，记录并展示每个玩家从房间开始到当前的所有积分变化，并按累计积分排名。

## 数据结构

### 后端 — GameRoom.js

新增实例属性：
```javascript
this.leaderboard = [] // Array<{ id, name, chipsBefore, totalChange }>
```

每局结算时更新：
```javascript
// 局结束时记录每个玩家的 chipsBefore
this.players.forEach(p => p.chipsBefore = p.chips)

// 局结算后计算 chipChange 并更新 leaderboard
const settle = (winner) => {
  const change = winner.chips - (winner.chipsBefore ?? winner.chips)
  const entry = this.leaderboard.find(e => e.id === winner.id)
  if (entry) {
    entry.totalChange += change
  } else {
    this.leaderboard.push({ id: winner.id, name: winner.name, totalChange: change })
  }
}
```

### Socket 事件

新增 `leaderboard:update` 事件，推送完整 leaderboard 数组到客户端。

## 前端

### 新增组件

**`client/src/components/LeaderboardPanel.jsx`**

- 折叠/展开式右侧面板（默认收起）
- 展开时展示排名列表：排名、玩家名、累计积分变化、当前积分
- 按 `totalChange` 降序排列

### 组件状态

```javascript
const [isOpen, setIsOpen] = useState(false)
const [leaderboard, setLeaderboard] = useState([])
```

### Socket 监听

```javascript
socket.on('leaderboard:update', (data) => {
  setLeaderboard(data)
})
```

## 文件清单

| 文件 | 改动 |
|------|------|
| `server/src/game/GameRoom.js` | 新增 leaderboard 属性，每局结算后更新 |
| `server/src/index.js` | 新增 `leaderboard:update` 事件广播 |
| `client/src/components/LeaderboardPanel.jsx` | 新增折叠式积分榜组件 |
| `client/src/components/Table.jsx` | 引入 LeaderboardPanel 并传入 socket |

## 验证方式

1. 启动 server 和 client
2. 创建房间，加入多个玩家
3. 开始游戏，几局后观察积分榜数据是否正确累计
4. 验证折叠/展开功能正常
5. 验证排名按 totalChange 降序排列
