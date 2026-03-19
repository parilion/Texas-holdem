import GameRoom from './GameRoom.js'

function makeRoom(playerCount = 2) {
  const room = new GameRoom('TEST01')
  for (let i = 0; i < playerCount; i++) {
    room.addPlayer(`player${i}`, `玩家${i}`)
  }
  return room
}

// 让所有非房主玩家准备好，然后开始游戏
function startGame(room) {
  room.players.forEach(p => {
    if (!p.isDealer) room.setReady(p.id, true)
  })
  room.startGame()
}

test('创建房间初始状态', () => {
  const room = new GameRoom('TEST01')
  expect(room.phase).toBe('WAITING')
  expect(room.players.length).toBe(0)
})

test('pots array initialized as empty on room creation', () => {
  const room = new GameRoom('TEST01')
  expect(room.pots).toEqual([])
})

test('main pot is created with initial pot', () => {
  const room = new GameRoom('TEST01')
  room.addPlayer('p0', 'A')
  room.addPlayer('p1', 'B')
  room.players.forEach(p => { if (!p.isDealer) room.setReady(p.id, true) })
  room.startGame()
  // After blinds, a main pot should exist
  expect(room.pots.length).toBeGreaterThan(0)
  expect(room.pots[0].amount).toBe(30) // 10 + 20 blinds
})

test('添加玩家', () => {
  const room = makeRoom(2)
  expect(room.players.length).toBe(2)
})

test('开始游戏发手牌', () => {
  const room = makeRoom(2)
  startGame(room)
  expect(room.phase).toBe('PREFLOP')
  room.players.forEach(p => expect(p.holeCards.length).toBe(2))
})

test('大小盲注自动下注', () => {
  const room = makeRoom(2)
  startGame(room)
  const bets = room.players.map(p => p.bet)
  expect(bets).toContain(10) // small blind
  expect(bets).toContain(20) // big blind
})

test('合法的 call 操作', () => {
  const room = makeRoom(2)
  startGame(room)
  const actingPlayer = room.players[room.currentPlayerIndex]
  const chipsBefore = actingPlayer.chips
  room.handleAction(actingPlayer.id, 'call')
  // 玩家已跟注，筹码减少
  expect(actingPlayer.chips).toBeLessThan(chipsBefore + actingPlayer.bet)
})

test('fold 使玩家状态变为 folded', () => {
  const room = makeRoom(2)
  startGame(room)
  const actingPlayer = room.players[room.currentPlayerIndex]
  room.handleAction(actingPlayer.id, 'fold')
  expect(actingPlayer.status).toBe('folded')
})

test('非当前玩家操作被拒绝', () => {
  const room = makeRoom(3)
  startGame(room)
  const wrongPlayer = room.players[(room.currentPlayerIndex + 1) % room.players.length]
  expect(() => room.handleAction(wrongPlayer.id, 'call')).toThrow()
})

test('getPublicState 隐藏他人手牌', () => {
  const room = makeRoom(2)
  startGame(room)
  const state = room.getPublicState('player0')
  const otherPlayer = state.players.find(p => p.id === 'player1')
  expect(otherPlayer.holeCards).toBeNull()
  const self = state.players.find(p => p.id === 'player0')
  expect(self.holeCards).not.toBeNull()
})

// ——— 翻牌圈推进专项测试 ———

test('2人局：SB跟注后直接进入翻牌圈（无需BB点过牌）', () => {
  const room = makeRoom(2)
  startGame(room)
  // dealer=player0(BB), player1=SB 先行动
  expect(room.phase).toBe('PREFLOP')

  const sb = room.players[room.currentPlayerIndex]
  room.handleAction(sb.id, 'call')            // SB 跟注
  expect(room.phase).toBe('FLOP')             // 无人加注，直接进翻牌圈
  expect(room.communityCards.length).toBe(3)
})

test('3人局：UTG/SB各跟注后直接进入翻牌圈', () => {
  const room = makeRoom(3)
  startGame(room)
  // dealer=player0, SB=player1, BB=player2, UTG=player0 先行动
  expect(room.phase).toBe('PREFLOP')

  const utg = room.players[room.currentPlayerIndex]
  room.handleAction(utg.id, 'call')           // UTG 跟注
  expect(room.phase).toBe('PREFLOP')

  const sb = room.players[room.currentPlayerIndex]
  room.handleAction(sb.id, 'call')            // SB 跟注后直接翻牌
  expect(room.phase).toBe('FLOP')
  expect(room.communityCards.length).toBe(3)
})

test('翻牌圈全员过牌 → 进入转牌圈', () => {
  const room = makeRoom(2)
  startGame(room)
  // 先走完翻前
  room.handleAction(room.players[room.currentPlayerIndex].id, 'call')
  room.handleAction(room.players[room.currentPlayerIndex].id, 'check')
  expect(room.phase).toBe('FLOP')

  // 翻牌圈：两人各过牌
  room.handleAction(room.players[room.currentPlayerIndex].id, 'check')
  room.handleAction(room.players[room.currentPlayerIndex].id, 'check')
  expect(room.phase).toBe('TURN')
  expect(room.communityCards.length).toBe(4)
})

test('全程过牌到摊牌', () => {
  const room = makeRoom(2)
  startGame(room)
  // 翻前
  room.handleAction(room.players[room.currentPlayerIndex].id, 'call')
  room.handleAction(room.players[room.currentPlayerIndex].id, 'check')
  // 翻牌
  room.handleAction(room.players[room.currentPlayerIndex].id, 'check')
  room.handleAction(room.players[room.currentPlayerIndex].id, 'check')
  // 转牌
  room.handleAction(room.players[room.currentPlayerIndex].id, 'check')
  room.handleAction(room.players[room.currentPlayerIndex].id, 'check')
  // 河牌
  room.handleAction(room.players[room.currentPlayerIndex].id, 'check')
  room.handleAction(room.players[room.currentPlayerIndex].id, 'check')
  expect(room.phase).toBe('SHOWDOWN')
  expect(room.communityCards.length).toBe(5)
})

test('一人弃牌 → 另一人赢得底池', () => {
  const room = makeRoom(2)
  startGame(room)
  const folder = room.players[room.currentPlayerIndex]
  const winner = room.players.find(p => p.id !== folder.id)
  const chipsBefore = winner.chips
  room.handleAction(folder.id, 'fold')
  expect(room.phase).toBe('SHOWDOWN')
  expect(winner.chips).toBeGreaterThan(chipsBefore)
})

test('_advance 遇到 disconnected 玩家时自动 fold 并跳过', () => {
  const room = new GameRoom('R1')
  room.addPlayer('p1', 'Alice')
  room.addPlayer('p2', 'Bob')
  room.addPlayer('p3', 'Charlie')

  // 手动模拟 PREFLOP 阶段状态
  room.phase = 'PREFLOP'
  room.players[0].status = 'active'
  room.players[0].bet = 20
  room.players[0].hasActed = true
  room.players[1].status = 'disconnected' // Bob 断线
  room.players[1].bet = 0
  room.players[1].hasActed = false
  room.players[2].status = 'active'
  room.players[2].bet = 20
  room.players[2].hasActed = false // Charlie 还未行动，回合未结束
  room.currentBet = 20
  room.currentPlayerIndex = 0 // Alice 刚行动完

  room._advance()

  // Bob 应被自动 fold
  expect(room.players[1].status).toBe('folded')
  // 当前操作者应跳过 Bob，精确为 Charlie（index 2）
  expect(room.currentPlayerIndex).toBe(2)
})

test('_advance 所有其他玩家断线时自动进入结算', () => {
  const room = new GameRoom('R1')
  room.addPlayer('p1', 'Alice')
  room.addPlayer('p2', 'Bob')
  room.addPlayer('p3', 'Charlie')

  // 仅 Alice 是 active，Bob 和 Charlie 都断线
  room.phase = 'PREFLOP'
  room.players[0].status = 'active'
  room.players[0].chips = 980
  room.players[0].bet = 20
  room.players[0].hasActed = true
  room.players[0].holeCards = [{ suit: 'H', rank: 'A' }, { suit: 'D', rank: 'K' }]
  room.players[1].status = 'disconnected'
  room.players[1].chips = 980
  room.players[1].bet = 20
  room.players[1].holeCards = [{ suit: 'S', rank: '2' }, { suit: 'C', rank: '3' }]
  room.players[2].status = 'disconnected'
  room.players[2].chips = 960
  room.players[2].bet = 40
  room.players[2].holeCards = [{ suit: 'H', rank: '5' }, { suit: 'D', rank: '6' }]
  room.currentBet = 20
  room.currentPlayerIndex = 0
  room.pot = 80
  let notified = false
  room.onStateChange = () => { notified = true }

  room._advance()

  // Bob 和 Charlie 应被自动 fold
  expect(room.players[1].status).toBe('folded')
  expect(room.players[2].status).toBe('folded')
  // 游戏应进入 SHOWDOWN 阶段（而非挂起等待）
  expect(room.phase).toBe('SHOWDOWN')
  // 状态变更通知应被触发
  expect(notified).toBe(true)
})
