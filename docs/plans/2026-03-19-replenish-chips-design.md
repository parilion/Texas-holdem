# 补筹功能设计

## 概述

SHOWDOWN 结算完成后，若当前玩家筹码归零，弹出补筹页面。玩家输入补筹金额（上限 1000）确认后，筹码增加并转为 `waiting` 状态，可正常准备参与下一局。

## 流程

```
SHOWDOWN 结算 → 玩家点击"继续" → 检测到我方 chips=0 → 弹出补筹页面
→ 玩家输入金额(自动上限1000) → 确认补筹 → 筹码更新、状态→waiting → 等待/准备
```

## 交互规则

- 补筹上限：**固定 1000**，每次补筹最多补到 1000
- 输入框预填默认值 **1000**，使用 `max={1000}` 属性，超出自动截断，无额外提示文字
- 点击"补筹"确认后，更新筹码、状态置为 `waiting`，面板关闭
- 若非自己筹码归零（其他玩家），无感知，不影响当前用户

## 前端改动

### 新增文件

- `client/src/components/ReplenishPanel.jsx` — 补筹面板组件

### 修改文件

- `client/src/components/Table.jsx` — 结算"继续"后检测 chips=0 则展示补筹面板
- `client/src/hooks/useGame.js` — 新增 `doReplenish(amount)` 方法

### 补筹面板 UI

```jsx
// 模态浮层，居中显示
// 输入框 max={1000}，超过自动截断，无范围提示
// 确认按钮点击后调用 doReplenish(amount)
```

## 后端改动

### 修改文件

- `server/src/index.js` — 处理 `player:replenish` 事件，更新玩家筹码为 `waiting` 状态
- `server/src/game/GameRoom.js` — 补筹后玩家状态改为 `waiting`（不再踢出）

## 状态迁移

```
out (本局归零) → waiting (补筹后) → ready (玩家准备) → active (游戏开始)
```

## 事件

| 事件名 | 方向 | 数据 | 说明 |
|--------|------|------|------|
| `player:replenish` | client→server | `{ amount: number }` | 玩家申请补筹 |
| `player:replenished` | server→client | `{ chips: number }` | 补筹结果确认 |
