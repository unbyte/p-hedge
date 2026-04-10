# p-hedge

Request hedging for promises — launch redundant attempts with a delay and take the first to settle. See [gRPC request hedging](https://grpc.io/docs/guides/request-hedging/) for the concept.

See [packages/p-hedge](./packages/p-hedge) for full documentation.

This repo also includes [p-dynamic](./packages/p-dynamic) — variants of `Promise.any` / `Promise.race` that accept new promises after creation, which p-hedge builds on.

## License

MIT License
