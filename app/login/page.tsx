"use client";

import Image from "next/image";
import Form from "@/components/form";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function Login() {
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRegistrationStatus = async () => {
      try {
        const response = await fetch('/api/settings?public=true&key=registration_enabled');
        if (response.ok) {
          const data = await response.json();
          setRegistrationEnabled(data.value === 'true');
        }
      } catch (error) {
        console.error('检查注册状态失败:', error);
        // 默认允许注册，以防出错
        setRegistrationEnabled(true);
      } finally {
        setLoading(false);
      }
    };

    checkRegistrationStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
      <div className="z-10 w-full max-w-md overflow-hidden rounded-2xl border border-gray-100 shadow-xl">
        <div className="flex flex-col items-center justify-center space-y-3 border-b border-gray-200 bg-white px-4 py-6 pt-8 text-center sm:px-16">
          <Link href="/">
            <Image
              src="/logo.png"
              priority
              alt="Logo"
              className="h-10 w-10 rounded-full"
              width={20}
              height={20}
            />
          </Link>
          <h3 className="text-xl font-semibold">登录</h3>
          <p className="text-sm text-gray-500">
            使用账号和密码登录
          </p>
        </div>
        <Form type="login" showRegisterLink={registrationEnabled} />
      </div>
    </div>
  );
}
