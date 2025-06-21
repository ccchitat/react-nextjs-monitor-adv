"use client";

import { useState, useEffect } from 'react';

interface ScheduleConfig {
  mode: 'interval' | 'time';
  interval: number;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  scheduledTime: string;
  timezone: string;
}

interface ScheduleManagerProps {
  onScheduleChange?: () => void;
}

export default function ScheduleManager({ onScheduleChange }: ScheduleManagerProps) {
  const [isScheduled, setIsScheduled] = useState(false);
  const [config, setConfig] = useState<ScheduleConfig>({
    mode: 'interval',
    interval: 1, // 改为1分钟
    enabled: false,
    lastRun: null,
    nextRun: null,
    scheduledTime: '09:00', // 默认上午9点
    timezone: 'Asia/Shanghai'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载定时任务状态
  const loadScheduleStatus = async () => {
    try {
      console.log('🔄 正在加载定时任务状态...');
      const response = await fetch('/api/schedule');
      if (response.ok) {
        const result = await response.json();
        console.log('📡 服务器返回的状态:', result);
        if (result.success) {
          console.log('✅ 设置状态:', { isScheduled: result.data.isScheduled, config: result.data.config });
          setIsScheduled(result.data.isScheduled);
          setConfig(result.data.config);
        } else {
          console.error('❌ 服务器返回错误:', result.message);
        }
      } else {
        console.error('❌ 请求失败:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ 加载定时任务状态失败:', error);
    }
  };

  useEffect(() => {
    // 立即加载状态
    loadScheduleStatus();
    
    // 每10秒刷新一次状态
    const interval = setInterval(loadScheduleStatus, 10000);
    
    // 页面可见性变化时刷新状态
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadScheduleStatus();
      }
    };
    
    // 窗口获得焦点时刷新状态
    const handleFocus = () => {
      loadScheduleStatus();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // 启动定时任务
  const startSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          mode: config.mode,
          interval: config.interval,
          scheduledTime: config.scheduledTime
        }),
      });

      const result = await response.json();
      if (result.success) {
        setIsScheduled(true);
        setConfig(result.data);
        onScheduleChange?.();
      } else {
        setError(result.message);
      }
    } catch (error: any) {
      setError(error.message || '启动定时任务失败');
    } finally {
      setLoading(false);
    }
  };

  // 停止定时任务
  const stopSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });

      const result = await response.json();
      if (result.success) {
        setIsScheduled(false);
        setConfig(result.data);
        onScheduleChange?.();
      } else {
        setError(result.message);
      }
    } catch (error: any) {
      setError(error.message || '停止定时任务失败');
    } finally {
      setLoading(false);
    }
  };

  // 更新配置
  const updateConfig = async (newMode: 'interval' | 'time', newInterval: number, newScheduledTime: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          mode: newMode,
          interval: newInterval,
          scheduledTime: newScheduledTime
        }),
      });

      const result = await response.json();
      if (result.success) {
        setConfig(result.data);
        if (result.data.enabled) {
          setIsScheduled(true);
        }
        onScheduleChange?.();
      } else {
        setError(result.message);
      }
    } catch (error: any) {
      setError(error.message || '更新配置失败');
    } finally {
      setLoading(false);
    }
  };

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

  // 时间转换辅助函数
  const timeToMinutes = (timeString: string): number => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const getTimeDescription = (timeString: string): string => {
    const [hours] = timeString.split(':').map(Number);
    if (hours === 0) return '午夜';
    if (hours < 6) return '凌晨';
    if (hours < 12) return '上午';
    if (hours === 12) return '中午';
    if (hours < 18) return '下午';
    return '晚上';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">定时抓取管理</h3>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isScheduled 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {isScheduled ? '运行中' : '已停止'}
          </span>
          <button
            onClick={loadScheduleStatus}
            disabled={loading}
            className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
            title="刷新状态"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* 执行模式选择 */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            执行模式:
          </label>
          <select
            value={config.mode}
            onChange={(e) => updateConfig(e.target.value as 'interval' | 'time', config.interval, config.scheduledTime)}
            disabled={loading}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="interval">按间隔执行</option>
            <option value="time">按时间执行</option>
          </select>
        </div>

        {/* 间隔时间设置 */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            {config.mode === 'interval' ? '执行间隔:' : '执行时间:'}
          </label>
          {config.mode === 'interval' ? (
            <select
              value={config.interval}
              onChange={(e) => updateConfig(config.mode, Number(e.target.value), config.scheduledTime)}
              disabled={loading}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value={1}>1分钟</option>
              <option value={5}>5分钟</option>
              <option value={15}>15分钟</option>
              <option value={30}>30分钟</option>
              <option value={60}>1小时</option>
              <option value={120}>2小时</option>
              <option value={240}>4小时</option>
              <option value={480}>8小时</option>
              <option value={720}>12小时</option>
              <option value={1440}>24小时</option>
            </select>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={config.scheduledTime}
                onChange={(e) => updateConfig(config.mode, config.interval, e.target.value)}
                disabled={loading}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 w-36"
                style={{ minWidth: '140px' }}
              />
              <span className="text-sm text-gray-500">
                ({getTimeDescription(config.scheduledTime)})
              </span>
              <div className="flex gap-1 ml-2">
                <button
                  type="button"
                  onClick={() => updateConfig(config.mode, config.interval, '09:00')}
                  disabled={loading}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 quick-time-btn"
                  title="上午9点"
                >
                  9点
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig(config.mode, config.interval, '14:00')}
                  disabled={loading}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 quick-time-btn"
                  title="下午2点"
                >
                  14点
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig(config.mode, config.interval, '02:00')}
                  disabled={loading}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 quick-time-btn"
                  title="凌晨2点"
                >
                  2点
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 状态信息 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">上次运行:</span>
            <span className="ml-2 font-medium">{formatTime(config.lastRun)}</span>
          </div>
          <div>
            <span className="text-gray-600">下次运行:</span>
            <span className="ml-2 font-medium">{formatTime(config.nextRun)}</span>
          </div>
        </div>

        {/* 当前配置显示 */}
        <div className="bg-blue-50 p-3 rounded-md">
          <div className="text-sm text-blue-800">
            <p><strong>当前配置:</strong></p>
            <p>• 执行模式: {config.mode === 'interval' ? '按间隔执行' : '按时间执行'}</p>
            {config.mode === 'interval' ? (
              <p>• 执行间隔: {formatInterval(config.interval)}</p>
            ) : (
              <p>• 执行时间: 每天 {config.scheduledTime}</p>
            )}
            <p>• 时区: {config.timezone}</p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          {!isScheduled ? (
            <button
              onClick={startSchedule}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {loading ? '启动中...' : '启动定时任务'}
            </button>
          ) : (
            <button
              onClick={stopSchedule}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {loading ? '停止中...' : '停止定时任务'}
            </button>
          )}
        </div>

        {/* 说明 */}
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-md">
          <p className="mb-1"><strong>说明:</strong></p>
          <ul className="space-y-1">
            <li>• 定时任务会在后台自动运行，即使关闭浏览器也会继续</li>
            <li>• 按间隔执行：立即开始，按设定间隔重复执行</li>
            <li>• 按时间执行：每天在指定时间执行一次</li>
            <li>• 每次执行都会在服务器控制台打印信息</li>
            <li>• 服务器重启后需要重新启动定时任务</li>
            <li>• 测试完成后建议停止任务或修改为正常间隔</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 