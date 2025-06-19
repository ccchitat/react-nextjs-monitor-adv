import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adv_ids, period, endDate } = body;

    console.log(`[/api/epc] 收到POST请求, adv_ids数量: ${adv_ids?.length}, period: ${period}, endDate: ${endDate}`);

    if (!adv_ids || !Array.isArray(adv_ids) || adv_ids.length === 0) {
      return NextResponse.json({ success: false, message: 'adv_ids is required and must be a non-empty array' }, { status: 400 });
    }

    if (!period || typeof period !== 'number') {
      return NextResponse.json({ success: false, message: 'period is required and must be a number' }, { status: 400 });
    }

    if (!endDate || typeof endDate !== 'string') {
      return NextResponse.json({ success: false, message: 'endDate is required and must be a string' }, { status: 400 });
    }

    const data = await DatabaseService.getEpcHistoryForAdvertisers(adv_ids, period, new Date(endDate));

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