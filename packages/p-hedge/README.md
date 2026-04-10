# p-hedge

Hedging is a latency-reduction technique: instead of waiting for a slow request to time out before retrying, you speculatively launch a duplicate request after a short delay. The first attempt to settle wins and the losers are cancelled via `AbortSignal`. This trades a small amount of extra load for significantly lower tail latency.

See [gRPC request hedging](https://grpc.io/docs/guides/request-hedging/) for a detailed explanation of the concept.

## Installation

```sh
npm install p-hedge
```

## Quick Start

```ts
import { phedge } from 'p-hedge'

const controller = new AbortController()

const data = await phedge(
  (index, signal) => fetch('/api/data', { signal }).then(r => r.json()),
  {
    delay: (index) => index * 200,
    maxHedges: 3,
    timeout: 5000,
    signal: controller.signal,
  }
)
```

This fires attempt `0` immediately. If it hasn't settled after 200 ms, attempt `1` is launched. If that also hasn't settled after 400 ms, attempt `2` is launched, and so on. Whichever settles first wins; the rest are aborted.

## Factory

The `factory` function is called for each attempt and must return a `Promise`. It receives the attempt `index` (0-based) and an `AbortSignal`. Pass the signal to any cancellable API so losing attempts are cleaned up automatically.

```ts
const factory = (index: number, signal: AbortSignal) => {
  console.log(`attempt ${index} started`)
  return fetch('/api/data', { signal }).then(r => r.json())
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `delay` | `number \| (index: number) => number` | `1000` | ms to wait before launching the next attempt |
| `maxHedges` | `number` | `1` | max additional attempts beyond attempt 0 |
| `timeout` | `number` | none | ms before aborting everything and rejecting with `Error('timeout')` |
| `signal` | `AbortSignal` | none | external signal — cancels all in-flight attempts and rejects with `Error('aborted')` |

## License

MIT License
