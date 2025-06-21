import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcrypt";
import { PrismaClient } from "@prisma/client";

// 初始化 Prisma 客户端
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "fallback_secret_for_development_only",
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  debug: process.env.NODE_ENV === "development",
  trustHost: true,
  callbacks: {
    session: async ({ session, token }) => {
      session.user.id = token.uid as string;
      session.user.username = token.username as string;
      session.user.isAdmin = token.isAdmin as boolean;
      return session;
    },
    jwt: async ({ user, token }) => {
      console.log("🔑 JWT callback called with user:", user ? "Yes" : "No");
      if (user) {
        // 确保 id 是字符串格式
        token.uid = typeof user.id === 'string' ? user.id : user.id.toString();
        token.username = user.username;
        token.isAdmin = user.isAdmin;
        console.log("✅ JWT token updated:", { uid: token.uid, username: token.username, isAdmin: token.isAdmin });
      }
      return token;
    },
  },
  providers: [
    CredentialsProvider({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<any> {
        console.log("🔐 NextAuth authorize called with:", { username: credentials?.username });
        
        const { username, password } = credentials ?? {};
        if (!username || !password) {
          console.log("❌ Missing credentials");
          throw new Error("用户名或密码不能为空");
        }
        
        try {
          const user = await prisma.user.findUnique({
            where: {
              username,
            },
          });
          
          console.log("👤 User found:", user ? "Yes" : "No");
          
          // if user doesn't exist or password doesn't match
          if (!user || !(await compare(password, user.password))) {
            console.log("❌ Invalid credentials");
            throw new Error("用户名或密码错误");
          }
          
          console.log("✅ Login successful for:", username);
          
          // 返回用户信息，确保 id 可以被正确处理
          return {
            id: user.id.toString(),
            username: user.username,
            isAdmin: user.isAdmin,
          };
        } catch (error) {
          console.error("🚨 Database error:", error);
          throw error;
        }
      },
    }),
  ],
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
