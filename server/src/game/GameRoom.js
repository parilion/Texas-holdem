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
    this.pots = [] // [{ amount, eligiblePlayers? }] - side pot 系统
    this.currentBet = 0
    this.currentPlayerIndex = 0
    this.dealer = 0
    this.deck = null
    this.turnTimer = null
    this.lastAggressor = -1 // 最后一个加注的玩家索引
    this.onStateChange = null // 回调：状态变更时通知外部
  }

  addPlayer(id, name) {
    if (this.phase !== 'WAITING') throw new Error('游戏已开始，无法加入')
    if (this.players.length >= 9) throw new Error('房间已满')
    if (this.players.find(p => p.id === id)) return
    const isFirstPlayer = this.players.length === 0
    this.players.push({
      id, name,
      chips: STARTING_CHIPS,
      bet: 0,
      holeCards: [],
      status: 'waiting', // ready | waiting | active | folded | allin | out | disconnected
      isDealer: isFirstPlayer, // 第一个玩家为房主
    })
    if (isFirstPlayer) {
      this.dealer = 0
    }
  }

  removePlayer(id) {
    const playerIndex = this.players.findIndex(p => p.id === id)
    const wasDealer = this.players[playerIndex]?.isDealer

    this.players = this.players.filter(p => p.id !== id)

    // 如果被移除的是房主，将房主顺延给下一位玩家
    if (wasDealer && this.players.length > 0) {
      // 找到被移除玩家的位置，下一位玩家成为新房主
      this.dealer = playerIndex % this.players.length
      this.players[this.dealer].isDealer = true
    } else if (playerIndex < this.dealer) {
      // 如果移除的玩家在当前庄家之前，调整庄家索引
      this.dealer = (this.dealer - 1 + this.players.length) % this.players.length
    }
  }

  setReady(playerId, ready) {
    const player = this.players.find(p => p.id === playerId)
    if (!player) return
    if (player.status !== 'ready' && player.status !== 'waiting') return
    player.status = ready ? 'ready' : 'waiting'
    this._notifyChange()
  }

  startGame() {
    if (this.players.length < 2) throw new Error('至少需要 2 名玩家')
    if (this.phase !== 'WAITING') throw new Error('游戏已在进行中')

    // 检查所有非房主玩家是否都已准备（房主无需按准备）
    const allReady = this.players.every(p => p.isDealer || p.status === 'ready' || p.status === 'out')
    if (!allReady) throw new Error('还有人没准备')

    this.deck = new Deck().shuffle()
    this.communityCards = []
    this.pot = 0
    this.pots = [{ amount: 0 }]
    this.currentBet = BIG_BLIND
    this.lastAggressor = -1 // 重置

    // 重置玩家状态（'out' 玩家跳过，保持淘汰状态）
    this.players.forEach(p => {
      p.holeCards = []
      p.bet = 0
      p.hasActed = false // 本轮是否已行动
      p.isDealer = false
      if (p.status === 'out') return
      p.chipsBefore = p.chips // 记录本局开始时筹码，用于结算盈亏
      p.status = 'active'
    })

    // 检查参与本局的玩家数
    const activePlayers = this.players.filter(p => p.status !== 'out')
    if (activePlayers.length < 2) throw new Error('参与玩家不足 2 人')

    // 设置庄家（跳过 'out' 玩家）
    this.dealer = this.dealer % this.players.length
    while (this.players[this.dealer].status === 'out') {
      this.dealer = (this.dealer + 1) % this.players.length
    }
    this.players[this.dealer].isDealer = true

    // 发手牌（仅非 out 玩家）
    this.players.forEach(p => {
      if (p.status !== 'out') p.holeCards = this.deck.deal(2)
    })

    // 找下一个非 out 玩家的辅助函数
    const nextActive = (from) => {
      let idx = (from + 1) % this.players.length
      while (this.players[idx].status === 'out') {
        idx = (idx + 1) % this.players.length
      }
      return idx
    }

    // 收盲注
    const sbIndex = nextActive(this.dealer)
    const bbIndex = nextActive(sbIndex)
    this._postBlind(sbIndex, SMALL_BLIND)
    this._postBlind(bbIndex, BIG_BLIND)

    // preflop 第一个操作者是 bb 之后
    this.currentPlayerIndex = nextActive(bbIndex)
    this.phase = 'PREFLOP'

    this._notifyChange()
  }

  _postBlind(index, amount) {
    const player = this.players[index]
    const actual = Math.min(amount, player.chips)
    player.chips -= actual
    player.bet = actual
    player.hasActed = true // 盲注视为已行动，无人加注时无需再次行动
    this.pot += actual
    if (this.pots.length > 0) this.pots[0].amount += actual
    if (player.chips === 0) player.status = 'allin'
  }

  handleAction(playerId, action, amount = 0) {
    const player = this.players[this.currentPlayerIndex]
    if (player.id !== playerId) throw new Error('不是你的回合')
    if (player.status !== 'active') throw new Error('玩家状态不允许操作')

    player.hasActed = true // 标记已行动

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
        if (this.pots.length > 0) this.pots[0].amount += toCall
        player.bet += toCall
        if (player.chips === 0) player.status = 'allin'
        break
      }
      case 'raise': {
        const minRaiseAmount = this.currentBet + Math.max(BIG_BLIND, this.currentBet)
        // 只有筹码足够的情况下才验证最小加注额
        if (player.bet + player.chips >= minRaiseAmount && amount < minRaiseAmount) {
          throw new Error(`最小加注额为 ${minRaiseAmount}`)
        }
        if (amount <= this.currentBet) throw new Error('加注金额必须大于当前注')
        const toAdd = Math.min(amount - player.bet, player.chips)
        player.chips -= toAdd
        this.pot += toAdd
        if (this.pots.length > 0) this.pots[0].amount += toAdd
        player.bet += toAdd
        // ✅ 只有 player.bet 超过 currentBet 才更新，防止降低
        if (player.bet > this.currentBet) {
          this.currentBet = player.bet
          this.lastAggressor = this.currentPlayerIndex
          this.players.forEach(p => { if (p.status === 'active') p.hasActed = false })
          player.hasActed = true
        }
        if (player.chips === 0) player.status = 'allin'
        break
      }
      case 'allin': {
        // 有效投入上限：不超过声明的 allin 金额，也不超过任意对手的最大可投入总额
        const opponents = this.players.filter(
          p => p.id !== player.id && (p.status === 'active' || p.status === 'allin')
        )
        const maxOpponentTotal = opponents.length > 0
          ? Math.max(...opponents.map(p => p.bet + p.chips))
          : player.bet + player.chips
        const effectiveTotal = Math.min(amount, maxOpponentTotal)
        const allInAmount = Math.max(0, effectiveTotal - player.bet)

        this.pot += allInAmount
        if (this.pots.length > 0) this.pots[0].amount += allInAmount
        player.bet += allInAmount
        player.chips -= allInAmount

        if (player.bet > this.currentBet) {
          this.currentBet = player.bet
          this.lastAggressor = this.currentPlayerIndex
          this.players.forEach(p => { if (p.status === 'active') p.hasActed = false })
          player.hasActed = true
        }
        player.status = 'allin'
        break
      }
      default:
        throw new Error('未知操作: ' + action)
    }

    this._advance()
  }

  _advance() {
    // 先将所有 disconnected 玩家自动 fold（断线宽限期内轮到该玩家时自动 fold）
    // 注：disconnected 状态由 index.js 的 disconnect 事件处理器负责设置
    this.players.forEach(p => {
      if (p.status === 'disconnected') p.status = 'folded'
    })

    // 检查是否只剩一人活跃（包含 allin 状态）
    const active = this.players.filter(p => p.status === 'active' || p.status === 'allin')
    const canAct = this.players.filter(p => p.status === 'active')

    // 如果没有可行动的玩家（所有人都 ALL IN 或弃牌），进入下一阶段
    if (canAct.length === 0) {
      return this._nextPhase()
    }

    // 如果只剩一人活跃，直接结束这轮
    if (active.length <= 1) {
      return this._endRound()
    }

    // 判断本轮是否下注结束（所有 active 玩家 bet 相同且都行动过）
    if (this._bettingRoundComplete()) {
      return this._nextPhase()
    }

    // 找下一个可操作玩家（用计数器防止死循环）
    let next = (this.currentPlayerIndex + 1) % this.players.length
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[next]?.status === 'active') break
      next = (next + 1) % this.players.length
    }

    this.currentPlayerIndex = next
    this._notifyChange()
  }

  _bettingRoundComplete() {
    // 只检查仍可行动的玩家（allin 玩家已无法行动，不参与此判断）
    const activePlayers = this.players.filter(p => p.status === 'active')
    return activePlayers.every(p => p.hasActed) &&
           activePlayers.every(p => p.bet === this.currentBet)
  }

  _nextPhase() {
    // 重置本轮 bet 和 hasActed
    this.players.forEach(p => {
      if (p.status === 'active') {
        p.bet = 0
        p.hasActed = false
      }
    })
    this.currentBet = 0
    this.lastAggressor = -1

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
    let startLoop = 0
    while (
      (this.players[start].status === 'folded' ||
       this.players[start].status === 'out' ||
       this.players[start].status === 'allin' ||
       this.players[start].status === 'disconnected') &&
      startLoop < this.players.length
    ) {
      start = (start + 1) % this.players.length
      startLoop++
    }
    this.currentPlayerIndex = start
    this._notifyChange()

    // 若无人可行动（全员 allin），自动推进到下一阶段（每张牌展示 1.5 秒）
    const canAct = this.players.filter(p => p.status === 'active')
    if (canAct.length === 0) {
      setTimeout(() => { if (this.phase !== 'WAITING') this._nextPhase() }, 500)
    }
  }

  _endRound() {
    this.phase = 'SHOWDOWN'
    const activePlayers = this.players.filter(p => p.status === 'active' || p.status === 'allin')

    let winners = []
    let showdownPlayers = []
    let winningCommunityCards = []

    if (activePlayers.length === 1) {
      // 弃牌获胜：不展示手牌对比，公共牌全部正常显示（不置灰）
      winners = [activePlayers[0]]
      winningCommunityCards = [...this.communityCards]
    } else {
      const allCards = this.communityCards
      const evaluated = activePlayers.map(p => ({
        player: p,
        hand: HandEvaluator.evaluate([...p.holeCards, ...allCards])
      }))
      evaluated.sort((a, b) => HandEvaluator.compare(b.hand, a.hand))
      const topHand = evaluated[0].hand
      // 找出所有手牌相同强度的赢家（Split Pot）
      winners = evaluated
        .filter(e => HandEvaluator.compare(e.hand, topHand) === 0)
        .map(e => e.player)

      const winnerIds = new Set(winners.map(w => w.id))

      // 计算每位摊牌玩家的手牌及胜利牌
      showdownPlayers = evaluated.map(e => {
        const isWinner = winnerIds.has(e.player.id)
        const winningCards = isWinner
          ? HandEvaluator.getWinningCards(e.player.holeCards, allCards, e.hand.bestCombo).winningCards
          : []
        return {
          id: e.player.id,
          name: e.player.name,
          holeCards: e.player.holeCards,
          handName: e.hand.name,
          winningCards,
        }
      })

      // 胜者最佳牌型中属于公共牌的部分
      const winnerEval = evaluated.find(e => winnerIds.has(e.player.id))
      winningCommunityCards = winnerEval.hand.bestCombo.filter(card =>
        allCards.some(cc => cc.rank === card.rank && cc.suit === card.suit)
      )
    }

    // 退还超额筹码（单赢家场景才需要）
    if (winners.length === 1) {
      const winner = winners[0]
      const winnerContrib = (winner.chipsBefore ?? winner.chips) - winner.chips
      this.players.forEach(p => {
        if (p.id === winner.id) return
        if (p.status === 'out') return
        const pContrib = (p.chipsBefore ?? p.chips) - p.chips
        const excess = Math.max(0, pContrib - winnerContrib)
        if (excess > 0) {
          p.chips += excess
          this.pot -= excess
          if (this.pots.length > 0) this.pots[0].amount -= excess
        }
      })
      winners[0].chips += this.pot
      if (this.pots.length > 0) this.pots[0].amount = this.pot
    } else {
      // Split Pot：均分底池，奇数筹码给第一位赢家
      const share = Math.floor(this.pot / winners.length)
      winners.forEach(w => { w.chips += share })
      const remainder = this.pot % winners.length
      if (remainder > 0) winners[0].chips += remainder
      if (this.pots.length > 0) this.pots[0].amount = this.pot
    }

    const winner = winners[0]
    const winAmount = this.pot
    this.pot = 0
    if (this.pots.length > 0) this.pots[0].amount = 0

    const playerResults = this.players.map(p => ({
      id: p.id,
      name: p.name,
      chipChange: p.status === 'out' ? 0 : p.chips - (p.chipsBefore ?? p.chips),
      chips: p.chips,
    }))

    this._notifyChange({
      winner: winners.map(w => w.id).join(','),
      winnerName: winners.length === 1 ? winner.name : winners.map(w => w.name).join(' & '),
      winnerChips: winAmount,
      playerResults,
      showdownPlayers,
      winningCommunityCards,
    })

    // 准备下局
    setTimeout(() => {
      // ✅ 防护：玩家可能在延迟期间离开，或已被外部重置
      if (this.players.length === 0) return
      if (this.phase === 'WAITING') return
      const livingPlayers = this.players.filter(p => p.status !== 'out')
      if (livingPlayers.length === 0) return

      this.phase = 'WAITING'
      this.players.forEach(p => {
        p.isDealer = false
        if (p.chips <= 0) p.status = 'out'  // 标记无筹码玩家，不再自动踢出，由玩家自行选择补筹或离开
        else p.status = 'ready'
      })
      // dealer 推进，跳过 'out' 玩家，用计数器防止无限循环
      this.dealer = (this.dealer + 1) % this.players.length
      let loopCount = 0
      while (this.players[this.dealer]?.status === 'out' && loopCount < this.players.length) {
        this.dealer = (this.dealer + 1) % this.players.length
        loopCount++
      }
      if (this.players[this.dealer]) {
        this.players[this.dealer].isDealer = true
      }
      this._notifyChange({})
    }, 1000)
  }

  // 游戏中途人数不足时，重置为等待界面（只保留仍在线的玩家）
  resetToWaiting(connectedIds) {
    this.players = this.players.filter(p => connectedIds.includes(p.id))
    this.phase = 'WAITING'
    this.communityCards = []
    this.pot = 0
    this.pots = []
    this.currentBet = 0
    this.lastAggressor = -1
    this.deck = null
    this.currentPlayerIndex = 0
    this.players.forEach(p => {
      p.bet = 0
      p.holeCards = []
      p.hasActed = false
      p.isDealer = false
      p.status = 'waiting'
    })
    if (this.players.length > 0) {
      this.dealer = 0
      this.players[0].isDealer = true
    }
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
