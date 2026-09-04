import { getAuth } from "@clerk/express";
import type { Request, Response } from "express";

export function requireAdmin(req: Request, res: Response): string | null {
  const userId = getAuth(req).userId;
  const allowedIds = (process.env.CLERK_ADMIN_USER_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  if (!allowedIds.includes(userId)) {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  return userId;
}