# 对局历史功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在游戏界面左上角新增"历史"按钮，点击展开下拉框展示上一局结算结果。

**Architecture:** 在 Table.jsx 中新增 state 管理上一局结算数据，添加历史按钮和下拉弹框 UI，复用 Card 组件展示牌面，使用绝对定位控制下拉展开。

**Tech Stack:** React (useState), CSS (absolute positioning)

---

## Task 1: 添加 state 和保存逻辑

**Files:**
- Modify: `client/src/components/Table.jsx`

**Step 1: 添加 state**

在 Table 组件顶部添加：
```jsx
const [lastSettlement, setLastSettlement] = useState(null)
const [showHistory, setShowHistory] = useState(false)
```

**Step 2: 修改 useEffect 保存结算数据**

在现有的 `settlement` useEffect 中，结算弹框显示时同步保存到 `lastSettlement`：
```jsx
// 在 setSettlement({...}) 之后添加：
setLastSettlement({...}) // 复用同样的数据对象
```

**Step 3: 添加点击外部关闭下拉的 useEffect**

```jsx
useEffect(() => {
  if (!showHistory) return
  const handler = (e) => {
    if (!e.target.closest('.history-container')) {
      setShowHistory(false)
    }
  }
  document.addEventListener('click', handler)
  return () => document.removeEventListener('click', handler)
}, [showHistory])
```

---

## Task 2: 添加历史按钮 UI

**Files:**
- Modify: `client/src/components/Table.jsx`

在 `room-info` div 之前（左上角位置）添加：
```jsx
<div className="history-container">
  <button
    className="history-btn"
    onClick={(e) => {
      e.stopPropagation()
      setShowHistory(!showHistory)
    }}
    disabled={!lastSettlement}
  >
    历史
  </button>

  {showHistory && lastSettlement && (
    <div className="history-dropdown">
      {/* 复用 settlement 弹框的内容结构 */}
    </div>
  )}
</div>
```

---

## Task 3: 抽取结算内容为独立函数

**Files:**
- Modify: `client/src/components/Table.jsx`

**Step 1: 创建 SettlementContent 组件**

在 Table.jsx 文件末尾（export 之前）添加：
```jsx
function SettlementContent({ settlement }) {
  if (!settlement) return null
  return (
    <>
      <div className="settlement-title">本局结算</div>
      <div className="settlement-winner">🏆 {settlement.winnerName} 获胜！</div>
      {/* 公共牌、亮牌、结算列表 - 复用现有代码 */}
    </>
  )
}
```

**Step 2: 简化两个弹框的引用**

在 `settlement` 弹框中使用 `<SettlementContent settlement={settlement} />`
在 `history-dropdown` 中也使用 `<SettlementContent settlement={lastSettlement} />`

---

## Task 4: 添加 CSS 样式

**Files:**
- Modify: `client/src/components/Table.css`

**Step 1: 添加 history-container 样式**

```css
.history-container {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 100;
}

.history-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
}

.history-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.history-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.history-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 8px;
  background: #1a1a2e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
  min-width: 300px;
  max-width: 400px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}
```

---

## Task 5: 测试验证

1. 启动游戏并完成一局
2. 确认结算弹框出现后，左上角"历史"按钮可点击
3. 点击"历史"按钮，确认下拉展示完整结算信息
4. 点击下拉外部，确认下拉关闭
5. 开始新一局，确认旧数据被新数据覆盖
