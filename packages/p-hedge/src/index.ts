import { prace } from 'p-dynamic'

export interface HedgeOptions {
  /** ms from the previous attempt before launching the next. Default: 1000 */
  delay?: number | ((index: number) => number)
  /** max additional attempts beyond attempt 0. Default: 1 */
  maxHedges?: number
  /** ms before aborting everything and rejecting with Error('timeout'). Default: none */
  timeout?: number
}

type Tagged<T> = { index: number; ok: true; value: T } | { index: number; ok: false; error: unknown }

export function phedge<T>(factory: (index: number, signal: AbortSignal) => Promise<T>, options: HedgeOptions = {}): Promise<T> {
  const { delay = 1000, maxHedges = 1, timeout } = options
  const getDelay = typeof delay === 'function' ? delay : () => delay

  const { add, promise: taggedPromise } = prace<Tagged<T>>()
  const controllers: AbortController[] = []
  let hedgeTimer: ReturnType<typeof setTimeout> | undefined
  let done = false

  function abort(winner?: number) {
    clearTimeout(hedgeTimer)
    hedgeTimer = undefined
    for (let i = 0; i < controllers.length; i++) {
      if (i !== winner) controllers[i].abort()
    }
  }

  function launch(index: number) {
    const controller = new AbortController()
    controllers.push(controller)
    add(
      factory(index, controller.signal).then(
        (value) => ({ index, ok: true as const, value }),
        (error) => ({ index, ok: false as const, error }),
      ),
    )
    if (index < maxHedges) {
      const next = index + 1
      hedgeTimer = setTimeout(() => {
        if (!done) launch(next)
      }, getDelay(next))
    }
  }

  launch(0)

  const result = new Promise<T>((resolve, reject) => {
    taggedPromise.then((tagged) => {
      if (done) return
      done = true
      abort(tagged.index)
      if (tagged.ok) resolve(tagged.value)
      else reject(tagged.error)
    })

    if (timeout !== undefined) {
      setTimeout(() => {
        if (done) return
        done = true
        abort()
        reject(new Error('timeout'))
      }, timeout)
    }
  })

  return result
}
