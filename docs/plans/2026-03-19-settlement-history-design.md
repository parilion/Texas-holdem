# 对局历史功能设计

## 概述

在游戏界面左上角新增"历史"按钮，点击展开下拉框展示上一局结算结果。结算完成后自动保存，仅保留最近一局数据。

## UI 布局

```
[历史按钮]                    房间号: 12345 [退出房间]
```

- 历史按钮位于左上角，与右上角房间号区域水平对齐
- 下拉弹框在按钮下方展开

## 交互流程

1. SHOWDOWN 阶段结算完成后，自动保存结算数据到 `lastSettlement` state
2. 点击"历史"按钮，展开下拉框展示完整结算结果
3. 再次点击"历史"按钮或点击外部区域，关闭下拉
4. 下一局结算时，覆盖更新 `lastSettlement` 数据

## 下拉内容

与现有结算弹框 `settlement` 保持一致的内容：

- **标题**：本局结算
- **获胜者**：🏆 {winnerName} 获胜！
- **公共牌**：5 张公共牌展示
- **亮牌**：展示 showdown 玩家的手牌
- **结算列表**：每个玩家的 name、chipChange（+/- 高亮）、剩余筹码

## 状态管理

```jsx
const [lastSettlement, setLastSettlement] = useState(null)
const [showHistory, setShowHistory] = useState(false)
```

- `lastSettlement`：保存上一局结算数据，仅 1 条
- `showHistory`：控制下拉展开/收起

## 组件结构

在 `Table.jsx` 中新增：
- 历史按钮（`history-btn`）
- 下拉弹框（`history-dropdown`）
- 复用 `Card` 组件展示牌面

## 数据来源

复用现有 `settlement` state 的数据，在结算弹框显示时同步保存到 `lastSettlement`。

## 样式

```css
/* 左上角历史按钮 */
.history-btn {
  /* 与 room-info 水平对齐 */
}

/* 下拉弹框 */
.history-dropdown {
  /* 绝对定位，出现在按钮下方 */
  /* 可设置最大高度和滚动 */
}
```

## 实现文件

- `client/src/components/Table.jsx`：新增状态和 UI
- `client/src/components/Table.css`：新增样式
