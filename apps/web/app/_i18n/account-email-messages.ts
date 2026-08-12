export const englishAccountEmailMessages = Object.freeze({
  subject: (brandName: string) => `${brandName} secure sign-in link`,
  heading: "Finish signing in",
  introduction: "Use this secure, short-lived link to sign in to your private account.",
  action: "Sign in securely",
  expiry: (expiresAt: string) => `This link expires at ${expiresAt}.`,
  ignored: "If you did not request this link, you can ignore this email.",
});
