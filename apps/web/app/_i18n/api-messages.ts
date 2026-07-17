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

export const questionIntakeApiMessages = Object.freeze({
  invalidBody: Object.freeze({
    detail: "Send one valid, bounded English question-intake document.",
    title: "The question intake is invalid",
  }),
  invalidRequest: Object.freeze({
    detail: "Send one same-origin JSON request from this site.",
    title: "The question intake request was not accepted",
  }),
  tooLarge: Object.freeze({
    detail: "Shorten the question and try again.",
    title: "The question intake is too large",
  }),
  unavailable: Object.freeze({
    detail: "The private question check is temporarily unavailable. Try again manually.",
    title: "The question intake is unavailable",
  }),
});
