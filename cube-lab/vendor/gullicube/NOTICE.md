# gullicube

Tomas Rokicki’s [gullicube](https://github.com/rokicki/gullicube) is used under the Mozilla Public License 2.0. The upstream source and algorithm tables are available at [commit 48bd54b](https://github.com/rokicki/gullicube/tree/48bd54b36a95888639f63df63a24d8639b84cd23). This directory ships the unchanged fast tables. The solver loads the larger tables from the same pinned upstream commit as needed.

The complete build modifications are in `build.py` and `serial-thread.h`. The build replaces upstream thread pools with synchronous execution so the solver can run on static sites that lack cross-origin isolation. It also emits checkpoints for improved candidate solutions so the browser can retain a verified solution when the search budget expires, handles Windows line endings in class tables, and skips the oblique-pair finish tables for 5×5 cubes, which have no such pairs. The search itself and the table formats come from upstream.

To reproduce the WebAssembly build, check out the pinned upstream commit, activate Emscripten 6.0.13, then run `python vendor/gullicube/build.py /path/to/gullicube` from the Cube Lab repository.
