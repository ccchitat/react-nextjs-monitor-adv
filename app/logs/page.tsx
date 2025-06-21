"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, SessionContextValue } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface CrawlLog {
  id: number;
  crawlDate: string;
  totalAdvertisers: number | null;
  successCount: number | null;
  errorCount: number | null;
  startTime: string;
  endTime: string | null;
  durationSeconds: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export default function LogsPage() {
  const { data: session } = useSession() as SessionContextValue;
  const router = useRouter();
  const [logs, setLogs] = useState<CrawlLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 检查是否为管理员
  const isAdmin = session?.user?.isAdmin || false;

  // 如果不是管理员，重定向到主页
  useEffect(() => {
    if (session && !isAdmin) {
      router.push('/lh');
    }
  }, [session, isAdmin, router]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('开始获取日志数据...');
      
      // 减少超时时间到3秒
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时
      
      const response = await fetch('/api/logs', {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log('API响应状态:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API返回数据:', data);
      
      if (data.success) {
        setLogs(data.logs);
        console.log('设置日志数据成功，条数:', data.logs.length);
      } else {
        setError(data.message || '获取日志失败');
      }
    } catch (err: any) {
      console.error('获取日志错误:', err);
      if (err.name === 'AbortError') {
        setError('请求超时，请检查数据库连接');
      } else {
        setError('网络错误或数据库连接失败，请稍后重试');
      }
      // 即使出错也设置空数组，让页面显示
      setLogs([]);
    } finally {
      setLoading(false);
      console.log('加载完成');
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'bg-green-100 text-green-800';
      case 'ERROR':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return '成功';
      case 'ERROR':
        return '失败';
      default:
        return status;
    }
  };

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
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">抓取日志</h1>
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
                  className="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium border-b-2 border-blue-600"
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
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  系统设置
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex justify-end items-center mb-6">
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            刷新
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    抓取日期
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    数据统计
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    耗时
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    开始时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    结束时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    错误信息
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      暂无抓取日志
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDateTime(log.crawlDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(log.status)}`}>
                          {getStatusText(log.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.totalAdvertisers ? (
                          <div>
                            <div>总数: {log.totalAdvertisers}</div>
                            <div className="text-gray-500">
                              成功: {log.successCount || 0} | 失败: {log.errorCount || 0}
                            </div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(log.durationSeconds)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDateTime(log.startTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.endTime ? formatDateTime(log.endTime) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        {log.errorMessage ? (
                          <div className="truncate" title={log.errorMessage}>
                            {log.errorMessage}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
} 