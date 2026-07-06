import { Request, Response, NextFunction } from "express";
import { User } from "../db_schema";

const verifySubscribe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user as User
    if (user && user.subscribe) {
      (req as any).user = user;
      return next();
    }

    return res.status(401).json({ message: "Access Denied: Invalid user.", type : "NOT_SUBSCRIBE" });
  } catch (e) {
    return res.status(500).json({ message: "An error occured"});
  }
};

export const createVerifySubscribeMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    verifySubscribe(req, res, next);
  };
};