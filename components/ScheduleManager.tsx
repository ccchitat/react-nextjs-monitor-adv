"use client";

import { useState, useEffect } from 'react';

interface ScheduleConfig {
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
    interval: 1440, // 默认24小时
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
      const response = await fetch('/api/schedule');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setIsScheduled(result.data.isScheduled);
          setConfig(result.data.config);
        }
      }
    } catch (error) {
      console.error('加载定时任务状态失败:', error);
    }
  };

  useEffect(() => {
    loadScheduleStatus();
    // 每30秒刷新一次状态
    const interval = setInterval(loadScheduleStatus, 30000);
    return () => clearInterval(interval);
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
  const updateConfig = async (newInterval: number, newScheduledTime: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
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
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* 间隔时间设置 */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            抓取间隔:
          </label>
          <select
            value={config.interval}
            onChange={(e) => updateConfig(Number(e.target.value), config.scheduledTime)}
            disabled={loading}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value={60}>1小时</option>
            <option value={120}>2小时</option>
            <option value={240}>4小时</option>
            <option value={480}>8小时</option>
            <option value={720}>12小时</option>
            <option value={1440}>24小时</option>
          </select>
        </div>

        {/* 执行时间设置 */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            执行时间:
          </label>
          <input
            type="time"
            value={config.scheduledTime}
            onChange={(e) => updateConfig(config.interval, e.target.value)}
            disabled={loading}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <span className="text-sm text-gray-500">（每天）</span>
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
            <p>• 间隔: {formatInterval(config.interval)}</p>
            <p>• 执行时间: 每天 {config.scheduledTime}</p>
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
              {loading ? '启动中...' : '启动定时抓取'}
            </button>
          ) : (
            <button
              onClick={stopSchedule}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {loading ? '停止中...' : '停止定时抓取'}
            </button>
          )}
        </div>

        {/* 说明 */}
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-md">
          <p className="mb-1"><strong>说明:</strong></p>
          <ul className="space-y-1">
            <li>• 定时抓取会在后台自动运行，即使关闭浏览器也会继续</li>
            <li>• 每次抓取都会记录到抓取日志中</li>
            <li>• 默认每天上午9点执行一次，可自定义时间</li>
            <li>• 服务器重启后需要重新启动定时任务</li>
            <li>• 建议使用24小时间隔，避免过于频繁的请求</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 