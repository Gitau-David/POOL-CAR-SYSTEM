import { NextRequest, NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE, SESSION_MAX_AGE, hashPin } from "@/lib/session";
import type { Role } from "@/lib/types";

// Demo-only PIN check against an env var. In production, swap this for a
// real lookup + compare against the `users` table (see db/schema.sql),
// which already stores a sha256 pin_hash per admin account.
const ADMIN_PIN = process.env.ADMIN_PIN || "1234";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const role: Role = body.role;
  const name: string = (body.name || "").trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (role === "admin") {
    if (hashPin(String(body.pin ?? "")) !== hashPin(ADMIN_PIN)) {
      return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
    }
  } else if (role !== "user") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const token = encodeSession({ name, role });
  const res = NextResponse.json({ name, role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
