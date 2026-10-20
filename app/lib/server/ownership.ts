export const plotOwnerCookie = (plotId: string) => `own_mars_claim_${plotId}`;
export const plotOwnerCookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
