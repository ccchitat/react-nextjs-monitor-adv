import { NextRequest, NextResponse } from 'next/server';

// 全局变量存储定时任务状态
let scheduledTask: NodeJS.Timeout | null = null;
let isScheduled = false;
let scheduleConfig = {
  mode: 'interval' as 'interval' | 'time',
  interval: 1,
  scheduledTime: '09:00',
  enabled: false,
  lastRun: null as Date | null,
  nextRun: null as Date | null,
  timezone: 'Asia/Shanghai'
};

export async function GET() {
  console.log('📋 GET /api/schedule - 当前状态:', { isScheduled, config: scheduleConfig });
  
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
    const { action, mode, interval, scheduledTime } = await request.json();
    
    switch (action) {
      case 'start':
        return await startScheduledTask(mode, interval, scheduledTime);
      case 'stop':
        return await stopScheduledTask();
      case 'update':
        return await updateScheduleConfig(mode, interval, scheduledTime);
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

async function startScheduledTask(mode: 'interval' | 'time' = 'interval', intervalMinutes: number = 1, scheduledTime: string = '09:00') {
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

    let nextRunTime: Date;

    if (mode === 'interval') {
      // 按间隔执行：立即执行，然后按间隔重复
      await runScheduledCrawl();
      nextRunTime = new Date(Date.now() + intervalMinutes * 60 * 1000);
      
      // 设置重复定时器
      scheduledTask = setInterval(async () => {
        await runScheduledCrawl();
      }, intervalMinutes * 60 * 1000);
      
    } else {
      // 按时间执行：等待到指定时间执行
      nextRunTime = calculateNextRunTime(scheduledTime);
      const now = new Date();
      const timeUntilNextRun = nextRunTime.getTime() - now.getTime();
      
      // 如果下次执行时间已经过了，立即执行一次
      if (timeUntilNextRun <= 0) {
        await runScheduledCrawl();
        // 重新计算下次执行时间（明天同一时间）
        nextRunTime = calculateNextRunTime(scheduledTime);
      }
      
      // 设置定时器
      scheduledTask = setTimeout(async () => {
        await runScheduledCrawl();
        // 设置重复定时器（每天同一时间）
        scheduledTask = setInterval(async () => {
          await runScheduledCrawl();
        }, 24 * 60 * 60 * 1000); // 24小时
      }, Math.max(0, timeUntilNextRun));
    }

    isScheduled = true;
    
    scheduleConfig = {
      mode,
      interval: intervalMinutes,
      enabled: true,
      lastRun: null,
      nextRun: nextRunTime,
      scheduledTime,
      timezone: 'Asia/Shanghai'
    };

    console.log(`🚀 定时任务已启动`);
    if (mode === 'interval') {
      console.log(`⏰ 执行模式: 每${intervalMinutes}分钟执行一次`);
    } else {
      console.log(`⏰ 执行模式: 每天${scheduledTime}执行一次`);
    }
    console.log(`⏰ 下次执行时间: ${nextRunTime.toLocaleString('zh-CN')}`);
    
    return NextResponse.json({ 
      success: true, 
      message: `定时任务已启动，模式: ${mode === 'interval' ? '按间隔执行' : '按时间执行'}`,
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

async function updateScheduleConfig(mode: 'interval' | 'time' = 'interval', intervalMinutes: number, scheduledTime: string) {
  if (isScheduled) {
    // 如果正在运行，先停止再重新启动
    await stopScheduledTask();
    return await startScheduledTask(mode, intervalMinutes, scheduledTime);
  } else {
    scheduleConfig.mode = mode;
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
    console.log('🕐 定时任务执行中...', new Date().toLocaleString('zh-CN'));
    console.log('📊 当前配置:', {
      mode: scheduleConfig.mode,
      interval: scheduleConfig.interval,
      scheduledTime: scheduleConfig.scheduledTime,
      lastRun: scheduleConfig.lastRun?.toLocaleString('zh-CN'),
      nextRun: scheduleConfig.nextRun?.toLocaleString('zh-CN')
    });
    
    // 更新最后执行时间
    scheduleConfig.lastRun = new Date();
    
    // 计算下次执行时间
    let nextRunTime: Date;
    if (scheduleConfig.mode === 'interval') {
      // 按间隔执行
      nextRunTime = new Date(Date.now() + scheduleConfig.interval * 60 * 1000);
    } else {
      // 按时间执行
      nextRunTime = calculateNextRunTime(scheduleConfig.scheduledTime);
    }
    scheduleConfig.nextRun = nextRunTime;
    
    console.log('✅ 定时任务执行完成');
    if (scheduleConfig.mode === 'interval') {
      console.log(`⏰ 每${scheduleConfig.interval}分钟执行一次，下次执行: ${nextRunTime.toLocaleString('zh-CN')}`);
    } else {
      console.log(`⏰ 下次执行时间: ${nextRunTime.toLocaleString('zh-CN')} (${scheduleConfig.scheduledTime})`);
    }
    console.log('---');
    
  } catch (error: any) {
    console.error('❌ 定时任务执行失败:', error);
  }
} 