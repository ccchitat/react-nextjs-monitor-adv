import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const advId = searchParams.get('advId');
    const date = searchParams.get('date');
    const period = searchParams.get('period');

    if (!advId || !date || !period) {
      return NextResponse.json({
        success: false,
        message: '缺少必要参数'
      });
    }

    // 获取趋势数据
    const trend = await prisma.entityTrend.findFirst({
      where: {
        advertiser: {
          advId: advId
        }
      }
    });

    // 获取 EPC 历史数据
    const endDate = new Date(date);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - parseInt(period) + 1);
    
    const epcData = await prisma.dailyEpc.findMany({
      where: {
        advertiser: {
          advId: advId
        },
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    // 组装数据
    const history: number[] = [];
    const labels: string[] = [];
    
    for (let i = 0; i < parseInt(period); i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      labels.push(date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
      
      const dataForDate = epcData.find(d => 
        d.date.toDateString() === date.toDateString()
      );
      history.push(dataForDate ? Number(dataForDate.epcValue) : 0);
    }

    // 根据周期选择趋势类型
    let trendType: string;
    if (period === '7') {
      trendType = trend?.epcTrendCategory7Day || 'UNKNOWN';
    } else if (period === '14') {
      trendType = trend?.epcTrendCategory14Day || 'UNKNOWN';
    } else {
      trendType = trend?.epcTrendCategory30Day || 'UNKNOWN';
    }

    return NextResponse.json({
      success: true,
      data: {
        history,
        labels,
        trend: trendType
      }
    });
  } catch (error) {
    console.error('获取趋势数据失败:', error);
    return NextResponse.json({
      success: false,
      message: '获取趋势数据失败'
    });
  }
} 