import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';

interface CrawlLog {
  id: bigint;
  crawlDate: Date;
  totalAdvertisers: number | null;
  successCount: number | null;
  errorCount: number | null;
  startTime: Date;
  endTime: Date | null;
  durationSeconds: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const logs = await DatabaseService.getCrawlLogs(limit);

    // 修复BigInt序列化问题
    const serializedLogs = logs.map((log: CrawlLog) => ({
      ...log,
      id: log.id.toString(), // 将BigInt转换为字符串
    }));

    return NextResponse.json({
      success: true,
      logs: serializedLogs
    });

  } catch (error) {
    console.error('获取日志失败:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '获取日志失败'
    }, { status: 500 });
  }
} 