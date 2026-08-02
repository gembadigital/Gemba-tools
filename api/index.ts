// ".js" extension required: Vercel's Node builder compiles this file with native ESM (this
// package.json has "type": "module"), which — unlike our esbuild bundle for the local/Cloud Run
// entry — does not rewrite relative import paths, and Node's ESM resolver rejects extensionless
// specifiers at runtime (ERR_MODULE_NOT_FOUND).
import app from "../src/server/app.js";

// Vercel's Node runtime treats a default-exported Express app as a request handler — every
// request matching the /api/:path* rewrite in vercel.json is routed here as a serverless
// function invocation. No app.listen() call: Vercel owns the HTTP server, not Express.
export default app;
