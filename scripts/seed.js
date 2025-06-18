const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedDatabase() {
  try {
    console.log('🌱 开始初始化测试数据...');
    
    // 清空现有数据
    console.log('🗑️  清空现有数据...');
    await prisma.epcHistory.deleteMany();
    await prisma.advertiserSnapshot.deleteMany();
    await prisma.crawlLog.deleteMany();
    await prisma.advertiser.deleteMany();
    
    // 创建测试广告商
    console.log('📝 创建测试广告商...');
    const advertisers = [];
    
    for (let i = 1; i <= 5; i++) {
      const advertiser = await prisma.advertiser.create({
        data: {
          advId: `test_adv_${i}`,
          advName: `测试广告商${i}`,
          mId: `m_${i}`,
          advCategory: ['电商', '游戏', '金融', '教育', '旅游'][i - 1],
          advType: ['CPA', 'CPS', 'CPL'][i % 3],
          mailingRegion: ['美国', '欧洲', '亚洲', '全球', '中国'][i - 1],
          approvalType: ['自动', '手动', '预审'][i % 3],
          approvalTypeText: ['自动审核', '人工审核', '预审核'][i % 3],
          advLogo: `https://via.placeholder.com/40x40/007bff/ffffff?text=T${i}`,
        }
      });
      advertisers.push(advertiser);
    }
    
    // 创建测试快照数据
    console.log('📊 创建测试快照数据...');
    const today = new Date();
    
    for (const advertiser of advertisers) {
      // 为每个广告商创建最近7天的快照
      for (let day = 6; day >= 0; day--) {
        const snapshotDate = new Date(today);
        snapshotDate.setDate(snapshotDate.getDate() - day);
        
        const snapshot = await prisma.advertiserSnapshot.create({
          data: {
            advertiserId: advertiser.id,
            snapshotDate: snapshotDate,
            monthlyVisits: (Math.random() * 1000000).toFixed(0),
            rd: (Math.random() * 100).toFixed(2),
            epc30: parseFloat((Math.random() * 10).toFixed(4)),
            rate30: parseFloat((Math.random() * 100).toFixed(2)),
            affBa: (Math.random() * 10000).toFixed(2),
            affBaUnit: 'USD',
            affBaText: `$${(Math.random() * 10000).toFixed(2)}`,
            joinStatus: ['开放', '关闭', '暂停'][Math.floor(Math.random() * 3)],
            joinStatusText: ['可申请', '暂停申请', '关闭申请'][Math.floor(Math.random() * 3)],
          }
        });
        
        // 为每个快照创建EPC历史数据
        const baseEpc = snapshot.epc30 || 0;
        for (let dayOffset = 1; dayOffset <= 30; dayOffset++) {
          const variation = (Math.random() - 0.5) * 0.3;
          const epcValue = Math.max(0, baseEpc * (1 + variation));
          
          await prisma.epcHistory.create({
            data: {
              advertiserId: advertiser.id,
              snapshotDate: snapshotDate,
              epcValue: parseFloat(epcValue.toFixed(4)),
              dayOffset: dayOffset,
            }
          });
        }
      }
    }
    
    // 创建测试抓取日志
    console.log('📋 创建测试抓取日志...');
    for (let i = 0; i < 3; i++) {
      const logDate = new Date(today);
      logDate.setDate(logDate.getDate() - i);
      
      await prisma.crawlLog.create({
        data: {
          crawlDate: logDate,
          totalAdvertisers: 100 + Math.floor(Math.random() * 50),
          successCount: 95 + Math.floor(Math.random() * 10),
          errorCount: Math.floor(Math.random() * 5),
          startTime: new Date(logDate.getTime() - 300000), // 5分钟前
          endTime: logDate,
          durationSeconds: 240 + Math.floor(Math.random() * 60),
          status: 'SUCCESS',
        }
      });
    }
    
    console.log('✅ 测试数据初始化完成！');
    console.log(`📊 创建了 ${advertisers.length} 个广告商`);
    console.log(`📈 创建了 ${advertisers.length * 7} 个快照`);
    console.log(`📉 创建了 ${advertisers.length * 7 * 30} 条EPC历史数据`);
    console.log(`📋 创建了 3 条抓取日志`);
    
  } catch (error) {
    console.error('❌ 初始化测试数据失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行种子脚本
seedDatabase(); 