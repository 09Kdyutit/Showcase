import type { Instrumentation } from 'next'
import { captureError } from '@/lib/observability/error-reporter'

// Captures every uncaught server-side error across Server Components, Route Handlers,
// and Server Actions in one place, instead of needing a try/catch wrapper in each of
// the ~30 API routes. See src/lib/observability/error-reporter.ts for where it goes.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const error = err instanceof Error ? err : new Error(String(err))
  await captureError(error, {
    routePath: context.routePath,
    routeType: context.routeType,
    method: request.method,
    path: request.path,
  })
}
