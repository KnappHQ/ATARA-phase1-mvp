import { Request, Response, NextFunction } from "express";

// Type definition for an async controller function
type AsyncController = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

export const catchAsync = (fn: AsyncController) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Catch any promise rejection and pass it to next() (the error middleware)
    fn(req, res, next).catch(next);
  };
};
