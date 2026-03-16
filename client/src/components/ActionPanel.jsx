import { useState } from 'react'

export default function ActionPanel({ gameState, myId, onAction }) {
  const [raiseAmount, setRaiseAmount] = useState(gameState?.currentBet * 2 || 40)

  const me = gameState?.players?.find(p => p.id === myId)
  const isMyTurn = gameState?.players?.[gameState.currentPlayerIndex]?.id === myId
  const canCheck = isMyTurn && (gameState.currentBet === 0 || me?.bet === gameState.currentBet)
  const callAmount = gameState ? Math.min(gameState.currentBet - (me?.bet || 0), me?.chips || 0) : 0

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
      <div className="raise-group">
        <input
          type="range"
          min={gameState.currentBet > 0 ? gameState.currentBet + 1 : 1}
          max={me.chips}
          value={raiseAmount}
          onChange={e => setRaiseAmount(Number(e.target.value))}
        />
        <button onClick={() => onAction('raise', raiseAmount)} className="btn-raise">
          加注 ({raiseAmount})
        </button>
      </div>
      <button onClick={() => onAction('allin')} className="btn-allin">ALL IN ({me.chips})</button>
    </div>
  )
}
