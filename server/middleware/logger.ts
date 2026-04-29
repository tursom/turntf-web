import type { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, _res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, url } = req;

  const onFinish = () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${method} ${url} - ${ms}ms`);
  };

  _res.on("finish", onFinish);
  next();
}
