import type { Request, Response, NextFunction, RequestHandler } from 'express'

/**
 * Wraps an async route handler so thrown errors become 500 responses
 * instead of crashing the process with unhandled rejections.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => {
      console.error(`[${req.method} ${req.path}]`, err)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' })
      } else {
        // Headers already sent — destroy the response to close the connection
        res.end()
      }
    })
  }
}
