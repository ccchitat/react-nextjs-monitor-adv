"use client";

import { useMemo } from 'react';

interface EPCChartProps {
  data: number[];
  labels: string[];
  width?: number;
  height?: number;
  color?: string;
}

export default function EPCChart({ 
  data, 
  labels, 
  width = 120, 
  height = 40, 
  color = '#3B82F6' 
}: EPCChartProps) {
  
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    const maxValue = Math.max(...data);
    const minValue = Math.min(...data);
    const range = maxValue - minValue || 1;
    
    // 计算SVG路径
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * (width - 20) + 10;
      const y = height - 10 - ((value - minValue) / range) * (height - 20);
      return `${x},${y}`;
    });
    
    const pathData = `M ${points.join(' L ')}`;
    
    // 计算填充区域路径
    const fillPoints = [
      `M 10,${height - 10}`,
      ...points.map(point => `L ${point}`),
      `L ${width - 10},${height - 10}`,
      'Z'
    ].join(' ');
    
    return {
      pathData,
      fillData: fillPoints,
      maxValue,
      minValue
    };
  }, [data, width, height]);

  if (!chartData) {
    return (
      <div 
        className="flex items-center justify-center text-gray-400 text-xs"
        style={{ width, height }}
      >
        无数据
      </div>
    );
  }

  return (
    <div className="relative">
      <svg 
        width={width} 
        height={height} 
        className="block"
        style={{ minWidth: width }}
      >
        {/* 渐变定义 */}
        <defs>
          <linearGradient id={`gradient-${Math.random()}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.1" />
          </linearGradient>
        </defs>
        
        {/* 填充区域 */}
        <path
          d={chartData.fillData}
          fill={`url(#gradient-${Math.random()})`}
        />
        
        {/* 折线 */}
        <path
          d={chartData.pathData}
          stroke={color}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* 数据点 */}
        {data.map((value, index) => {
          const x = (index / (data.length - 1)) * (width - 20) + 10;
          const y = height - 10 - ((value - chartData.minValue) / (chartData.maxValue - chartData.minValue)) * (height - 20);
          
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="2"
              fill={color}
              className="hover:r-3 transition-all duration-200"
            />
          );
        })}
      </svg>
    </div>
  );
} 