export function isMicrosoftAuthSupported() {
  if (typeof window === "undefined") return true;

  return Boolean(
    window.crypto &&
      window.crypto.subtle &&
      window.localStorage &&
      window.sessionStorage &&
      window.TextEncoder,
  );
}

export function supportsDateTimeFormatParts() {
  return Boolean(
    typeof Intl !== "undefined" &&
      Intl.DateTimeFormat &&
      Intl.DateTimeFormat.prototype &&
      typeof Intl.DateTimeFormat.prototype.formatToParts === "function",
  );
}