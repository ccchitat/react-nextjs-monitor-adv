import { PrismaClient, Prisma, ETrendType } from '@prisma/client';
import { processDailyEpcTrend } from './epcTrendAnalyzer';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['query', 'error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export interface AdvertiserData {
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

export class DatabaseService {
  /**
   * 保存广告商数据到数据库
   */
  static async saveAdvertiserData(
    advertiserList: AdvertiserData[],
    snapshotDate: Date
  ) {
    let successCount = 0;
    let errorCount = 0;
    const processedAdvertisers: { id: number; epcValue: number }[] = [];

    try {
      await prisma.$transaction(async (tx) => {
        for (const data of advertiserList) {
          try {
            // 1. 更新或创建广告商基础信息
            const advertiser = await tx.advertiser.upsert({
              where: { advId: data.adv_id },
              update: {
                advName: data.adv_name,
                mId: data.m_id,
                advCategory: data.adv_category,
                advType: data.adv_type,
                mailingRegion: data.mailing_region,
                monthlyVisits: data.monthly_visits,
                rd: data.rd,
                epc30Day: String(data['30_epc'] || ''),
                rate30Day: String(data['30_rate'] || ''),
                affBa: data.aff_ba,
                affBaUnit: data.aff_ba_unit,
                affBaText: data.aff_ba_text,
                approvalType: data.approval_type,
                approvalTypeText: data.approval_type_text,
                joinStatus: data.join_status,
                joinStatusText: data.join_status_text,
                advLogo: data.adv_logo,
              },
              create: {
                advId: data.adv_id,
                advName: data.adv_name,
                mId: data.m_id,
                advCategory: data.adv_category,
                advType: data.adv_type,
                mailingRegion: data.mailing_region,
                monthlyVisits: data.monthly_visits,
                rd: data.rd,
                epc30Day: String(data['30_epc'] || ''),
                rate30Day: String(data['30_rate'] || ''),
                affBa: data.aff_ba,
                affBaUnit: data.aff_ba_unit,
                affBaText: data.aff_ba_text,
                approvalType: data.approval_type,
                approvalTypeText: data.approval_type_text,
                joinStatus: data.join_status,
                joinStatusText: data.join_status_text,
                advLogo: data.adv_logo,
              },
            });

            // 2. 更新每日 EPC 数据
            const epcValue = typeof data['30_epc'] === 'number' ? data['30_epc'] : parseFloat(data['30_epc'] as string) || 0;
            await tx.dailyEpc.upsert({
              where: {
                entityId_date: {
                  entityId: Number(advertiser.id),
                  date: snapshotDate,
                },
              },
              update: {
                epcValue,
              },
              create: {
                entityId: Number(advertiser.id),
                date: snapshotDate,
                epcValue,
              },
            });

            // 记录需要处理趋势的广告商信息
            processedAdvertisers.push({
              id: Number(advertiser.id),
              epcValue
            });

            successCount++;
          } catch (error) {
            console.error(`处理广告商数据时发生错误 (${data.adv_id}):`, error);
            errorCount++;
          }
        }
      });

      // 在事务外部处理趋势数据，避免外键约束问题
      for (const advertiser of processedAdvertisers) {
        try {
          await processDailyEpcTrend(advertiser.id, advertiser.epcValue, snapshotDate);
        } catch (error) {
          console.error(`处理趋势数据时发生错误 (广告商ID: ${advertiser.id}):`, error);
          // 趋势处理错误不影响主流程
        }
      }

      return { successCount, errorCount };
    } catch (error) {
      console.error('保存广告商数据时发生错误:', error);
      throw error;
    }
  }

  /**
   * 获取指定日期的广告商数据（支持搜索和排序）
   */
  static async getAdvertiserDataByDate(
    date: Date, 
    page = 1, 
    pageSize = 20, 
    searchTerm?: string,
    sortField?: string,
    sortDirection: 'asc' | 'desc' = 'asc'
  ) {
    console.log(`[DatabaseService] getAdvertiserDataByDate 调用, 日期: ${date.toISOString()}, page: ${page}, pageSize: ${pageSize}, searchTerm: ${searchTerm}, sortField: ${sortField}, sortDirection: ${sortDirection}`);
    try {
      const startOfDay = new Date(date.toISOString().split('T')[0] + 'T00:00:00.000Z');
      const endOfDay = new Date(date.toISOString().split('T')[0] + 'T23:59:59.999Z');
      console.log(`[DatabaseService] 查询日期范围: ${startOfDay.toISOString()} ~ ${endOfDay.toISOString()}`);
      
      // 构建查询条件
      const whereCondition: any = {
        dailyEpc: {
          some: {
            date: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        },
      };
      
      // 添加搜索条件
      if (searchTerm && searchTerm.trim()) {
        whereCondition.OR = [
          { advName: { contains: searchTerm.trim(), mode: 'insensitive' } },
          { advId: { contains: searchTerm.trim(), mode: 'insensitive' } },
        ];
      }
      
      // 构建排序条件
      let orderBy: any = {};
      let skipPagination = false;
      
      if (sortField) {
        // 如果是月流量排序，不使用数据库排序，在应用层处理
        if (sortField === 'monthly_visits') {
          skipPagination = true;
          orderBy = { advName: 'asc' }; // 使用默认排序，避免数据库字符串排序
        } else {
          // 映射前端字段名到数据库字段名
          const fieldMapping: Record<string, any> = {
            'adv_name': { advName: sortDirection },
            'adv_id': { advId: sortDirection },
            'adv_category': { advCategory: sortDirection },
            'adv_type': { advType: sortDirection },
            'mailing_region': { mailingRegion: sortDirection },
            'rd': { rd: sortDirection },
            '30_epc': { epc30Day: sortDirection },
            '30_rate': { rate30Day: sortDirection },
            'aff_ba': { affBa: sortDirection },
            'approval_type': { approvalType: sortDirection },
            'join_status': { joinStatus: sortDirection },
          };
          
          orderBy = fieldMapping[sortField] || { advName: 'asc' };
        }
      } else {
        // 默认按广告商名称排序
        orderBy = { advName: 'asc' };
      }
      
      // 如果是月流量排序，需要获取所有数据
      const queryOptions: any = {
        where: whereCondition,
        orderBy: orderBy,
        include: {
          dailyEpc: {
            where: {
              date: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
          },
        },
      };
      
      if (!skipPagination) {
        queryOptions.skip = (page - 1) * pageSize;
        queryOptions.take = pageSize;
      }
      
      const advertisers = await prisma.advertiser.findMany(queryOptions);
      console.log(`[DatabaseService] 查询到 ${advertisers.length} 个广告商的基础数据`);
      
      // 单独查询趋势数据，避免外键约束问题
      const advertiserIds = advertisers.map(adv => adv.id);
      const trends = await prisma.entityTrend.findMany({
        where: {
          entityId: {
            in: advertiserIds
          }
        }
      });
      
      // 创建趋势数据映射
      const trendMap = new Map();
      trends.forEach(trend => {
        trendMap.set(trend.entityId, trend);
      });

      const result = advertisers.map(advertiser => {
        const epcData = advertiser.dailyEpc[0];
        const trend = trendMap.get(advertiser.id);
        if (!epcData) {
          console.log(`[DatabaseService] 广告商 ${advertiser.advId} 没有 EPC 数据`);
        }
        if (!trend) {
          console.log(`[DatabaseService] 广告商 ${advertiser.advId} 没有趋势数据`);
        }
        return {
          adv_logo: advertiser.advLogo || '',
          adv_name: advertiser.advName,
          adv_id: advertiser.advId,
          m_id: advertiser.mId || '',
          adv_category: advertiser.advCategory || '',
          mailing_region: advertiser.mailingRegion || '',
          adv_type: advertiser.advType || '',
          monthly_visits: advertiser.monthlyVisits || '',
          rd: advertiser.rd || '',
          '30_epc': advertiser.epc30Day || epcData?.epcValue || 0,
          '30_rate': advertiser.rate30Day || '',
          aff_ba: advertiser.affBa || '',
          aff_ba_unit: advertiser.affBaUnit || '',
          aff_ba_text: advertiser.affBaText || '',
          approval_type: advertiser.approvalType || '',
          approval_type_text: advertiser.approvalTypeText || '',
          join_status: advertiser.joinStatus || '',
          join_status_text: advertiser.joinStatusText || '',
          trend_7_day: trend?.epcTrendCategory7Day || 'UNKNOWN',
          trend_14_day: trend?.epcTrendCategory14Day || 'UNKNOWN',
          trend_30_day: trend?.epcTrendCategory30Day || 'UNKNOWN',
        };
      });

      // 对月流量字段进行数值排序（如果按月流量排序）
      if (sortField === 'monthly_visits') {
        result.sort((a, b) => {
          const parseMonthlyVisits = (value: string | number): number => {
            if (typeof value === 'number') return value;
            const str = String(value).toLowerCase();
            const num = parseFloat(str.replace(/[^\d.-]/g, ''));
            if (str.includes('k')) return num * 1000;
            if (str.includes('m')) return num * 1000000;
            if (str.includes('b')) return num * 1000000000;
            return num;
          };
          
          const aValue = parseMonthlyVisits(a.monthly_visits);
          const bValue = parseMonthlyVisits(b.monthly_visits);
          
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        });
        
        // 对排序后的数据进行分页
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedResult = result.slice(startIndex, endIndex);
        
        console.log(`[DatabaseService] 月流量排序后分页: 第${page}页，共${result.length}条数据，返回${paginatedResult.length}条`);
        return paginatedResult;
      }

      console.log(`[DatabaseService] 成功组装 ${result.length} 条数据`);
      console.log('[DatabaseService] getAdvertiserDataByDate 返回的原始数据:');
      console.log(JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('[DatabaseService] 获取数据时发生错误:', error);
      throw error;
    }
  }

  /**
   * 检查指定日期是否有数据
   */
  static async hasDataForDate(date: Date): Promise<boolean> {
    console.log(`[DatabaseService] 检查日期 ${date.toISOString()} 是否有数据`);
    
    try {
      // 构建正确的日期范围（UTC时间）
      const startOfDay = new Date(date.toISOString().split('T')[0] + 'T00:00:00.000Z');
      const endOfDay = new Date(date.toISOString().split('T')[0] + 'T23:59:59.999Z');
      
      const count = await prisma.dailyEpc.count({
        where: {
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });
      
      console.log(`[DatabaseService] 日期 ${date.toISOString()} 有 ${count} 条数据`);
      return count > 0;
    } catch (error) {
      console.error('[DatabaseService] 检查数据时发生错误:', error);
      return false;
    }
  }

  /**
   * 获取指定日期的广告商数量（支持搜索）
   */
  static async getAdvertiserCountByDate(date: Date, searchTerm?: string) {
    // 构建正确的日期范围（UTC时间）
    const startOfDay = new Date(date.toISOString().split('T')[0] + 'T00:00:00.000Z');
    const endOfDay = new Date(date.toISOString().split('T')[0] + 'T23:59:59.999Z');
    
    // 构建查询条件
    const whereCondition: any = {
      dailyEpc: {
        some: {
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      },
    };
    
    // 添加搜索条件
    if (searchTerm && searchTerm.trim()) {
      whereCondition.OR = [
        { advName: { contains: searchTerm.trim(), mode: 'insensitive' } },
        { advId: { contains: searchTerm.trim(), mode: 'insensitive' } },
      ];
    }
    
    return prisma.advertiser.count({
      where: whereCondition,
    });
  }

  /**
   * 获取抓取日志
   */
  static async getCrawlLogs(limit: number = 10) {
    return prisma.crawlLog.findMany({
      orderBy: {
        crawlDate: 'desc',
      },
      take: limit,
    });
  }

  /**
   * 创建抓取日志
   */
  static async createCrawlLog(data: {
    crawlDate: Date;
    startTime: Date;
    status: string;
  }) {
    return prisma.crawlLog.create({
      data: {
        crawlDate: data.crawlDate,
        startTime: data.startTime,
        status: data.status,
      },
    });
  }

  /**
   * 更新抓取日志
   */
  static async updateCrawlLog(id: bigint, data: {
    endTime?: Date;
    durationSeconds?: number;
    totalAdvertisers?: number;
    successCount?: number;
    errorCount?: number;
    status?: string;
    errorMessage?: string;
  }) {
    return prisma.crawlLog.update({
      where: { id },
      data,
    });
  }

  /**
   * 获取所有广告商ID
   */
  static async getAllAdvertiserIds(): Promise<string[]> {
    const advertisers = await prisma.advertiser.findMany({
      select: { advId: true },
    });
    return advertisers.map(a => a.advId);
  }
} 