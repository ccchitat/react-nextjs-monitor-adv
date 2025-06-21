import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const search = searchParams.get('search') || undefined;
    
    console.log(`[/api/data] 收到GET请求, date: ${date}, search: ${search}`);

    if (!date) {
      console.log('[/api/data] 缺少日期参数');
      return NextResponse.json({
        success: false,
        message: '请提供日期参数'
      }, { status: 400 });
    }

    const targetDate = new Date(date);
    console.log(`[/api/data] 解析后的日期: ${targetDate.toISOString()}`);
    
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    
    // 检查是否有数据
    const hasData = await DatabaseService.hasDataForDate(targetDate);
    console.log(`[/api/data] 日期 ${date} 是否有数据: ${hasData}`);
    
    if (!hasData) {
      console.log(`[/api/data] 日期 ${date} 暂无数据`);
      return NextResponse.json({
        success: true,
        data: [],
        message: `日期 ${date} 暂无数据，请先进行抓取`
      });
    }

    // 查询总数
    const total = await DatabaseService.getAdvertiserCountByDate(targetDate, search);
    // 查询当前页
    const advertisers = await DatabaseService.getAdvertiserDataByDate(targetDate, page, pageSize, search);
    return NextResponse.json({
      success: true,
      data: advertisers,
      total,
      message: `成功加载第${page}页，共${total}条数据`
    });

  } catch (error) {
    console.error('[/api/data] 加载数据失败:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '加载数据失败'
    }, { status: 500 });
  }
} 