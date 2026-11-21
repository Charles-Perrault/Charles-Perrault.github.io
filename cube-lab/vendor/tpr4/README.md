# Four-by-four search

`solver.mjs` is the browser JavaScript bundle of the MIT-licensed [MrDenzzz/cube-solver](https://github.com/MrDenzzz/cube-solver) at [`950fa93285640b2e64431a74186513f31d43b613`](https://github.com/MrDenzzz/cube-solver/tree/950fa93285640b2e64431a74186513f31d43b613). Its three-phase search follows [Chen Shuang's TPR solver](https://github.com/cs0x7f/TPR-4x4x4-Solver) and uses an edge-pairing distance table. The remaining 3×3 state is handled by the upstream two-phase solver.

The bundle was built with esbuild 0.25.3 with `--bundle --format=esm --platform=neutral --target=es2022 --ignore-annotations`, an `@cube/core` alias pointing to `packages/cube-core/src/index.ts`, and the following entry point from the upstream repository root.

```ts
export { parseFacelets4 } from './packages/cube-core/src/cube4.ts';
export { buildEdgePairing } from './packages/solver-ts/src/four/edge-pairing.ts';
export { buildReductionTables } from './packages/solver-ts/src/four/tables.ts';
export { createReductionSolver } from './packages/solver-ts/src/four/reduction.ts';
export { buildTwoPhaseTables, TWO_PHASE_TABLE_COUNT } from './packages/solver-ts/src/tables.ts';
export { createTwoPhaseSolver } from './packages/solver-ts/src/two-phase.ts';
```

For esbuild's TypeScript parser, the four right operands spelled `out[...]` in left-shift expressions in `packages/solver-ts/src/four/edge-pairing.ts` were enclosed in parentheses. In `packages/solver-ts/src/four/reduction.ts`, both of the first two search phases now check the existing cancellation callback every 4,096 visited nodes. This bounds the additional search time when Cube Lab tests other rotations of the input position.
