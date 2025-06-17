"use client";

import { useState, useRef } from 'react';

export default function Home() {
  const [advertisers, setAdvertisers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      setProgress({ current: 0, total: 0 });
      
      // 创建新的 AbortController
      abortControllerRef.current = new AbortController();
      
      const response = await fetch('/api/crawl', {
        method: 'POST',
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
              setAdvertisers(prev => [...prev, ...data.data.list.map((item: any) => item.adv_name)]);
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
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const stopFetching = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">广告商列表</h1>
        
        <div className="flex gap-4 mb-6">
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? '抓取中...' : '开始抓取'}
          </button>
          
          {loading && (
            <button
              onClick={stopFetching}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              停止抓取
            </button>
          )}
        </div>

        {loading && progress.total > 0 && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              正在抓取第 {progress.current} 页，共 {progress.total} 页
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {advertisers.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <ul className="divide-y divide-gray-200">
              {advertisers.map((name, index) => (
                <li key={index} className="p-4 hover:bg-gray-50">
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
