# Optimal 3×3 engine

`engine.mjs` bundles the MIT-licensed `cube-core` and `solver-ts` modules from [Denis's cube-solver](https://github.com/MrDenzzz/cube-solver/tree/950fa93285640b2e64431a74186513f31d43b613) at commit `950fa93285640b2e64431a74186513f31d43b613`. See `LICENSE` for attribution.

The solver searches in the half-turn metric. Its three-axis pattern database gives admissible bounds, and iterative deepening rules out every shorter depth. A verified two-phase plan supplies an upper bound for that proof. The 35 MB standard table is generated in the browser and cached in the origin-private file system when available. Hard positions take considerably longer than light scrambles.

`entry.ts` lists the exports included in the browser bundle. Rebuild it from the project root with esbuild 0.28.2 and the pinned source checkout.

```sh
upstream=/path/to/cube-solver
npx esbuild@0.28.2 vendor/optimal3/entry.ts --bundle --format=esm \
  --platform=browser --target=es2022 \
  --alias:@cube/core="$upstream/packages/cube-core/src/index.ts" \
  --alias:@upstream="$upstream/packages/solver-ts/src" \
  --outfile=vendor/optimal3/engine.mjs
```
