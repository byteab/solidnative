// Headless Hermes runner for the renderer bench: the app's own VM (Pods' macOS hermesvm), with
// print, a high-resolution clock and gc. Usage: host <bundle.hbc> [args...] (args as globalThis.args)
#include <hermes/hermes.h>
#include <jsi/jsi.h>
#include <jsi/instrumentation.h>
#include <chrono>
#include <cstdio>
#include <fstream>
#include <iostream>
#include <sstream>
using namespace facebook;
int main(int argc, char **argv) {
  std::ifstream in(argv[1], std::ios::binary);
  std::stringstream ss; ss << in.rdbuf();
  auto rt = facebook::hermes::makeHermesRuntime(::hermes::vm::RuntimeConfig::Builder().withES6Proxy(true).withMicrotaskQueue(true).build());
  auto &r = *rt;
  auto g = r.global();
  g.setProperty(r, "print", jsi::Function::createFromHostFunction(r, jsi::PropNameID::forAscii(r, "print"), 1,
    [](jsi::Runtime &r, const jsi::Value &, const jsi::Value *a, size_t n) {
      for (size_t i = 0; i < n; i++) std::cout << (i ? " " : "") << a[i].toString(r).utf8(r);
      std::cout << std::endl; return jsi::Value::undefined(); }));
  auto start = std::chrono::steady_clock::now();
  g.setProperty(r, "nowMs", jsi::Function::createFromHostFunction(r, jsi::PropNameID::forAscii(r, "nowMs"), 0,
    [start](jsi::Runtime &, const jsi::Value &, const jsi::Value *, size_t) {
      return jsi::Value(std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - start).count()); }));

  g.setProperty(r, "gcNow", jsi::Function::createFromHostFunction(r, jsi::PropNameID::forAscii(r, "gcNow"), 0,
    [](jsi::Runtime &r, const jsi::Value &, const jsi::Value *, size_t) { r.instrumentation().collectGarbage("bench"); return jsi::Value::undefined(); }));
  g.setProperty(r, "heapAllocated", jsi::Function::createFromHostFunction(r, jsi::PropNameID::forAscii(r, "heapAllocated"), 0,
    [](jsi::Runtime &r, const jsi::Value &, const jsi::Value *, size_t) {
      auto info = r.instrumentation().getHeapInfo(false);
      return jsi::Value((double)info["hermes_totalAllocatedBytes"]); }));
  jsi::Array args(r, argc - 2);
  for (int i = 2; i < argc; i++) args.setValueAtIndex(r, i - 2, jsi::String::createFromUtf8(r, argv[i]));
  g.setProperty(r, "args", args);
  try {
    r.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(ss.str()), argv[1]);
    r.drainMicrotasks();
  } catch (jsi::JSError &e) { std::cerr << e.getMessage() << "\n" << e.getStack() << std::endl; return 1; }
  return 0;
}
