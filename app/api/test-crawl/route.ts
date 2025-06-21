import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('开始执行模拟抓取任务...');
    
    // 创建抓取日志
    const log = await DatabaseService.createCrawlLog({
      crawlDate: new Date(),
      startTime: new Date(),
      status: 'RUNNING'
    });

    const startTime = Date.now();
    
    // 模拟抓取过程（5秒）
    console.log('模拟抓取数据中...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 模拟抓取结果
    const totalAdvertisers = Math.floor(Math.random() * 100) + 50;
    const successCount = Math.floor(totalAdvertisers * 0.9);
    const errorCount = totalAdvertisers - successCount;
    
    const endTime = Date.now();
    const durationSeconds = Math.floor((endTime - startTime) / 1000);

    // 更新抓取日志
    await DatabaseService.updateCrawlLog(log.id, {
      endTime: new Date(),
      durationSeconds,
      totalAdvertisers,
      successCount,
      errorCount,
      status: 'SUCCESS'
    });

    console.log(`模拟抓取任务完成，耗时: ${durationSeconds}秒，成功: ${successCount}，失败: ${errorCount}`);
    
    return NextResponse.json({
      success: true,
      message: '模拟抓取任务完成',
      data: {
        totalAdvertisers,
        successCount,
        errorCount,
        durationSeconds
      }
    });
    
  } catch (error: any) {
    console.error('模拟抓取任务失败:', error);
    
    return NextResponse.json({
      success: false,
      message: error.message || '模拟抓取任务失败'
    });
  }
} 