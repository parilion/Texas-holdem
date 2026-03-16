import GameRoom from './GameRoom.js'

function makeRoom(playerCount = 2) {
  const room = new GameRoom('TEST01')
  for (let i = 0; i < playerCount; i++) {
    room.addPlayer(`player${i}`, `玩家${i}`)
  }
  return room
}

test('创建房间初始状态', () => {
  const room = new GameRoom('TEST01')
  expect(room.phase).toBe('WAITING')
  expect(room.players.length).toBe(0)
})

test('添加玩家', () => {
  const room = makeRoom(2)
  expect(room.players.length).toBe(2)
})

test('开始游戏发手牌', () => {
  const room = makeRoom(2)
  room.startGame()
  expect(room.phase).toBe('PREFLOP')
  room.players.forEach(p => expect(p.holeCards.length).toBe(2))
})

test('大小盲注自动下注', () => {
  const room = makeRoom(2)
  room.startGame()
  const bets = room.players.map(p => p.bet)
  expect(bets).toContain(10) // small blind
  expect(bets).toContain(20) // big blind
})

test('合法的 call 操作', () => {
  const room = makeRoom(2)
  room.startGame()
  const actingPlayer = room.players[room.currentPlayerIndex]
  const chipsBefore = actingPlayer.chips
  room.handleAction(actingPlayer.id, 'call')
  // 玩家已跟注，筹码减少
  expect(actingPlayer.chips).toBeLessThan(chipsBefore + actingPlayer.bet)
})

test('fold 使玩家状态变为 folded', () => {
  const room = makeRoom(2)
  room.startGame()
  const actingPlayer = room.players[room.currentPlayerIndex]
  room.handleAction(actingPlayer.id, 'fold')
  expect(actingPlayer.status).toBe('folded')
})

test('非当前玩家操作被拒绝', () => {
  const room = makeRoom(3)
  room.startGame()
  const wrongPlayer = room.players[(room.currentPlayerIndex + 1) % room.players.length]
  expect(() => room.handleAction(wrongPlayer.id, 'call')).toThrow()
})

test('getPublicState 隐藏他人手牌', () => {
  const room = makeRoom(2)
  room.startGame()
  const state = room.getPublicState('player0')
  const otherPlayer = state.players.find(p => p.id === 'player1')
  expect(otherPlayer.holeCards).toBeNull()
  const self = state.players.find(p => p.id === 'player0')
  expect(self.holeCards).not.toBeNull()
})
