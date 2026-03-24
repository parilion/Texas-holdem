import { useState, useEffect } from 'react'

export default function ActionPanel({ gameState, myId, onAction }) {
  const BIG_BLIND = 20
  const me = gameState?.players?.find(p => p.id === myId)
  const isMyTurn = gameState?.players?.[gameState.currentPlayerIndex]?.id === myId
  const canCheck = isMyTurn && (gameState.currentBet === 0 || me?.bet === gameState.currentBet)
  const callAmount = gameState ? Math.min(gameState.currentBet - (me?.bet || 0), me?.chips || 0) : 0

  const minRaiseTotal = Math.max(
    (gameState?.currentBet || 0) * 2,
    (gameState?.currentBet || 0) + BIG_BLIND,
    BIG_BLIND
  )

  // 玩家实际总额（chips + 本轮已下注）
  const myTotal = me ? me.bet + me.chips : 0
  const [raiseAmount, setRaiseAmount] = useState(myTotal)
  const [selectedPct, setSelectedPct] = useState(100)

  useEffect(() => {
    const newMin = Math.max(
      (gameState?.currentBet || 0) * 2,
      (gameState?.currentBet || 0) + BIG_BLIND,
      BIG_BLIND
    )
    setRaiseAmount(myTotal)
    setSelectedPct(100)
  }, [gameState?.currentBet, myTotal])

  // 能否加注：只要玩家总筹码超过当前注即可（允许 all-in 式再加注）
  const canRaise = me && myTotal > (gameState?.currentBet || 0)
  // 实际最小值：若总筹码不足最小加注额，则 all-in 为唯一选项
  const effectiveMin = Math.min(minRaiseTotal, myTotal)

  // 底池筹码
  const pot = gameState?.pot || 0

  // 百分比按钮点击（基于底池）
  const handlePctClick = (pct) => {
    setSelectedPct(pct)
    const amount = Math.floor(pot * pct / 100)
    // 确保在 [effectiveMin, myTotal] 范围内
    setRaiseAmount(Math.min(Math.max(amount, effectiveMin), myTotal))
  }

  // 拖动条变化
  const handleSliderChange = (e) => {
    setSelectedPct(null)
    setRaiseAmount(Number(e.target.value))
  }

  if (!isMyTurn || !me || me.status !== 'active') {
    return <div className="action-panel">等待其他玩家操作...</div>
  }

  return (
    <div className="action-panel">
      <div className="action-row">
        <button onClick={() => onAction('fold')} className="btn-fold">弃牌</button>
        {canCheck
          ? <button onClick={() => onAction('check')} className="btn-check">过牌</button>
          : <button onClick={() => onAction('call')} className="btn-call">跟注 {callAmount}</button>
        }
      </div>

      {canRaise && (
        <>
          <div className="pct-buttons">
            <button
              className={`pct-btn ${selectedPct === 33 ? 'active' : ''}`}
              onClick={() => handlePctClick(33)}
            >
              33%
            </button>
            <button
              className={`pct-btn ${selectedPct === 50 ? 'active' : ''}`}
              onClick={() => handlePctClick(50)}
            >
              50%
            </button>
            <button
              className={`pct-btn ${selectedPct === 66 ? 'active' : ''}`}
              onClick={() => handlePctClick(66)}
            >
              66%
            </button>
            <button
              className={`pct-btn ${selectedPct === 100 ? 'active' : ''}`}
              onClick={() => handlePctClick(100)}
            >
              100%
            </button>
          </div>

          <input
            type="range"
            className="raise-slider"
            min={effectiveMin}
            max={myTotal}
            value={raiseAmount}
            onChange={handleSliderChange}
          />
          <div className="slider-labels">
            <span>{effectiveMin}</span>
            <span>底池: {pot}</span>
            <span>{myTotal}</span>
          </div>

          <div className="action-row">
            <button
              onClick={() => onAction('raise', raiseAmount)}
              className="btn-raise"
            >
              加注 {raiseAmount}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
