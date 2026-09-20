// The database is an optional starter capability, not a V2 runtime dependency.
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
  }
}
