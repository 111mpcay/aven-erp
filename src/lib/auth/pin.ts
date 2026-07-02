import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { getDb } from "@/lib/db/rls";
import { profiles } from "@/lib/db/schema";

/**
 * Action PIN (Phase 5) — a second factor for sensitive operations (CLAUDE.md:
 * delete, approve, edit posted records, expense over ₱10,000, role changes).
 *
 * - Stored as "v2:salt:hash": scrypt(HMAC-peppered PIN, per-user salt). The
 *   pepper (keyed by SUPABASE_SECRET_KEY) means a DB-only leak can't be cracked
 *   offline — the tiny 4–8 digit space needs the server secret too.
 * - Verify issues a SHORT-LIVED (5 min) HS256 token in an httpOnly cookie;
 *   requirePin checks it. Signing key derives from SUPABASE_SECRET_KEY.
 * - Brute force: an ATOMIC counter locks the PIN for 15 min after 5 failures
 *   (survives serverless instances; immune to parallel-request lost updates).
 */

const PIN_COOKIE = "action_pin_token";
const TOKEN_TTL_SECONDS = 5 * 60;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const PIN_SHAPE = /^\d{4,8}$/;
const HASH_VERSION = "v2";

function derivedKey(context: string): Buffer {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not configured.");
  return createHash("sha256").update(`${secret}:${context}`).digest();
}
const tokenKey = () => new Uint8Array(derivedKey("action-pin-token-v1"));
const pepperKey = () => derivedKey("action-pin-pepper-v1");

/** HMAC-pepper the PIN before scrypt so the hash isn't crackable from the DB alone. */
function scryptPeppered(pin: string, salt: Buffer): Buffer {
  const peppered = createHmac("sha256", pepperKey()).update(pin).digest();
  return scryptSync(peppered, salt, 32, { N: 16384, r: 8, p: 1 });
}

/** Set (or change) the current user's action PIN. Returns a user-facing error. */
export async function setActionPin(userId: string, pin: string): Promise<string | null> {
  if (!PIN_SHAPE.test(pin)) return "PIN must be 4–8 digits.";
  const salt = randomBytes(16);
  const stored = `${HASH_VERSION}:${salt.toString("hex")}:${scryptPeppered(pin, salt).toString("hex")}`;
  const db = await getDb();
  await db.rls((tx) =>
    tx
      .update(profiles)
      .set({ actionPinHash: stored, pinAttempts: 0, pinLockedUntil: null })
      .where(eq(profiles.id, userId)),
  );
  return null;
}

export type PinVerifyResult =
  | { ok: true }
  | { ok: false; error: string; locked?: boolean };

/** Verify the PIN; on success mint the short-lived token cookie. */
export async function verifyActionPin(
  userId: string,
  pin: string,
): Promise<PinVerifyResult> {
  // Shape check first — never run scrypt on arbitrary attacker input, and don't
  // burn a lockout attempt on obviously malformed input.
  if (!PIN_SHAPE.test(pin)) return { ok: false, error: "PIN must be 4–8 digits." };

  const db = await getDb();
  const result = await db.rls(async (tx): Promise<PinVerifyResult> => {
    const [me] = await tx
      .select({
        hash: profiles.actionPinHash,
        lockedUntil: profiles.pinLockedUntil,
      })
      .from(profiles)
      .where(eq(profiles.id, userId));

    if (!me?.hash) {
      return { ok: false, error: "No action PIN is set. Add one in Settings → Security." };
    }
    if (me.lockedUntil && me.lockedUntil > new Date()) {
      const mins = Math.ceil((me.lockedUntil.getTime() - Date.now()) / 60_000);
      return { ok: false, locked: true, error: `Too many attempts. Locked for ~${mins} min.` };
    }

    const parts = me.hash.split(":");
    const valid = verifyStoredHash(parts, pin);

    if (!valid) {
      // Atomic increment + conditional lock — parallel wrong attempts can't
      // race past the limit (SET reads the row's own current value).
      const [row] = (await tx.execute(sql`
        update profiles set
          pin_attempts = case when pin_attempts + 1 >= ${sql.raw(String(MAX_ATTEMPTS))} then 0 else pin_attempts + 1 end,
          pin_locked_until = case when pin_attempts + 1 >= ${sql.raw(String(MAX_ATTEMPTS))}
            then now() + interval '${sql.raw(String(LOCK_MINUTES))} minutes' else pin_locked_until end
        where id = ${userId}
        returning pin_attempts, pin_locked_until
      `)) as unknown as { pin_attempts: number; pin_locked_until: string | null }[];

      const locked = row?.pin_locked_until != null && row.pin_attempts === 0;
      if (locked) {
        return { ok: false, locked: true, error: `Too many attempts. Locked for ${LOCK_MINUTES} min.` };
      }
      const left = MAX_ATTEMPTS - (row?.pin_attempts ?? MAX_ATTEMPTS);
      return { ok: false, error: `Incorrect PIN (${Math.max(0, left)} tries left).` };
    }

    await tx
      .update(profiles)
      .set({ pinAttempts: 0, pinLockedUntil: null })
      .where(eq(profiles.id, userId));
    return { ok: true };
  });

  if (!result.ok) return result;

  const token = await new SignJWT({ purpose: "action-pin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(tokenKey());

  const cookieStore = await cookies();
  cookieStore.set(PIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  });
  return { ok: true };
}

/** Constant-time compare against a stored "v2:salt:hash" value; false on any malformed input. */
function verifyStoredHash(parts: string[], pin: string): boolean {
  if (parts.length !== 3) return false;
  const [version, saltHex, hashHex] = parts;
  if (version !== HASH_VERSION) return false;
  if (!/^[0-9a-f]+$/.test(saltHex) || !/^[0-9a-f]+$/.test(hashHex)) return false;
  const candidate = scryptPeppered(pin, Buffer.from(saltHex, "hex"));
  const expected = Buffer.from(hashHex, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** True when a fresh, valid PIN token exists for this user. */
export async function hasValidPinToken(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PIN_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, tokenKey(), { algorithms: ["HS256"] });
    return payload.sub === userId && payload.purpose === "action-pin";
  } catch {
    return false;
  }
}

/** Clear the elevation token (called on sign-out). */
export async function clearPinToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PIN_COOKIE);
}

/** Whether the user has a PIN configured at all. */
export async function hasPinConfigured(userId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.rls((tx) =>
    tx
      .select({ hash: profiles.actionPinHash })
      .from(profiles)
      .where(eq(profiles.id, userId)),
  );
  return Boolean(rows[0]?.hash);
}
