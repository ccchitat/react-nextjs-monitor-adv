-- 广告商数据监控系统数据库初始化脚本
-- 适用于PostgreSQL

-- 创建数据库 (如果不存在)
-- CREATE DATABASE advertiser_monitor;

-- 连接到数据库
-- \c advertiser_monitor;

-- 创建扩展 (如果需要)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建索引函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 注意: 实际的表结构由Prisma管理
-- 这个脚本主要用于手动检查和维护

-- 查看表结构
-- \dt

-- 查看索引
-- \di

-- 查看表数据统计
-- SELECT 
--     schemaname,
--     tablename,
--     attname,
--     n_distinct,
--     correlation
-- FROM pg_stats 
-- WHERE schemaname = 'public'
-- ORDER BY tablename, attname;

-- 性能优化建议:
-- 1. 为经常查询的字段添加索引
-- 2. 定期运行VACUUM和ANALYZE
-- 3. 监控慢查询日志
-- 4. 根据数据量调整PostgreSQL配置

-- 示例查询:
-- 获取指定日期的广告商数据
-- SELECT 
--     a.adv_name,
--     a.adv_category,
--     s.monthly_visits,
--     s.epc_30,
--     s.rate_30
-- FROM advertisers a
-- JOIN advertiser_snapshots s ON a.id = s.advertiser_id
-- WHERE s.snapshot_date = '2024-01-15'
-- ORDER BY s.epc_30 DESC;

-- 获取EPC趋势数据
-- SELECT 
--     a.adv_name,
--     eh.snapshot_date,
--     eh.epc_value,
--     eh.day_offset
-- FROM advertisers a
-- JOIN epc_history eh ON a.id = eh.advertiser_id
-- WHERE a.adv_id = 'adv_1_1'
-- AND eh.snapshot_date >= '2024-01-08'
-- AND eh.snapshot_date <= '2024-01-15'
-- ORDER BY eh.snapshot_date, eh.day_offset;

-- 获取抓取统计
-- SELECT 
--     DATE(crawl_date) as date,
--     COUNT(*) as total_crawls,
--     SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success_count,
--     AVG(duration_seconds) as avg_duration
-- FROM crawl_logs
-- WHERE crawl_date >= CURRENT_DATE - INTERVAL '30 days'
-- GROUP BY DATE(crawl_date)
-- ORDER BY date DESC; 