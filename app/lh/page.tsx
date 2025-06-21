"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import DataTable from '@/components/DataTable';
import { saveAs } from 'file-saver';
import { useSession, SessionContextValue } from 'next-auth/react';

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
  const { data: session } = useSession() as SessionContextValue;
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [epcTimeRange, setEpcTimeRange] = useState<7 | 14 | 30>(7);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [jumpPage, setJumpPage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [trendFilter, setTrendFilter] = useState('all');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [exporting, setExporting] = useState(false);
  
  // 检查是否为管理员
  const isAdmin = session?.user?.isAdmin || false;

  // 获取今天的日期作为默认值
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  // 从数据库加载数据（支持分页和排序）
  const loadDataFromDatabase = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      setCurrentPage(page);

      // 如果有趋势筛选，调用EPC接口获取所有符合条件的数据（不分页）
      if (trendFilter !== 'all') {
        const response = await fetch('/api/epc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            period: epcTimeRange,
            endDate: selectedDate || new Date().toISOString().split('T')[0],
            trend: trendFilter,
            page: page,
            pageSize: pageSize
          }),
        });
        
        if (!response.ok) {
          throw new Error('加载筛选数据失败');
        }
        
        const result = await response.json();
        if (result.success) {
          setAdvertisers(result.advertisers || []);
          setTotal(result.total || 0);
        } else {
          setAdvertisers([]);
          setTotal(0);
        }
        return;
      }

      // 正常加载数据（无趋势筛选，使用分页和排序）
      const params = new URLSearchParams({
        date: selectedDate || new Date().toISOString().split('T')[0],
        page: String(page),
        pageSize: String(pageSize),
      });
      if (searchTerm) params.append('search', searchTerm);
      if (epcTimeRange) params.append('epcPeriod', String(epcTimeRange));
      if (sortField) {
        params.append('sortField', sortField);
        params.append('sortDirection', sortDirection);
      }
      const response = await fetch(`/api/data?${params.toString()}`);
      if (!response.ok) {
        throw new Error('加载数据失败');
      }
      const result = await response.json();
      if (result.success) {
        setAdvertisers(result.data || []);
        setTotal(result.total || 0);
      } else {
        setError(result.message || '加载数据失败');
      }
    } catch (err: any) {
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 页面加载或日期变化时自动加载第一页
  useEffect(() => {
    if (selectedDate) {
      loadDataFromDatabase(1);
    }
  }, [selectedDate, pageSize, searchTerm, epcTimeRange, trendFilter, sortField, sortDirection]);

  const fetchData = async () => {
    try {
      setFetching(true);
      setError(null);
      setProgress({ current: 0, total: 0 });
      
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.type === 'progress') {
              setProgress(data.data);
            } else if (data.type === 'data') {
              console.log(`抓取到第 ${data.data.list.length} 条数据`);
            } else if (data.type === 'complete') {
              console.log('抓取完成，重新加载数据库数据');
              setTimeout(() => {
                loadDataFromDatabase();
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
      setTimeout(() => {
        loadDataFromDatabase();
      }, 500);
    }
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setAdvertisers([]);
  };

  const isToday = () => {
    const today = new Date().toISOString().split('T')[0];
    return selectedDate === today;
  };

  const formatDateDisplay = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleEpcPeriodChange = (period: 7 | 14 | 30) => {
    setEpcTimeRange(period);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    loadDataFromDatabase(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const handleTrendFilterChange = (trend: string) => {
    setTrendFilter(trend);
    setCurrentPage(1);
  };

  const handleSortChange = (field: string) => {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else if (sortDirection === 'asc') {
        setSortField(null);
        setSortDirection('desc');
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  
  const handleJump = () => {
    const page = Math.max(1, Math.min(totalPages, Number(jumpPage)));
    if (!isNaN(page)) handlePageChange(page);
    setJumpPage('');
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          searchTerm,
          epcPeriod: epcTimeRange,
          trendFilter,
          sortField,
          sortDirection
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '导出失败');
      }

      const blob = await response.blob();
      const fileName = `广告商数据_${selectedDate}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // 直接使用导入的saveAs函数
      saveAs(blob, fileName);
      
    } catch (error: any) {
      console.error('导出失败:', error);
      alert(`导出失败: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 relative z-10">
          <h1 className="text-3xl font-bold text-gray-900">linkhaitao数据监控</h1>
          <nav className="flex space-x-4">
            <Link 
              href="/lh"
              className="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium border-b-2 border-blue-600"
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
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  系统设置
                </Link>
              </>
            )}
          </nav>
        </div>
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
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
            {isToday() && isAdmin && (
              <>
                {!fetching && (
                  <button
                    onClick={fetchData}
                    disabled={fetching}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    开始抓取
                  </button>
                )}
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
            {/* 导出Excel按钮 */}
            <button
              onClick={handleExportExcel}
              disabled={exporting || advertisers.length === 0}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  导出中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  导出Excel
                </>
              )}
            </button>
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
          selectedDate={selectedDate}
          epcPeriod={epcTimeRange}
          trendFilter={trendFilter}
          onTrendFilterChange={handleTrendFilterChange}
          searchTerm={searchTerm}
          onSearchChange={handleSearch}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
        />
        
        <div className="flex flex-wrap justify-center items-center mt-6 gap-2">
          <button
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1 || loading}
            className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            上一页
          </button>

          {(() => {
            const totalPages = Math.max(1, Math.ceil(total / pageSize));
            const getPaginationNumbers = (currentPage: number, totalPages: number, visiblePagesCount: number = 5) => {
              if (totalPages <= visiblePagesCount + 2) {
                return Array.from({ length: totalPages }, (_, i) => i + 1);
              }

              const pages: (number | string)[] = [];
              const sidePages = Math.floor((visiblePagesCount - 1) / 2);
              let startPage = currentPage - sidePages;
              let endPage = currentPage + sidePages;
              
              if(visiblePagesCount % 2 === 0) {
                 endPage++;
              }

              if (currentPage - 1 < visiblePagesCount) {
                  startPage = 2;
                  endPage = visiblePagesCount + 1;
              }
              
              if(totalPages - currentPage < visiblePagesCount) {
                  startPage = totalPages - visiblePagesCount;
                  endPage = totalPages - 1;
              }
              
              pages.push(1);

              if (startPage > 2) {
                pages.push('...');
              }

              for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
              }

              if (endPage < totalPages - 1) {
                pages.push('... ');
              }
              
              pages.push(totalPages);

              return pages;
            };

            const pages = getPaginationNumbers(currentPage, totalPages, 3);
            
            return pages.map((p, idx) =>
              typeof p === 'string'
                ? <span key={`${p}-${idx}`} className="px-2 text-gray-400">...</span>
                : <button
                    key={p}
                    onClick={() => handlePageChange(Number(p))}
                    disabled={p === currentPage || loading}
                    className={`px-3 py-1 rounded transition-all duration-200 ${
                      p === currentPage 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-600 hover:bg-blue-100'
                    }`}
                  >{p}</button>
            );
          })()}

          <button
            onClick={() => handlePageChange(Math.min(Math.max(1, Math.ceil(total / pageSize)), currentPage + 1))}
            disabled={currentPage === Math.max(1, Math.ceil(total / pageSize)) || loading}
            className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            下一页
          </button>

          <span className="ml-4 text-gray-600">共 {Math.max(1, Math.ceil(total / pageSize))} 页</span>

          <div className="flex items-center gap-2 ml-4">
            <span className="text-sm text-gray-600">跳转到:</span>
            <input
              type="number"
              min={1}
              max={Math.max(1, Math.ceil(total / pageSize))}
              value={jumpPage}
              onChange={e => setJumpPage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleJump(); }}
              className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              placeholder="页码"
            />
            <button
              onClick={handleJump}
              className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-200"
              disabled={!jumpPage || isNaN(Number(jumpPage)) || Number(jumpPage) < 1 || Number(jumpPage) > Math.max(1, Math.ceil(total / pageSize))}
            >
              跳转
            </button>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <span className="text-sm text-gray-600">每页:</span>
            <select
              value={pageSize}
              onChange={e => handlePageSizeChange(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            >
              {[5, 10, 20, 50, 100].map(size => (
                <option key={size} value={size}>{size}条</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </main>
  );
} 