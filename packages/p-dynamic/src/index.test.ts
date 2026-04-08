import { describe, expect, it } from 'vitest'
import { pany, prace } from './index'

// Creates a pre-caught rejected promise to avoid unhandled rejection warnings
// when the rejection is intentionally discarded (e.g. passed to add() after settlement).
function rejected<T>(reason: unknown): Promise<T> {
  const p = Promise.reject<T>(reason)
  p.catch(() => {})
  return p
}

// Creates a promise that resolves after a delay.
function delayed<T>(ms: number, value: T): Promise<T> {
  return new Promise((res) => setTimeout(() => res(value), ms))
}

// Creates a promise that rejects after a delay.
function delayedReject<T>(ms: number, reason: unknown): Promise<T> {
  return new Promise((_, rej) => setTimeout(() => rej(reason), ms))
}

describe('prace', () => {
  it('resolves with the first resolved promise', async () => {
    const { add, promise } = prace<number>()
    add(Promise.resolve(1))
    add(delayed(50, 2))
    expect(await promise).toBe(1)
  })

  it('rejects with the first settled promise that rejects', async () => {
    const { add, promise } = prace<number>()
    add(delayedReject(10, new Error('fast-reject')))
    add(delayed(50, 1))
    const err = await promise.catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('fast-reject')
  })

  it('settles with a promise added via setTimeout before a slower initial one', async () => {
    const { add, promise } = prace<string>()
    add(delayed(100, 'slow'))
    const timer = setTimeout(() => add(Promise.resolve('fast')), 20)
    const result = await promise
    clearTimeout(timer)
    expect(result).toBe('fast')
  })

  it('accepts adds before settlement and returns false after', async () => {
    const { add, promise } = prace<number>()
    add(delayed(50, 99))
    const earlyResult = await new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(add(Promise.resolve(1))), 10)
    })
    expect(earlyResult).toBe(true)
    await promise
    expect(add(rejected<number>(new Error('late')))).toBe(false)
  })
})

describe('pany', () => {
  it('resolves with the first fulfilled promise', async () => {
    const { add, promise } = pany<number>()
    add(delayedReject(50, new Error('slow')))
    add(Promise.resolve(42))
    expect(await promise).toBe(42)
  })

  it('errors array is dense and in insertion order regardless of rejection order', async () => {
    const { add, promise } = pany<number>()
    const e0 = new Error('first-added')
    const e1 = new Error('second-added')
    // e1's promise rejects first by timing, but must appear at index 1
    add(delayedReject(30, e0))
    add(delayedReject(10, e1))
    const err = await promise.catch((e) => e)
    expect(err).toBeInstanceOf(AggregateError)
    expect(err.errors).toHaveLength(2)
    expect(err.errors[0]).toBe(e0)
    expect(err.errors[1]).toBe(e1)
  })

  it('resolves when a promise added via setTimeout fulfills before all rejections complete', async () => {
    const { add, promise } = pany<string>()
    add(delayedReject(80, new Error('r1')))
    add(delayedReject(90, new Error('r2')))
    const timer = setTimeout(() => add(Promise.resolve('winner')), 20)
    const result = await promise
    clearTimeout(timer)
    expect(result).toBe('winner')
  })

  it('rejects with AggregateError after all pre-registered promises reject', async () => {
    const { add, promise } = pany<number>()
    add(delayedReject(10, new Error('first')))
    add(delayedReject(20, new Error('second')))
    add(delayedReject(30, new Error('third')))
    const err = await promise.catch((e) => e)
    expect(err).toBeInstanceOf(AggregateError)
    expect(err.errors).toHaveLength(3)
  })

  it('accepts adds before resolution and returns false after', async () => {
    const { add, promise } = pany<number>()
    add(Promise.resolve(1))
    await promise
    expect(add(rejected<number>(new Error('late')))).toBe(false)
  })
})
