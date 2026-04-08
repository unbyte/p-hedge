# p-hedge

Hedging is a latency-reduction technique: instead of waiting for a slow request to time out before retrying, you speculatively launch a duplicate request after a short delay. The first response wins and the losers are cancelled via `AbortSignal`. This trades a small amount of extra load for significantly lower tail latency.

See [gRPC request hedging](https://grpc.io/docs/guides/request-hedging/) for a detailed explanation of the concept.

## Installation

```sh
npm install p-hedge
```

## Quick Start

```ts
import { phedge } from 'p-hedge'

const data = await phedge(
  (index, signal) => fetch('/api/data', { signal }).then(r => r.json()),
  { delay: 500, maxHedges: 2 }
)
```

This fires attempt `0` immediately. If it hasn't resolved after 500 ms, attempt `1` is launched. If that also hasn't resolved after another 500 ms, attempt `2` is launched. Whichever resolves first wins; the rest are aborted.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `delay` | `number \| (index: number) => number` | `1000` | ms to wait before launching the next attempt |
| `maxHedges` | `number` | `1` | max additional attempts beyond attempt 0 |
| `timeout` | `number` | none | ms before aborting everything and rejecting with `Error('timeout')` |

```ts
// dynamic delay — back off between hedges
phedge(factory, {
  delay: (index) => index * 200,
  maxHedges: 3,
  timeout: 5000,
})
```

The `factory` receives the attempt `index` (0-based) and an `AbortSignal`. Pass the signal to any cancellable API so losing attempts are cleaned up automatically.

## License

MIT License