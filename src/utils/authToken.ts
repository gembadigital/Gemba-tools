// The session token lives in localStorage ("Beni hatırla") or sessionStorage (not remembered) — see
// AuthScreen. Reading only localStorage sends an empty token for non-remembered logins and every
// request fails with "Invalid or expired session". Read it per request through this helper.
export function getAuthToken(): string {
  return localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token") || "";
}
