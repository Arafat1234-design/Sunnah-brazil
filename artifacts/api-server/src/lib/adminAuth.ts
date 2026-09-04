import { createHmac, timingSafeEqual } from "node:crypto";
import { getAuth } from "@clerk/express";
import type { Request, Response } from "express";

const ADMIN_ACCESS_COOKIE = "sunnah_admin_access";
const ADMIN_ACCESS_TTL_SECONDS = 30 * 60;

function getCookie(req: Request, name: string): string | null {
  const cookies = req.headers.cookie?.split(";") ?? [];
  const entry = cookies.find(cookie => cookie.trim().startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.trim().slice(name.length + 1)) : null;
}

function getSigningSecret(): string | null {
  return process.env.SESSION_SECRET || null;
}

function sign(payload: string): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function getAdminUserId(req: Request, res: Response): string | null {
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

export function isAdminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PANEL_PASSWORD && getSigningSecret());
}

export function isAdminAccessValid(req: Request, userId: string): boolean {
  const value = getCookie(req, ADMIN_ACCESS_COOKIE);
  const secret = getSigningSecret();
  if (!value || !secret) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(sign(payload) ?? "", signature)) return false;
  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const separator = decoded.lastIndexOf(".");
  if (separator < 1) return false;
  const tokenUserId = decoded.slice(0, separator);
  const expiresAt = Number(decoded.slice(separator + 1));
  return tokenUserId === userId && Number.isFinite(expiresAt) && expiresAt > Math.floor(Date.now() / 1000);
}

export function setAdminAccessCookie(res: Response, userId: string): boolean {
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_ACCESS_TTL_SECONDS;
  const payload = Buffer.from(`${userId}.${expiresAt}`, "utf8").toString("base64url");
  const signature = sign(payload);
  if (!signature) return false;
  res.setHeader("Set-Cookie", `${ADMIN_ACCESS_COOKIE}=${encodeURIComponent(`${payload}.${signature}`)}; Max-Age=${ADMIN_ACCESS_TTL_SECONDS}; Path=/api; HttpOnly; SameSite=Strict${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return true;
}

export function clearAdminAccessCookie(res: Response): void {
  res.setHeader("Set-Cookie", `${ADMIN_ACCESS_COOKIE}=; Max-Age=0; Path=/api; HttpOnly; SameSite=Strict${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
}

export function requireAdmin(req: Request, res: Response): string | null {
  const userId = getAdminUserId(req, res);
  if (!userId) return null;
  if (!isAdminAccessValid(req, userId)) {
    res.status(403).json({ error: "Admin password required" });
    return null;
  }
  return userId;
}