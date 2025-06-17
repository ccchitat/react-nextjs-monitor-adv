import { NextResponse } from 'next/server';
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
  
  console.log('过滤后的参数:', filteredParams);
  
  // 构建签名字符串（只拼接值）
  const signStr = Object.values(filteredParams).join('');
  
  console.log('签名字符串:', signStr);
  
  // 计算MD5
  const sign = crypto.createHash('md5').update(signStr).digest('hex');
  console.log('生成的sign:', sign);
  
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
    page_size: 10,
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
      'lh-authorization': 'U-15536776.9be6Mrbm_aFfWtw_bvdW537qq3T2kkUvP0WVjpxDqtCW7aZGbIy1vKKCrmzuMJEA0KCsclyj_bCjN6mZ0Z52sysIr2aU5lY7ti3v92nsZtIEex_bg_aHZ7IiWh8kTYFwaK6UVeu1b1f5EQDf_bVt0fySxarMz23mC_bWL7C'
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

// 创建流式响应
function createStreamResponse() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let currentPage = 1;
        let totalPages = 1;
        
        // 获取第一页数据
        const firstPageData = await fetchPage(currentPage);
        
        // 发送进度信息
        totalPages = Math.ceil(parseInt(firstPageData.payload.total) / 10);
        controller.enqueue(encoder.encode(JSON.stringify({
          type: 'progress',
          data: { current: currentPage, total: totalPages }
        }) + '\n'));
        
        // 发送第一页数据
        controller.enqueue(encoder.encode(JSON.stringify({
          type: 'data',
          data: firstPageData.payload
        }) + '\n'));
        
        // 抓取剩余页面
        while (currentPage < totalPages) {
          currentPage++;
          
          try {
            const pageData = await fetchPage(currentPage);
            
            // 发送进度信息
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'progress',
              data: { current: currentPage, total: totalPages }
            }) + '\n'));
            
            // 发送页面数据
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'data',
              data: pageData.payload
            }) + '\n'));
            
            // 添加延迟，避免请求过快
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.error(`抓取第 ${currentPage} 页失败:`, error);
            // 继续抓取下一页
            continue;
          }
        }
        
        controller.close();
      } catch (error) {
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

export async function POST() {
  try {
    return createStreamResponse();
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