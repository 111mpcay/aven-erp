import { z } from "zod";

/**
 * Money is validated and stored as a decimal STRING (never a JS float) so peso
 * amounts stay exact — correctness is priority #1 (CLAUDE.md). Drizzle's
 * `numeric` columns accept these strings directly.
 */
export const positiveMoney = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount (up to 2 decimals)")
  .refine((v) => Number(v) > 0, "Amount must be greater than 0");

export const nonNegativeMoney = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount (up to 2 decimals)")
  .refine((v) => Number(v) >= 0, "Amount cannot be negative");

/** FX rate to PHP — positive, up to 6 decimal places. Defaults to 1 (PHP→PHP). */
export const fxRate = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,6})?$/, "Enter a valid rate")
  .refine((v) => Number(v) > 0, "Rate must be greater than 0")
  .default("1");

/** ISO 4217-ish 3-letter currency code; defaults to PHP. */
export const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .length(3, "Use a 3-letter currency code")
  .default("PHP");

/** Calendar date as YYYY-MM-DD (matches a native <input type="date">). */
export const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
