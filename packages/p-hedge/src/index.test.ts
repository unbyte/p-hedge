import { describe, expect, it, vi } from 'vitest'
import { phedge } from './index'

// Never-settling promise — intentionally unresolved, no rejection to catch.
function pending<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

// NOTE: with fake timers, setTimeout(0) never auto-advances, so `await promise` would hang.
// Use Promise.resolve() directly for the winning hedge, and always advance timers before awaiting.

describe('phedge', () => {
  it('resolves with attempt 0 when it settles immediately', async () => {
    const factory = vi.fn((_i: number, _s: AbortSignal) => Promise.resolve(42))
    expect(await phedge(factory)).toBe(42)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(factory).toHaveBeenCalledWith(0, expect.any(AbortSignal))
  })

  it('rejects with the first settled rejection (race semantics)', async () => {
    const factory = vi.fn((i: number, _s: AbortSignal) => (i === 0 ? Promise.reject(new Error('fail')) : pending<number>()))
    const err = await phedge(factory, { delay: 1000 }).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('fail')
  })

  it('launches hedge after delay if attempt 0 has not settled', async () => {
    vi.useFakeTimers()
    const factory = vi.fn((_i: number, _s: AbortSignal) => pending<number>())
    phedge(factory, { delay: 100, maxHedges: 1 })
    expect(factory).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(100)
    expect(factory).toHaveBeenCalledTimes(2)
    expect(factory).toHaveBeenNthCalledWith(2, 1, expect.any(AbortSignal))
    vi.useRealTimers()
  })

  it('does not launch hedge if already settled', async () => {
    vi.useFakeTimers()
    const factory = vi.fn((_i: number, _s: AbortSignal) => Promise.resolve(1))
    await phedge(factory, { delay: 100, maxHedges: 1 })
    await vi.advanceTimersByTimeAsync(100)
    expect(factory).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('respects maxHedges cap', async () => {
    vi.useFakeTimers()
    const factory = vi.fn((_i: number, _s: AbortSignal) => pending<number>())
    phedge(factory, { delay: 50, maxHedges: 2 })
    await vi.advanceTimersByTimeAsync(200)
    expect(factory).toHaveBeenCalledTimes(3) // attempt 0 + 2 hedges
    vi.useRealTimers()
  })

  it('supports dynamic delay as relative intervals from previous attempt', async () => {
    vi.useFakeTimers()
    const factory = vi.fn((_i: number, _s: AbortSignal) => pending<number>())
    phedge(factory, { delay: (i) => i * 100, maxHedges: 2 })
    expect(factory).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(100) // delay(1) = 100ms after attempt 0
    expect(factory).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(200) // delay(2) = 200ms after attempt 1
    expect(factory).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })

  it('resolves with hedge winner and aborts loser', async () => {
    vi.useFakeTimers()
    const signals: AbortSignal[] = []
    const factory = vi.fn((i: number, signal: AbortSignal) => {
      signals.push(signal)
      return i === 0 ? pending<number>() : Promise.resolve(99)
    })
    const p = phedge(factory, { delay: 50, maxHedges: 1 })
    await vi.advanceTimersByTimeAsync(50)
    expect(await p).toBe(99)
    expect(signals[0].aborted).toBe(true) // loser aborted
    expect(signals[1].aborted).toBe(false) // winner kept alive
    vi.useRealTimers()
  })

  it('aborts losers but not the rejecting winner', async () => {
    vi.useFakeTimers()
    const signals: AbortSignal[] = []
    const factory = vi.fn((i: number, signal: AbortSignal) => {
      signals.push(signal)
      if (i === 0) return Promise.reject<number>(new Error('fail'))
      return pending<number>()
    })
    await phedge(factory, { delay: 100, maxHedges: 1 }).catch(() => {})
    expect(signals[0].aborted).toBe(false) // winner (rejector) kept alive
    vi.useRealTimers()
  })

  it('rejects with timeout error and aborts all controllers', async () => {
    vi.useFakeTimers()
    const signals: AbortSignal[] = []
    const factory = vi.fn((_i: number, signal: AbortSignal) => {
      signals.push(signal)
      return pending<number>()
    })
    const p = phedge(factory, { delay: 100, maxHedges: 1, timeout: 500 })
    p.catch(() => {}) // pre-catch to avoid unhandled rejection warning
    await vi.advanceTimersByTimeAsync(500)
    const err = await p.catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('timeout')
    expect(signals.every((s) => s.aborted)).toBe(true)
    vi.useRealTimers()
  })
})
