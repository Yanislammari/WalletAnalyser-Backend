import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../db_schema";

import dotenv from "dotenv";
import UserType from "../db_schema/users/user_type";

dotenv.config();
const TOKEN_KEY = process.env.TOKEN_KEY as string;

const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  const token = (req.headers["authorization"] as string)?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access Denied: No token provided." });
  }

  try {
    const decoded = jwt.verify(token, TOKEN_KEY);
    const user = await User.findOne({ where: { uuid: (decoded as { uuid: string }).uuid } });
    if (user) {
      req.body.user = user;
      return next();
    }

    return res.status(401).json({ message: "Access Denied: Invalid user." }); //fail case
  } catch (e) {
    console.log(e);
    return res.status(400).json({ message: "Invalid token." });
  }
};

const verifyTokenAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const token = (req.headers["authorization"] as string)?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access Denied: No token provided." });
  }

  try {
    const decoded = jwt.verify(token, TOKEN_KEY);
    const user = await User.findOne({ where: { uuid: (decoded as { uuid: string }).uuid } });
    if (user && user.user_type == UserType.ADMIN) {
      req.body.user = user;
      return next();
    }

    return res.status(401).json({ message: "Access Denied: Invalid user." }); //fail case
  } catch (e) {
    console.log(e);
    return res.status(400).json({ message: "Invalid token." });
  }
};

export const createVerifyTokenMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    verifyToken(req, res, next);
  };
};

export const createVerifyTokenAdminMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    verifyTokenAdmin(req, res, next);
  };
};

