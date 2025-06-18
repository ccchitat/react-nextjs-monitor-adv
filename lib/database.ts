import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

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
    const startTime = new Date();
    let successCount = 0;
    let errorCount = 0;

    try {
      // 开始事务
      await prisma.$transaction(async (tx) => {
        for (const data of advertiserList) {
          try {
            // 1. 创建或更新广告商基础信息
            const advertiser = await tx.advertiser.upsert({
              where: { advId: data.adv_id },
              update: {
                advName: data.adv_name,
                mId: data.m_id,
                advCategory: data.adv_category,
                advType: data.adv_type,
                mailingRegion: data.mailing_region,
                approvalType: data.approval_type,
                approvalTypeText: data.approval_type_text,
                advLogo: data.adv_logo,
                updatedAt: new Date(),
              },
              create: {
                advId: data.adv_id,
                advName: data.adv_name,
                mId: data.m_id,
                advCategory: data.adv_category,
                advType: data.adv_type,
                mailingRegion: data.mailing_region,
                approvalType: data.approval_type,
                approvalTypeText: data.approval_type_text,
                advLogo: data.adv_logo,
              },
            });

            // 2. 创建每日快照
            const snapshot = await tx.advertiserSnapshot.upsert({
              where: {
                advertiserId_snapshotDate: {
                  advertiserId: advertiser.id,
                  snapshotDate: snapshotDate,
                },
              },
              update: {
                monthlyVisits: data.monthly_visits,
                rd: data.rd,
                epc30: typeof data['30_epc'] === 'number' ? data['30_epc'] : parseFloat(data['30_epc'] as string) || null,
                rate30: typeof data['30_rate'] === 'number' ? data['30_rate'] : parseFloat(data['30_rate'] as string) || null,
                affBa: data.aff_ba,
                affBaUnit: data.aff_ba_unit,
                affBaText: data.aff_ba_text,
                joinStatus: data.join_status,
                joinStatusText: data.join_status_text,
              },
              create: {
                advertiserId: advertiser.id,
                snapshotDate: snapshotDate,
                monthlyVisits: data.monthly_visits,
                rd: data.rd,
                epc30: typeof data['30_epc'] === 'number' ? data['30_epc'] : parseFloat(data['30_epc'] as string) || null,
                rate30: typeof data['30_rate'] === 'number' ? data['30_rate'] : parseFloat(data['30_rate'] as string) || null,
                affBa: data.aff_ba,
                affBaUnit: data.aff_ba_unit,
                affBaText: data.aff_ba_text,
                joinStatus: data.join_status,
                joinStatusText: data.join_status_text,
              },
            });

            // 3. 生成并保存EPC历史数据（模拟7天数据）
            const epcHistoryData = this.generateEpcHistoryData(data['30_epc']);
            for (let i = 0; i < epcHistoryData.length; i++) {
              const epcValue = epcHistoryData[i];
              const dayOffset = i + 1;
              
              await tx.epcHistory.upsert({
                where: {
                  advertiserId_snapshotDate_dayOffset: {
                    advertiserId: advertiser.id,
                    snapshotDate: snapshotDate,
                    dayOffset: dayOffset,
                  },
                },
                update: {
                  epcValue: epcValue,
                },
                create: {
                  advertiserId: advertiser.id,
                  snapshotDate: snapshotDate,
                  epcValue: epcValue,
                  dayOffset: dayOffset,
                },
              });
            }

            successCount++;
          } catch (error) {
            console.error(`保存广告商数据失败: ${data.adv_id}`, error);
            errorCount++;
          }
        }
      });

      // 记录抓取日志
      const endTime = new Date();
      const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      await prisma.crawlLog.create({
        data: {
          crawlDate: snapshotDate,
          totalAdvertisers: advertiserList.length,
          successCount,
          errorCount,
          startTime,
          endTime,
          durationSeconds,
          status: 'SUCCESS',
        },
      });

      return {
        success: true,
        total: advertiserList.length,
        successCount,
        errorCount,
        durationSeconds,
      };
    } catch (error) {
      console.error('数据库事务失败:', error);
      
      // 记录错误日志
      const endTime = new Date();
      const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      await prisma.crawlLog.create({
        data: {
          crawlDate: snapshotDate,
          totalAdvertisers: advertiserList.length,
          successCount,
          errorCount,
          startTime,
          endTime,
          durationSeconds,
          status: 'ERROR',
          errorMessage: error instanceof Error ? error.message : '未知错误',
        },
      });

      throw error;
    }
  }

  /**
   * 获取指定日期的广告商数据
   */
  static async getAdvertiserDataByDate(date: Date, timeRange: number = 7) {
    const startDate = new Date(date);
    startDate.setDate(startDate.getDate() - timeRange + 1);

    const advertisers = await prisma.advertiser.findMany({
      include: {
        snapshots: {
          where: {
            snapshotDate: {
              gte: startDate,
              lte: date,
            },
          },
          orderBy: {
            snapshotDate: 'asc',
          },
        },
        epcHistory: {
          where: {
            snapshotDate: {
              gte: startDate,
              lte: date,
            },
            dayOffset: {
              lte: timeRange,
            },
          },
          orderBy: [
            { snapshotDate: 'asc' },
            { dayOffset: 'asc' },
          ],
        },
      },
    });

    return advertisers.map(advertiser => {
      const latestSnapshot = advertiser.snapshots[advertiser.snapshots.length - 1];
      
      // 构建真实的EPC历史数据
      const epcHistoryData: number[] = [];
      const dateLabels: string[] = [];
      
      // 按日期和天数偏移排序EPC历史数据
      const sortedEpcHistory = advertiser.epcHistory.sort((a, b) => {
        if (a.snapshotDate.getTime() !== b.snapshotDate.getTime()) {
          return a.snapshotDate.getTime() - b.snapshotDate.getTime();
        }
        return a.dayOffset - b.dayOffset;
      });

      // 生成日期标签
      for (let i = 0; i < timeRange; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dateLabels.push(date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
      }

      // 构建EPC数据数组
      for (let i = 0; i < timeRange; i++) {
        const targetDate = new Date(startDate);
        targetDate.setDate(targetDate.getDate() + i);
        const dayOffset = i + 1;
        
        // 查找对应日期的EPC数据
        const epcRecord = sortedEpcHistory.find(epc => 
          epc.snapshotDate.toDateString() === targetDate.toDateString() && 
          epc.dayOffset === dayOffset
        );
        
        if (epcRecord) {
          epcHistoryData.push(Number(epcRecord.epcValue));
        } else {
          // 如果没有找到对应数据，使用默认值
          epcHistoryData.push(0);
        }
      }

      return {
        adv_logo: advertiser.advLogo || '',
        adv_name: advertiser.advName,
        adv_id: advertiser.advId,
        m_id: advertiser.mId || '',
        adv_category: advertiser.advCategory || '',
        mailing_region: advertiser.mailingRegion || '',
        adv_type: advertiser.advType || '',
        monthly_visits: latestSnapshot?.monthlyVisits || '',
        rd: latestSnapshot?.rd || '',
        '30_epc': latestSnapshot?.epc30 || 0,
        '30_rate': latestSnapshot?.rate30 || 0,
        aff_ba: latestSnapshot?.affBa || '',
        aff_ba_unit: latestSnapshot?.affBaUnit || '',
        aff_ba_text: latestSnapshot?.affBaText || '',
        approval_type: advertiser.approvalType || '',
        join_status: latestSnapshot?.joinStatus || '',
        join_status_text: latestSnapshot?.joinStatusText || '',
        approval_type_text: advertiser.approvalTypeText || '',
        epc_history: epcHistoryData,
        date_labels: dateLabels,
      };
    });
  }

  /**
   * 检查指定日期是否已有数据
   */
  static async hasDataForDate(date: Date) {
    const count = await prisma.advertiserSnapshot.count({
      where: {
        snapshotDate: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
        },
      },
    });
    return count > 0;
  }

  /**
   * 获取指定日期的广告商数据数量
   */
  static async getAdvertiserCountByDate(date: Date) {
    return await prisma.advertiserSnapshot.count({
      where: {
        snapshotDate: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
        },
      },
    });
  }

  /**
   * 获取抓取日志
   */
  static async getCrawlLogs(limit: number = 10) {
    return await prisma.crawlLog.findMany({
      orderBy: {
        createdAt: 'desc',
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
    return await prisma.crawlLog.create({
      data: {
        crawlDate: data.crawlDate,
        startTime: data.startTime,
        status: data.status,
        totalAdvertisers: 0,
        successCount: 0,
        errorCount: 0,
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
    return await prisma.crawlLog.update({
      where: { id },
      data,
    });
  }

  /**
   * 生成模拟EPC历史数据
   */
  private static generateEpcHistoryData(baseEpc: number | string): number[] {
    const baseValue = typeof baseEpc === 'number' ? baseEpc : parseFloat(baseEpc as string) || 0;
    const epcData: number[] = [];
    
    for (let i = 0; i < 30; i++) {
      // 生成基于基础值的随机波动数据
      const variation = (Math.random() - 0.5) * 0.3; // ±15% 波动
      const epcValue = Math.max(0, baseValue * (1 + variation));
      epcData.push(parseFloat(epcValue.toFixed(4)));
    }
    
    return epcData;
  }
} 