import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';

// 全局变量存储定时任务状态
let scheduledTask: NodeJS.Timeout | null = null;
let isScheduled = false;
let scheduleConfig = {
  interval: 1440, // 默认24小时（1440分钟）
  enabled: false,
  lastRun: null as Date | null,
  nextRun: null as Date | null,
  scheduledTime: '09:00', // 默认每天上午9点执行
  timezone: 'Asia/Shanghai' // 默认中国时区
};

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      isScheduled,
      config: scheduleConfig
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const { action, interval, scheduledTime } = await request.json();
    
    switch (action) {
      case 'start':
        return await startScheduledTask(interval, scheduledTime);
      case 'stop':
        return await stopScheduledTask();
      case 'update':
        return await updateScheduleConfig(interval, scheduledTime);
      default:
        return NextResponse.json({ 
          success: false, 
          message: '无效的操作' 
        });
    }
  } catch (error: any) {
    console.error('定时任务操作失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || '操作失败' 
    });
  }
}

async function startScheduledTask(intervalMinutes: number = 1440, scheduledTime: string = '09:00') {
  if (isScheduled) {
    return NextResponse.json({ 
      success: false, 
      message: '定时任务已在运行中' 
    });
  }

  try {
    // 清除可能存在的旧定时器
    if (scheduledTask) {
      clearInterval(scheduledTask);
    }

    // 计算下次执行时间
    const nextRunTime = calculateNextRunTime(scheduledTime);
    const now = new Date();
    const timeUntilNextRun = nextRunTime.getTime() - now.getTime();

    // 如果下次执行时间已经过了，立即执行一次
    if (timeUntilNextRun <= 0) {
      await runScheduledCrawl();
      // 重新计算下次执行时间
      const newNextRunTime = calculateNextRunTime(scheduledTime);
      const newTimeUntilNextRun = newNextRunTime.getTime() - now.getTime();
      
      // 设置定时器
      scheduledTask = setTimeout(async () => {
        await runScheduledCrawl();
        // 设置重复定时器
        scheduledTask = setInterval(async () => {
          await runScheduledCrawl();
        }, intervalMinutes * 60 * 1000);
      }, newTimeUntilNextRun);
    } else {
      // 设置定时器
      scheduledTask = setTimeout(async () => {
        await runScheduledCrawl();
        // 设置重复定时器
        scheduledTask = setInterval(async () => {
          await runScheduledCrawl();
        }, intervalMinutes * 60 * 1000);
      }, timeUntilNextRun);
    }

    isScheduled = true;
    scheduleConfig = {
      interval: intervalMinutes,
      enabled: true,
      lastRun: null,
      nextRun: nextRunTime,
      scheduledTime,
      timezone: 'Asia/Shanghai'
    };

    console.log(`定时抓取任务已启动，间隔: ${intervalMinutes}分钟，执行时间: ${scheduledTime}`);
    
    return NextResponse.json({ 
      success: true, 
      message: `定时抓取任务已启动，间隔: ${intervalMinutes}分钟，执行时间: ${scheduledTime}`,
      data: scheduleConfig
    });
  } catch (error: any) {
    console.error('启动定时任务失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || '启动定时任务失败' 
    });
  }
}

async function stopScheduledTask() {
  if (!isScheduled) {
    return NextResponse.json({ 
      success: false, 
      message: '定时任务未在运行' 
    });
  }

  try {
    if (scheduledTask) {
      clearTimeout(scheduledTask);
      clearInterval(scheduledTask);
      scheduledTask = null;
    }

    isScheduled = false;
    scheduleConfig.enabled = false;
    scheduleConfig.nextRun = null;

    console.log('定时抓取任务已停止');
    
    return NextResponse.json({ 
      success: true, 
      message: '定时抓取任务已停止',
      data: scheduleConfig
    });
  } catch (error: any) {
    console.error('停止定时任务失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || '停止定时任务失败' 
    });
  }
}

async function updateScheduleConfig(intervalMinutes: number, scheduledTime: string) {
  if (isScheduled) {
    // 如果正在运行，先停止再重新启动
    await stopScheduledTask();
    return await startScheduledTask(intervalMinutes, scheduledTime);
  } else {
    scheduleConfig.interval = intervalMinutes;
    scheduleConfig.scheduledTime = scheduledTime;
    return NextResponse.json({ 
      success: true, 
      message: '定时任务配置已更新',
      data: scheduleConfig
    });
  }
}

// 计算下次执行时间
function calculateNextRunTime(scheduledTime: string): Date {
  const now = new Date();
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  
  // 创建今天的执行时间
  const todayRunTime = new Date(now);
  todayRunTime.setHours(hours, minutes, 0, 0);
  
  // 如果今天的执行时间已经过了，设置为明天
  if (todayRunTime <= now) {
    todayRunTime.setDate(todayRunTime.getDate() + 1);
  }
  
  return todayRunTime;
}

async function runScheduledCrawl() {
  try {
    console.log('开始执行定时抓取任务...');
    scheduleConfig.lastRun = new Date();
    
    // 创建抓取日志
    const log = await DatabaseService.createCrawlLog({
      crawlDate: new Date(),
      startTime: new Date(),
      status: 'RUNNING'
    });

    const startTime = Date.now();
    
    // 调用抓取API
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/crawl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: new Date().toISOString().split('T')[0]
      }),
    });

    if (!response.ok) {
      throw new Error('抓取请求失败');
    }

    // 读取流式响应
    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法读取响应流');

    let totalAdvertisers = 0;
    let successCount = 0;
    let errorCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.type === 'data') {
            totalAdvertisers += data.data.list.length;
          } else if (data.type === 'complete') {
            successCount = data.data.successCount || 0;
            errorCount = data.data.errorCount || 0;
          }
        } catch (e) {
          console.error('解析定时抓取数据失败:', e);
        }
      }
    }

    const endTime = Date.now();
    const durationSeconds = Math.floor((endTime - startTime) / 1000);

    // 更新抓取日志
    await DatabaseService.updateCrawlLog(log.id, {
      endTime: new Date(),
      durationSeconds,
      totalAdvertisers,
      successCount,
      errorCount,
      status: 'COMPLETED'
    });

    // 更新下次运行时间
    scheduleConfig.nextRun = calculateNextRunTime(scheduleConfig.scheduledTime);

    console.log(`定时抓取任务完成，耗时: ${durationSeconds}秒，成功: ${successCount}，失败: ${errorCount}`);
  } catch (error: any) {
    console.error('定时抓取任务失败:', error);
    
    // 更新抓取日志为失败状态
    if (scheduleConfig.lastRun) {
      const logs = await DatabaseService.getCrawlLogs(1);
      if (logs.length > 0) {
        await DatabaseService.updateCrawlLog(logs[0].id, {
          endTime: new Date(),
          status: 'FAILED',
          errorMessage: error.message
        });
      }
    }
  }
} 