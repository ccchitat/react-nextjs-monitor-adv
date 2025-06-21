"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import LoadingDots from "@/components/loading-dots";
import toast from "react-hot-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Iuser } from "types";

export default function Form({ type, showRegisterLink = true }: { type: "login" | "register", showRegisterLink?: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  // 登录逻辑
  const login = async ({ username, password }: Iuser) => {
    try {
      console.log("🚀 Starting login process...");
      const result = await signIn("credentials", {
        username,
        password,
        callbackUrl: "/lh"
      });
      
      console.log("📋 SignIn result:", result);
      
      // 如果使用了 callbackUrl，signIn 会自动处理重定向
      // 只有在出错时才需要手动处理
      if (result && typeof result === 'string' && result.includes('error')) {
        setLoading(false);
        toast.error("登录失败");
      }
    } catch (error) {
      setLoading(false);
      toast.error("登录失败，请重试");
      console.error("Login error:", error);
    }
  };
  // 注册逻辑
  const register = async ({ username, password }: Iuser) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });
      
      setLoading(false);
      
      if (res.status === 200) {
        toast.success("账户创建成功！正在跳转到登录页面...");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        try {
          const data = await res.json();
          toast.error(data.error || "注册失败");
        } catch (jsonError) {
          console.error("解析响应JSON失败:", jsonError);
          toast.error("注册失败，请重试");
        }
      }
    } catch (error) {
      setLoading(false);
      console.error("注册请求失败:", error);
      toast.error("注册失败，请重试");
    }
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setLoading(true);
        if (type === "login") {
          login({ username: e.currentTarget.username.value, password: e.currentTarget.password.value });
        } else {
          register({ username: e.currentTarget.username.value, password: e.currentTarget.password.value });
        }
      }}
      className="flex flex-col space-y-4 bg-gray-50 px-4 py-8 sm:px-16"
    >
      <div>
        <label htmlFor="username" className="block text-xs text-gray-600 uppercase">
          账号
        </label>
        <input
          id="username"
          name="username"
          type="text"
          placeholder="请输入账号"
          autoComplete="username"
          required
          className="mt-1 block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-black focus:outline-none focus:ring-black sm:text-sm"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-xs text-gray-600 uppercase">
          密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="请输入密码"
          required
          className="mt-1 block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-black focus:outline-none focus:ring-black sm:text-sm"
        />
      </div>
      <button
        disabled={loading}
        className={`${
          loading ? "cursor-not-allowed border-gray-200 bg-gray-100" : "border-black bg-black text-white hover:bg-white hover:text-black"
        } flex h-10 w-full items-center justify-center rounded-md border text-sm transition-all focus:outline-none`}
      >
        {loading ? <LoadingDots color="#808080" /> : <p>{type === "login" ? "登录" : "注册"}</p>}
      </button>
      {type === "login" ? (
        showRegisterLink && (
          <p className="text-center text-sm text-gray-600">
            没有账号?{" "}
            <Link href="/register" className="font-semibold text-gray-800">
              立即注册
            </Link>
          </p>
        )
      ) : (
        <p className="text-center text-sm text-gray-600">
          已有账号?{" "}
          <Link href="/login" className="font-semibold text-gray-800">
            立即登录
          </Link>
        </p>
      )}
    </form>
  );
}
