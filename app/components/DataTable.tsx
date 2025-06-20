import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import TrendFilter from './TrendFilter';

// 注册 Chart.js 组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Advertiser {
  adv_logo: string;
  adv_name: string;
  adv_id: string;
  m_id: string;
  adv_category: string;
  mailing_region: string;
  adv_type: string;
  '30_epc': number | string;
  approval_type: string;
  approval_type_text: string;
  trend_7_day: string;
  trend_14_day: string;
  trend_30_day: string;
}

interface TrendData {
  history: number[];
  labels: string[];
  trend: string;
}

interface Props {
  data: Advertiser[];
  loading: boolean;
  onEpcPeriodChange: (period: number) => void;
  onExportDataChange: (data: Advertiser[]) => void;
  selectedDate: string;
}

export default function DataTable({ data, loading, onEpcPeriodChange, onExportDataChange, selectedDate }: Props) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [sortedData, setSortedData] = useState<Advertiser[]>([]);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [epcPeriod, setEpcPeriod] = useState<number>(7);
  const [selectedTrend, setSelectedTrend] = useState<string | null>(null);
  const [epcData, setEpcData] = useState<any>(null);
  const [epcTrendFilter, setEpcTrendFilter] = useState<string>('all');

  // 图表配置
  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'EPC'
        }
      },
      x: {
        title: {
          display: true,
          text: '日期'
        }
      }
    }
  };

  // 处理排序
  useEffect(() => {
    let sortedItems = [...data];
    if (sortConfig !== null) {
      sortedItems.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof Advertiser];
        const bValue = b[sortConfig.key as keyof Advertiser];
        
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        const comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }
    setSortedData(sortedItems);
    onExportDataChange(sortedItems);
  }, [data, sortConfig]);

  // 处理排序点击
  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // 加载趋势数据
  const loadTrendData = async (advId: string) => {
    try {
      const response = await fetch('/api/epc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adv_ids: [advId],
          period: epcPeriod,
          endDate: selectedDate,
          trend: selectedTrend
        }),
      });
      
      if (!response.ok) throw new Error('加载趋势数据失败');
      const result = await response.json();
      
      if (result.success && result.data[advId]) {
        setTrendData({
          history: result.data[advId].history,
          labels: result.data[advId].labels,
          trend: result.data[advId].trend || 'UNKNOWN'
        });
      } else {
        setTrendData(null);
      }
    } catch (error) {
      console.error('加载趋势数据失败:', error);
      setTrendData(null);
    }
  };

  // 处理广告商选择
  const handleAdvertiserSelect = async (advId: string) => {
    if (selectedAdvertiser === advId) {
      setSelectedAdvertiser(null);
      setTrendData(null);
    } else {
      setSelectedAdvertiser(advId);
      await loadTrendData(advId);
    }
  };

  // 处理EPC时间范围变化
  const handleEpcPeriodChange = async (period: number) => {
    setEpcPeriod(period);
    onEpcPeriodChange(period);
    // 如果有选中的广告商，则更新其趋势图
    if (selectedAdvertiser) {
      await loadTrendData(selectedAdvertiser);
    }
  };

  // 处理趋势筛选变化
  const handleTrendChange = async (trend: string | null) => {
    console.log('[DataTable] 处理趋势筛选变化, newTrend:', trend);
    setSelectedTrend(trend); // 直接设置大写的趋势值
  };

  // 当趋势筛选变化时，重新获取过滤后的数据
  useEffect(() => {
    console.log('[DataTable] useEffect 触发，selectedTrend 变化为:', selectedTrend);
    
    if (!selectedTrend) {
      // 如果没有趋势筛选，显示所有数据
      console.log('[DataTable] 无趋势筛选，显示所有数据');
      setSortedData(data);
      onExportDataChange(data);
      return;
    }

    // 如果有趋势筛选，调用 API 获取筛选后的数据
    const fetchFilteredData = async () => {
      try {
        console.log('[DataTable] 调用API获取筛选数据，trend:', selectedTrend);
        const response = await fetch('/api/epc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            period: epcPeriod,
            endDate: selectedDate,
            trend: selectedTrend,
          }),
        });

        if (!response.ok) {
          throw new Error('获取筛选数据失败');
        }

        const result = await response.json();
        console.log('[DataTable] API返回的筛选数据:', result);

        if (result.success) {
          setSortedData(result.data);
          onExportDataChange(result.data);
        } else {
          console.error('[DataTable] API返回失败:', result.message);
          setSortedData([]);
          onExportDataChange([]);
        }
      } catch (error) {
        console.error('[DataTable] 获取筛选数据失败:', error);
        setSortedData([]);
        onExportDataChange([]);
      }
    };

    fetchFilteredData();
  }, [selectedTrend, epcPeriod, selectedDate, data]);

  // 获取趋势文本
  const getTrendText = (trend: string) => {
    console.log(`[DataTable] 获取趋势文本, 原始趋势: ${trend}`);
    switch (trend) {
      case 'UPWARD': return '上升';
      case 'DOWNWARD': return '下降';
      case 'STABLE': return '平稳';
      case 'VOLATILE': return '波动';
      default: return '未知';
    }
  };

  // 获取趋势类型
  const getTrendType = (entityTrend: any) => {
    console.log(`[DataTable] 获取趋势类型, 当前周期: ${epcPeriod}天`);
    if (!entityTrend) return 'UNKNOWN';
    
    // 根据当前选择的时间周期返回对应的趋势
    if (epcPeriod === 7) return entityTrend.epcTrendCategory7Day;
    if (epcPeriod === 14) return entityTrend.epcTrendCategory14Day;
    return entityTrend.epcTrendCategory30Day;
  };

  // 获取趋势图标颜色
  const getTrendColor = (trend: string) => {
    console.log(`[DataTable] 获取趋势颜色, 原始趋势: ${trend}`);
    switch (trend) {
      case 'UPWARD': return 'text-green-600';
      case 'DOWNWARD': return 'text-red-600';
      case 'STABLE': return 'text-blue-600';
      case 'VOLATILE': return 'text-orange-600';
      default: return 'text-gray-400';
    }
  };

  // 获取趋势图标
  const getTrendIcon = (trend: string) => {
    console.log(`[DataTable] 获取趋势图标, 原始趋势: ${trend}`);
    switch (trend) {
      case 'UPWARD':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      case 'DOWNWARD':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
          </svg>
        );
      case 'STABLE':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
          </svg>
        );
      case 'VOLATILE':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M12 14h.01M12 16h.01M12 18h.01" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  // 检查EPC趋势
  const checkEpcTrend = (itemEpcData: any): string => {
    console.log(`[DataTable] 检查EPC趋势`);
    if (!itemEpcData) {
      console.log('[DataTable] itemEpcData 不存在, 返回 "all"');
      return 'all';
    }

    const trend = getTrendType(itemEpcData);
    console.log(`[DataTable] 从 getTrendType 获取的趋势: ${trend}`);

    if (trend) {
      return trend; // 直接返回大写趋势，例如 "UPWARD"
    }
    
    console.log('[DataTable] 未能确定趋势, 返回 "all"');
    return 'all';
  };

  // 当数据变化或筛选变化时，获取EPC趋势
  useEffect(() => {
    const fetchEpcData = async (trend: string | null) => {
      if (sortedData.length === 0 || !selectedDate) return;
      
      console.log('[DataTable] 开始获取EPC数据:', {
        advertisers: sortedData.map(a => a.adv_id),
        period: epcPeriod,
        endDate: selectedDate,
        trend: trend,
        currentEpcData: epcData
      });
      
      try {
        console.log('[DataTable] 发送API请求:', {
          adv_ids: sortedData.map(a => a.adv_id),
          period: epcPeriod,
          endDate: selectedDate,
          trend: trend
        });
        
        const response = await fetch(`/api/epc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adv_ids: sortedData.map(a => a.adv_id),
            period: epcPeriod,
            endDate: selectedDate,
            trend: trend
          }),
        });
        
        const result = await response.json();
        console.log('[DataTable] API返回的EPC数据:', {
          success: result.success,
          data: result.data,
          advertisersCount: Object.keys(result.data || {}).length,
          trends: Object.entries(result.data || {}).map(([advId, data]: [string, any]) => ({
            advId,
            trend: data.trend
          }))
        });
        
        if (result.success) {
          setEpcData(result.data);
        }
      } catch (error) {
        console.error('[DataTable] 获取EPC数据失败:', error);
      }
    };
    
    fetchEpcData(selectedTrend);
  }, [sortedData, epcPeriod, selectedDate, selectedTrend]);

  // 渲染数据表格
  const renderTableBody = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
            加载中...
          </td>
        </tr>
      );
    }

    if (sortedData.length === 0) {
      return (
        <tr>
          <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
            暂无数据
          </td>
        </tr>
      );
    }

    return sortedData.map((advertiser) => {
      // 获取当前广告商的趋势数据
      const itemEpcData = epcData?.[advertiser.adv_id];
      console.log(`[DataTable] 渲染广告商 ${advertiser.adv_id} 的数据:`, {
        advertiser,
        itemEpcData,
        epcTrendFilter,
        epcPeriod,
        epcData: epcData ? Object.keys(epcData).length : 0
      });

      // 获取趋势类型
      let currentTrend;
      if (itemEpcData?.trend) {
        currentTrend = itemEpcData.trend;
        console.log(`[DataTable] 使用API返回的趋势 ${advertiser.adv_id}:`, currentTrend);
      } else {
        // 如果没有趋势数据，从advertiser中获取
        const trendField = `trend_${epcPeriod}_day`;
        currentTrend = advertiser[trendField] || 'UNKNOWN';
        console.log(`[DataTable] 使用广告商自带的趋势 ${advertiser.adv_id}:`, {
          trendField,
          currentTrend
        });
      }
      
      console.log(`[DataTable] 广告商 ${advertiser.adv_id} 的趋势:`, {
        itemEpcData,
        currentTrend,
        epcPeriod
      });

      return (
        <tr 
          key={advertiser.adv_id}
          className={`hover:bg-gray-50 ${
            selectedAdvertiser === advertiser.adv_id ? 'bg-blue-50' : ''
          }`}
          onClick={() => handleAdvertiserSelect(advertiser.adv_id)}
        >
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex items-center">
              {advertiser.adv_logo && (
                <img 
                  className="h-10 w-10 rounded-full mr-3" 
                  src={advertiser.adv_logo} 
                  alt={advertiser.adv_name} 
                />
              )}
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {advertiser.adv_name}
                </div>
                <div className="text-sm text-gray-500">
                  {advertiser.adv_id}
                </div>
              </div>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm text-gray-900">
              {typeof advertiser['30_epc'] === 'number' 
                ? advertiser['30_epc'].toFixed(2)
                : advertiser['30_epc']}
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex items-center space-x-4">
              <div className={`flex items-center ${getTrendColor(currentTrend)}`}>
                {getTrendIcon(currentTrend)}
                <span className="ml-1 text-sm">
                  {getTrendText(currentTrend)}
                </span>
              </div>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            <div className="flex flex-col space-y-1">
              <div>分类: {advertiser.adv_category || '-'}</div>
              <div>地区: {advertiser.mailing_region || '-'}</div>
              <div>类型: {advertiser.adv_type || '-'}</div>
            </div>
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* EPC时间范围和趋势筛选 */}
      <div className="p-4 border-b border-gray-200 space-y-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">EPC趋势时间范围:</span>
          <div className="flex gap-2">
            {[7, 14, 30].map((period) => (
              <button
                key={period}
                onClick={() => handleEpcPeriodChange(period)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  epcPeriod === period
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {period}天
              </button>
            ))}
          </div>
        </div>
        <TrendFilter onTrendChange={handleTrendChange} />
      </div>

      {/* 数据表格 */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                广告商
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('30_epc')}
              >
                30天EPC
                {sortConfig?.key === '30_epc' && (
                  <span className="ml-1">
                    {sortConfig.direction === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                趋势
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                其他信息
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {renderTableBody()}
          </tbody>
        </table>
      </div>

      {/* 趋势图 */}
      {selectedAdvertiser && trendData && (
        <div className="p-4 border-t border-gray-200">
          <div className="h-64">
            <Line
              data={{
                labels: trendData.labels,
                datasets: [
                  {
                    label: 'EPC趋势',
                    data: trendData.history,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    tension: 0.1
                  }
                ]
              }}
              options={chartOptions}
            />
          </div>
        </div>
      )}
    </div>
  );
} 