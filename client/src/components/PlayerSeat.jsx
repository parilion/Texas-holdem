import { useState, useEffect } from 'react'
import Card from './Card'

const TURN_SECONDS = 30

export default function PlayerSeat({ player, isCurrentPlayer, isMe, position }) {
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS)

  useEffect(() => {
    if (!isCurrentPlayer) {
      setTimeLeft(TURN_SECONDS)
      return
    }
    setTimeLeft(TURN_SECONDS)
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [isCurrentPlayer])
  if (!player) return <div className={`seat empty seat-${position}`} />

  const statusLabel = {
    active: '',
    folded: '弃牌',
    allin: 'ALL IN',
    out: '出局',
    waiting: '未准备',
    ready: '已准备',
  }[player.status] || ''

  return (
    <div className={`seat seat-${position} ${isCurrentPlayer ? 'current-turn' : ''} ${player.status}`}>
      <div className="player-name">
        {player.isDealer && <span className="dealer-btn">D</span>}
        {player.name}
        {isMe && ' (我)'}
      </div>
      <div className="player-chips">💰 {player.chips}</div>
      {player.bet > 0 && <div className="player-bet">注: {player.bet}</div>}
      {isCurrentPlayer && (
        <div className="thinking-indicator">
          <span>{isMe ? '你的回合' : '思考中'} {timeLeft}s</span>
          <div className="turn-timer-bar">
            <div
              className="turn-timer-fill"
              style={{
                width: `${(timeLeft / TURN_SECONDS) * 100}%`,
                backgroundColor: timeLeft > 10 ? '#4caf50' : timeLeft > 5 ? '#f4c430' : '#e53935',
              }}
            />
          </div>
        </div>
      )}
      {statusLabel && !player.isDealer && <div className={`player-status ${player.status === 'ready' ? 'status-ready' : ''}`}>{statusLabel}</div>}
      <div className="player-cards">
        {player.holeCards
          ? player.holeCards.map((c, i) => (
              <div key={i} className={i === 0 ? 'card-1' : 'card-2'}>
                <Card card={c} />
              </div>
            ))
          : player.cardCount > 0
          ? Array(player.cardCount).fill(null).map((_, i) => (
              <div key={i} className={i === 0 ? 'card-1' : 'card-2'}>
                <Card faceDown />
              </div>
            ))
          : null
        }
      </div>
    </div>
  )
}
