"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, SessionContextValue } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface SystemConfig {
  registration_enabled: string;
}

export default function SettingsPage() {
  const { data: session } = useSession() as SessionContextValue;
  const router = useRouter();
  const [configs, setConfigs] = useState<SystemConfig>({ registration_enabled: 'true' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 检查是否为管理员
  const isAdmin = session?.user?.isAdmin || false;

  // 如果不是管理员，重定向到主页
  useEffect(() => {
    if (session && !isAdmin) {
      router.push('/lh');
    }
  }, [session, isAdmin, router]);

  // 加载系统配置
  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setConfigs(result.configs);
        } else {
          setMessage({ type: 'error', text: result.message || '加载配置失败' });
        }
      } else {
        setMessage({ type: 'error', text: '加载配置失败' });
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      setMessage({ type: 'error', text: '网络错误' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadConfigs();
    }
  }, [isAdmin]);

  // 更新配置
  const updateConfig = async (key: string, value: string, description?: string) => {
    try {
      setSaving(true);
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value, description }),
      });

      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: '配置更新成功' });
        setConfigs(prev => ({ ...prev, [key]: value }));
      } else {
        setMessage({ type: 'error', text: result.message || '更新失败' });
      }
    } catch (error) {
      console.error('更新配置失败:', error);
      setMessage({ type: 'error', text: '网络错误' });
    } finally {
      setSaving(false);
    }
  };

  const handleRegistrationToggle = () => {
    const newValue = configs.registration_enabled === 'true' ? 'false' : 'true';
    updateConfig('registration_enabled', newValue, '是否允许用户注册');
  };

  // 清除消息
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!isAdmin) {
    return null; // 将被重定向
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* 页面头部 */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">系统设置</h1>
            <p className="text-gray-600 mt-2">配置系统的基本参数和功能开关</p>
          </div>
          <nav className="flex space-x-4">
            <Link 
              href="/lh"
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              数据监控
            </Link>
            {isAdmin && (
              <>
                <Link
                  href="/logs"
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  抓取日志
                </Link>
                <Link
                  href="/schedule"
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  定时管理
                </Link>
                <Link
                  href="/settings"
                  className="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium border-b-2 border-blue-600"
                >
                  系统设置
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-100 border border-green-400 text-green-700' 
              : 'bg-red-100 border border-red-400 text-red-700'
          }`}>
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                {message.type === 'success' ? (
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                ) : (
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                )}
              </svg>
              {message.text}
            </div>
          </div>
        )}

        {/* 设置面板 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">用户管理设置</h2>
            <p className="text-sm text-gray-600 mt-1">控制用户注册和访问权限</p>
          </div>
          
          <div className="p-6">
            <div className="space-y-6">
              {/* 注册开关 */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">允许用户注册</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    关闭后，新用户将无法通过注册页面创建账号
                  </p>
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={handleRegistrationToggle}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      configs.registration_enabled === 'true' 
                        ? 'bg-blue-600' 
                        : 'bg-gray-200'
                    } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        configs.registration_enabled === 'true' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="ml-3 text-sm text-gray-900">
                    {configs.registration_enabled === 'true' ? '开启' : '关闭'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 帮助信息 */}
        <div className="mt-6 bg-blue-50 rounded-lg p-6">
          <h3 className="text-sm font-medium text-blue-900 mb-2">使用说明</h3>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• 关闭注册后，已存在的用户仍可正常登录</p>
            <p>• 管理员可以随时开启或关闭注册功能</p>
            <p>• 建议在系统稳定运行后适当限制注册，确保系统安全</p>
          </div>
        </div>
      </div>
    </main>
  );
} 