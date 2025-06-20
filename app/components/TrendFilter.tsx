import { useState } from 'react';

interface Props {
  onTrendChange: (trend: string | null) => void;
}

export default function TrendFilter({ onTrendChange }: Props) {
  const [selectedTrend, setSelectedTrend] = useState<string | null>(null);

  const trends = [
    { key: 'UPWARD', text: '上升', color: 'text-green-600' },
    { key: 'DOWNWARD', text: '下降', color: 'text-red-600' },
    { key: 'STABLE', text: '平稳', color: 'text-blue-600' },
    { key: 'VOLATILE', text: '波动', color: 'text-orange-600' }
  ];

  const handleTrendClick = (trend: string) => {
    console.log('[TrendFilter] 点击趋势按钮:', {
      currentTrend: selectedTrend,
      newTrend: trend,
      trends: trends.map(t => t.key)
    });
    
    if (selectedTrend === trend) {
      console.log('[TrendFilter] 取消选中趋势');
      setSelectedTrend(null);
      onTrendChange(null);
    } else {
      console.log('[TrendFilter] 选中新趋势:', trend);
      setSelectedTrend(trend);
      onTrendChange(trend);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-600">趋势筛选:</span>
      <div className="flex gap-2">
        {trends.map(({ key, text, color }) => (
          <button
            key={key}
            onClick={() => handleTrendClick(key)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              selectedTrend === key
                ? `bg-${color.split('-')[1]}-600 text-white`
                : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
} 