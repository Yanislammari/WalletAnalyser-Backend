import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { attributesUser, User } from "../db_schema";

import dotenv from "dotenv";
import UserType from "../db_schema/users/user_type";
import TokenPayloadUser from "../config/token_payload";

dotenv.config();
const SECRET_KEY = process.env.SECRET_KEY as string;

const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  const token = (req.headers["authorization"] as string)?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access Denied: No token provided." });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY) as TokenPayloadUser;
    const user = await User.findOne({ where: { [attributesUser.id]: decoded.id }});
    if (user) {
      (req as any).user = user;
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
    const decoded = jwt.verify(token, SECRET_KEY) as TokenPayloadUser;
    const user = await User.findOne({ where: { [attributesUser.id]: decoded.id }});
    if (user && user.user_type == UserType.ADMIN) {
      (req as any).user = user;
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

