import { PrismaClient, Prisma } from '@prisma/client';
import { linearRegression, mean } from 'simple-statistics';

const prisma = new PrismaClient();

// 定义趋势类型
export enum ETrendType {
  UPWARD = 'UPWARD',     // 上升趋势
  DOWNWARD = 'DOWNWARD', // 下降趋势
  STABLE = 'STABLE',     // 平稳趋势
  VOLATILE = 'VOLATILE', // 波动趋势
  UNKNOWN = 'UNKNOWN',   // 未知或数据不足
}

// 定义趋势判断的阈值
const TREND_THRESHOLDS = {
  SLOPE: {
    UPWARD: 0.05,    // 斜率 > 0.05 视为上升
    DOWNWARD: -0.05, // 斜率 < -0.05 视为下降
    VOLATILE: 0.1,   // 数据波动超过10%视为波动
  },
  MIN_DATA_POINTS: 3, // 最少需要多少个数据点才能判断趋势
};

/**
 * 计算趋势
 * @param epcValues EPC值数组
 * @returns 包含斜率和趋势类型的对象
 */
export function calculateTrend(epcValues: number[]): { 
  slope: number; 
  trendCategory: ETrendType;
  avgEpc: number;
} {
  // 如果数据点不足，返回 UNKNOWN
  if (epcValues.length < TREND_THRESHOLDS.MIN_DATA_POINTS) {
    return { 
      slope: 0, 
      trendCategory: ETrendType.UNKNOWN,
      avgEpc: epcValues.length > 0 ? mean(epcValues) : 0
    };
  }

  // 计算线性回归
  const points = epcValues.map((value, index) => [index, value]);
  const regression = linearRegression(points);
  const slope = regression.m;
  
  // 计算平均值
  const avgEpc = mean(epcValues);
  
  // 计算波动性
  const maxDeviation = Math.max(...epcValues.map(v => Math.abs(v - avgEpc) / avgEpc));
  
  // 判断趋势类型
  let trendCategory: ETrendType;
  if (slope > TREND_THRESHOLDS.SLOPE.UPWARD) {
    trendCategory = ETrendType.UPWARD;
  } else if (slope < TREND_THRESHOLDS.SLOPE.DOWNWARD) {
    trendCategory = ETrendType.DOWNWARD;
  } else if (maxDeviation > TREND_THRESHOLDS.SLOPE.VOLATILE) {
    trendCategory = ETrendType.VOLATILE;
  } else {
    trendCategory = ETrendType.STABLE;
  }
  
  return { slope, trendCategory, avgEpc };
}

/**
 * 处理每日EPC趋势
 * @param entityId 实体ID
 * @param todayEpcValue 今日EPC值
 * @param todayDate 日期
 */
export async function processDailyEpcTrend(
  entityId: number,
  todayEpcValue: number,
  todayDate: Date
): Promise<void> {
  try {
    // 1. 获取最近30天的数据
    const thirtyDaysAgo = new Date(todayDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const historicalData = await prisma.dailyEpc.findMany({
      where: {
        entityId,
        date: {
          gte: thirtyDaysAgo,
          lte: todayDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
      select: {
        epcValue: true,
      },
    });

    // 2. 提取EPC值数组
    const epcValues = historicalData.map((record: { epcValue: Prisma.Decimal }) => Number(record.epcValue));
    
    // 3. 计算不同时间窗口的趋势
    const last7Days = epcValues.slice(-7);
    const last14Days = epcValues.slice(-14);
    const last30Days = epcValues.slice(-30);
    
    const trend7Day = calculateTrend(last7Days);
    const trend14Day = calculateTrend(last14Days);
    const trend30Day = calculateTrend(last30Days);

    // 4. 更新趋势记录
    await prisma.entityTrend.upsert({
      where: {
        entityId,
      },
      update: {
        // 7天趋势数据
        last7DayAvgEPC: trend7Day.avgEpc,
        epcSlope7Day: trend7Day.slope,
        epcTrendCategory7Day: trend7Day.trendCategory,
        
        // 14天趋势数据
        last14DayAvgEPC: trend14Day.avgEpc,
        epcSlope14Day: trend14Day.slope,
        epcTrendCategory14Day: trend14Day.trendCategory,
        
        // 30天趋势数据
        last30DayAvgEPC: trend30Day.avgEpc,
        epcSlope30Day: trend30Day.slope,
        epcTrendCategory30Day: trend30Day.trendCategory,
        
        lastCalculatedAt: new Date(),
      },
      create: {
        entityId,
        // 7天趋势数据
        last7DayAvgEPC: trend7Day.avgEpc,
        epcSlope7Day: trend7Day.slope,
        epcTrendCategory7Day: trend7Day.trendCategory,
        
        // 14天趋势数据
        last14DayAvgEPC: trend14Day.avgEpc,
        epcSlope14Day: trend14Day.slope,
        epcTrendCategory14Day: trend14Day.trendCategory,
        
        // 30天趋势数据
        last30DayAvgEPC: trend30Day.avgEpc,
        epcSlope30Day: trend30Day.slope,
        epcTrendCategory30Day: trend30Day.trendCategory,
      },
    });
    
  } catch (error) {
    console.error('处理EPC趋势时发生错误:', error);
    throw error;
  }
}

/**
 * 查询示例：筛选近7天趋势为上升的实体
 */
export async function findUpwardTrend7Days() {
  return prisma.entityTrend.findMany({
    where: {
      epcTrendCategory7Day: ETrendType.UPWARD,
    },
  });
}

/**
 * 查询示例：筛选近14天趋势为下降且斜率小于-0.05的实体
 */
export async function findSignificantDownwardTrend14Days() {
  return prisma.entityTrend.findMany({
    where: {
      AND: [
        { epcTrendCategory14Day: ETrendType.DOWNWARD },
        { epcSlope14Day: { lt: -0.05 } },
      ],
    },
  });
}

/**
 * 查询示例：筛选近30天趋势为波动的实体
 */
export async function findVolatileTrend30Days() {
  return prisma.entityTrend.findMany({
    where: {
      epcTrendCategory30Day: ETrendType.VOLATILE,
    },
  });
}

/**
 * 高级查询示例：组合多个条件的复杂查询
 */
export async function findComplexTrendPatterns({
  days,
  trendType,
  minSlope,
  maxSlope,
  minAvgEpc,
}: {
  days: 7 | 14 | 30;
  trendType?: ETrendType;
  minSlope?: number;
  maxSlope?: number;
  minAvgEpc?: number;
}) {
  const whereClause: any = {};
  
  // 根据天数选择对应的字段
  const trendField = `epcTrendCategory${days}Day`;
  const slopeField = `epcSlope${days}Day`;
  const avgEpcField = `last${days}DayAvgEPC`;
  
  if (trendType) {
    whereClause[trendField] = trendType;
  }
  
  if (minSlope !== undefined || maxSlope !== undefined) {
    whereClause[slopeField] = {};
    if (minSlope !== undefined) {
      whereClause[slopeField].gte = minSlope;
    }
    if (maxSlope !== undefined) {
      whereClause[slopeField].lte = maxSlope;
    }
  }
  
  if (minAvgEpc !== undefined) {
    whereClause[avgEpcField] = { gte: minAvgEpc };
  }
  
  return prisma.entityTrend.findMany({
    where: whereClause,
    orderBy: {
      [avgEpcField]: 'desc',
    },
  });
} 