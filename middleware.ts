import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export default async function middleware(req: NextRequest) {
  // Get the pathname of the request
  const path = req.nextUrl.pathname;

  // 不需要认证的路径
  const publicPaths = ['/login', '/register', '/api/auth'];
  
  // 检查是否是公开路径
  const isPublicPath = publicPaths.some(publicPath => 
    path.startsWith(publicPath)
  );

  // 检查是否是公开的设置查询
  const isPublicSettingsQuery = path === '/api/settings' && 
    req.nextUrl.searchParams.get('public') === 'true';

  // 获取用户session
  const session = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || "fallback_secret_for_development_only",
  });

  console.log(`🔒 Middleware: ${path} | Session: ${session ? 'Yes' : 'No'} | Public: ${isPublicPath || isPublicSettingsQuery}`);

  // 如果是公开路径或公开设置查询
  if (isPublicPath || isPublicSettingsQuery) {
    // 如果已登录且试图访问登录/注册页面，重定向到主页
    if (session && (path === "/login" || path === "/register")) {
      console.log(`🔄 Redirecting logged-in user from ${path} to /lh`);
      return NextResponse.redirect(new URL("/lh", req.url));
    }
    return NextResponse.next();
  }

  // 对于所有其他路径，如果没有登录则重定向到登录页
  if (!session) {
    console.log(`🔄 Redirecting unauthorized user from ${path} to /login`);
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|vercel.svg).*)'],
}
