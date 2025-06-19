"use client";

import { useState, useEffect, useMemo } from 'react';
import EPCChart from './EPCChart';

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
  epc_history?: number[];
  date_labels?: string[];
}

interface DataTableProps {
  data: Advertiser[];
  loading: boolean;
  selectedDate: string;
  onEpcPeriodChange?: (period: EPCPeriod) => void;
  onExportDataChange?: (data: Advertiser[]) => void;
}

type EPCPeriod = 7 | 14 | 30;

const AdvertiserLogo = ({ logoUrl, advertiserName }: { logoUrl: string, advertiserName: string }) => {
  const [hasError, setHasError] = useState(!logoUrl);

  useEffect(() => {
    setHasError(!logoUrl);
  }, [logoUrl]);

  if (hasError) {
    return (
      <div className="h-8 w-8 rounded-full mr-3 flex-shrink-0 bg-gray-200 flex items-center justify-center">
        <span className="font-medium text-gray-500 text-xs">
          {advertiserName ? advertiserName.charAt(0).toUpperCase() : '?'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={advertiserName}
      className="h-8 w-8 rounded-full mr-3 flex-shrink-0 object-cover"
      onError={() => setHasError(true)}
    />
  );
};

export default function DataTable({ data, loading, selectedDate, onEpcPeriodChange, onExportDataChange }: DataTableProps) {
  const [sortField, setSortField] = useState<keyof Advertiser | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [processedData, setProcessedData] = useState<Advertiser[]>([]);
  const [epcPeriod, setEpcPeriod] = useState<EPCPeriod>(7);
  const [epcTrendFilter, setEpcTrendFilter] = useState<'all' | 'up' | 'down' | 'flat'>('all');
  const [epcData, setEpcData] = useState<Record<string, { history: number[], labels: string[] }>>({});
  const [loadingEpc, setLoadingEpc] = useState<Record<string, boolean>>({});
  const itemsPerPage = 20;

  // 处理数据，直接使用数据库返回的真实数据
  useEffect(() => {
    if (data.length > 0) {
      setProcessedData(data);
    } else {
      setProcessedData([]);
    }
  }, [data]);

  // 检查EPC趋势
  const checkEpcTrend = (epcHistory: number[]): 'up' | 'down' | 'flat' => {
    if (!epcHistory || epcHistory.length < 2) return 'flat';
    
    const validData = epcHistory.filter(epc => !isNaN(epc) && epc !== null && epc !== undefined);
    if (validData.length < 2) return 'flat';
    
    const first = validData[0];
    const last = validData[validData.length - 1];
    const change = ((last - first) / first) * 100;
    
    if (change > 5) return 'up';      // 上升超过5%
    if (change < -5) return 'down';   // 下降超过5%
    return 'flat';                    // 变化在±5%以内视为平稳
  };

  // 当数据变化时，获取所有数据的EPC趋势
  useEffect(() => {
    const fetchAllEpcData = async () => {
      if (processedData.length === 0 || !selectedDate) return;
      
      // 获取所有需要加载的广告商ID
      const idsToFetch = processedData
        .map(item => item.adv_id)
        .filter(id => !epcData[id] && !loadingEpc[id]);

      if (idsToFetch.length === 0) return;

      // 更新加载状态
      setLoadingEpc(prev => {
        const newLoading = { ...prev };
        idsToFetch.forEach(id => { newLoading[id] = true; });
        return newLoading;
      });

      try {
        // 分批获取数据，每批50个
        const batchSize = 50;
        const batches = [];
        for (let i = 0; i < idsToFetch.length; i += batchSize) {
          batches.push(idsToFetch.slice(i, i + batchSize));
        }

        // 并发请求所有批次
        const results = await Promise.all(
          batches.map(async (batch) => {
            const response = await fetch(`/api/epc`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                adv_ids: batch,
                period: epcPeriod,
                endDate: selectedDate
              }),
            });

            if (!response.ok) {
              throw new Error('获取EPC数据失败');
            }

            const result = await response.json();
            return result.success ? result.data : {};
          })
        );

        // 合并所有批次的结果
        const combinedResults = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
        setEpcData(prev => ({ ...prev, ...combinedResults }));

      } catch (error) {
        console.error('[DataTable] 获取EPC数据失败:', error);
      } finally {
        setLoadingEpc(prev => {
          const newLoading = { ...prev };
          idsToFetch.forEach(id => { delete newLoading[id]; });
          return newLoading;
        });
      }
    };

    fetchAllEpcData();
  }, [processedData, epcPeriod, selectedDate]);

  // 过滤数据
  const filteredByTrend = useMemo(() => {
    // 如果正在加载任何EPC数据，返回所有数据
    if (Object.keys(loadingEpc).length > 0) {
      return processedData;
    }

    return processedData.filter(item => {
      if (epcTrendFilter === 'all') return true;
      
      const itemEpcData = epcData[item.adv_id];
      
      // 如果没有数据且筛选条件是平稳，则显示
      if (!itemEpcData || !itemEpcData.history || itemEpcData.history.length === 0) {
        return epcTrendFilter === 'flat';
      }
      
      const trend = checkEpcTrend(itemEpcData.history);
      return trend === epcTrendFilter;
    });
  }, [processedData, epcData, epcTrendFilter, loadingEpc]);

  // 搜索过滤
  const searchFilteredData = useMemo(() => {
    return filteredByTrend.filter(item =>
      Object.values(item).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [filteredByTrend, searchTerm]);

  // 排序
  const sortedData = useMemo(() => {
    return [...searchFilteredData].sort((a, b) => {
      if (!sortField || !sortDirection) return 0;
      
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (sortField === '30_epc' || sortField === '30_rate' || sortField === 'monthly_visits') {
        const aNum = typeof aValue === 'number' ? aValue : parseFloat(String(aValue).replace(/[^\d.-]/g, '')) || 0;
        const bNum = typeof bValue === 'number' ? bValue : parseFloat(String(bValue).replace(/[^\d.-]/g, '')) || 0;
        
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue, 'zh-CN')
          : bValue.localeCompare(aValue, 'zh-CN');
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      const aStr = String(aValue || '');
      const bStr = String(bValue || '');
      return sortDirection === 'asc' 
        ? aStr.localeCompare(bStr, 'zh-CN')
        : bStr.localeCompare(aStr, 'zh-CN');
    });
  }, [searchFilteredData, sortField, sortDirection]);

  // 分页
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage);

  // 通知父组件当前可导出的数据
  useEffect(() => {
    if (onExportDataChange) {
      onExportDataChange(sortedData);
    }
  }, [sortedData, onExportDataChange]);

  // 处理排序
  const handleSort = (field: keyof Advertiser) => {
    if (sortField === field) {
      // 循环：null -> asc -> desc -> null
      if (sortDirection === null) {
        setSortDirection('asc');
      } else if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // 获取排序图标
  const SortIcon = ({ field }: { field: keyof Advertiser }) => {
    const isCurrentField = sortField === field;
    return (
      <div className="flex flex-col -space-y-1">
        <svg 
          className={`w-3 h-3 ${isCurrentField && sortDirection === 'asc' ? 'text-green-500' : 'text-gray-400'}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
        <svg 
          className={`w-3 h-3 ${isCurrentField && sortDirection === 'desc' ? 'text-green-500' : 'text-gray-400'}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    );
  };

  // 格式化数字显示（K、M、B单位）
  const formatNumber = (value: string | number): string => {
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.-]/g, '')) || 0;
    
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1) + 'B';
    } else if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    } else {
      return num.toString();
    }
  };

  // 处理EPC周期变化
  const handleEpcPeriodChange = (period: EPCPeriod) => {
    setEpcPeriod(period);
    setCurrentPage(1); // 重置到第一页
    setEpcData({}); // 清空已获取的EPC数据
    setLoadingEpc({}); // 清空加载状态
    if (onEpcPeriodChange) {
      onEpcPeriodChange(period);
    }
  };

  // 处理EPC趋势筛选变化
  const handleEpcTrendFilterChange = (filter: 'all' | 'up' | 'down' | 'flat') => {
    setEpcTrendFilter(filter);
    setCurrentPage(1); // 重置到第一页
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">正在加载数据...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        暂无数据，请点击"开始抓取"按钮获取数据
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* 加载指示器 */}
      {loading && (
        <div className="p-3 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center justify-center text-blue-600 text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            正在加载数据...
          </div>
        </div>
      )}
      
      {/* 搜索和统计 */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <input
              type="text"
              placeholder="搜索广告商..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">
              共 {sortedData.length} 条记录
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* EPC时间范围选择 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">EPC趋势:</span>
              <div className="flex border border-gray-300 rounded-md overflow-hidden">
                {([7, 14, 30] as EPCPeriod[]).map((period) => (
                  <button
                    key={period}
                    onClick={() => handleEpcPeriodChange(period)}
                    className={`px-3 py-1 text-sm font-medium transition-colors ${
                      epcPeriod === period
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {period}天
                  </button>
                ))}
              </div>
            </div>
            
            {/* EPC趋势筛选 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">趋势筛选:</span>
              <div className="flex border border-gray-300 rounded-md overflow-hidden">
                <button
                  onClick={() => handleEpcTrendFilterChange('all')}
                  className={`px-3 py-1 text-sm font-medium transition-colors ${
                    epcTrendFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  全部
                </button>
                <button
                  onClick={() => handleEpcTrendFilterChange('up')}
                  className={`px-3 py-1 text-sm font-medium transition-colors ${
                    epcTrendFilter === 'up'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  上升
                </button>
                <button
                  onClick={() => handleEpcTrendFilterChange('down')}
                  className={`px-3 py-1 text-sm font-medium transition-colors ${
                    epcTrendFilter === 'down'
                      ? 'bg-red-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  下降
                </button>
                <button
                  onClick={() => handleEpcTrendFilterChange('flat')}
                  className={`px-3 py-1 text-sm font-medium transition-colors ${
                    epcTrendFilter === 'flat'
                      ? 'bg-gray-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  平稳
                </button>
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              第 {currentPage} 页，共 {totalPages} 页
            </div>
          </div>
        </div>
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }}>
                广告商信息
              </th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
                分类
              </th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
                类型
              </th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}>
                地区
              </th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-50" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }} onClick={() => handleSort('monthly_visits')}>
                <div className="flex items-center justify-center gap-2">
                  <span className="group-hover:text-gray-900">月访问量</span>
                  <SortIcon field="monthly_visits" />
                </div>
              </th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-50" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }} onClick={() => handleSort('30_epc')}>
                <div className="flex items-center justify-center gap-2">
                  <span className="group-hover:text-gray-900">30天EPC</span>
                  <SortIcon field="30_epc" />
                </div>
              </th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-50" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }} onClick={() => handleSort('30_rate')}>
                <div className="flex items-center justify-center gap-2">
                  <span className="group-hover:text-gray-900">30天转化率</span>
                  <SortIcon field="30_rate" />
                </div>
              </th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}>
                <span>{epcPeriod}天EPC趋势</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((item, index) => (
              <tr key={item.adv_id} className="hover:bg-gray-50 group h-20">
                <td className="px-4 py-4" style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }}>
                  <div className="flex items-center h-full">
                    <AdvertiserLogo logoUrl={item.adv_logo} advertiserName={item.adv_name} />
                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                      <div 
                        className="text-sm font-medium text-gray-900 truncate cursor-help"
                        title={item.adv_name}
                      >
                        {item.adv_name}
                      </div>
                      <div 
                        className="text-sm text-gray-500 truncate cursor-help mt-1"
                        title={item.adv_id}
                      >
                        ID: {item.adv_id}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
                  <div className="flex items-center justify-center h-full">
                    <div 
                      className="text-sm text-gray-900 truncate cursor-help text-center"
                      title={item.adv_category || '-'}
                    >
                      {item.adv_category || '-'}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
                  <div className="flex items-center justify-center h-full">
                    <div 
                      className="text-sm text-gray-900 truncate cursor-help text-center"
                      title={item.adv_type || '-'}
                    >
                      {item.adv_type || '-'}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4" style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}>
                  <div className="flex items-center justify-center h-full">
                    <div 
                      className="text-sm text-gray-900 truncate cursor-help text-center"
                      title={item.mailing_region || '-'}
                    >
                      {item.mailing_region || '-'}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
                  <div className="flex items-center justify-center h-full">
                    <div 
                      className="text-sm text-gray-900 truncate cursor-help text-center"
                      title={item.monthly_visits ? formatNumber(item.monthly_visits) : '-'}
                    >
                      {item.monthly_visits ? formatNumber(item.monthly_visits) : '-'}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
                  <div className="flex items-center justify-center h-full">
                    <div 
                      className="text-sm text-gray-900 truncate cursor-help text-center"
                      title={String(item['30_epc'] || '-')}
                    >
                      {item['30_epc'] || '-'}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
                  <div className="flex items-center justify-center h-full">
                    <div 
                      className="text-sm text-gray-900 truncate cursor-help text-center"
                      title={String(item['30_rate'] || '-')}
                    >
                      {item['30_rate'] || '-'}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4" style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}>
                  <div className="flex items-center justify-center h-full">
                    {(() => {
                      const itemEpcData = epcData[item.adv_id];
                      const isLoading = loadingEpc[item.adv_id];

                      if (isLoading) {
                        return (
                          <div className="flex items-center justify-center w-[140px] h-[40px]">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                          </div>
                        );
                      }

                      if (itemEpcData && itemEpcData.history && itemEpcData.history.length > 0) {
                        return (
                          <div className="group relative flex items-center justify-center">
                            <div className="flex items-center gap-2">
                              <EPCChart
                                data={itemEpcData.history}
                                labels={itemEpcData.labels}
                                width={140}
                                height={40}
                                color="#3B82F6"
                              />
                              {/* 趋势指示器 */}
                              {(() => {
                                const trend = checkEpcTrend(itemEpcData.history);
                                if (trend === 'up') {
                                  return (
                                    <div className="flex items-center text-green-600 text-xs bg-green-50 px-2 py-1 rounded">
                                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                      </svg>
                                      上升
                                    </div>
                                  );
                                } else if (trend === 'down') {
                                  return (
                                    <div className="flex items-center text-red-600 text-xs bg-red-50 px-2 py-1 rounded">
                                      <svg className="w-3 h-3 mr-1 transform rotate-180" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                      </svg>
                                      下降
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div className="flex items-center text-gray-500 text-xs bg-gray-50 px-2 py-1 rounded">
                                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                      </svg>
                                      平稳
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                            {/* 详细工具提示 */}
                            <div className="absolute -top-32 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs p-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                              <div className="font-medium mb-2">{epcPeriod}天EPC趋势</div>
                              {itemEpcData.labels.map((label, idx) => (
                                <div key={idx} className="flex justify-between gap-4">
                                  <span>{label}:</span>
                                  <span className="text-blue-300">{itemEpcData.history![idx]} EPC</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="flex items-center justify-center w-[140px] h-[40px] bg-gray-50 rounded border border-gray-200">
                          <div className="text-gray-400 text-xs">暂无趋势数据</div>
                        </div>
                      );
                    })()}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              显示第 {startIndex + 1} 到 {Math.min(startIndex + itemsPerPage, sortedData.length)} 条，共 {sortedData.length} 条
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              
              {/* 页码显示 */}
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 text-sm border rounded-md ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
              
              {/* 跳页功能 */}
              <div className="flex items-center space-x-2 ml-4">
                <span className="text-sm text-gray-600">跳转到:</span>
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="页码"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const targetPage = parseInt(e.currentTarget.value);
                      if (targetPage >= 1 && targetPage <= totalPages) {
                        setCurrentPage(targetPage);
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                />
                <span className="text-sm text-gray-500">/ {totalPages}</span>
                <button
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling?.previousElementSibling as HTMLInputElement;
                    const targetPage = parseInt(input.value);
                    if (targetPage >= 1 && targetPage <= totalPages) {
                      setCurrentPage(targetPage);
                      input.value = '';
                    }
                  }}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  跳转
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 