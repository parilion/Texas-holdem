import { useState, useEffect } from 'react'

export default function ActionPanel({ gameState, myId, onAction }) {
  const BIG_BLIND = 20
  const minRaiseTotal = Math.max(
    (gameState?.currentBet || 0) * 2,
    (gameState?.currentBet || 0) + BIG_BLIND,
    BIG_BLIND
  )
  const [raiseAmount, setRaiseAmount] = useState(minRaiseTotal)

  useEffect(() => {
    const newMin = Math.max(
      (gameState?.currentBet || 0) * 2,
      (gameState?.currentBet || 0) + BIG_BLIND,
      BIG_BLIND
    )
    setRaiseAmount(newMin)
  }, [gameState?.currentBet])

  const me = gameState?.players?.find(p => p.id === myId)
  const isMyTurn = gameState?.players?.[gameState.currentPlayerIndex]?.id === myId
  const canCheck = isMyTurn && (gameState.currentBet === 0 || me?.bet === gameState.currentBet)
  const callAmount = gameState ? Math.min(gameState.currentBet - (me?.bet || 0), me?.chips || 0) : 0

  // 有效 all-in 额：不超过对手的最大可投入总额
  const opponents = gameState?.players?.filter(p => p.id !== myId && (p.status === 'active' || p.status === 'allin')) || []
  const maxOpponentTotal = opponents.length > 0 ? Math.max(...opponents.map(p => p.bet + p.chips)) : 0
  const effectiveAllin = Math.min(me?.chips || 0, Math.max(0, maxOpponentTotal - (me?.bet || 0)))

  // 玩家实际总额（chips + 本轮已下注）必须超过最小加注总额才能加注
  const canRaise = me && (me.chips + (me.bet || 0)) > minRaiseTotal

  if (!isMyTurn || !me || me.status !== 'active') {
    return <div className="action-panel waiting">等待其他玩家操作...</div>
  }

  return (
    <div className="action-panel">
      <button onClick={() => onAction('fold')} className="btn-fold">弃牌</button>
      {canCheck
        ? <button onClick={() => onAction('check')} className="btn-check">过牌</button>
        : <button onClick={() => onAction('call')} className="btn-call">跟注 ({callAmount})</button>
      }
      {canRaise && (
        <div className="raise-group">
          <input
            type="range"
            min={minRaiseTotal}
            max={me.bet + me.chips}
            value={Math.min(raiseAmount, me.bet + me.chips)}
            onChange={e => setRaiseAmount(Number(e.target.value))}
          />
          <button onClick={() => onAction('raise', raiseAmount)} className="btn-raise">
            加注 ({raiseAmount})
          </button>
        </div>
      )}
      <button onClick={() => onAction('allin')} className="btn-allin">ALL IN ({effectiveAllin})</button>
    </div>
  )
}
