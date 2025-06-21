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

            // 3. 处理趋势数据
            await processDailyEpcTrend(Number(advertiser.id), epcValue, snapshotDate);

            successCount++;
          } catch (error) {
            console.error(`处理广告商数据时发生错误 (${data.adv_id}):`, error);
            errorCount++;
          }
        }
      });

      return { successCount, errorCount };
    } catch (error) {
      console.error('保存广告商数据时发生错误:', error);
      throw error;
    }
  }

  /**
   * 获取指定日期的广告商数据（支持搜索）
   */
  static async getAdvertiserDataByDate(date: Date, page = 1, pageSize = 20, searchTerm?: string) {
    console.log(`[DatabaseService] getAdvertiserDataByDate 调用, 日期: ${date.toISOString()}, page: ${page}, pageSize: ${pageSize}, searchTerm: ${searchTerm}`);
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
      
      const advertisers = await prisma.advertiser.findMany({
        where: whereCondition,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          dailyEpc: {
            where: {
              date: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
          },
          entityTrend: true,
        },
      });
      console.log(`[DatabaseService] 查询到 ${advertisers.length} 个广告商的基础数据`);
      const result = advertisers.map(advertiser => {
        const epcData = advertiser.dailyEpc[0];
        const trend = advertiser.entityTrend;
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