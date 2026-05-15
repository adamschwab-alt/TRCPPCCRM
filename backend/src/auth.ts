import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { prisma } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: Role;
    fullName: string;
    tokenVersion?: number;
  };
}

export function signToken(payload: AuthRequest["user"]): string {
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn: "12h" });
}

export async function authRequired(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }
  try {
    const token = header.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as AuthRequest["user"];
    if (!decoded?.id) return res.status(401).json({ error: "Invalid token" });
    // Verify the user still exists, is active, and the token hasn't been revoked.
    const u = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, isActive: true, isArchived: true, tokenVersion: true, role: true, fullName: true, username: true },
    });
    if (!u || !u.isActive || u.isArchived) {
      return res.status(401).json({ error: "Account disabled" });
    }
    if ((decoded.tokenVersion ?? 0) !== u.tokenVersion) {
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }
    req.user = {
      id: u.id,
      username: u.username,
      role: u.role,
      fullName: u.fullName,
      tokenVersion: u.tokenVersion,
    };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

export function readOnlyBlocked(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user?.role === "READ_ONLY") {
    return res.status(403).json({ error: "Read-only role cannot modify" });
  }
  next();
}
