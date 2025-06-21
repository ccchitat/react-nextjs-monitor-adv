"use client";

import { useState, useEffect } from 'react';
import Image from "next/image";
import Form from "@/components/form";
import Link from "next/link";

export default function Register() {
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 检查注册是否被启用
    const checkRegistrationStatus = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setRegistrationEnabled(result.configs.registration_enabled === 'true');
          } else {
            setRegistrationEnabled(true); // 默认启用
          }
        } else {
          setRegistrationEnabled(true); // 默认启用
        }
      } catch (error) {
        console.error('检查注册状态失败:', error);
        setRegistrationEnabled(true); // 默认启用
      } finally {
        setLoading(false);
      }
    };

    checkRegistrationStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (registrationEnabled === false) {
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
            <h3 className="text-xl font-semibold">注册暂不可用</h3>
            <p className="text-sm text-gray-500">
              管理员已禁用用户注册功能
            </p>
          </div>
          <div className="flex flex-col space-y-4 bg-gray-50 px-4 py-8 sm:px-16">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                如需注册账号，请联系系统管理员
              </p>
              <Link
                href="/login"
                className="flex h-10 w-full items-center justify-center rounded-md border border-gray-300 text-sm transition-colors hover:bg-gray-100"
              >
                返回登录
              </Link>
            </div>
          </div>
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
          <h3 className="text-xl font-semibold">注册</h3>
          <p className="text-sm text-gray-500">
            使用账号和密码创建新账户
          </p>
        </div>
        <Form type="register" />
      </div>
    </div>
  );
}
