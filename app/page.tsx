"use client";

import { useState, useRef, useEffect } from 'react';
import DataTable from '@/components/DataTable';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

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
  const [epcTimeRange, setEpcTimeRange] = useState<7 | 14 | 30>(7);
  const [exportData, setExportData] = useState<Advertiser[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [jumpPage, setJumpPage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [trendFilter, setTrendFilter] = useState('all');

  // 获取今天的日期作为默认值
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  // 从数据库加载数据（支持分页）
  const loadDataFromDatabase = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      setAdvertisers([]);
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
          console.log(`[page.tsx] 成功加载了 ${result.advertisers?.length || 0} 条筛选后的数据，总数: ${result.total}`);
        } else {
          setAdvertisers([]);
          setTotal(0);
          console.log('[page.tsx] 没有找到符合趋势条件的数据');
        }
        return;
      }

      // 正常加载数据（无趋势筛选，使用分页）
      const params = new URLSearchParams({
        date: selectedDate || new Date().toISOString().split('T')[0],
        page: String(page),
        pageSize: String(pageSize),
      });
      if (searchTerm) params.append('search', searchTerm);
      if (epcTimeRange) params.append('epcPeriod', String(epcTimeRange));
      const response = await fetch(`/api/data?${params.toString()}`);
      if (!response.ok) {
        throw new Error('加载数据失败');
      }
      const result = await response.json();
      if (result.success) {
        setAdvertisers(result.data || []);
        setTotal(result.total || 0);
        if (result.data && result.data.length > 0) {
          console.log(`[page.tsx] 成功从数据库加载了 ${result.data.length} 条基础数据`);
        } else {
          console.log('[page.tsx] 数据库中暂无该日期的数据');
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

  // 页面加载或日期变化时自动加载第一页
  useEffect(() => {
    if (selectedDate) {
      loadDataFromDatabase(1);
    }
  }, [selectedDate, pageSize, searchTerm, epcTimeRange, trendFilter]);

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
  const handleEpcPeriodChange = (period: 7 | 14 | 30) => {
    setEpcTimeRange(period);
    setCurrentPage(1);
  };

  // 处理分页切换
  const handlePageChange = (page: number) => {
    loadDataFromDatabase(page);
  };

  // 处理每页条数变化
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // 处理搜索输入
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  // 处理趋势筛选变化
  const handleTrendFilterChange = (trend: string) => {
    setTrendFilter(trend);
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  
  const handleJump = () => {
    const page = Math.max(1, Math.min(totalPages, Number(jumpPage)));
    if (!isNaN(page)) handlePageChange(page);
    setJumpPage('');
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* 导航栏 */}
        <div className="flex justify-between items-center mb-8 relative z-10">
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
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium cursor-pointer"
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
              onClick={() => {
                try {
                  console.log('开始导出Excel，数据条数:', exportData.length);
                  
                  // 检查数据
                  if (!exportData || exportData.length === 0) {
                    alert('没有可导出的数据');
                    return;
                  }

                  // 生成默认文件名
                  const now = new Date();
                  const dateStr = now.toISOString().split('T')[0];
                  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
                  const defaultFileName = `广告商数据_${dateStr}_${timeStr}.xlsx`;
                  
                  // 让用户自定义文件名
                  const customFileName = prompt(
                    `请输入文件名（不包含扩展名）:\n\n默认文件名: ${defaultFileName.replace('.xlsx', '')}\n\n提示：文件将下载到您的默认下载目录`,
                    defaultFileName.replace('.xlsx', '')
                  );
                  
                  if (!customFileName) {
                    console.log('用户取消了导出');
                    return;
                  }
                  
                  const fileName = customFileName.endsWith('.xlsx') ? customFileName : `${customFileName}.xlsx`;

                  // 准备导出数据
                  console.log('正在准备导出数据...');
                  const exportDataForExcel = exportData.map(item => ({
                    '广告商名称': item.adv_name || '',
                    '广告商ID': item.adv_id || '',
                    '分类': item.adv_category || '-',
                    '类型': item.adv_type || '-',
                    '地区': item.mailing_region || '-',
                    '月访问量': item.monthly_visits || '-',
                    '30天EPC': item['30_epc'] || '-',
                    '30天转化率': item['30_rate'] || '-',
                    '审批类型': item.approval_type || '-',
                    '加入状态': item.join_status || '-',
                    '联盟BA': item.aff_ba || '-',
                    'RD': item.rd || '-'
                  }));

                  console.log('导出数据准备完成，条数:', exportDataForExcel.length);

                  // 创建工作簿
                  console.log('正在创建工作簿...');
                  const wb = XLSX.utils.book_new();
                  const ws = XLSX.utils.json_to_sheet(exportDataForExcel);

                  // 设置列宽
                  const colWidths = [
                    { wch: 20 }, // 广告商名称
                    { wch: 15 }, // 广告商ID
                    { wch: 12 }, // 分类
                    { wch: 12 }, // 类型
                    { wch: 12 }, // 地区
                    { wch: 12 }, // 月访问量
                    { wch: 12 }, // 30天EPC
                    { wch: 12 }, // 30天转化率
                    { wch: 12 }, // 审批类型
                    { wch: 12 }, // 加入状态
                    { wch: 12 }, // 联盟BA
                    { wch: 10 }  // RD
                  ];
                  ws['!cols'] = colWidths;

                  // 添加工作表到工作簿
                  XLSX.utils.book_append_sheet(wb, ws, '广告商数据');

                  console.log('正在生成Excel文件...');
                  // 导出文件
                  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                  
                  console.log('正在下载文件:', fileName);
                  saveAs(blob, fileName);

                  console.log(`成功导出 ${exportDataForExcel.length} 条数据到 ${fileName}`);
                  
                  // 显示成功消息，包含下载位置提示
                  alert(`✅ 导出成功！\n\n📊 数据条数: ${exportDataForExcel.length}\n📁 文件名: ${fileName}\n📂 下载位置: 您的默认下载目录\n\n💡 提示：您可以在浏览器设置中更改默认下载目录`);
                } catch (error) {
                  console.error('导出Excel失败，详细错误:', error);
                  console.error('错误堆栈:', error instanceof Error ? error.stack : '无堆栈信息');
                  alert(`❌ 导出失败: ${error instanceof Error ? error.message : '未知错误'}，请稍后重试`);
                }
              }}
              disabled={exportData.length === 0}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              导出Excel
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
          onExportDataChange={setExportData}
          selectedDate={selectedDate}
          epcPeriod={epcTimeRange}
          trendFilter={trendFilter}
          onTrendFilterChange={handleTrendFilterChange}
          searchTerm={searchTerm}
          onSearchChange={handleSearch}
        />
        {/* 分页控件重写区 */}
        <div className="flex flex-wrap justify-center items-center mt-6 gap-2">
          {/* 上一页按钮 */}
          <button
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1 || loading}
            className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            上一页
          </button>

          {/* 滑动窗口页码 */}
          {(() => {
            const totalPages = Math.max(1, Math.ceil(total / pageSize));

            /**
             * 生成分页页码的核心函数
             * @param currentPage - 当前页码
             * @param totalPages - 总页数
             * @param visiblePagesCount - 在当前页周围希望看到的页码数量（不包括第一页、最后一页和省略号）
             * @returns {Array<number|string>} - 用于渲染的页码和省略号数组
             */
            const getPaginationNumbers = (currentPage: number, totalPages: number, visiblePagesCount: number = 5) => {
              // 1. 如果总页数很少，不足以需要省略号，则直接显示所有页码
              if (totalPages <= visiblePagesCount + 2) { // 例如 total=7, visible=5 -> [1,2,3,4,5,6,7]
                return Array.from({ length: totalPages }, (_, i) => i + 1);
              }

              const pages: (number | string)[] = [];

              // 2. 处理当前页在 "中间区域" 的情况
              // 例如 total=20, current=10 -> [1, '...', 9, 10, 11, '...', 20]
              const sidePages = Math.floor((visiblePagesCount - 1) / 2); // 核心页码两边的数量
              let startPage = currentPage - sidePages;
              let endPage = currentPage + sidePages;
              
              // 保证中间页码数量始终为 visiblePagesCount
              if(visiblePagesCount % 2 === 0) {
                 endPage++;
              }

              // 3. 处理当前页靠近 "起始" 的情况
              // 例如 total=20, current=3 -> [1, 2, 3, 4, 5, '...', 20]
              if (currentPage - 1 < visiblePagesCount) {
                  startPage = 2;
                  endPage = visiblePagesCount + 1;
              }
              
              // 4. 处理当前页靠近 "末尾" 的情况
              // 例如 total=20, current=18 -> [1, '...', 16, 17, 18, 19, 20]
              if(totalPages - currentPage < visiblePagesCount) {
                  startPage = totalPages - visiblePagesCount;
                  endPage = totalPages - 1;
              }
              
              pages.push(1); // 始终显示第一页

              if (startPage > 2) {
                pages.push('...'); // 左侧省略号
              }

              for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
              }

              if (endPage < totalPages - 1) {
                // 为了避免React的key冲突，在第二个省略号后加一个空格
                pages.push('... '); // 右侧省略号
              }
              
              pages.push(totalPages); // 始终显示最后一页

              return pages;
            };

            const pages = getPaginationNumbers(currentPage, totalPages, 3); // visiblePagesCount=3 意味着中间部分是 [prev, current, next]
            
            return pages.map((p, idx) =>
              typeof p === 'string'
                ? <span key={`${p}-${idx}`} className="px-2 text-gray-400">...</span>
                : <button
                    key={p}
                    onClick={() => handlePageChange(Number(p))}
                    disabled={p === currentPage || loading}
                    className={`px-3 py-1 rounded transition-colors ${
                      p === currentPage 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-600 hover:bg-blue-100'
                    }`}
                  >{p}</button>
            );
          })()}

          {/* 下一页按钮 */}
          <button
            onClick={() => handlePageChange(Math.min(Math.max(1, Math.ceil(total / pageSize)), currentPage + 1))}
            disabled={currentPage === Math.max(1, Math.ceil(total / pageSize)) || loading}
            className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            下一页
          </button>

          {/* 页码信息 */}
          <span className="ml-4 text-gray-600">共 {Math.max(1, Math.ceil(total / pageSize))} 页</span>

          {/* 跳转功能 */}
          <div className="flex items-center gap-2 ml-4">
            <span className="text-sm text-gray-600">跳转到:</span>
            <input
              type="number"
              min={1}
              max={Math.max(1, Math.ceil(total / pageSize))}
              value={jumpPage}
              onChange={e => setJumpPage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleJump(); }}
              className="w-16 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="页码"
            />
            <button
              onClick={handleJump}
              className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              disabled={!jumpPage || isNaN(Number(jumpPage)) || Number(jumpPage) < 1 || Number(jumpPage) > Math.max(1, Math.ceil(total / pageSize))}
            >
              跳转
            </button>
          </div>

          {/* 每页条数选择 */}
          <div className="flex items-center gap-2 ml-4">
            <span className="text-sm text-gray-600">每页:</span>
            <select
              value={pageSize}
              onChange={e => handlePageSizeChange(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[5, 10, 20, 50, 100].map(size => (
                <option key={size} value={size}>{size}条</option>
              ))}
            </select>
          </div>
        </div>
        {/* 分页控件重写区 END */}
      </div>
    </main>
  );
}
