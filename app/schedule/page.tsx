"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ScheduleManager from '@/components/ScheduleManager';
import { useSession, SessionContextValue } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface ScheduleConfig {
  mode: 'interval' | 'time';
  interval: number;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  scheduledTime: string;
  timezone: string;
}

interface CrawlStatus {
  isRunning: boolean;
  currentPage?: number;
  totalPages?: number;
  successCount: number;
  errorCount: number;
  startTime?: string;
  estimatedEndTime?: string;
  triggerType?: 'manual' | 'scheduled';
  snapshotDate?: string;
}

interface ScheduleStatus {
  isScheduled: boolean;
  config: ScheduleConfig;
  crawlStatus: CrawlStatus;
}

export default function SchedulePage() {
  const { data: session } = useSession() as SessionContextValue;
  const router = useRouter();
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // 检查是否为管理员
  const isAdmin = session?.user?.isAdmin || false;

  // 如果不是管理员，重定向到主页
  useEffect(() => {
    if (session && !isAdmin) {
      router.push('/lh');
    }
  }, [session, isAdmin, router]);

  // 加载定时任务状态
  const loadScheduleStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/schedule');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setScheduleStatus(result.data);
        }
      }
    } catch (error) {
      console.error('加载定时任务状态失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScheduleStatus();
    // 每30秒刷新一次状态
    const interval = setInterval(loadScheduleStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-';
    return new Date(timeString).toLocaleString('zh-CN');
  };

  const formatInterval = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}分钟`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      return `${hours}小时`;
    } else {
      const days = Math.floor(minutes / 1440);
      return `${days}天`;
    }
  };

  // 如果正在加载或没有数据，显示加载状态
  if (loading || !scheduleStatus) {
    return (
      <main className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">加载中...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* 页面头部 */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">定时抓取管理</h1>
            <p className="text-gray-600 mt-2">配置和管理自动数据抓取任务</p>
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
                  className="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium border-b-2 border-blue-600"
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

        {/* 当前状态概览 */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">当前状态</h2>
            
            {/* 抓取状态显示 */}
            {scheduleStatus.crawlStatus?.isRunning && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                    <h3 className="text-lg font-medium text-blue-900">抓取任务正在执行中</h3>
                  </div>
                  <span className="text-sm text-blue-700">
                    {scheduleStatus.crawlStatus.triggerType === 'manual' ? '手动触发' : '定时触发'}
                  </span>
                </div>
                
                {scheduleStatus.crawlStatus.currentPage && scheduleStatus.crawlStatus.totalPages && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-blue-700">
                      <span>进度: 第 {scheduleStatus.crawlStatus.currentPage} 页 / 共 {scheduleStatus.crawlStatus.totalPages} 页</span>
                      <span>{Math.round((scheduleStatus.crawlStatus.currentPage / scheduleStatus.crawlStatus.totalPages) * 100)}%</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(scheduleStatus.crawlStatus.currentPage / scheduleStatus.crawlStatus.totalPages) * 100}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-sm text-blue-600">
                      <span>成功: {scheduleStatus.crawlStatus.successCount} 条</span>
                      <span>失败: {scheduleStatus.crawlStatus.errorCount} 条</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-2 ${
                  scheduleStatus.isScheduled 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {scheduleStatus.isScheduled ? '运行中' : '已停止'}
                </div>
                <p className="text-sm text-gray-600">定时任务状态</p>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900 mb-1">
                  {formatInterval(scheduleStatus.config.interval)}
                </div>
                <p className="text-sm text-gray-600">执行间隔</p>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900 mb-1">
                  {scheduleStatus.config.scheduledTime}
                </div>
                <p className="text-sm text-gray-600">执行时间</p>
              </div>
            </div>
            
            {scheduleStatus.isScheduled && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">上次运行:</span>
                    <span className="ml-2 font-medium">{formatTime(scheduleStatus.config.lastRun)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">下次运行:</span>
                    <span className="ml-2 font-medium">{formatTime(scheduleStatus.config.nextRun)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 定时任务管理组件 */}
        <div className="mb-6">
          <ScheduleManager onScheduleChange={loadScheduleStatus} />
        </div>

        {/* 使用说明 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">使用说明</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <span className="text-orange-600 font-medium">⚠️</span>
              <span>定时任务现在会执行实际的数据抓取，请合理设置执行间隔</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-medium">•</span>
              <span>定时任务会在后台自动运行，即使关闭浏览器也会继续执行</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-medium">•</span>
              <span>每次执行都会在服务器控制台打印信息，可观察定时任务是否正常工作</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-medium">•</span>
              <span>建议设置合理的执行间隔，避免过于频繁的数据抓取</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-medium">•</span>
              <span>服务器重启后需要重新启动定时任务，请及时检查任务状态</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-medium">•</span>
              <span>如需修改配置，请先停止任务，修改后再重新启动</span>
            </div>
          </div>
        </div>

        {/* 快速操作 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/lh"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors"
            >
              查看数据监控
            </Link>
            {isAdmin && (
              <Link
                href="/logs"
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium transition-colors"
              >
                查看抓取日志
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
} 