import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService, AdvertiserData } from '@/lib/database';
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
  
  // console.log('过滤后的参数:', filteredParams);
  
  // 构建签名字符串（只拼接值）
  const signStr = Object.values(filteredParams).join('');
  
  // console.log('签名字符串:', signStr);
  
  // 计算MD5
  const sign = crypto.createHash('md5').update(signStr).digest('hex');
  // console.log('生成的sign:', sign);
  
  return sign;
}

// 抓取单页数据
async function fetchPage(page: number): Promise<ApiResponse> {
  const params = {
    channel: "14681",
    join_status: "adopt",
    adv_category: "",
    adv_type: "",
    mini_type: "",
    region: "",
    mailing_region: "",
    approval_type: "",
    platform: "",
    is_cross: "",
    allow_sml: "",
    allow_sem: "",
    has_coupon: "",
    page: page,
    page_size: 100,
    m_ids: "",
    order_by: "",
    linkhaitao_api2_salt: "TSf03xGHykY"
  };

  console.log('原始参数:', params);

  // 生成sign
  const sign = generateSign(params);
  
  // 构建URL（保留所有参数，包括空字符串）
  const queryString = Object.entries(params)
    .filter(([key]) => key !== 'linkhaitao_api2_salt')
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  
  const url = `https://www.linkhaitao.com/api2.php?c=programs&a=list&sign=${sign}&${queryString}`;
  
  console.log('开始抓取数据...');
  console.log('当前页码:', page);
  console.log('请求URL:', url);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'https://www.linkhaitao.com/',
      'Origin': 'https://www.linkhaitao.com',
      'lh-authorization': 'U-15536776.9be6Mrbm_aFfWtw_bvdW537qq3T2kkUvP0WVjpxDqtCW7aZGbIy1vKKCrmzuMJEA0KCscl yj_bCjN6mZ0Z52sysIr2aU5lY7ti3v92nsZtIEex_bg_aHZ7IiWh8kTYFwaK6UVeu1b1f5EQDf_bVt0fySxarMz23mC_bWL7C'
    }
  });
  
  const data = await response.json() as ApiResponse;
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  if (data.code !== '0200') {
    throw new Error(`API error: ${data.msg}`);
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

// 创建流式响应
function createStreamResponse(date?: string, signal?: AbortSignal) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let crawlLogId: bigint | null = null;
      const startTime = new Date();
      const snapshotDate = date ? new Date(date) : new Date();
      
      // 监听取消信号
      if (signal) {
        signal.addEventListener('abort', () => {
          console.log('收到取消信号，停止抓取');
          controller.close();
        });
      }
      
      try {
        // 检查是否已有该日期的数据，确定起始页
        const hasData = await DatabaseService.hasDataForDate(snapshotDate);
        let startPage = 1;
        
        if (hasData) {
          // 如果已有数据，计算已抓取的页数
          const existingDataCount = await DatabaseService.getAdvertiserCountByDate(snapshotDate);
          startPage = Math.floor(existingDataCount / 100) + 1;
          console.log(`发现已有 ${existingDataCount} 条数据，从第 ${startPage} 页开始继续抓取`);
          
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'info',
            message: `发现已有 ${existingDataCount} 条数据，从第 ${startPage} 页开始继续抓取`
          }) + '\n'));
        }
        
        // 创建抓取日志
        crawlLogId = await DatabaseService.createCrawlLog({
          crawlDate: snapshotDate,
          startTime: startTime,
          status: 'running'
        });
        
        console.log('开始抓取数据，日期:', date || '今天');
        console.log('抓取日志ID:', crawlLogId);
        console.log('起始页:', startPage);
        
        let currentPage = startPage;
        let totalPages = 1;
        let totalSuccessCount = 0;
        let totalErrorCount = 0;
        
        // 获取第一页数据（或继续页）
        const firstPageData = await fetchPage(currentPage);
        
        // 检查是否已取消
        if (signal?.aborted) {
          console.log('抓取已取消');
          if (crawlLogId) {
            await DatabaseService.updateCrawlLog(crawlLogId, {
              endTime: new Date(),
              durationSeconds: Math.round((new Date().getTime() - startTime.getTime()) / 1000),
              totalAdvertisers: 0,
              successCount: 0,
              errorCount: 1,
              status: 'cancelled',
              errorMessage: '用户取消抓取'
            });
          }
          controller.close();
          return;
        }
        
        // 发送进度信息
        totalPages = Math.ceil(parseInt(firstPageData.payload.total) / 100);
        controller.enqueue(encoder.encode(JSON.stringify({
          type: 'progress',
          data: { current: currentPage, total: totalPages }
        }) + '\n'));
        
        // 转换并立即保存第一页数据
        const firstPageConverted = firstPageData.payload.list.map(convertToDatabaseFormat);
        try {
          const saveResult = await DatabaseService.saveAdvertiserData(firstPageConverted, snapshotDate);
          totalSuccessCount += saveResult.successCount;
          totalErrorCount += saveResult.errorCount;
          
          console.log(`第 ${currentPage} 页数据保存完成: 成功 ${saveResult.successCount} 条，失败 ${saveResult.errorCount} 条`);
        } catch (error) {
          console.error(`第 ${currentPage} 页数据保存失败:`, error);
          totalErrorCount += firstPageConverted.length;
        }
        
        // 发送第一页数据
        controller.enqueue(encoder.encode(JSON.stringify({
          type: 'data',
          data: firstPageData.payload
        }) + '\n'));
        
        // 抓取剩余页面
        while (currentPage < totalPages) {
          // 检查是否已取消
          if (signal?.aborted) {
            console.log('抓取已取消');
            if (crawlLogId) {
              await DatabaseService.updateCrawlLog(crawlLogId, {
                endTime: new Date(),
                durationSeconds: Math.round((new Date().getTime() - startTime.getTime()) / 1000),
                totalAdvertisers: totalSuccessCount + totalErrorCount,
                successCount: totalSuccessCount,
                errorCount: totalErrorCount + 1,
                status: 'cancelled',
                errorMessage: '用户取消抓取'
              });
            }
            controller.close();
            return;
          }
          
          currentPage++;
          
          try {
            const pageData = await fetchPage(currentPage);
            
            // 发送进度信息
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'progress',
              data: { current: currentPage, total: totalPages }
            }) + '\n'));
            
            // 转换并立即保存页面数据
            const pageConverted = pageData.payload.list.map(convertToDatabaseFormat);
            try {
              const saveResult = await DatabaseService.saveAdvertiserData(pageConverted, snapshotDate);
              totalSuccessCount += saveResult.successCount;
              totalErrorCount += saveResult.errorCount;
              
              console.log(`第 ${currentPage} 页数据保存完成: 成功 ${saveResult.successCount} 条，失败 ${saveResult.errorCount} 条`);
            } catch (error) {
              console.error(`第 ${currentPage} 页数据保存失败:`, error);
              totalErrorCount += pageConverted.length;
            }
            
            // 发送页面数据
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'data',
              data: pageData.payload
            }) + '\n'));
            
            // 添加延迟，避免请求过快
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.error(`抓取第 ${currentPage} 页失败:`, error);
            totalErrorCount++;
            // 继续抓取下一页
            continue;
          }
        }
        
        // 检查是否已取消
        if (signal?.aborted) {
          console.log('抓取已取消');
          if (crawlLogId) {
            await DatabaseService.updateCrawlLog(crawlLogId, {
              endTime: new Date(),
              durationSeconds: Math.round((new Date().getTime() - startTime.getTime()) / 1000),
              totalAdvertisers: totalSuccessCount + totalErrorCount,
              successCount: totalSuccessCount,
              errorCount: totalErrorCount + 1,
              status: 'cancelled',
              errorMessage: '用户取消抓取'
            });
          }
          controller.close();
          return;
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
        
        controller.enqueue(encoder.encode(JSON.stringify({
          type: 'complete',
          message: `抓取完成！共处理 ${totalSuccessCount + totalErrorCount} 条数据，成功 ${totalSuccessCount} 条，失败 ${totalErrorCount} 条，耗时 ${durationSeconds} 秒`
        }) + '\n'));
        
        controller.close();
      } catch (error) {
        console.error('抓取过程中发生错误:', error);
        
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
        
        controller.error(error);
      }
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export async function POST(request: Request) {
  try {
    // 解析请求体，获取日期参数
    const body = await request.json();
    const { date } = body;
    
    console.log('收到抓取请求，日期:', date);
    
    // 传递 AbortSignal 到流式响应
    return createStreamResponse(date, request.signal);
  } catch (error: any) {
    console.error('抓取失败:', error);
    
    // 返回错误响应
    return NextResponse.json({ 
      success: false, 
      message: '抓取任务失败',
      error: error?.message || '未知错误'
    }, { status: 500 });
  }
} 