# All-in and Side Pot Fix - Handoff Document

## 目标
修复德州扑克 all-in 筹码计算 bug 和实现边池追踪系统。

## 当前状态

**分支**: `frontend-redesign`
**工作目录**: `/g/demo/Texas`

### 已完成 (Commits 已提交)
1. **Task 1**: 添加 `this.pots = []` 数据结构 ✓
2. **Task 2**: 修复 allin handler Math.max → Math.min ✓
3. **Task 3**: 实现边池创建方法 ✓

### 代码修改位置
- `server/src/game/GameRoom.js` - 主要修改
- `server/src/game/GameRoom.test.js` - 测试用例

---

## 当前问题 (需要继续调试)

### 边池逻辑还未完全正确

**测试场景**: A(980) allin, B(480) call, C(780) call

**期望结果**:
- 主池: 60(盲注) + 480*3 = 1500
- 边池: A excess 500 + C excess 300 = 800 (A,B,C 争夺)
- 总计: 2300

**当前问题**:
1. `eligiblePlayers` 条件不正确 - 只包含 allin 玩家，应该是所有未 fold/out 玩家
2. 当 C call 时，因为 deck=null 导致测试崩溃（需要初始化 deck）

### 需要修复的文件和方法

**1. `_createSidePotForAllIn` 方法 (约 line 295-318)**
- `eligiblePlayers` 条件太严格
- 应该包含所有未 fold/out 的玩家

**2. `_sweepExcessToSidePots` 方法 (约 line 321-345)**
- 类似问题

**3. 测试初始化问题**
- 需要正确初始化 `room.deck`

---

## 后续任务清单

### Task 4: 修复 _endRound showdown 分配
- 修改 `_endRound()` 使用 `this.pots` 数组分配奖金
- 单赢家: 分配主池 + 所有符合条件的边池
- 分池 (split pot): 按比例分配

### Task 5: 集成测试
- 编写完整 all-in 场景测试
- 验证边池分配正确性

### Task 6: 更新 getPublicState
- 添加 `pots` 字段到 public state
- 供前端显示边池信息

---

## 关键代码片段

### 正确的主池/边池计算逻辑

```
A(980) allin, B(480) call, C(780) call:

1. A allin 时:
   - effectiveTotal = min(980, min(480,780) * 3) = min(980, 1260) = 980
   - currentBet = min(980, 480) = 480
   - A 投入: 480 到主池, 500 到边池

2. B call 480:
   - B 投入: 480 到主池

3. C call 480:
   - C 投入: 480 到主池, 300 到边池

最终:
- 主池: 60 + 480*3 = 1500 (A,B,C 争夺)
- 边池: 500 + 300 = 800 (A,C 争夺, 因为 B 只投入 480)
```

### 边池 eligiblePlayers 规则
- **主池**: 所有投入的玩家
- **边池**: 只能由那些"有能力争夺"的玩家赢得
  - 如果边池是由 A 的 excess 创建，且 C 也投入了 excess，则 A 和 C 可以争夺
  - B 不能争夺 C 的 excess（因为 B 只投入了 480，而 C 投入了 780）

---

## 测试命令

```bash
cd /g/demo/Texas/server
npm test -- --testPathPattern=GameRoom.test.js
```

---

## 参考

- 计划文档: `docs/plans/2026-03-19-allin-sidepot-fix.md`
- 原始 bug 分析请见计划文档
