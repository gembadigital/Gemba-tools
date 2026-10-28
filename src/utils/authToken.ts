// The session token lives in localStorage ("Beni hatırla") or sessionStorage (not remembered) — see
// AuthScreen. Reading only localStorage sends an empty token for non-remembered logins and every
// request fails with "Invalid or expired session". Read it per request through this helper.
// The tab-scoped token wins: a kiosk session (sessionStorage) opened on a device where someone is
// also signed in with "Beni hatırla" (localStorage) must keep acting as the kiosk user.
export function getAuthToken(): string {
  return sessionStorage.getItem("gemba_token") || localStorage.getItem("gemba_token") || "";
}
