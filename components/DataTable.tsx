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
  epcPeriod?: EPCPeriod;
  trendFilter?: string;
  onTrendFilterChange?: (trend: string) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  sortField?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (field: string) => void;
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

// 数字格式化工具函数（K/M/B 单位）
function formatNumber(value: string | number): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.-]/g, '')) || 0;
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + 'B';
  } else if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  } else {
    return num.toString();
  }
}

// 排序图标组件
function SortIcon({ field, sortField, sortDirection }: { field: keyof Advertiser, sortField: keyof Advertiser | null, sortDirection: 'asc' | 'desc' | null }) {
  const isCurrent = sortField === field;
  return (
    <span className="flex flex-col ml-1">
      <svg className={`w-3 h-3 ${isCurrent && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
      <svg className={`w-3 h-3 -mt-1 ${isCurrent && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </span>
  );
}

export default function DataTable({ data, loading, selectedDate, onEpcPeriodChange, onExportDataChange, epcPeriod = 7, trendFilter = 'all', onTrendFilterChange, searchTerm = '', onSearchChange, sortField, sortDirection, onSortChange }: DataTableProps) {
  const [epcData, setEpcData] = useState<Record<string, { history: number[], labels: string[], trend?: string }>>({});
  const [loadingEpc, setLoadingEpc] = useState<Record<string, boolean>>({});
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  // 通知父组件当前可导出的数据
  useEffect(() => {
    if (onExportDataChange) {
      onExportDataChange(data);
    }
  }, [data, onExportDataChange]);

  // 获取当前页面广告商的EPC数据
  useEffect(() => {
    if (!selectedDate || data.length === 0) return;

    const currentPageIds = data
      .map(item => item.adv_id)
      .filter(id => !epcData[id] && !loadingEpc[id]);

    if (currentPageIds.length === 0) return;

    const fetchCurrentPageEpc = async () => {
      setLoadingEpc(prev => {
        const newLoading = { ...prev };
        currentPageIds.forEach(id => { newLoading[id] = true; });
        return newLoading;
      });

      try {
        const response = await fetch(`/api/epc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adv_ids: currentPageIds,
            period: epcPeriod,
            endDate: selectedDate
          }),
        });
        const result = await response.json();
        if (result.success) {
          setEpcData(prev => ({ ...prev, ...result.data }));
        }
      } catch (error) {
        console.error('[DataTable] 获取当前页EPC数据失败:', error);
      } finally {
        setLoadingEpc(prev => {
          const newLoading = { ...prev };
          currentPageIds.forEach(id => { delete newLoading[id]; });
          return newLoading;
        });
      }
    };

    fetchCurrentPageEpc();
  }, [data, epcPeriod, selectedDate]);

  // 当epcPeriod变化时，清空现有EPC数据
  useEffect(() => {
    setEpcData({});
    setLoadingEpc({});
  }, [epcPeriod]);

  // 处理排序
  const handleSort = (field: keyof Advertiser) => {
    if (onSortChange) {
      onSortChange(field);
    }
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex flex-col">
        {/* 工具栏始终显示 */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* 搜索输入框 */}
              <input
                type="text"
                placeholder="搜索广告商..."
                value={searchTerm}
                onChange={e => onSearchChange && onSearchChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                style={{ minWidth: 200 }}
              />
              <span className="text-sm text-gray-600">
                共 0 条记录
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2">正在加载数据...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col">
        {/* 工具栏始终显示 */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* 搜索输入框 */}
              <input
                type="text"
                placeholder="搜索广告商..."
                value={searchTerm}
                onChange={e => onSearchChange && onSearchChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                style={{ minWidth: 200 }}
              />
              <span className="text-sm text-gray-600">
                共 0 条记录
              </span>
            </div>
          </div>
        </div>
        <div className="text-center p-8 text-gray-500">
          暂无数据，请尝试更换搜索条件或日期
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden transition-all duration-300 ease-in-out">
      {/* 加载指示器 */}
      {loading && (
        <div className="p-3 bg-blue-50 border-b border-blue-200 animate-pulse">
          <div className="flex items-center justify-center text-blue-600 text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            正在加载数据...
          </div>
        </div>
      )}
      
      {/* 搜索和统计+筛选UI */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* 搜索输入框 */}
            <input
              type="text"
              placeholder="搜索广告商..."
              value={searchTerm}
              onChange={e => onSearchChange && onSearchChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              style={{ minWidth: 200 }}
            />
            <span className="text-sm text-gray-600">
              共 {data.length} 条记录
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
                    onClick={() => onEpcPeriodChange && onEpcPeriodChange(period)}
                    className={`px-3 py-1 text-sm font-medium transition-all duration-200 ${
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
                  onClick={() => onTrendFilterChange && onTrendFilterChange('all')}
                  className={`px-3 py-1 text-sm font-medium transition-all duration-200 ${
                    trendFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  全部
                </button>
                <button
                  onClick={() => onTrendFilterChange && onTrendFilterChange('UPWARD')}
                  className={`px-3 py-1 text-sm font-medium transition-all duration-200 ${
                    trendFilter === 'UPWARD'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  上升
                </button>
                <button
                  onClick={() => onTrendFilterChange && onTrendFilterChange('DOWNWARD')}
                  className={`px-3 py-1 text-sm font-medium transition-all duration-200 ${
                    trendFilter === 'DOWNWARD'
                      ? 'bg-red-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  下降
                </button>
                <button
                  onClick={() => onTrendFilterChange && onTrendFilterChange('STABLE')}
                  className={`px-3 py-1 text-sm font-medium transition-all duration-200 ${
                    trendFilter === 'STABLE'
                      ? 'bg-gray-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  平稳
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300 transition-opacity duration-300" style={{ tableLayout: 'fixed', opacity: loading ? 0.6 : 1 }}>
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
                  <SortIcon field="monthly_visits" sortField={sortField as keyof Advertiser} sortDirection={sortDirection} />
                </div>
              </th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-50" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }} onClick={() => handleSort('30_epc')}>
                <div className="flex items-center justify-center gap-2">
                  <span className="group-hover:text-gray-900">30天EPC</span>
                  <SortIcon field="30_epc" sortField={sortField as keyof Advertiser} sortDirection={sortDirection} />
                </div>
              </th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-50" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }} onClick={() => handleSort('30_rate')}>
                <div className="flex items-center justify-center gap-2">
                  <span className="group-hover:text-gray-900">30天转化率</span>
                  <SortIcon field="30_rate" sortField={sortField as keyof Advertiser} sortDirection={sortDirection} />
                </div>
              </th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}>
                <span>{epcPeriod}天EPC趋势</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, rowIdx) => (
              <tr key={item.adv_id} className="hover:bg-gray-50 group h-20 transition-all duration-200">
                {/* 广告商信息 */}
                <td
                  className="px-4 py-4 relative"
                  style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }}
                  onMouseEnter={() => setHoveredCell({ row: rowIdx, col: 0 })}
                  onMouseLeave={() => setHoveredCell(null)}
                >
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
                  {hoveredCell && hoveredCell.row === rowIdx && hoveredCell.col === 0 && (
                    <div className="absolute -top-20 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs p-3 rounded-lg z-10 whitespace-nowrap">
                      <div className="font-medium mb-1">广告商信息</div>
                      <div>名称：{item.adv_name}</div>
                      <div>ID：{item.adv_id}</div>
                      <div>m_id：{item.m_id}</div>
                      <div>联盟BA：{item.aff_ba}</div>
                    </div>
                  )}
                </td>
                {/* 分类 */}
                <td
                  className="px-4 py-4 relative"
                  style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}
                  onMouseEnter={() => setHoveredCell({ row: rowIdx, col: 1 })}
                  onMouseLeave={() => setHoveredCell(null)}
                >
                  <div className="flex items-center justify-center h-full">
                    <div 
                      className="text-sm text-gray-900 truncate cursor-help text-center"
                      title={item.adv_category || '-'}
                    >
                      {item.adv_category || '-'}
                    </div>
                  </div>
                  {hoveredCell && hoveredCell.row === rowIdx && hoveredCell.col === 1 && (
                    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs p-2 rounded-lg z-10 whitespace-nowrap">
                      分类：{item.adv_category || '-'}
                    </div>
                  )}
                </td>
                {/* 类型 */}
                <td
                  className="px-4 py-4 relative"
                  style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}
                  onMouseEnter={() => setHoveredCell({ row: rowIdx, col: 2 })}
                  onMouseLeave={() => setHoveredCell(null)}
                >
                  <div className="flex items-center justify-center h-full">
                    <div 
                      className="text-sm text-gray-900 truncate cursor-help text-center"
                      title={item.adv_type || '-'}
                    >
                      {item.adv_type || '-'}
                    </div>
                  </div>
                  {hoveredCell && hoveredCell.row === rowIdx && hoveredCell.col === 2 && (
                    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs p-2 rounded-lg z-10 whitespace-nowrap">
                      类型：{item.adv_type || '-'}
                    </div>
                  )}
                </td>
                {/* 地区 */}
                <td
                  className="px-4 py-4 relative"
                  style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
                  onMouseEnter={() => setHoveredCell({ row: rowIdx, col: 3 })}
                  onMouseLeave={() => setHoveredCell(null)}
                >
                  <div className="flex items-center justify-center h-full">
                    <div 
                      className="text-sm text-gray-900 truncate cursor-help text-center"
                      title={item.mailing_region || '-'}
                    >
                      {item.mailing_region || '-'}
                    </div>
                  </div>
                  {hoveredCell && hoveredCell.row === rowIdx && hoveredCell.col === 3 && (
                    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs p-2 rounded-lg z-10 whitespace-nowrap">
                      地区：{item.mailing_region || '-'}
                    </div>
                  )}
                </td>
                {/* 月访问量 */}
                <td
                  className="px-4 py-4 relative"
                  style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}
                  onMouseEnter={() => setHoveredCell({ row: rowIdx, col: 4 })}
                  onMouseLeave={() => setHoveredCell(null)}
                >
                  <div className="flex items-center justify-center h-full">
                    <div 
                      className="text-sm text-gray-900 truncate cursor-help text-center"
                      title={item.monthly_visits ? formatNumber(item.monthly_visits) : '-'}
                    >
                      {item.monthly_visits ? formatNumber(item.monthly_visits) : '-'}
                    </div>
                  </div>
                  {hoveredCell && hoveredCell.row === rowIdx && hoveredCell.col === 4 && (
                    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs p-2 rounded-lg z-10 whitespace-nowrap">
                      月访问量：{item.monthly_visits ? formatNumber(item.monthly_visits) : '-'}
                    </div>
                  )}
                </td>
                {/* 30天EPC */}
                <td
                  className="px-4 py-4 relative"
                  style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}
                  onMouseEnter={() => setHoveredCell({ row: rowIdx, col: 5 })}
                  onMouseLeave={() => setHoveredCell(null)}
                >
                  <div className="flex items-center justify-center h-full">
                    <div 
                      className="text-sm text-gray-900 truncate cursor-help text-center"
                      title={String(item['30_epc'] || '-')}
                    >
                      {item['30_epc'] || '-'}
                    </div>
                  </div>
                  {hoveredCell && hoveredCell.row === rowIdx && hoveredCell.col === 5 && (
                    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs p-2 rounded-lg z-10 whitespace-nowrap">
                      30天EPC：{item['30_epc'] || '-'}
                    </div>
                  )}
                </td>
                {/* 30天转化率 */}
                <td
                  className="px-4 py-4 relative"
                  style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}
                  onMouseEnter={() => setHoveredCell({ row: rowIdx, col: 6 })}
                  onMouseLeave={() => setHoveredCell(null)}
                >
                  <div className="flex items-center justify-center h-full">
                    <div 
                      className="text-sm text-gray-900 truncate cursor-help text-center"
                      title={String(item['30_rate'] || '-')}
                    >
                      {item['30_rate'] || '-'}
                    </div>
                  </div>
                  {hoveredCell && hoveredCell.row === rowIdx && hoveredCell.col === 6 && (
                    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs p-2 rounded-lg z-10 whitespace-nowrap">
                      30天转化率：{item['30_rate'] || '-'}
                    </div>
                  )}
                </td>
                {/* EPC趋势 */}
                <td
                  className="px-4 py-4 relative"
                  style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}
                  onMouseEnter={() => setHoveredCell({ row: rowIdx, col: 7 })}
                  onMouseLeave={() => setHoveredCell(null)}
                >
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
                            // 只用后端返回的trend字段
                            const trend = itemEpcData.trend;
                            let trendText = '-';
                            let trendColor = 'text-gray-400';
                            if (trend === 'UPWARD') {
                              trendText = '上升';
                              trendColor = 'text-green-600';
                            } else if (trend === 'DOWNWARD') {
                              trendText = '下降';
                              trendColor = 'text-red-600';
                            } else if (trend === 'STABLE') {
                              trendText = '平稳';
                              trendColor = 'text-gray-600';
                            } else if (trend === 'VOLATILE') {
                              trendText = '波动';
                              trendColor = 'text-yellow-600';
                            }
                            return (
                              <span className={`ml-2 text-xs font-bold ${trendColor}`}>{trendText}</span>
                            );
                          })()}
                        </div>
                        {/* 详细工具提示 */}
                            {hoveredCell && hoveredCell.row === rowIdx && hoveredCell.col === 7 && (
                              <div className="absolute -top-32 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs p-3 rounded-lg opacity-100 transition-opacity duration-200 pointer-events-auto whitespace-nowrap z-10">
                          <div className="font-medium mb-2">{epcPeriod}天EPC趋势</div>
                                {itemEpcData.labels.map((label, idx) => (
                            <div key={idx} className="flex justify-between gap-4">
                              <span>{label}:</span>
                                    <span className="text-blue-300">{itemEpcData.history![idx]} EPC</span>
                            </div>
                          ))}
                        </div>
                            )}
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
    </div>
  );
} 