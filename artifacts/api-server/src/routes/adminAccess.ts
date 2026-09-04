import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  clearAdminAccessCookie,
  isAdminAccessValid,
  isAdminPasswordConfigured,
  setAdminAccessCookie,
} from "../lib/adminAuth";

const router: IRouter = Router();

function passwordMatches(password: string): boolean {
  const configured = process.env.ADMIN_PANEL_PASSWORD;
  if (!configured) return false;
  const given = Buffer.from(password);
  const expected = Buffer.from(configured);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

router.get("/admin/access", (req, res) => {
  if (!isAdminPasswordConfigured()) {
    res.status(503).json({ error: "Admin password is not configured" });
    return;
  }
  res.json({ authorized: isAdminAccessValid(req) });
});

router.post("/admin/access", (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!isAdminPasswordConfigured()) {
    res.status(503).json({ error: "Admin password is not configured" });
    return;
  }
  if (!password || !passwordMatches(password)) {
    res.status(401).json({ error: "Invalid admin password" });
    return;
  }
  if (!setAdminAccessCookie(res)) {
    res.status(503).json({ error: "Admin session is not configured" });
    return;
  }
  res.json({ authorized: true });
});

router.delete("/admin/access", (req, res) => {
  clearAdminAccessCookie(res);
  res.status(204).send();
});

export default router;