/* A uniform error shape across the whole API, so every response looks like:
   { "error": { "code": "permission-denied", "message": "..." } }
   `code` mirrors the string codes the old HttpsError used, so frontend
   error-handling logic keyed off e.g. err.code === 'permission-denied'
   needs minimal changes when switching from httpsCallable to fetch(). */
class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = { AppError };
