import { Fragment } from "react";

/**
 * Render a line where text wrapped in *asterisks* becomes the brass-accent
 * emphasis used across the sign-in screen. Plain text renders unchanged.
 */
export function withEmphasis(text) {
  const value = typeof text === "string" ? text : "";
  return value.split(/\*([^*]+)\*/g).map((part, index) =>
    index % 2 ? <em key={index}>{part}</em> : <Fragment key={index}>{part}</Fragment>
  );
}
