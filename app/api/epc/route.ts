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
    if (trend === 'up' || trend === 'down' || trend === 'flat') {
      // 查询所有广告商ID
      const allAdvertisers = await DatabaseService.getAllAdvertiserIds();
      // 批量查快照
      const snapshots = await prisma.ePCTrendSnapshot.findMany({
        where: {
          advId: { in: allAdvertisers },
          date: endDateObj,
        },
      });
      // 组装数据
      const periodKey = `epc${period}History`;
      const labelKey = `epc${period}Labels`;
      const trendKey = `epc${period}Trend`;
      const allEpcData: Record<string, { history: number[]; labels: string[]; trend?: string }> = {};
      for (const snap of snapshots) {
        allEpcData[snap.advId] = {
          history: snap[periodKey],
          labels: snap[labelKey],
          trend: snap[trendKey],
        };
      }
      // 没有快照的补全
      const missingIds = allAdvertisers.filter(id => !allEpcData[id]);
      for (const advId of missingIds) {
        const { history, labels } = await DatabaseService.getOrCreateEpcTrendSnapshot(advId, endDateObj, period);
        // 计算趋势
        let trendType = 'flat';
        if (history && history.length >= 2) {
          const valid = history.filter(x => typeof x === 'number' && !isNaN(x));
          if (valid.length >= 2) {
            const first = valid[0];
            const last = valid[valid.length - 1];
            const change = ((last - first) / (first || 1)) * 100;
            if (change > 5) trendType = 'up';
            else if (change < -5) trendType = 'down';
          }
        }
        allEpcData[advId] = { history, labels, trend: trendType };
      }
      // 过滤
      const filtered = Object.entries(allEpcData).filter(([id, d]) => d.trend === trend);
      const result = Object.fromEntries(filtered.map(([id, d]) => [id, { history: d.history, labels: d.labels }]));
      return NextResponse.json({ success: true, data: result });
    }

    // 原有逻辑：按ID批量查
    if (!adv_ids || !Array.isArray(adv_ids) || adv_ids.length === 0) {
      return NextResponse.json({ success: false, message: 'adv_ids is required and must be a non-empty array' }, { status: 400 });
    }
    // 批量查快照
    const snapshots = await prisma.ePCTrendSnapshot.findMany({
      where: {
        advId: { in: adv_ids },
        date: endDateObj,
      },
    });
    const periodKey = `epc${period}History`;
    const labelKey = `epc${period}Labels`;
    const data: Record<string, { history: number[]; labels: string[] }> = {};
    for (const snap of snapshots) {
      data[snap.advId] = {
        history: snap[periodKey],
        labels: snap[labelKey],
      };
    }
    // 没有快照的补全
    const missingIds = adv_ids.filter(id => !data[id]);
    for (const advId of missingIds) {
      data[advId] = await DatabaseService.getOrCreateEpcTrendSnapshot(advId, endDateObj, period);
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