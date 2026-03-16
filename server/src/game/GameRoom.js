import Deck from './Deck.js'
import HandEvaluator from './HandEvaluator.js'

const SMALL_BLIND = 10
const BIG_BLIND = 20
const STARTING_CHIPS = 1000
const TURN_TIMEOUT = 30000

const PHASES = ['WAITING', 'PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN']

export default class GameRoom {
  constructor(roomId) {
    this.roomId = roomId
    this.phase = 'WAITING'
    this.players = []
    this.communityCards = []
    this.pot = 0
    this.currentBet = 0
    this.currentPlayerIndex = 0
    this.dealer = 0
    this.deck = null
    this.turnTimer = null
    this.onStateChange = null // 回调：状态变更时通知外部
  }

  addPlayer(id, name) {
    if (this.phase !== 'WAITING') throw new Error('游戏已开始，无法加入')
    if (this.players.length >= 9) throw new Error('房间已满')
    if (this.players.find(p => p.id === id)) return
    this.players.push({
      id, name,
      chips: STARTING_CHIPS,
      bet: 0,
      holeCards: [],
      status: 'waiting', // waiting | active | folded | allin | out
      isDealer: false,
    })
  }

  removePlayer(id) {
    this.players = this.players.filter(p => p.id !== id)
  }

  startGame() {
    if (this.players.length < 2) throw new Error('至少需要 2 名玩家')
    if (this.phase !== 'WAITING') throw new Error('游戏已在进行中')

    this.deck = new Deck().shuffle()
    this.communityCards = []
    this.pot = 0
    this.currentBet = BIG_BLIND

    // 重置玩家状态
    this.players.forEach(p => {
      p.holeCards = []
      p.bet = 0
      p.status = 'active'
      p.isDealer = false
    })

    // 设置庄家
    this.dealer = this.dealer % this.players.length
    this.players[this.dealer].isDealer = true

    // 发手牌（每人 2 张）
    this.players.forEach(p => {
      p.holeCards = this.deck.deal(2)
    })

    // 收盲注
    const sbIndex = (this.dealer + 1) % this.players.length
    const bbIndex = (this.dealer + 2) % this.players.length
    this._postBlind(sbIndex, SMALL_BLIND)
    this._postBlind(bbIndex, BIG_BLIND)

    // preflop 第一个操作者是 bb 之后
    this.currentPlayerIndex = (bbIndex + 1) % this.players.length
    this.phase = 'PREFLOP'

    this._notifyChange()
  }

  _postBlind(index, amount) {
    const player = this.players[index]
    const actual = Math.min(amount, player.chips)
    player.chips -= actual
    player.bet = actual
    this.pot += actual
    if (player.chips === 0) player.status = 'allin'
  }

  handleAction(playerId, action, amount = 0) {
    const player = this.players[this.currentPlayerIndex]
    if (player.id !== playerId) throw new Error('不是你的回合')
    if (player.status !== 'active') throw new Error('玩家状态不允许操作')

    switch (action) {
      case 'fold':
        player.status = 'folded'
        break
      case 'check':
        if (this.currentBet > player.bet) throw new Error('当前有注，无法 check')
        break
      case 'call': {
        const toCall = Math.min(this.currentBet - player.bet, player.chips)
        player.chips -= toCall
        this.pot += toCall
        player.bet += toCall
        if (player.chips === 0) player.status = 'allin'
        break
      }
      case 'raise': {
        if (amount <= this.currentBet) throw new Error('加注金额必须大于当前注')
        const toAdd = Math.min(amount - player.bet, player.chips)
        player.chips -= toAdd
        this.pot += toAdd
        player.bet += toAdd
        this.currentBet = player.bet
        if (player.chips === 0) player.status = 'allin'
        break
      }
      case 'allin': {
        const allInAmount = player.chips
        this.pot += allInAmount
        player.bet += allInAmount
        player.chips = 0
        if (player.bet > this.currentBet) this.currentBet = player.bet
        player.status = 'allin'
        break
      }
      default:
        throw new Error('未知操作: ' + action)
    }

    this._advance()
  }

  _advance() {
    // 检查是否只剩一人活跃
    const active = this.players.filter(p => p.status === 'active' || p.status === 'allin')
    const canAct = this.players.filter(p => p.status === 'active')

    if (canAct.length <= 1 && active.length <= 1) {
      return this._endRound()
    }

    // 判断本轮是否下注结束（所有 active 玩家 bet 相同且都行动过）
    if (this._bettingRoundComplete()) {
      return this._nextPhase()
    }

    // 找下一个可操作玩家
    let next = (this.currentPlayerIndex + 1) % this.players.length
    while (this.players[next].status !== 'active') {
      next = (next + 1) % this.players.length
      if (next === this.currentPlayerIndex) break
    }
    this.currentPlayerIndex = next
    this._notifyChange()
  }

  _bettingRoundComplete() {
    return this.players
      .filter(p => p.status === 'active')
      .every(p => p.bet === this.currentBet)
  }

  _nextPhase() {
    // 重置本轮 bet
    this.players.forEach(p => { if (p.status === 'active') p.bet = 0 })
    this.currentBet = 0

    const phaseOrder = ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN']
    const idx = phaseOrder.indexOf(this.phase)
    this.phase = phaseOrder[idx + 1] || 'SHOWDOWN'

    if (this.phase === 'FLOP') {
      this.communityCards.push(...this.deck.deal(3))
    } else if (this.phase === 'TURN' || this.phase === 'RIVER') {
      this.communityCards.push(...this.deck.deal(1))
    } else if (this.phase === 'SHOWDOWN') {
      return this._endRound()
    }

    // 从庄家左手边第一个活跃玩家开始
    let start = (this.dealer + 1) % this.players.length
    while (this.players[start].status === 'folded' || this.players[start].status === 'out') {
      start = (start + 1) % this.players.length
    }
    this.currentPlayerIndex = start
    this._notifyChange()
  }

  _endRound() {
    this.phase = 'SHOWDOWN'
    const activePlayers = this.players.filter(p => p.status === 'active' || p.status === 'allin')

    let winner
    if (activePlayers.length === 1) {
      winner = activePlayers[0]
    } else {
      // 评判手牌
      const allCards = this.communityCards
      const evaluated = activePlayers.map(p => ({
        player: p,
        hand: HandEvaluator.evaluate([...p.holeCards, ...allCards])
      }))
      evaluated.sort((a, b) => HandEvaluator.compare(b.hand, a.hand))
      winner = evaluated[0].player
    }

    winner.chips += this.pot
    this.pot = 0

    this._notifyChange({ winner: winner.id, winnerName: winner.name })

    // 准备下局
    setTimeout(() => {
      this.phase = 'WAITING'
      this.dealer = (this.dealer + 1) % this.players.length
      this.players.forEach(p => {
        if (p.chips <= 0) p.status = 'out'
        else p.status = 'waiting'
      })
      this._notifyChange()
    }, 5000)
  }

  getPublicState(viewerId) {
    return {
      roomId: this.roomId,
      phase: this.phase,
      pot: this.pot,
      communityCards: this.communityCards,
      currentBet: this.currentBet,
      currentPlayerIndex: this.currentPlayerIndex,
      dealer: this.dealer,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        status: p.status,
        isDealer: p.isDealer,
        holeCards: (p.id === viewerId || this.phase === 'SHOWDOWN') ? p.holeCards : null,
        cardCount: p.holeCards.length,
      }))
    }
  }

  _notifyChange(extra = {}) {
    if (this.onStateChange) this.onStateChange(extra)
  }
}
