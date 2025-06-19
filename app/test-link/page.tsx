"use client";

import Link from 'next/link';

export default function TestLinkPage() {
  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">链接测试页面</h1>
        
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">测试链接</h2>
            <div className="space-y-2">
              <Link 
                href="/"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                返回主页
              </Link>
              
              <Link 
                href="/logs"
                className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 ml-2"
              >
                抓取日志
              </Link>
            </div>
          </div>
          
          <div className="p-4 bg-white rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">直接跳转按钮</h2>
            <div className="space-y-2">
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                返回主页 (window.location)
              </button>
              
              <button
                onClick={() => window.location.href = '/logs'}
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 ml-2"
              >
                抓取日志 (window.location)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 