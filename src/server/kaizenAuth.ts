// Sicil no ile giriş (Faz 3.5) — rules shared by the login route, the session check and the
// Kurulum PIN actions. Shop-floor employees have no Gemba Tools user account: they log in with the
// customer id (from the QR / login link) + sicil no, and — when the customer's PIN policy requires
// it for their role — a PIN they chose themselves using a one-time code from the Kurul Yöneticisi.
import crypto from "crypto";
import { hashPassword, verifyPassword } from "./db.js";
import { buildOrg, normEmployeeNo } from "../utils/kaizenOrg.js";
import type { PinPolicy } from "../utils/kaizenSettings.js";

export const PIN_MAX_FAILS = 5;
export const PIN_LOCK_MINUTES = 15;
export const PIN_CODE_DAYS = 7;
export const KIOSK_SESSION = "15m";
export const PHONE_SESSION = "30d";

// Authorized = has power over others' suggestions: Kurul member/admin or anyone's supervisor.
export function isAuthorizedRole(person: any, roster: any[]): boolean {
  if (person.isBoardMember || person.isBoardAdmin) return true;
  return (buildOrg(roster).reportsOf.get(person.id) || []).length > 0;
}

export function pinRequired(person: any, roster: any[], policy: PinPolicy): boolean {
  if (policy === "none") return false;
  if (policy === "all") return true;
  return isAuthorizedRole(person, roster);
}

export function findBySicil(roster: any[], employeeNo: unknown): any | undefined {
  const no = normEmployeeNo(employeeNo);
  return no ? roster.find(p => normEmployeeNo(p.employeeNo) === no) : undefined;
}

// 4–6 digits, not all the same digit, not a plain ascending/descending run.
export function pinProblem(pin: unknown): string | null {
  const p = typeof pin === "string" ? pin.trim() : "";
  if (!/^\d{4,6}$/.test(p)) return "PIN 4–6 rakamdan oluşmalı.";
  if (/^(\d)\1+$/.test(p)) return "PIN tek bir rakamın tekrarı olamaz.";
  const asc = "0123456789", desc = "9876543210";
  if (asc.includes(p) || desc.includes(p)) return "PIN ardışık rakamlardan oluşamaz (ör. 1234).";
  return null;
}

export function newPinCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export const isLocked = (p: any, now = Date.now()) => !!p.pinLockedUntil && Date.parse(p.pinLockedUntil) > now;

// Record a failed PIN/code attempt; returns the fields to merge into the personnel record.
export function failedAttempt(p: any, now = Date.now()): Record<string, any> {
  const fails = (Number(p.pinFailed) || 0) + 1;
  return fails >= PIN_MAX_FAILS
    ? { pinFailed: 0, pinLockedUntil: new Date(now + PIN_LOCK_MINUTES * 60_000).toISOString() }
    : { pinFailed: fails };
}

export const codeValid = (p: any, code: unknown, now = Date.now()) =>
  !!p.pinCodeHash && typeof code === "string" && !!p.pinCodeExpires && Date.parse(p.pinCodeExpires) > now && verifyPassword(code.trim(), p.pinCodeHash);

export const pinValid = (p: any, pin: unknown) => !!p.pinHash && typeof pin === "string" && verifyPassword(pin.trim(), p.pinHash);

export const hashSecret = (v: string) => hashPassword(v.trim());

// Secret PIN fields never leave the server; the roster gets flags instead.
const SECRET_FIELDS = ["pinHash", "pinCodeHash", "pinFailed", "pinLockedUntil", "pinVersion"];
export function publicPersonnel(p: any) {
  const out: any = { ...p, hasPin: !!p.pinHash, pinCodeActive: !!p.pinCodeHash && !!p.pinCodeExpires && Date.parse(p.pinCodeExpires) > Date.now() };
  for (const f of SECRET_FIELDS) delete out[f];
  return out;
}
export function stripSecretInput(body: any) {
  for (const f of [...SECRET_FIELDS, "pinCodeExpires", "hasPin", "pinCodeActive"]) delete body[f];
  return body;
}

// The stable e-mail-shaped identity of an employee without an e-mail address. Used as authorEmail
// etc. so existing e-mail based matching keeps working for them.
export const virtualEmail = (personnelId: string) => `sicil-${personnelId}@kaizen.local`;
