export const anonymousSessionApiMessages = Object.freeze({
  conflict: Object.freeze({
    detail: "Retry from the browser that holds the original private session cookie.",
    title: "This session request cannot be replayed",
  }),
  invalidIdempotency: Object.freeze({
    detail: "Send one new random idempotency key with this request.",
    title: "The session request is invalid",
  }),
  invalidRequest: Object.freeze({
    detail: "Send an empty same-origin request from this site.",
    title: "The session request was not accepted",
  }),
  rateLimited: Object.freeze({
    detail: "Please wait briefly before starting a new private session.",
    title: "New sessions are temporarily limited",
  }),
  unavailable: Object.freeze({
    detail: "The private session service is temporarily unavailable. Please try again.",
    title: "A private session could not be started",
  }),
});
