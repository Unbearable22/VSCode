import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (process.env.STAGING_MODE !== "true") return NextResponse.next();
  const headers = {
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Cache-Control": "private, no-store",
  };
  if (request.nextUrl.pathname === "/robots.txt")
    return new NextResponse("User-agent: *\nDisallow: /\n", {
      headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
    });
  const user = process.env.STAGING_BASIC_AUTH_USER,
    password = process.env.STAGING_BASIC_AUTH_PASSWORD;
  if (!user || !password || password.length < 16)
    return new NextResponse("Тестовый доступ не настроен.", {
      status: 503,
      headers,
    });
  const authorization = request.headers.get("authorization") || "";
  const expected = Buffer.from(`${user}:${password}`).toString("base64");
  const actual = authorization.startsWith("Basic ")
    ? authorization.slice(6)
    : "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(actual), digest(expected)))
    return new NextResponse("Требуется доступ к тестовому сайту.", {
      status: 401,
      headers: {
        ...headers,
        "WWW-Authenticate": 'Basic realm="MarginTools Test", charset="UTF-8"',
      },
    });
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(headers))
    response.headers.set(key, value);
  return response;
}
