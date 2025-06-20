import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService, prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adv_ids, period, endDate, trend } = body;

    console.log(`[/api/epc] 收到POST请求, adv_ids数量: ${adv_ids?.length}, period: ${period}, endDate: ${endDate}, trend: ${trend}`);

    if (!period || typeof period !== 'number') {
      return NextResponse.json({ success: false, message: 'period is required and must be a number' }, { status: 400 });
    }
    if (!endDate || typeof endDate !== 'string') {
      return NextResponse.json({ success: false, message: 'endDate is required and must be a string' }, { status: 400 });
    }
    const endDateObj = new Date(endDate);

    // 新增：如果有trend参数，后端直接筛选
    if (trend) {
      // 将前端趋势类型映射到后端趋势类型
      const trendMap: Record<string, string> = {
        'up': 'UPWARD',
        'down': 'DOWNWARD',
        'flat': 'STABLE',
        'volatile': 'VOLATILE',
        // 添加大写映射
        'UPWARD': 'UPWARD',
        'DOWNWARD': 'DOWNWARD',
        'STABLE': 'STABLE',
        'VOLATILE': 'VOLATILE'
      };
      const backendTrend = trendMap[trend];
      
      if (!backendTrend) {
        console.log(`[/api/epc] 无效的趋势类型: ${trend}, 有效的趋势类型:`, Object.keys(trendMap));
        return NextResponse.json({ success: false, message: 'Invalid trend type' }, { status: 400 });
      }

      // 获取所有广告商的趋势数据
      const allTrends = await prisma.entityTrend.findMany({
        include: {
          advertiser: true
        }
      });

      console.log('\n' + '='.repeat(80));
      console.log('[/api/epc] 所有广告商的趋势状态:');
      console.log('-'.repeat(80));
      console.log(JSON.stringify(allTrends.map(t => ({
        advId: t.advertiser.advId,
        trend7Day: t.epcTrendCategory7Day,
        trend14Day: t.epcTrendCategory14Day,
        trend30Day: t.epcTrendCategory30Day,
        avgEpc7Day: t.last7DayAvgEPC,
        avgEpc14Day: t.last14DayAvgEPC,
        avgEpc30Day: t.last30DayAvgEPC,
        slope7Day: t.epcSlope7Day,
        slope14Day: t.epcSlope14Day,
        slope30Day: t.epcSlope30Day,
        lastCalculatedAt: t.lastCalculatedAt
      })), null, 2));
      console.log('='.repeat(80) + '\n');

      // 根据当前周期选择趋势字段
      const trendField = period === 7 ? 'epcTrendCategory7Day' : 
                        period === 14 ? 'epcTrendCategory14Day' : 
                        'epcTrendCategory30Day';

      // 获取符合当前趋势的广告商
      const trends = await prisma.entityTrend.findMany({
        where: {
          [trendField]: backendTrend
        },
        include: {
          advertiser: true
        }
      });

      console.log(`[/api/epc] 找到 ${trends.length} 个符合趋势 ${backendTrend} 的广告商`);

      // 如果没有符合条件的广告商，返回空数组
      if (trends.length === 0) {
        return NextResponse.json({
          success: true,
          data: []
        });
      }

      // 获取符合条件的广告商的完整信息
      const advertisers = await DatabaseService.getAdvertiserDataByDate(endDateObj);
      
      // 筛选出符合趋势条件的广告商
      const filteredAdvertisers = advertisers.filter(advertiser => {
        return trends.some(trend => trend.advertiser.advId === advertiser.adv_id);
      });

      console.log(`[/api/epc] 找到 ${filteredAdvertisers.length} 个符合趋势条件的广告商`);
      console.log('[/api/epc] 符合趋势条件的广告商详细信息:');
      console.log(JSON.stringify(filteredAdvertisers, null, 2));

      // 如果没有符合条件的广告商，返回空对象
      if (filteredAdvertisers.length === 0) {
        return NextResponse.json({
          success: true,
          data: {}
        });
      }

      // 获取这些广告商的EPC历史数据
      const filteredAdvIds = filteredAdvertisers.map(adv => adv.adv_id);
      const startDate = new Date(endDateObj);
      startDate.setDate(startDate.getDate() - period + 1);
      
      const epcData = await prisma.dailyEpc.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDateObj
          },
          advertiser: {
            advId: { in: filteredAdvIds }
          }
        },
        include: {
          advertiser: {
            select: { advId: true }
          }
        },
        orderBy: {
          date: 'asc'
        }
      });

      console.log(`[/api/epc] 查询到 ${epcData.length} 条筛选后的EPC历史数据`);

      // 组装EPC数据，格式与"全部"模式一致
      const data: Record<string, { history: number[]; labels: string[]; trend?: string }> = {};
      
      for (const advId of filteredAdvIds) {
        const advEpcData = epcData.filter(d => d.advertiser.advId === advId);
        const history: number[] = [];
        const labels: string[] = [];
        
        // 填充数据
        for (let i = 0; i < period; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          labels.push(date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
          
          const dataForDate = advEpcData.find(d => 
            d.date.toDateString() === date.toDateString()
          );
          history.push(dataForDate ? Number(dataForDate.epcValue) : 0);
        }
        
        // 获取后端计算的趋势
        const trendData = trends.find(t => t.advertiser.advId === advId);
        let backendTrend: string | undefined;
        if (trendData) {
          switch (period) {
            case 7:
              backendTrend = trendData.epcTrendCategory7Day;
              break;
            case 14:
              backendTrend = trendData.epcTrendCategory14Day;
              break;
            case 30:
              backendTrend = trendData.epcTrendCategory30Day;
              break;
          }
        }
        
        data[advId] = { history, labels, trend: backendTrend };
      }

      console.log(`[/api/epc] 成功返回 ${Object.keys(data).length} 个广告商的EPC数据（筛选模式）`);
      
      return NextResponse.json({
        success: true,
        data,
        advertisers: filteredAdvertisers // 同时返回广告商信息，供前端使用
      });
    }

    // 原有逻辑：按ID批量查
    if (!adv_ids || !Array.isArray(adv_ids) || adv_ids.length === 0) {
      return NextResponse.json({ success: false, message: 'adv_ids is required and must be a non-empty array' }, { status: 400 });
    }

    // 获取 EPC 历史数据
    const startDate = new Date(endDateObj);
    startDate.setDate(startDate.getDate() - period + 1);
    
    const epcData = await prisma.dailyEpc.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDateObj
        },
        advertiser: {
          advId: { in: adv_ids }
        }
      },
      include: {
        advertiser: {
          select: { advId: true }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    // console.log(`[/api/epc] 查询到的EPC历史数据:`, JSON.stringify(epcData.map(d => ({
    //   advId: d.advertiser.advId,
    //   date: d.date,
    //   epcValue: d.epcValue
    // })), null, 2));

    // 获取趋势数据
    const trendsData = await prisma.entityTrend.findMany({
      where: {
        advertiser: {
          advId: { in: adv_ids }
        }
      },
      include: {
        advertiser: {
          select: { advId: true }
        }
      }
    });

    // 组装数据
    const data: Record<string, { history: number[]; labels: string[]; trend?: string }> = {};
    
    for (const advId of adv_ids) {
      const advEpcData = epcData.filter(d => d.advertiser.advId === advId);
      const history: number[] = [];
      const labels: string[] = [];
      
      // 填充数据
      for (let i = 0; i < period; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        labels.push(date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
        
        const dataForDate = advEpcData.find(d => 
          d.date.toDateString() === date.toDateString()
        );
        history.push(dataForDate ? Number(dataForDate.epcValue) : 0);
      }
      
      // 获取后端计算的趋势
      const trendData = trendsData.find(t => t.advertiser.advId === advId);
      let backendTrend: string | undefined;
      if (trendData) {
        switch (period) {
          case 7:
            backendTrend = trendData.epcTrendCategory7Day;
            break;
          case 14:
            backendTrend = trendData.epcTrendCategory14Day;
            break;
          case 30:
            backendTrend = trendData.epcTrendCategory30Day;
            break;
        }
      }
      
      data[advId] = { history, labels, trend: backendTrend };
    }

    console.log(`[/api/epc] 成功返回 ${Object.keys(data).length} 个广告商的EPC数据`);
    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('Failed to fetch EPC data:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 