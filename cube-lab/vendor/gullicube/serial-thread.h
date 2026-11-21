#pragma once

#include <functional>
#include <utility>

// GitHub Pages workers cannot use shared WebAssembly memory. The upstream
// thread-pool call sites also work with one worker running synchronously.
struct CubeLabThread {
  static unsigned int hardware_concurrency() { return 1; }

  template<class Function, class... Args>
  explicit CubeLabThread(Function&& task, Args&&... args) {
    std::invoke(std::forward<Function>(task), std::forward<Args>(args)...);
  }

  void join() noexcept {}
};
