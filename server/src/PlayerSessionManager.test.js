import { jest } from '@jest/globals'
import PlayerSessionManager from './PlayerSessionManager.js'

describe('PlayerSessionManager', () => {
  let mgr

  beforeEach(() => {
    mgr = new PlayerSessionManager()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('register 新玩家', () => {
    mgr.register('uuid-1', 'socket-1')
    expect(mgr.getByPlayerId('uuid-1').socketId).toBe('socket-1')
  })

  test('getBySocketId 反查', () => {
    mgr.register('uuid-1', 'socket-1')
    expect(mgr.getBySocketId('socket-1').playerId).toBe('uuid-1')
  })

  test('register 重连更新 socketId 并取消计时', () => {
    mgr.register('uuid-1', 'socket-old')
    const cb = jest.fn()
    mgr.onDisconnect('socket-old', cb)
    mgr.register('uuid-1', 'socket-new') // 模拟重连
    jest.advanceTimersByTime(60000)
    expect(cb).not.toHaveBeenCalled()
    expect(mgr.getByPlayerId('uuid-1').socketId).toBe('socket-new')
  })

  test('onDisconnect 60s 后触发回调', () => {
    mgr.register('uuid-1', 'socket-1')
    const cb = jest.fn()
    mgr.onDisconnect('socket-1', cb)
    expect(cb).not.toHaveBeenCalled()
    jest.advanceTimersByTime(60000)
    expect(cb).toHaveBeenCalledWith('uuid-1')
  })

  test('onDisconnect 超时后记录保留 10 分钟再清除', () => {
    mgr.register('uuid-1', 'socket-1')
    mgr.onDisconnect('socket-1', jest.fn())
    jest.advanceTimersByTime(60000)
    expect(mgr.getByPlayerId('uuid-1')).not.toBeNull()
    jest.advanceTimersByTime(10 * 60 * 1000)
    expect(mgr.getByPlayerId('uuid-1')).toBeNull()
  })

  test('setRoom / clearRoom', () => {
    mgr.register('uuid-1', 'socket-1')
    mgr.setRoom('uuid-1', 'ROOM01')
    expect(mgr.getByPlayerId('uuid-1').roomId).toBe('ROOM01')
    mgr.clearRoom('uuid-1')
    expect(mgr.getByPlayerId('uuid-1').roomId).toBeNull()
  })
})
