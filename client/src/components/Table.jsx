import { useState, useEffect, useRef } from 'react'
import PlayerSeat from './PlayerSeat'
import ActionPanel from './ActionPanel'
import Card from './Card'
import ReplenishPanel from './ReplenishPanel'
import './Table.css'

// 位置索引: 0=bottom(我), 1=bottom-right, 2=right, 3=top-right, 4=top, 5=top-left, 6=left, 7=bottom-left
const POSITIONS = ['bottom', 'bottom-right', 'right', 'top-right', 'top', 'top-left', 'left', 'bottom-left']

export default function Table({ gameState, myId, roomId, onAction, onStartGame, onReady, onUnready, onLeaveRoom, error }) {
  const [settlement, setSettlement] = useState(null)
  const [showReplenish, setShowReplenish] = useState(false)
  const prevPhaseRef = useRef(null)

  if (!gameState) return <div className="table-loading">加载中...</div>

  const { players, phase, pot, communityCards, currentBet } = gameState
  const myIndex = players.findIndex(p => p.id === myId)
  const myPlayer = players[myIndex]
  const isHost = myPlayer?.isDealer === true

  // "我"固定在底部中间位置(pos 0)，其他玩家顺时针围绕牌桌
  const orderedPlayers = Array(8).fill(null)
  // 先把自己放到位置0（底部中间）
  orderedPlayers[0] = { ...players[myIndex], originalIndex: myIndex }

  // 其他玩家顺时针排列（从右边开始）
  let posIndex = 0
  const otherPositions = [1, 2, 3, 4, 5, 6, 7] // 顺时针位置序列（跳过0）
  players.forEach((player, i) => {
    if (i === myIndex) return
    orderedPlayers[otherPositions[posIndex]] = { ...player, originalIndex: i }
    posIndex++
  })

  const isMyTurn = players[gameState.currentPlayerIndex]?.id === myId
  const isReady = myPlayer?.status === 'ready'
  const allOthersReady = players.filter(p => p.id !== myId && p.status !== 'out').every(p => p.status === 'ready')

  // 监听结算数据
  useEffect(() => {
    if (phase === 'SHOWDOWN' && gameState.winner && prevPhaseRef.current !== 'SHOWDOWN') {
      setSettlement({
        winner: gameState.winner,
        winnerName: gameState.winnerName,
        winnerChips: gameState.winnerChips,
        playerResults: gameState.playerResults || [],
        communityCards: gameState.communityCards || [],
        showdownPlayers: (gameState.players || [])
          .filter(p => p.holeCards && p.holeCards.length > 0 && p.status !== 'folded')
          .map(p => ({ id: p.id, name: p.name, holeCards: p.holeCards })),
      })
    }
    prevPhaseRef.current = phase
  }, [phase, gameState?.winner])

  return (
    <div className="table-wrapper">
      <div className="room-info">
        <span>房间号: <strong>{roomId}</strong></span>
        <button className="leave-btn" onClick={onLeaveRoom}>退出房间</button>
      </div>
      {error && <div className="error-toast">{error}</div>}

      <div className="table">
        {orderedPlayers.map((player, pos) => (
          <PlayerSeat
            key={pos}
            player={player}
            isCurrentPlayer={player && phase !== 'WAITING' && phase !== 'SHOWDOWN' && players[gameState.currentPlayerIndex]?.id === player.id}
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

      {phase === 'WAITING' && players.length < 2 && (
        <div className="waiting-alone">等待其他玩家加入...</div>
      )}

      {phase === 'WAITING' && isHost && players.length >= 2 && !settlement && (
        <button className={`start-btn ${!allOthersReady ? 'start-btn-disabled' : ''}`} onClick={onStartGame} disabled={!allOthersReady}>开始游戏</button>
      )}

      {phase === 'WAITING' && !isHost && !isReady && players.length >= 2 && (
        <button className="ready-btn" onClick={onReady}>准备</button>
      )}

      {phase === 'WAITING' && !isHost && isReady && players.length >= 2 && (
        <button className="ready-btn ready" onClick={onUnready}>取消准备</button>
      )}

      {phase !== 'WAITING' && phase !== 'SHOWDOWN' && (
        <ActionPanel gameState={gameState} myId={myId} onAction={onAction} />
      )}

      {settlement && (
        <div className="settlement-overlay">
          <div className="settlement-panel">
            <div className="settlement-title">本局结算</div>
            <div className="settlement-winner">🏆 {settlement.winnerName} 获胜！</div>

            {settlement.communityCards.length > 0 && (
              <div className="settlement-community">
                <div className="settlement-section-label">公共牌</div>
                <div className="settlement-cards">
                  {settlement.communityCards.map((card, i) => (
                    <Card key={i} card={card} />
                  ))}
                </div>
              </div>
            )}

            {settlement.showdownPlayers.length > 0 && (
              <div className="settlement-hands">
                <div className="settlement-section-label">亮牌</div>
                {settlement.showdownPlayers.map(p => (
                  <div key={p.id} className="settlement-player-cards">
                    <span className={`s-hand-name ${settlement.winner?.split(',').includes(p.id) ? 'winner-hand' : ''}`}>{p.name}</span>
                    <div className="settlement-cards">
                      {p.holeCards.map((card, i) => (
                        <Card key={i} card={card} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="settlement-list">
              {settlement.playerResults.map(p => (
                <div key={p.id} className={`settlement-row ${settlement.winner?.split(',').includes(p.id) ? 'winner-row' : ''}`}>
                  <span className="s-name">{p.name}</span>
                  <span className={`s-change ${p.chipChange >= 0 ? 'positive' : 'negative'}`}>
                    {p.chipChange >= 0 ? '+' : ''}{p.chipChange}
                  </span>
                  <span className="s-chips">💰 {p.chips}</span>
                </div>
              ))}
            </div>
            <button
              className="settlement-continue"
              onClick={() => {
                setSettlement(null)
                if (myPlayer.chips === 0) {
                  setShowReplenish(true)
                }
              }}
            >
              继续
            </button>
          </div>
        </div>
      )}
      {showReplenish && (
        <ReplenishPanel onReplenish={(amount) => {
          doReplenish(amount)
          setShowReplenish(false)
        }} />
      )}
    </div>
  )
}
