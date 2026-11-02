/** Leading + trailing throttle: fires at most once per `wait` ms, always delivering the latest call. */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, wait: number) {
  let last = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let pendingArgs: A | undefined

  const invoke = () => {
    last = Date.now()
    timer = undefined
    if (pendingArgs) {
      const args = pendingArgs
      pendingArgs = undefined
      fn(...args)
    }
  }

  const throttled = (...args: A) => {
    pendingArgs = args
    const remaining = wait - (Date.now() - last)
    if (remaining <= 0) invoke()
    else if (!timer) timer = setTimeout(invoke, remaining)
  }

  throttled.cancel = () => {
    clearTimeout(timer)
    timer = undefined
    pendingArgs = undefined
  }

  return throttled
}
