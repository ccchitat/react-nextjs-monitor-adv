const { PrismaClient } = require('@prisma/client');

async function testDatabaseConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 测试数据库连接...');
    
    // 测试连接
    await prisma.$connect();
    console.log('✅ 数据库连接成功');
    
    // 检查表是否存在
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    console.log('📋 数据库表列表:');
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // 检查数据量
    const advertiserCount = await prisma.advertiser.count();
    const snapshotCount = await prisma.advertiserSnapshot.count();
    const epcCount = await prisma.epcHistory.count();
    const logCount = await prisma.crawlLog.count();
    
    console.log('\n📊 数据统计:');
    console.log(`  - 广告商: ${advertiserCount} 条`);
    console.log(`  - 快照: ${snapshotCount} 条`);
    console.log(`  - EPC历史: ${epcCount} 条`);
    console.log(`  - 抓取日志: ${logCount} 条`);
    
    console.log('\n🎉 数据库测试完成');
    
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testDatabaseConnection(); 