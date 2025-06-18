"use client";

import { useState, useRef, useEffect } from 'react';
import DataTable from '@/components/DataTable';
import Link from 'next/link';

interface Advertiser {
  adv_logo: string;
  adv_name: string;
  adv_id: string;
  m_id: string;
  adv_category: string;
  mailing_region: string;
  adv_type: string;
  monthly_visits: string;
  rd: string;
  '30_epc': number | string;
  '30_rate': number | string;
  aff_ba: string;
  aff_ba_unit: string;
  aff_ba_text: string;
  approval_type: string;
  join_status: string;
  join_status_text: string;
  approval_type_text: string;
}

export default function Home() {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [epcTimeRange, setEpcTimeRange] = useState<number>(7);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 获取今天的日期作为默认值
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  // 从数据库加载数据
  const loadDataFromDatabase = async (timeRange: number = 7) => {
    try {
      setLoading(true);
      setError(null);
      setAdvertisers([]);
      
      const response = await fetch(`/api/data?date=${selectedDate || new Date().toISOString().split('T')[0]}&timeRange=${timeRange}`);
      
      if (!response.ok) {
        throw new Error('加载数据失败');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setAdvertisers(result.data || []);
        if (result.data && result.data.length > 0) {
          console.log(`从数据库加载了 ${result.data.length} 条数据`);
        } else {
          console.log('数据库中暂无该日期的数据');
        }
      } else {
        setError(result.message || '加载数据失败');
      }
    } catch (err: any) {
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 页面加载时自动加载数据
  useEffect(() => {
    if (selectedDate) {
      loadDataFromDatabase(epcTimeRange);
    }
  }, [selectedDate, epcTimeRange]);

  const fetchData = async () => {
    try {
      setFetching(true);
      setError(null);
      setProgress({ current: 0, total: 0 });
      
      // 创建新的 AbortController
      abortControllerRef.current = new AbortController();
      
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate || new Date().toISOString().split('T')[0]
        }),
        signal: abortControllerRef.current.signal
      });
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      // 处理流式响应
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // 将 Uint8Array 转换为字符串
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.type === 'progress') {
              setProgress(data.data);
            } else if (data.type === 'data') {
              setAdvertisers((prev: Advertiser[]) => [...prev, ...data.data.list]);
            } else if (data.type === 'complete') {
              console.log('抓取完成，重新加载数据库数据');
              // 抓取完成后重新从数据库加载数据
              setTimeout(() => {
                loadDataFromDatabase(epcTimeRange);
              }, 1000);
            }
          } catch (e) {
            console.error('解析数据失败:', e);
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('抓取已停止');
      } else {
        setError(err.message || '请求失败，请稍后重试');
      }
    } finally {
      setFetching(false);
      abortControllerRef.current = null;
    }
  };

  const stopFetching = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setFetching(false);
    }
  };

  // 处理日期变化
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setAdvertisers([]); // 清空当前数据
  };

  // 检查选择的日期是否是今天
  const isToday = () => {
    const today = new Date().toISOString().split('T')[0];
    return selectedDate === today;
  };

  // 格式化日期显示
  const formatDateDisplay = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // 处理EPC时间范围变化
  const handleEpcPeriodChange = (period: number) => {
    setEpcTimeRange(period);
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* 导航栏 */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">广告商数据监控</h1>
          <nav className="flex space-x-4">
            <Link 
              href="/"
              className="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium"
            >
              数据监控
            </Link>
            <Link 
              href="/logs"
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              抓取日志
            </Link>
          </nav>
        </div>
        
        {/* 日期选择和操作按钮 */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* 日期选择 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">数据日期:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              {selectedDate && (
                <span className="text-sm text-gray-500">
                  {formatDateDisplay(selectedDate)}
                </span>
              )}
            </div>
            
            {/* 非今天日期的提示 */}
            {!isToday() && selectedDate && (
              <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 px-3 py-2 rounded-md">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                历史数据查看模式 - 只能查看已保存的数据
              </div>
            )}
          </div>
          
          <div className="flex gap-4">
            {isToday() && (
              <>
                <button
                  onClick={fetchData}
                  disabled={fetching}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {fetching ? '抓取中...' : '开始抓取'}
                </button>
                
                {fetching && (
                  <button
                    onClick={stopFetching}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                  >
                    停止抓取
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {fetching && progress.total > 0 && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow">
            <div className="mb-2">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                ></div>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              正在抓取第 {progress.current} 页，共 {progress.total} 页
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          </div>
        )}

        <DataTable 
          data={advertisers} 
          loading={loading} 
          onEpcPeriodChange={handleEpcPeriodChange}
        />
      </div>
    </main>
  );
}
