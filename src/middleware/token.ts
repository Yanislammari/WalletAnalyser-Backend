import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { attributesUser, User } from "../db_schema";

import dotenv from "dotenv";
import UserType from "../db_schema/users/user_type";
import TokenPayloadUser from "../config/token_payload";

dotenv.config();
const SECRET_KEY = process.env.SECRET_KEY as string;

// ─── User lookup cache ────────────────────────────────────────────────────────
// Avoids a DB round-trip (~15-20ms in prod) on every authenticated request.
// TTL of 60 s is short enough to propagate bans/role changes quickly.

const USER_CACHE_TTL_MS = 60_000;

interface CachedUser {
  user:      User;
  expiresAt: number;
}

const userCache = new Map<string, CachedUser>();

async function getUser(id: string): Promise<User | null> {
  const cached = userCache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }
  const user = await User.findOne({ where: { [attributesUser.id]: id } });
  if (user) {
    userCache.set(id, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
  }
  return user;
}

// ─── Middlewares ──────────────────────────────────────────────────────────────

const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  const token = (req.headers["authorization"] as string)?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access Denied: No token provided.", type : "NO_AUTH" });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY) as TokenPayloadUser;
    const user = await getUser(decoded.id);
    if (user && user.ban == false) {
      (req as any).user = user;
      return next();
    }

    return res.status(401).json({ message: "Access Denied: Invalid user.", type : "NO_AUTH" });
  } catch (e) {
    return res.status(400).json({ message: "Invalid token.", type : "NO_AUTH" });
  }
};

const verifyTokenAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const token = (req.headers["authorization"] as string)?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Your session has expired. Please login again.", type : "NO_AUTH" });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY) as TokenPayloadUser;
    const user = await getUser(decoded.id);
    if (user && user.user_type == UserType.ADMIN) {
      (req as any).user = user;
      return next();
    }

    return res.status(401).json({ message: "Your session has expired. Please login again.", type : "NO_AUTH" });
  } catch (e) {
    return res.status(400).json({ message: "Your session has expired. Please login again.", type : "NO_AUTH" });
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

