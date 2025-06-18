"use client";

import { useState, useEffect } from 'react';
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
  onEpcPeriodChange?: (period: EPCPeriod) => void;
}

type EPCPeriod = 7 | 14 | 30;

export default function DataTable({ data, loading, onEpcPeriodChange }: DataTableProps) {
  const [sortField, setSortField] = useState<keyof Advertiser>('adv_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [processedData, setProcessedData] = useState<Advertiser[]>([]);
  const [epcPeriod, setEpcPeriod] = useState<EPCPeriod>(7);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const itemsPerPage = 20;

  // 获取今天的日期作为默认值
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  // 处理数据，直接使用数据库返回的真实数据
  useEffect(() => {
    if (data.length > 0) {
      setProcessedData(data);
    } else {
      setProcessedData([]);
    }
  }, [data]);

  // 排序函数
  const sortedData = [...processedData].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue, 'zh-CN')
        : bValue.localeCompare(aValue, 'zh-CN');
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    return 0;
  });

  // 搜索过滤
  const filteredData = sortedData.filter(item =>
    Object.values(item).some(value =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // 分页
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  // 处理排序
  const handleSort = (field: keyof Advertiser) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // 获取排序图标
  const getSortIcon = (field: keyof Advertiser) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  // 格式化文本显示
  const formatText = (text: string | number, maxLength: number = 50) => {
    const str = String(text);
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
  };

  // 检查文本是否需要截断
  const needsTruncation = (text: string | number, maxLength: number = 50) => {
    return String(text).length > maxLength;
  };

  // 处理EPC周期变化
  const handleEpcPeriodChange = (period: EPCPeriod) => {
    setEpcPeriod(period);
    setCurrentPage(1); // 重置到第一页
    // 通知父组件重新加载数据
    if (onEpcPeriodChange) {
      onEpcPeriodChange(period);
    }
  };

  // 处理日期变化
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setCurrentPage(1); // 重置到第一页
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

  if (loading) {
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
              共 {filteredData.length} 条记录
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* 日期选择 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">数据日期:</span>
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
            <div className="text-sm text-gray-600">
              第 {currentPage} 页，共 {totalPages} 页
            </div>
          </div>
        </div>
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-48"
                onClick={() => handleSort('adv_name')}
              >
                <div className="flex items-center">
                  <span>广告商名称</span>
                  <span className="ml-1">{getSortIcon('adv_name')}</span>
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-32"
                onClick={() => handleSort('adv_category')}
              >
                <div className="flex items-center">
                  <span>分类</span>
                  <span className="ml-1">{getSortIcon('adv_category')}</span>
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-32"
                onClick={() => handleSort('adv_type')}
              >
                <div className="flex items-center">
                  <span>类型</span>
                  <span className="ml-1">{getSortIcon('adv_type')}</span>
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-32"
                onClick={() => handleSort('mailing_region')}
              >
                <div className="flex items-center">
                  <span>地区</span>
                  <span className="ml-1">{getSortIcon('mailing_region')}</span>
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-32"
                onClick={() => handleSort('monthly_visits')}
              >
                <div className="flex items-center">
                  <span>月访问量</span>
                  <span className="ml-1">{getSortIcon('monthly_visits')}</span>
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-28"
                onClick={() => handleSort('30_epc')}
              >
                <div className="flex items-center">
                  <span>30天EPC</span>
                  <span className="ml-1">{getSortIcon('30_epc')}</span>
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-32"
                onClick={() => handleSort('30_rate')}
              >
                <div className="flex items-center">
                  <span>30天转化率</span>
                  <span className="ml-1">{getSortIcon('30_rate')}</span>
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40"
              >
                <span>{epcPeriod}天EPC趋势</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((item, index) => (
              <tr key={item.adv_id} className="hover:bg-gray-50 group">
                <td className="px-4 py-4">
                  <div className="flex items-start">
                    {item.adv_logo && (
                      <img 
                        src={item.adv_logo} 
                        alt={item.adv_name}
                        className="h-8 w-8 rounded-full mr-3 flex-shrink-0 mt-1"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div 
                        className="text-sm font-medium text-gray-900 break-words cursor-help"
                        title={needsTruncation(item.adv_name, 30) ? item.adv_name : undefined}
                      >
                        {formatText(item.adv_name, 30)}
                      </div>
                      <div 
                        className="text-sm text-gray-500 break-words cursor-help"
                        title={needsTruncation(item.adv_id, 20) ? item.adv_id : undefined}
                      >
                        ID: {formatText(item.adv_id, 20)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div 
                    className="text-sm text-gray-900 break-words cursor-help"
                    title={needsTruncation(item.adv_category, 20) ? item.adv_category : undefined}
                  >
                    {formatText(item.adv_category || '-', 20)}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div 
                    className="text-sm text-gray-900 break-words cursor-help"
                    title={needsTruncation(item.adv_type, 20) ? item.adv_type : undefined}
                  >
                    {formatText(item.adv_type || '-', 20)}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div 
                    className="text-sm text-gray-900 break-words cursor-help"
                    title={needsTruncation(item.mailing_region, 20) ? item.mailing_region : undefined}
                  >
                    {formatText(item.mailing_region || '-', 20)}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div 
                    className="text-sm text-gray-900 break-words cursor-help"
                    title={needsTruncation(item.monthly_visits, 15) ? item.monthly_visits : undefined}
                  >
                    {formatText(item.monthly_visits || '-', 15)}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div 
                    className="text-sm text-gray-900 break-words cursor-help"
                    title={needsTruncation(item['30_epc'], 15) ? String(item['30_epc']) : undefined}
                  >
                    {formatText(item['30_epc'] || '-', 15)}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div 
                    className="text-sm text-gray-900 break-words cursor-help"
                    title={needsTruncation(item['30_rate'], 15) ? String(item['30_rate']) : undefined}
                  >
                    {formatText(item['30_rate'] || '-', 15)}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-center">
                    {item.epc_history && item.date_labels ? (
                      <div className="group relative">
                        <EPCChart 
                          data={item.epc_history} 
                          labels={item.date_labels}
                          width={140}
                          height={40}
                          color="#3B82F6"
                        />
                        {/* 详细工具提示 */}
                        <div className="absolute -top-32 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs p-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          <div className="font-medium mb-2">{epcPeriod}天EPC趋势</div>
                          {item.date_labels.map((label, idx) => (
                            <div key={idx} className="flex justify-between gap-4">
                              <span>{label}:</span>
                              <span className="text-blue-300">{item.epc_history![idx]} EPC</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-400 text-xs">无数据</div>
                    )}
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
              显示第 {startIndex + 1} 到 {Math.min(startIndex + itemsPerPage, filteredData.length)} 条，共 {filteredData.length} 条
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="px-3 py-1 text-sm text-gray-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 