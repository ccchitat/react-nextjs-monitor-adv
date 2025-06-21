import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService, AdvertiserData } from '@/lib/database';
import { CrawlStatusManager } from '@/lib/crawl-status';
import fetch from 'node-fetch';
import crypto from 'crypto';

// 定义响应数据类型
interface Advertiser {
  adv_logo: string;
  adv_name: string;
  adv_id: string;
  m_id: string;
  adv_category: string;
  mailing_region: string;
  adv_type: string;
  monthly_visits: string;
  rd: string;
  '30_epc': number | string;
  '30_rate': number | string;
  aff_ba: string;
  aff_ba_unit: string;
  aff_ba_text: string;
  approval_type: string;
  join_status: string;
  join_status_text: string;
  approval_type_text: string;
}

interface ApiResponse {
  code: string;
  msg: string;
  payload: {
    total: string;
    list: Advertiser[];
  };
}

// 生成sign的函数
function generateSign(params: Record<string, any>): string {
  // 过滤掉空字符串参数
  const filteredParams: Record<string, any> = Object.entries(params)
    .filter(([_, value]) => value !== '')
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
  
  // 构建签名字符串（只拼接值）
  const signStr = Object.values(filteredParams).join('');
  
  // 计算MD5
  const sign = crypto.createHash('md5').update(signStr).digest('hex');
  
  return sign;
}

// 抓取单页数据的函数
async function fetchPage(page: number): Promise<ApiResponse> {
  const params = {
    p: page.toString(),
    ps: '100',
    type: '0',
    status: '3',
    keyword: '',
    cat_id: '',
    country: '',
    key_word: '',
    order: 'monthly_visits',
    order_type: 'desc'
  };
  
  const sign = generateSign(params);
  const fullParams = { ...params, sign };
  
  const searchParams = new URLSearchParams(fullParams);
  const url = `https://www.linkhaitao.com/api/get_products?${searchParams.toString()}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.linkhaitao.com/union/products'
    },
    timeout: 30000 // 30秒超时
  });
  
  if (!response.ok) {
    throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
  }
  
  const data: ApiResponse = await response.json();
  
  if (data.code !== '200') {
    throw new Error(`API错误: ${data.msg}`);
  }
  
  return data;
}

// 转换API数据为数据库格式
function convertToDatabaseFormat(advertiser: Advertiser) {
  return {
    adv_logo: advertiser.adv_logo,
    adv_name: advertiser.adv_name,
    adv_id: advertiser.adv_id,
    m_id: advertiser.m_id,
    adv_category: advertiser.adv_category,
    mailing_region: advertiser.mailing_region,
    adv_type: advertiser.adv_type,
    monthly_visits: advertiser.monthly_visits,
    rd: advertiser.rd,
    '30_epc': typeof advertiser['30_epc'] === 'string' ? parseFloat(advertiser['30_epc']) : advertiser['30_epc'],
    '30_rate': typeof advertiser['30_rate'] === 'string' ? parseFloat(advertiser['30_rate']) : advertiser['30_rate'],
    aff_ba: advertiser.aff_ba,
    aff_ba_unit: advertiser.aff_ba_unit,
    aff_ba_text: advertiser.aff_ba_text,
    approval_type: advertiser.approval_type,
    join_status: advertiser.join_status,
    join_status_text: advertiser.join_status_text,
    approval_type_text: advertiser.approval_type_text,
  };
}

// 优化后的抓取任务
async function executeCrawlTask(date?: string, triggerType: 'manual' | 'scheduled' = 'scheduled'): Promise<{ success: boolean; message: string; details?: any }> {
  const startTime = new Date();
  let crawlLogId: bigint | null = null;
  
  // 检查是否已有任务在运行
  if (CrawlStatusManager.isRunning()) {
    return {
      success: false,
      message: '已有抓取任务正在运行中，请等待完成后再试'
    };
  }
  
  try {
    console.log('🚀 开始执行抓取任务...');
    
    // 使用传入的日期或当前日期
    const snapshotDate = date || new Date().toISOString().split('T')[0];
    console.log(`📅 抓取日期: ${snapshotDate}`);
    
    // 启动状态管理
    CrawlStatusManager.startCrawl(triggerType, snapshotDate);
    
    // 检查是否有已存在的数据，支持断点续抓
    let startPage = 1;
    const existingDataCount = await DatabaseService.getAdvertiserCountByDate(new Date(snapshotDate));
    if (existingDataCount > 0) {
      startPage = Math.floor(existingDataCount / 100) + 1;
      console.log(`📊 发现已有 ${existingDataCount} 条数据，从第 ${startPage} 页开始继续抓取`);
    }
    
    // 创建抓取日志
    const crawlLog = await DatabaseService.createCrawlLog({
      crawlDate: new Date(snapshotDate),
      startTime: startTime,
      status: 'running'
    });
    crawlLogId = crawlLog.id;
    
    console.log('📝 抓取日志ID:', crawlLogId);
    console.log('📄 起始页:', startPage);
    
    let currentPage = startPage;
    let totalPages = 1;
    let totalSuccessCount = 0;
    let totalErrorCount = 0;
    
    // 获取第一页数据
    const firstPageData = await fetchPage(currentPage);
    totalPages = Math.ceil(parseInt(firstPageData.payload.total) / 100);
    
    console.log(`📚 总页数: ${totalPages}, 总数据量: ${firstPageData.payload.total}`);
    
    // 转换并保存第一页数据
    const firstPageConverted = firstPageData.payload.list.map(convertToDatabaseFormat);
    try {
      const saveResult = await DatabaseService.saveAdvertiserData(firstPageConverted, snapshotDate);
      totalSuccessCount += saveResult.successCount;
      totalErrorCount += saveResult.errorCount;
      
      // 更新状态
      CrawlStatusManager.updateProgress(currentPage, totalPages, totalSuccessCount, totalErrorCount);
      
      console.log(`✅ 第 ${currentPage} 页数据保存完成: 成功 ${saveResult.successCount} 条，失败 ${saveResult.errorCount} 条`);
    } catch (error) {
      console.error(`❌ 第 ${currentPage} 页数据保存失败:`, error);
      totalErrorCount += firstPageConverted.length;
      // 更新状态
      CrawlStatusManager.updateProgress(currentPage, totalPages, totalSuccessCount, totalErrorCount);
    }
    
    // 抓取剩余页面 - 增加延迟和批处理
    while (currentPage < totalPages) {
      currentPage++;
      
      try {
        console.log(`🔄 正在抓取第 ${currentPage}/${totalPages} 页...`);
        const pageData = await fetchPage(currentPage);
        
        // 转换并保存页面数据
        const pageConverted = pageData.payload.list.map(convertToDatabaseFormat);
        try {
          const saveResult = await DatabaseService.saveAdvertiserData(pageConverted, snapshotDate);
          totalSuccessCount += saveResult.successCount;
          totalErrorCount += saveResult.errorCount;
          
          // 更新状态
          CrawlStatusManager.updateProgress(currentPage, totalPages, totalSuccessCount, totalErrorCount);
          
          console.log(`✅ 第 ${currentPage} 页数据保存完成: 成功 ${saveResult.successCount} 条，失败 ${saveResult.errorCount} 条`);
        } catch (error) {
          console.error(`❌ 第 ${currentPage} 页数据保存失败:`, error);
          totalErrorCount += pageConverted.length;
          // 更新状态
          CrawlStatusManager.updateProgress(currentPage, totalPages, totalSuccessCount, totalErrorCount);
        }
        
        // 增加延迟，避免请求过快和阻塞其他请求
        // 每10页增加更长的休息时间
        if (currentPage % 10 === 0) {
          console.log(`💤 批次休息中... (第${currentPage}页)`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒休息
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒延迟
        }
        
        // 每处理一定数量的页面，释放一下控制权给其他请求
        if (currentPage % 5 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
        
      } catch (error) {
        console.error(`❌ 抓取第 ${currentPage} 页失败:`, error);
        totalErrorCount++;
        
        // 网络错误时等待更长时间再重试
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }
    }
    
    // 更新抓取日志
    const endTime = new Date();
    const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
    
    if (crawlLogId) {
      await DatabaseService.updateCrawlLog(crawlLogId, {
        endTime: endTime,
        durationSeconds: durationSeconds,
        totalAdvertisers: totalSuccessCount + totalErrorCount,
        successCount: totalSuccessCount,
        errorCount: totalErrorCount,
        status: 'completed'
      });
    }
    
    const message = `✅ 抓取完成！共处理 ${totalSuccessCount + totalErrorCount} 条数据，成功 ${totalSuccessCount} 条，失败 ${totalErrorCount} 条，耗时 ${durationSeconds} 秒`;
    console.log(message);
    
    // 完成状态管理
    CrawlStatusManager.completeCrawl(totalSuccessCount, totalErrorCount);
    
    return {
      success: true,
      message,
      details: {
        totalPages,
        totalSuccessCount,
        totalErrorCount,
        durationSeconds
      }
    };
    
  } catch (error) {
    console.error('❌ 抓取过程中发生错误:', error);
    
    // 失败状态管理
    CrawlStatusManager.failCrawl(error instanceof Error ? error.message : '未知错误');
    
    // 更新抓取日志为失败状态
    if (crawlLogId) {
      const endTime = new Date();
      const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
      
      await DatabaseService.updateCrawlLog(crawlLogId, {
        endTime: endTime,
        durationSeconds: durationSeconds,
        totalAdvertisers: 0,
        successCount: 0,
        errorCount: 1,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : '抓取失败'
      });
    }
    
    return {
      success: false,
      message: `抓取失败: ${error instanceof Error ? error.message : '未知错误'}`,
      details: { error }
    };
  }
}

// 定时任务配置类型
interface ScheduleConfig {
  mode: 'interval' | 'time';
  interval: number; // 分钟
  scheduledTime: string; // HH:MM 格式
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  timezone: string;
}

// 使用 global 对象来避免热重载导致的状态重置
declare global {
  var _scheduleConfig: ScheduleConfig | undefined;
  var _scheduledTimer: NodeJS.Timeout | null | undefined;
}

// 获取或初始化配置
function getScheduleConfig(): ScheduleConfig {
  if (!global._scheduleConfig) {
    global._scheduleConfig = {
      mode: 'time',
      interval: 60, // 默认60分钟
      scheduledTime: '22:30', // 默认22:30
      enabled: false,
      timezone: 'Asia/Shanghai'
    };
  }
  return global._scheduleConfig;
}

// 获取或初始化定时器
function getScheduledTimer(): NodeJS.Timeout | null {
  return global._scheduledTimer || null;
}

// 设置定时器
function setScheduledTimer(timer: NodeJS.Timeout | null) {
  global._scheduledTimer = timer;
}

// 简单的全局状态管理，不需要数据库持久化

// 计算下次执行时间
function calculateNextRun(): Date {
  const scheduleConfig = getScheduleConfig();
  if (scheduleConfig.mode === 'interval') {
    // 按间隔执行
    return new Date(Date.now() + scheduleConfig.interval * 60 * 1000);
  } else {
    // 按时间执行
    return calculateNextRunTime(scheduleConfig.scheduledTime);
  }
}

// 计算指定时间的下次执行时间
function calculateNextRunTime(timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const now = new Date();
  const nextRun = new Date();
  
  nextRun.setHours(hours, minutes, 0, 0);
  
  // 如果时间已过，设置为明天
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  
  return nextRun;
}

// 启动定时任务
function startSchedule() {
  const scheduleConfig = getScheduleConfig();
  let scheduledTimer = getScheduledTimer();
  
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
  }
  
  if (!scheduleConfig.enabled) {
    console.log('⏸️ 定时任务已禁用');
    return;
  }
  
  const nextRun = calculateNextRun();
  scheduleConfig.nextRun = nextRun;
  
  const delay = nextRun.getTime() - Date.now();
  
  console.log(`⏰ 定时任务已启动`);
  console.log(`📋 配置: ${scheduleConfig.mode === 'interval' ? `每${scheduleConfig.interval}分钟` : `每天${scheduleConfig.scheduledTime}`}`);
  console.log(`🎯 下次执行: ${nextRun.toLocaleString('zh-CN')}`);
  console.log(`⏱️ 延迟: ${Math.round(delay / 1000)}秒`);
  
  scheduledTimer = setTimeout(async () => {
    await runScheduledCrawl();
    
    // 递归启动下次任务
    const currentConfig = getScheduleConfig();
    if (currentConfig.enabled) {
      startSchedule();
    }
  }, delay);
  
  setScheduledTimer(scheduledTimer);
}

// 停止定时任务
function stopSchedule() {
  const scheduledTimer = getScheduledTimer();
  const scheduleConfig = getScheduleConfig();
  
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    setScheduledTimer(null);
  }
  scheduleConfig.enabled = false;
  scheduleConfig.nextRun = undefined;
  console.log('🛑 定时任务已停止');
}

// GET 请求 - 获取当前状态
export async function GET() {
  try {
    const scheduleConfig = getScheduleConfig();
    const crawlStatus = CrawlStatusManager.getStatus();
    
    console.log('📋 GET /api/schedule - 当前状态:', {
      isScheduled: scheduleConfig.enabled,
      config: scheduleConfig,
      crawlStatus
    });
    
    return NextResponse.json({
      success: true,
      data: {
        isScheduled: scheduleConfig.enabled,
        config: scheduleConfig,
        crawlStatus: crawlStatus
      }
    });
  } catch (error) {
    console.error('❌ 获取定时任务状态失败:', error);
    return NextResponse.json({ success: false, message: '获取状态失败' }, { status: 500 });
  }
}

// POST 请求 - 设置定时任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📝 POST /api/schedule - 收到请求:', body);
    
    const { action, config, mode, interval, scheduledTime } = body;
    const scheduleConfig = getScheduleConfig();
    
    if (action === 'start') {
      // 支持两种格式：config对象或直接参数
      const newConfig = config || { mode, interval, scheduledTime };
      
      if (newConfig && (newConfig.mode || newConfig.interval || newConfig.scheduledTime)) {
        // 更新配置
        Object.assign(scheduleConfig, newConfig, { enabled: true });
        console.log('🔧 更新配置:', scheduleConfig);
      } else {
        scheduleConfig.enabled = true;
      }
      
      startSchedule();
      
      // 配置已保存到内存
      
      return NextResponse.json({
        success: true,
        message: '定时任务已启动',
        data: scheduleConfig
      });
    } else if (action === 'stop') {
      stopSchedule();
      
      return NextResponse.json({
        success: true,
        message: '定时任务已停止',
        data: scheduleConfig
      });
    } else if (action === 'update') {
      // 支持两种格式：config对象或直接参数
      const newConfig = config || { mode, interval, scheduledTime };
      
      console.log('🔍 更新配置调试信息:', {
        originalBody: body,
        config,
        directParams: { mode, interval, scheduledTime },
        newConfig
      });
      
      // 更宽松的验证：只要有任何一个有效的配置参数就允许更新
      if (!newConfig) {
        return NextResponse.json({ success: false, message: '缺少配置参数' }, { status: 400 });
      }
      
      const wasEnabled = scheduleConfig.enabled;
      
      // 只更新提供的参数
      if (newConfig.mode !== undefined) {
        scheduleConfig.mode = newConfig.mode;
      }
      if (newConfig.interval !== undefined) {
        scheduleConfig.interval = newConfig.interval;
      }
      if (newConfig.scheduledTime !== undefined) {
        scheduleConfig.scheduledTime = newConfig.scheduledTime;
      }
      
      console.log('🔧 配置已更新:', scheduleConfig);
      
      // 如果之前是启用状态，重新启动
      if (wasEnabled && scheduleConfig.enabled) {
        startSchedule();
      }
      
      return NextResponse.json({
        success: true,
        message: '配置已更新',
        data: scheduleConfig
      });
    } else {
      return NextResponse.json({ success: false, message: '无效的操作' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ 处理定时任务请求失败:', error);
    return NextResponse.json({ success: false, message: '处理请求失败' }, { status: 500 });
  }
}

// 执行定时抓取
async function runScheduledCrawl() {
  const scheduleConfig = getScheduleConfig();
  console.log(`🕐 定时任务执行中... ${new Date().toLocaleString('zh-CN')}`);
  console.log('📊 当前配置:', {
    mode: scheduleConfig.mode,
    interval: scheduleConfig.interval,
    scheduledTime: scheduleConfig.scheduledTime,
    lastRun: scheduleConfig.lastRun?.toLocaleString('zh-CN'),
    nextRun: scheduleConfig.nextRun?.toLocaleString('zh-CN')
  });
  
  try {
    // 更新最后执行时间
    scheduleConfig.lastRun = new Date();
    
    // 使用当前日期作为抓取日期
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 格式
    
    const result = await executeCrawlTask(currentDate, 'scheduled');
    
    if (result.success) {
      console.log('✅ 定时抓取任务执行成功:', result.message);
    } else {
      console.log('❌ 定时抓取任务执行失败:', result.message);
    }
  } catch (error) {
    console.error('❌ 定时任务执行异常:', error);
  }
  
  // 计算下次执行时间
  const nextRun = calculateNextRun();
  scheduleConfig.nextRun = nextRun;
  console.log(`⏰ 下次执行时间: ${nextRun.toLocaleString('zh-CN')}`);
}