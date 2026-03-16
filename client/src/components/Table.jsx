import PlayerSeat from './PlayerSeat'
import ActionPanel from './ActionPanel'
import Card from './Card'
import './Table.css'

const POSITIONS = ['bottom', 'bottom-left', 'left', 'top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom2']

export default function Table({ gameState, myId, roomId, onAction, onStartGame, error }) {
  if (!gameState) return <div className="table-loading">加载中...</div>

  const { players, phase, pot, communityCards, currentBet } = gameState
  const myIndex = players.findIndex(p => p.id === myId)
  const isHost = myIndex === 0

  // 以自己为底部重新排列座位
  const orderedPlayers = Array(9).fill(null)
  players.forEach((player, i) => {
    const relativePos = (i - myIndex + 9) % players.length
    orderedPlayers[relativePos] = { ...player, originalIndex: i }
  })

  const isMyTurn = players[gameState.currentPlayerIndex]?.id === myId

  return (
    <div className="table-wrapper">
      <div className="room-info">房间号: <strong>{roomId}</strong></div>
      {error && <div className="error-toast">{error}</div>}

      <div className="table">
        {orderedPlayers.map((player, pos) => (
          <PlayerSeat
            key={pos}
            player={player}
            isCurrentPlayer={player && players[gameState.currentPlayerIndex]?.id === player.id}
            isMe={player?.id === myId}
            position={POSITIONS[pos]}
          />
        ))}

        <div className="table-center">
          <div className="community-cards">
            {Array(5).fill(null).map((_, i) => (
              <Card key={i} card={communityCards[i] || null} faceDown={!communityCards[i]} />
            ))}
          </div>
          <div className="pot">底池: 💰{pot}</div>
          <div className="phase">{phase}</div>
          {currentBet > 0 && <div className="current-bet">当前注: {currentBet}</div>}
        </div>
      </div>

      {phase === 'WAITING' && isHost && players.length >= 2 && (
        <button className="start-btn" onClick={onStartGame}>开始游戏</button>
      )}

      {phase !== 'WAITING' && phase !== 'SHOWDOWN' && (
        <ActionPanel gameState={gameState} myId={myId} onAction={onAction} />
      )}
    </div>
  )
}
