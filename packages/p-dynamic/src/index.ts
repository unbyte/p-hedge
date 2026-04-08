export interface DynamicPromise<T> {
  /** Register a new promise. Returns false if already settled. */
  add: (p: Promise<T>) => boolean
  /** The aggregated result promise. */
  promise: Promise<T>
}

/**
 * Resolves with the first fulfilled value.
 * Rejects with AggregateError only when every added promise has rejected.
 */
export function pany<T>(): DynamicPromise<T> {
  let settled = false
  let total = 0
  let rejectedCount = 0
  const errors: unknown[] = []
  const { promise, resolve, reject } = withResolvers<T>()

  function add(p: Promise<T>): boolean {
    if (settled) return false
    // capture index before incrementing so rejection order is preserved
    const index = total++
    p.then(
      (value) => {
        if (settled) return
        settled = true
        resolve(value)
      },
      (reason) => {
        if (settled) return
        errors[index] = reason
        rejectedCount++
        // all registered promises have rejected — give up
        if (rejectedCount === total) {
          settled = true
          reject(new AggregateError(errors, 'All promises were rejected'))
        }
      },
    )
    return true
  }

  return { add, promise }
}

/**
 * Settles with the first promise to resolve or reject, whichever comes first.
 */
export function prace<T>(): DynamicPromise<T> {
  let settled = false
  const { promise, resolve, reject } = withResolvers<T>()

  function add(p: Promise<T>): boolean {
    if (settled) return false
    p.then(
      (value) => {
        if (settled) return
        settled = true
        resolve(value)
      },
      (reason) => {
        if (settled) return
        settled = true
        reject(reason)
      },
    )
    return true
  }

  return { add, promise }
}

function withResolvers<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
