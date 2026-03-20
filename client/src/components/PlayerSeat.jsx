import Card from './Card'

export default function PlayerSeat({ player, isCurrentPlayer, isMe, position }) {
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
          {isMe ? '你的回合...' : '思考中...'}
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
