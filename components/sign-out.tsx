"use client";
import { signOut } from "next-auth/react";

export default function SignOut() {
  return (
    <button
      className="text-red-600 hover:text-red-700 text-sm font-medium transition-all"
      onClick={() => signOut({ callbackUrl: '/login' })}
    >
      退出登录
    </button>
  );
}
