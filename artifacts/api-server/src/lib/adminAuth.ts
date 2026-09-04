import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

const ADMIN_ACCESS_COOKIE = "sunnah_admin_access";
const ADMIN_ACCESS_TTL_SECONDS = 30 * 60;
const ADMIN_ACCESS_SUBJECT = "password-only";

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

export function isAdminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PANEL_PASSWORD && getSigningSecret());
}

export function isAdminAccessValid(req: Request): boolean {
  const value = getCookie(req, ADMIN_ACCESS_COOKIE);
  const secret = getSigningSecret();
  if (!value || !secret) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(sign(payload) ?? "", signature)) return false;
  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const separator = decoded.lastIndexOf(".");
  if (separator < 1) return false;
  const subject = decoded.slice(0, separator);
  const expiresAt = Number(decoded.slice(separator + 1));
  return subject === ADMIN_ACCESS_SUBJECT && Number.isFinite(expiresAt) && expiresAt > Math.floor(Date.now() / 1000);
}

export function setAdminAccessCookie(res: Response): boolean {
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_ACCESS_TTL_SECONDS;
  const payload = Buffer.from(`${ADMIN_ACCESS_SUBJECT}.${expiresAt}`, "utf8").toString("base64url");
  const signature = sign(payload);
  if (!signature) return false;
  res.setHeader("Set-Cookie", `${ADMIN_ACCESS_COOKIE}=${encodeURIComponent(`${payload}.${signature}`)}; Max-Age=${ADMIN_ACCESS_TTL_SECONDS}; Path=/api; HttpOnly; SameSite=Strict${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return true;
}

export function clearAdminAccessCookie(res: Response): void {
  res.setHeader("Set-Cookie", `${ADMIN_ACCESS_COOKIE}=; Max-Age=0; Path=/api; HttpOnly; SameSite=Strict${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
}

export function requireAdmin(req: Request, res: Response): string | null {
  if (!isAdminAccessValid(req)) {
    res.status(403).json({ error: "Admin password required" });
    return null;
  }
  return ADMIN_ACCESS_SUBJECT;
}