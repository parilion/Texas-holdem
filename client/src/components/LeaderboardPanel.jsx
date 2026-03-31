import { useState, useEffect } from 'react'
import { getSocket } from '../hooks/useSocket'
import './LeaderboardPanel.css'

export default function LeaderboardPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [leaderboard, setLeaderboard] = useState([])
  const socket = getSocket()

  useEffect(() => {
    const handleLeaderboardUpdate = (data) => {
      setLeaderboard(data)
    }
    socket.on('leaderboard:update', handleLeaderboardUpdate)
    return () => socket.off('leaderboard:update', handleLeaderboardUpdate)
  }, [socket])

  return (
    <div className={`leaderboard-panel ${isOpen ? 'open' : ''}`}>
      <button
        className="leaderboard-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? '› 积分榜' : '‹ 积分榜'}
      </button>

      {isOpen && (
        <div className="leaderboard-content">
          <div className="leaderboard-title">📊 积分榜</div>
          {leaderboard.length === 0 ? (
            <div className="leaderboard-empty">暂无数据</div>
          ) : (
            <div className="leaderboard-list">
              {leaderboard.map((entry, index) => (
                <div key={entry.id} className="leaderboard-row">
                  <span className="lb-rank">{index + 1}</span>
                  <span className="lb-name">{entry.name}</span>
                  <span className={`lb-change ${entry.totalChange >= 0 ? 'positive' : 'negative'}`}>
                    {entry.totalChange >= 0 ? '+' : ''}{entry.totalChange}
                  </span>
                  <span className="lb-chips">💰 {entry.currentChips}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
