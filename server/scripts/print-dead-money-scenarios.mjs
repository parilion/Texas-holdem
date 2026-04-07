import GameRoom from '../src/game/GameRoom.js'

function setup() {
  const room = new GameRoom('TEST01')
  room.addPlayer('p0', 'A')
  room.addPlayer('p1', 'B')
  room.addPlayer('p2', 'C')
  room.addPlayer('p3', 'D')

  const a = room.players[0]
  const b = room.players[1]
  const c = room.players[2]
  const d = room.players[3]

  room.players.forEach(player => {
    player.chipsBefore = 500
    player.bet = 0
  })

  // A 下注后弃牌（死钱），B/C/D 进入 all-in 分池
  // 投入：A=120(fold), B=200(allin), C=350(allin), D=260(allin)
  a.chips = 380
  b.chips = 300
  c.chips = 150
  d.chips = 240
  a.status = 'folded'
  b.status = 'allin'
  c.status = 'allin'
  d.status = 'allin'

  room.pot = 930
  room.phase = 'RIVER'
  room.communityCards = [
    { suit: 'C', rank: '2' },
    { suit: 'D', rank: '7' },
    { suit: 'H', rank: '9' },
    { suit: 'S', rank: 'J' },
    { suit: 'D', rank: '4' },
  ]

  return { room, a, b, c, d }
}

function printResult(title, room) {
  const rows = room.players.map(p => ({
    player: p.name,
    status: p.status,
    finalChips: p.chips,
    chipChange: p.chips - 500,
  }))
  console.log(`\n=== ${title} ===`)
  console.table(rows)
}

// 1) B 赢主池, C 赢高边池
{
  const { room, a, b, c, d } = setup()
  a.holeCards = [{ suit: 'S', rank: 'A' }, { suit: 'H', rank: 'A' }]
  b.holeCards = [{ suit: 'C', rank: 'K' }, { suit: 'H', rank: 'K' }]
  c.holeCards = [{ suit: 'S', rank: 'T' }, { suit: 'C', rank: 'T' }]
  d.holeCards = [{ suit: 'C', rank: '8' }, { suit: 'H', rank: '8' }]
  room._endRound()
  printResult('Case 1: B wins main, C wins side', room)
}

// 2) C 通吃可争夺奖池
{
  const { room, a, b, c, d } = setup()
  a.holeCards = [{ suit: 'C', rank: '4' }, { suit: 'H', rank: '4' }]
  b.holeCards = [{ suit: 'C', rank: 'K' }, { suit: 'H', rank: 'K' }]
  c.holeCards = [{ suit: 'S', rank: 'A' }, { suit: 'H', rank: 'A' }]
  d.holeCards = [{ suit: 'C', rank: 'Q' }, { suit: 'H', rank: 'Q' }]
  room._endRound()
  printResult('Case 2: C wins all eligible pots', room)
}

// 3) D 赢低层, C 赢最高边池
{
  const { room, a, b, c, d } = setup()
  a.holeCards = [{ suit: 'C', rank: '4' }, { suit: 'H', rank: '4' }]
  b.holeCards = [{ suit: 'C', rank: 'K' }, { suit: 'H', rank: 'K' }]
  c.holeCards = [{ suit: 'C', rank: 'Q' }, { suit: 'H', rank: 'Q' }]
  d.holeCards = [{ suit: 'S', rank: 'A' }, { suit: 'H', rank: 'A' }]
  room._endRound()
  printResult('Case 3: D wins lower layers, C wins top side', room)
}
