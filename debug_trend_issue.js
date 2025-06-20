const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugTrendIssue() {
  try {
    console.log('🔍 调试趋势筛选问题...\n');
    
    // 1. 检查所有趋势的分布
    const allTrends = await prisma.entityTrend.findMany({
      include: {
        advertiser: true
      }
    });
    
    console.log(`📊 总共有 ${allTrends.length} 条趋势记录\n`);
    
    // 统计趋势分布
    const trendStats = {
      day7: { UPWARD: 0, DOWNWARD: 0, STABLE: 0 },
      day14: { UPWARD: 0, DOWNWARD: 0, STABLE: 0 },
      day30: { UPWARD: 0, DOWNWARD: 0, STABLE: 0 }
    };
    
    allTrends.forEach(trend => {
      trendStats.day7[trend.epcTrendCategory7Day] = (trendStats.day7[trend.epcTrendCategory7Day] || 0) + 1;
      trendStats.day14[trend.epcTrendCategory14Day] = (trendStats.day14[trend.epcTrendCategory14Day] || 0) + 1;
      trendStats.day30[trend.epcTrendCategory30Day] = (trendStats.day30[trend.epcTrendCategory30Day] || 0) + 1;
    });
    
    console.log('📈 趋势统计:');
    console.log(`  7天趋势: 上升${trendStats.day7.UPWARD} | 下降${trendStats.day7.DOWNWARD} | 平稳${trendStats.day7.STABLE}`);
    console.log(`  14天趋势: 上升${trendStats.day14.UPWARD} | 下降${trendStats.day14.DOWNWARD} | 平稳${trendStats.day14.STABLE}`);
    console.log(`  30天趋势: 上升${trendStats.day30.UPWARD} | 下降${trendStats.day30.DOWNWARD} | 平稳${trendStats.day30.STABLE}\n`);
    
    // 2. 查找UPWARD趋势的广告商
    console.log('🔍 查找7天UPWARD趋势的广告商:');
    const upwardTrends7Day = await prisma.entityTrend.findMany({
      where: {
        epcTrendCategory7Day: 'UPWARD'
      },
      include: {
        advertiser: true
      },
      take: 10
    });
    
    console.log(`找到 ${upwardTrends7Day.length} 个7天UPWARD趋势的广告商:`);
    upwardTrends7Day.forEach(trend => {
      console.log(`  ${trend.advertiser.advId} - ${trend.advertiser.advName}`);
      console.log(`    7天平均EPC: ${trend.last7DayAvgEPC}`);
      console.log(`    趋势: ${trend.epcTrendCategory7Day}`);
    });
    
    // 3. 直接查询Prisma枚举类型
    console.log('\n🔍 测试Prisma枚举查询:');
    const testQuery = await prisma.entityTrend.findMany({
      where: {
        epcTrendCategory7Day: 'UPWARD'
      },
      take: 5
    });
    console.log(`直接查询UPWARD结果数量: ${testQuery.length}`);
    
    // 4. 查看所有可能的趋势值
    console.log('\n📋 检查数据库中实际的趋势值:');
    const uniqueTrends = await prisma.$queryRaw`
      SELECT DISTINCT epc_trend_category_7_day, COUNT(*) as count 
      FROM entity_trends 
      GROUP BY epc_trend_category_7_day 
      ORDER BY count DESC
    `;
    console.log('7天趋势的唯一值:', uniqueTrends);
    
    // 5. 检查具体的非零EPC广告商的趋势
    console.log('\n💰 检查有非零EPC的广告商趋势:');
    const nonZeroEpc = await prisma.dailyEpc.findMany({
      where: {
        epcValue: { gt: 0 }
      },
      include: {
        advertiser: {
          include: {
            entityTrend: true
          }
        }
      },
      take: 10
    });
    
    console.log(`找到 ${nonZeroEpc.length} 条非零EPC记录:`);
    nonZeroEpc.forEach(epc => {
      const trend = epc.advertiser.entityTrend;
      if (trend) {
        console.log(`  ${epc.advertiser.advId}: EPC=${epc.epcValue}, 7天趋势=${trend.epcTrendCategory7Day}`);
      }
    });
    
  } catch (error) {
    console.error('❌ 调试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugTrendIssue(); 