"""Build the pinned gullicube source as a single-threaded browser module (MPL-2.0)."""

from pathlib import Path
from shutil import copy2, copytree, which
from subprocess import check_output, run
from tempfile import TemporaryDirectory
import sys


revision = "48bd54b36a95888639f63df63a24d8639b84cd23"
here = Path(__file__).resolve().parent
fast_files = ("fast6", "p8s10", "diag2", "mid2", "wing3", "pair3", "diag3", "mid3")


def substitute(path, find, replacement):
    source = path.read_text(encoding="utf-8")
    if source.count(find) != 1:
        raise RuntimeError(f"Unexpected source in {path.name}: {find}")
    path.write_text(source.replace(find, replacement), encoding="utf-8")


def build(checkout, compiler):
    actual = check_output(["git", "rev-parse", "HEAD"], cwd=checkout, text=True).strip()
    if actual != revision:
        raise RuntimeError(f"Expected gullicube {revision}, got {actual}")
    with TemporaryDirectory(prefix="cubelab-gullicube-") as tmp:
        work = Path(tmp)
        copytree(checkout / "src", work / "src")
        for path in (work / "src/full").iterdir():
            source = path.read_text(encoding="utf-8")
            if "std::thread" in source:
                path.write_text(source.replace("std::thread", "CubeLabThread"), encoding="utf-8")

        # Retain each better, complete plan before the time-boxed search proceeds.
        # The browser can cancel the search and still replay its last valid candidate.
        main = work / "src/full/gullicube.cpp"
        substitute(main, "int main(int argc, char **argv) {", r'''
static void checkpoint(const std::vector<mv> &candidate, int n) {
  auto moves = candidate;
  conventionalMoves(moves, n);
  std::string line = "# checkpoint";
  for (const auto &m : moves) {
    line += ' ';
    if (m.dep > 1) line += std::to_string(m.dep);
    line += "ULFRBD"[m.face];
    if (m.twist == 2) line += '2';
    if (m.twist == 3) line += '\'';
  }
  puts(line.c_str());
  fflush(stdout);
}

int main(int argc, char **argv) {''')
        substitute(main, "      if (better) best = std::move(r);\n      return true;", '''      if (better) {
        best = std::move(r);
        if (o.writeMoves) checkpoint(best.moves, N);
      }
      return true;''')
        substitute(main, '    if (o.finish) {\n      const char *files[] = {D("c12x.cls")',
                   '    if (o.finish && o.N >= 6) {\n      const char *files[] = {D("c12x.cls")')
        substitute(work / "src/full/classpool.h", r"(t.back() == '\n' || t.back() == ' ')",
                   "isspace((unsigned char)t.back())")
        sources = sorted((work / "src/full").glob("*.cpp")) + sorted((work / "src/brob").glob("*.cpp"))
        run([compiler, "-O3", "-std=c++20", "-msimd128", "-Isrc/brob", "-Isrc/full",
             "-include", str(here / "serial-thread.h"),
             *map(str, sources), "-sALLOW_MEMORY_GROWTH", "-sMAXIMUM_MEMORY=3GB", "-sINITIAL_MEMORY=96MB",
             "-sMODULARIZE", "-sEXPORT_ES6", "-sINVOKE_RUN=0", "-sEXIT_RUNTIME=1", "-sSTACK_SIZE=8MB",
             "-sEXPORTED_RUNTIME_METHODS=callMain,FS", "-sENVIRONMENT=worker,node",
             "-o", str(work / "gullicube.mjs")], check=True, cwd=work)

        (here / "data").mkdir(exist_ok=True)
        for name in fast_files:
            table = check_output(["git", "show", f"{revision}:data/{name}.cls"], cwd=checkout)
            (here / "data" / f"{name}.cls").write_bytes(table)
        for name in ("gullicube.mjs", "gullicube.wasm"):
            copy2(work / name, here / name)
        copy2(checkout / "LICENSE-MPL.md", here / "LICENSE-MPL.md")


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        raise SystemExit("Usage: python vendor/gullicube/build.py PATH-TO-GULLICUBE [PATH-TO-EM++]")
    compiler = sys.argv[2] if len(sys.argv) == 3 else which("em++")
    if not compiler:
        raise SystemExit("Install and activate Emscripten (tested with 6.0.13).")
    build(Path(sys.argv[1]).resolve(), compiler)
