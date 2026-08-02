import app from "../src/server/app";

// Vercel's Node runtime treats a default-exported Express app as a request handler — every
// request matching the /api/:path* rewrite in vercel.json is routed here as a serverless
// function invocation. No app.listen() call: Vercel owns the HTTP server, not Express.
export default app;
