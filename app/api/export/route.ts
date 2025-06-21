import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { DatabaseService } from '@/lib/database';

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
  trend_7_day?: string;
  trend_14_day?: string;
  trend_30_day?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { date, searchTerm, epcPeriod, trendFilter, sortField, sortDirection } = await request.json();
    
    // 获取所有数据（不分页）
    let advertisers: Advertiser[];
    if (trendFilter && trendFilter !== 'all') {
      // 如果有趋势筛选，使用EPC接口获取数据
      const epcResponse = await fetch(`${request.nextUrl.origin}/api/epc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period: epcPeriod || 7,
          endDate: date,
          trend: trendFilter,
          page: 1,
          pageSize: 10000 // 获取所有数据
        }),
      });
      
      if (!epcResponse.ok) {
        throw new Error('获取趋势数据失败');
      }
      
      const epcResult = await epcResponse.json();
      advertisers = epcResult.advertisers || [];
    } else {
      // 正常获取数据
      advertisers = await DatabaseService.getAdvertiserDataByDate(
        new Date(date),
        1,
        10000, // 获取所有数据
        searchTerm,
        sortField,
        sortDirection
      );
    }

    if (!advertisers || advertisers.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: '没有数据可导出' 
      });
    }

    // 准备Excel数据
    const excelData = advertisers.map((adv: Advertiser) => {
      // 处理30天EPC，确保空值显示为0
      const epc30 = adv['30_epc'];
      console.log(`[Export] 广告商 ${adv.adv_id} 的30天EPC原始值:`, epc30, '类型:', typeof epc30);
      
      let epc30Value = 0;
      if (epc30 !== null && epc30 !== undefined && epc30 !== '' && epc30 !== 'null' && epc30 !== 'undefined') {
        // 尝试转换为数字
        const numValue = parseFloat(String(epc30));
        epc30Value = isNaN(numValue) ? 0 : numValue;
      }
      
      // 处理30天转化率，确保空值显示为0
      const rate30 = adv['30_rate'];
      console.log(`[Export] 广告商 ${adv.adv_id} 的30天转化率原始值:`, rate30, '类型:', typeof rate30);
      
      let rate30Value = 0;
      if (rate30 !== null && rate30 !== undefined && rate30 !== '' && rate30 !== 'null' && rate30 !== 'undefined') {
        // 尝试转换为数字
        const numValue = parseFloat(String(rate30));
        rate30Value = isNaN(numValue) ? 0 : numValue;
      }
      
      console.log(`[Export] 广告商 ${adv.adv_id} 处理后的值 - EPC: ${epc30Value}, 转化率: ${rate30Value}`);
      
      return {
        '广告商名称': adv.adv_name,
        '广告商ID': adv.adv_id,
        'M_ID': adv.m_id,
        '分类': adv.adv_category || '-',
        '类型': adv.adv_type || '-',
        '地区': adv.mailing_region || '-',
        '月访问量': adv.monthly_visits || '-',
        '30天EPC': epc30Value,
        '30天转化率': rate30Value,
        '联盟BA': adv.aff_ba || '-',
        '审批类型': adv.approval_type_text || '-'
      };
    });

    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // 设置列宽
    const columnWidths = [
      { wch: 20 }, // 广告商名称
      { wch: 15 }, // 广告商ID
      { wch: 15 }, // M_ID
      { wch: 10 }, // 分类
      { wch: 10 }, // 类型
      { wch: 8 },  // 地区
      { wch: 12 }, // 月访问量
      { wch: 12 }, // 30天EPC
      { wch: 12 }, // 30天转化率
      { wch: 12 }, // 联盟BA
      { wch: 10 }  // 审批类型
    ];
    worksheet['!cols'] = columnWidths;

    // 添加工作表到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, '广告商数据');

    // 生成Excel文件
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 生成文件名
    const fileName = `广告商数据_${date}_${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });

  } catch (error: any) {
    console.error('导出Excel失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || '导出失败' 
    }, { status: 500 });
  }
} 