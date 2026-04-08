# p-dynamic

Dynamic versions of `Promise.any` and `Promise.race` — add promises after creation.

## Installation

```sh
npm install p-dynamic
```

## Quick Start

### `pany`

Resolves with the first fulfilled value. Rejects with `AggregateError` only when every added promise has rejected — same semantics as `Promise.any`, but you can keep adding promises after the fact.

```ts
import { pany } from 'p-dynamic'

const { add, promise } = pany<string>()

add(fetch('/api/a').then(r => r.text()))
add(fetch('/api/b').then(r => r.text()))

// later, add more before the first one settles
add(fetch('/api/c').then(r => r.text()))

const result = await promise // first to fulfill wins
```

### `prace`

Settles with the first promise to resolve or reject — same semantics as `Promise.race`, but dynamic.

```ts
import { prace } from 'p-dynamic'

const { add, promise } = prace<string>()

add(fetchWithTimeout('/api/a', 500))
add(fetchWithTimeout('/api/b', 500))

const result = await promise // first to settle (resolve or reject) wins
```

### Concept: dynamic promise aggregation

The standard `Promise.any` / `Promise.race` require all inputs upfront. `p-dynamic` lets you register promises incrementally — useful when you don't know all candidates at the start, or when you want to launch additional attempts lazily.

`add()` returns `false` once the aggregated promise has already settled, so you can safely call it at any time without side effects.

## License

MIT License