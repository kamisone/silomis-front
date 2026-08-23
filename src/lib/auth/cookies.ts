import { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_TOKEN_MAX_AGE, type RotatedTokens } from "./session";

function baseOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // "lax" (not "strict"): the session must survive top-level
    // navigations/reloads after the tab has been idle (e.g. the browser
    // discarding and reloading a background tab). With "strict", that reload
    // can omit the cookies entirely, which middleware then reads as "no
    // session" and clears the (still valid) auth cookies outright.
    sameSite: "lax" as const,
    path: "/",
    maxAge: REFRESH_TOKEN_MAX_AGE,
  };
}

/** Sets both auth cookies after a login or a refresh-token rotation. */
export function setAuthCookies(response: NextResponse, tokens: RotatedTokens): void {
  response.cookies.set(ACCESS_COOKIE, tokens.access_token, baseOpts());
  response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, baseOpts());
}

/** Clears both auth cookies (logout, or an unrecoverable session). */
export function clearAuthCookies(response: NextResponse): void {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
}
