import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const timeRange = parseInt(searchParams.get('timeRange') || '7');

    if (!date) {
      return NextResponse.json({
        success: false,
        message: '请提供日期参数'
      }, { status: 400 });
    }

    const targetDate = new Date(date);
    
    // 检查是否有数据
    const hasData = await DatabaseService.hasDataForDate(targetDate);
    
    if (!hasData) {
      return NextResponse.json({
        success: true,
        data: [],
        message: `日期 ${date} 暂无数据，请先进行抓取`
      });
    }

    // 从数据库加载数据
    const advertisers = await DatabaseService.getAdvertiserDataByDate(targetDate, timeRange);

    return NextResponse.json({
      success: true,
      data: advertisers,
      message: `成功加载 ${advertisers.length} 条数据`
    });

  } catch (error) {
    console.error('加载数据失败:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '加载数据失败'
    }, { status: 500 });
  }
} 