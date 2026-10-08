import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { password } = await request.json();
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  if (password === expected) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("dashboard_auth", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 4, // 一个登录有4小时的权限
    });
    return res;
  }

  return NextResponse.json({ error: "Wrong password" }, { status: 401 });
}

