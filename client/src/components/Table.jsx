import { useState, useEffect, useRef } from 'react'
import PlayerSeat from './PlayerSeat'
import ActionPanel from './ActionPanel'
import Card from './Card'
import ReplenishPanel from './ReplenishPanel'
import ChatBox from './ChatBox'
import { getSocket } from '../hooks/useSocket'
import './Table.css'

// 位置索引: 0=bottom(我), 1=bottom-right, 2=right, 3=top-right, 4=top, 5=top-left, 6=left, 7=bottom-left
const POSITIONS = ['bottom', 'bottom-right', 'right', 'top-right', 'top', 'top-left', 'left', 'bottom-left']

export default function Table({ gameState, myId, roomId, onAction, onStartGame, onReady, onUnready, onLeaveRoom, doReplenish, onSendChat, error }) {
  const [settlement, setSettlement] = useState(null)
  const [lastSettlement, setLastSettlement] = useState(gameState?.lastSettlement || null)
  const [showHistory, setShowHistory] = useState(false)
  const [showReplenish, setShowReplenish] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const prevPhaseRef = useRef(null)
  const socket = getSocket()

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
      // 判断是"对手弃牌获胜"还是"多人比牌获胜"
      // showdownPlayers 来自 gameState，由后端计算好传来
      const activePlayers = (gameState.players || []).filter(
        p => p.holeCards && p.holeCards.length > 0 && p.status !== 'folded' && p.status !== 'out'
      )
      const isByFold = activePlayers.length <= 1

      const settlementData = {
        winner: gameState.winner,
        winnerName: gameState.winnerName,
        winnerChips: gameState.winnerChips,
        playerResults: gameState.playerResults || [],
        communityCards: gameState.communityCards || [],
        winningCommunityCards: gameState.winningCommunityCards || [],
        showdownPlayers: isByFold ? [] : (gameState.showdownPlayers || []),
      }
      setSettlement(settlementData)
      setLastSettlement(settlementData)
    }
    prevPhaseRef.current = phase
  }, [phase, gameState])

  // 点击外部关闭历史下拉
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

  // 监听聊天消息
  useEffect(() => {
    const handleChatReceive = (message) => {
      setChatMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev
        return [...prev, message]
      })
    }
    socket.on('chat:receive', handleChatReceive)
    return () => socket.off('chat:receive', handleChatReceive)
  }, [socket])

  // 用 gameState.messages 初始化聊天消息
  useEffect(() => {
    if (gameState?.messages && gameState.messages.length > 0) {
      setChatMessages(gameState.messages)
    }
  }, [gameState])

  return (
    <div className="table-wrapper">
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
            <SettlementContent settlement={lastSettlement} />
          </div>
        )}
      </div>

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
            <SettlementContent settlement={settlement} />
            <button
              className="settlement-continue"
              onClick={() => {
                setSettlement(null)
                if (myPlayer?.chips === 0) {
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

      <ChatBox
        messages={chatMessages}
        onSendMessage={onSendChat}
        myId={myId}
      />
    </div>
  )
}

// 结算内容组件 - 复用给 settlement 弹框和 history 下拉
function SettlementContent({ settlement }) {
  if (!settlement) return null
  return (
    <>
      <div className="settlement-title">本局结算</div>
      <div className="settlement-winner">🏆 {settlement.winnerName} 获胜！</div>

      {settlement.communityCards.length > 0 && (
        <div className="settlement-community">
          <div className="settlement-section-label">公共牌</div>
          <div className="settlement-cards">
            {settlement.communityCards.map((card, i) => {
              const isWinningCard = settlement.winningCommunityCards.some(
                wc => wc.rank === card.rank && wc.suit === card.suit
              )
              return <Card key={i} card={card} dimmed={!isWinningCard} />
            })}
          </div>
        </div>
      )}

      {settlement.showdownPlayers.length > 0 && (
        <div className="settlement-hands">
          <div className="settlement-section-label">亮牌</div>
          {settlement.showdownPlayers.map(p => {
            const isWinner = settlement.winner?.split(',').includes(p.id)
            const isWinningCard = (card) => {
              if (!isWinner || !p.winningCards) return false
              return p.winningCards.some(wc => wc.rank === card.rank && wc.suit === card.suit)
            }
            return (
              <div key={p.id} className="settlement-player-cards">
                <span className={`s-hand-name ${isWinner ? 'winner-hand' : ''}`}>{p.name}</span>
                <div className="settlement-cards">
                  {p.holeCards.map((card, i) => (
                    <Card key={i} card={card} dimmed={!isWinner || !isWinningCard(card)} />
                  ))}
                </div>
              </div>
            )
          })}
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
    </>
  )
}
