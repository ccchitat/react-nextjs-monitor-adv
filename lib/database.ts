import { Prisma, PrismaClient } from '@prisma/client';

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

            // 注意：不再生成虚假的EPC历史数据
            // EPC历史数据将基于真实的每日快照数据动态构建

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
  static async getAdvertiserDataByDate(date: Date, timeRange?: number) {
    console.log(`[DatabaseService] getAdvertiserDataByDate 调用, 日期: ${date.toISOString().split('T')[0]}, timeRange: ${timeRange}`);
    const advertisers = await prisma.advertiser.findMany({
      include: {
        snapshots: {
          where: {
            snapshotDate: timeRange
              ? {
                  gte: new Date(new Date(date).setDate(date.getDate() - timeRange + 1)),
                  lte: date,
                }
              : {
                  gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
                  lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
                },
          },
          orderBy: {
            snapshotDate: 'asc',
          },
        },
      },
    });

    console.log(`[DatabaseService] getAdvertiserDataByDate 查询到 ${advertisers.length} 个广告商的基础数据`);

    return advertisers.map(advertiser => {
      if (advertiser.snapshots.length === 0) {
        // 如果在指定日期没有快照，可能意味着这个广告商在该日期没有数据，可以考虑跳过
        console.log(`[DatabaseService] 广告商 ${advertiser.advId} 在指定日期范围内没有快照数据, 将被过滤。`);
        return null;
      }
      const latestSnapshot = advertiser.snapshots[advertiser.snapshots.length - 1];
      
      let epcHistoryData: number[] | undefined = undefined;
      let dateLabels: string[] | undefined = undefined;
      
      if (timeRange) {
        epcHistoryData = [];
        dateLabels = [];
        const startDate = new Date(date);
        startDate.setDate(startDate.getDate() - timeRange + 1);

        for (let i = 0; i < timeRange; i++) {
          const iterDate = new Date(startDate);
          iterDate.setDate(iterDate.getDate() + i);
          dateLabels.push(iterDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));

          const snapshotForDate = advertiser.snapshots.find((snapshot: any) => 
            snapshot.snapshotDate.toDateString() === iterDate.toDateString()
          );
          
          if (snapshotForDate && snapshotForDate.epc30 !== null) {
            epcHistoryData.push(Number(snapshotForDate.epc30));
          } else {
            epcHistoryData.push(0);
          }
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
        ...(timeRange && { epc_history: epcHistoryData, date_labels: dateLabels }),
      };
    }).filter(item => item !== null);
  }

  /**
   * 为指定的广告商列表获取EPC历史数据
   */
  static async getEpcHistoryForAdvertisers(
    advIds: string[],
    period: number,
    endDate: Date
  ): Promise<Record<string, { history: number[]; labels: string[] }>> {
    console.log(`[DatabaseService] getEpcHistoryForAdvertisers 调用, advIds数量: ${advIds.length}, period: ${period}, endDate: ${endDate.toISOString().split('T')[0]}`);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - period + 1);

    const advertisers = await prisma.advertiser.findMany({
      where: {
        advId: { in: advIds },
      },
      include: {
        snapshots: {
          where: {
            snapshotDate: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: {
            snapshotDate: 'asc',
          },
        },
      },
    });

    const epcData: Record<string, { history: number[]; labels: string[] }> = {};

    if(advertisers.length > 0) {
      console.log(`[DatabaseService] getEpcHistoryForAdvertisers 从数据库中查询到 ${advertisers.length} 个广告商的快照数据。`);
    }

    for (const advertiser of advertisers) {
      const history: number[] = [];
      const labels: string[] = [];
      
      for (let i = 0; i < period; i++) {
        const targetDate = new Date(startDate);
        targetDate.setDate(targetDate.getDate() + i);
        labels.push(targetDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
        
        const snapshotForDate = advertiser.snapshots.find(
          (s) => s.snapshotDate.toDateString() === targetDate.toDateString()
        );
        
        history.push(snapshotForDate?.epc30 ? Number(snapshotForDate.epc30) : 0);
      }
      
      epcData[advertiser.advId] = { history, labels };
    }

    console.log(`[DatabaseService] getEpcHistoryForAdvertisers 构建完成 ${Object.keys(epcData).length} 个广告商的EPC历史。`);
    return epcData;
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
} 