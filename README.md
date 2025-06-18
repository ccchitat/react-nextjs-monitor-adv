# 广告商数据监控系统

一个基于React和Next.js的广告商数据监控系统，支持数据抓取、存储、展示和分析。

## 功能特性

### 🚀 核心功能
- **数据抓取**: 支持按日期抓取广告商数据
- **数据存储**: 使用PostgreSQL数据库持久化存储数据
- **数据展示**: Excel样式的表格展示，支持排序、搜索、分页
- **EPC趋势图**: 每行显示最近7/14/30天的EPC折线图
- **抓取日志**: 完整的抓取历史记录和状态监控

### 📊 数据管理
- **广告商基础信息**: 存储广告商的基本信息
- **每日数据快照**: 记录每天的数据变化
- **EPC历史数据**: 保存EPC趋势数据
- **抓取日志**: 记录每次抓取的详细信息

### 🎨 用户界面
- **响应式设计**: 适配不同屏幕尺寸
- **现代化UI**: 使用Tailwind CSS构建美观界面
- **实时进度**: 抓取过程实时显示进度
- **错误处理**: 完善的错误提示和处理机制

## 技术栈

- **前端**: React 18, Next.js 13, TypeScript
- **样式**: Tailwind CSS
- **数据库**: PostgreSQL
- **ORM**: Prisma
- **部署**: Vercel (推荐)

## 快速开始

### 1. 环境要求
- Node.js 18+
- PostgreSQL 12+
- pnpm (推荐) 或 npm

### 2. 安装依赖
```bash
pnpm install
```

### 3. 环境配置
创建 `.env.local` 文件：
```env
# 数据库连接配置
DATABASE_URL="postgresql://username:password@localhost:5432/advertiser_monitor"

# 应用配置
NODE_ENV=development
NEXT_PUBLIC_APP_NAME="广告商数据监控系统"
```

### 4. 数据库设置
```bash
# 生成Prisma客户端
pnpm prisma generate

# 推送数据库架构
pnpm prisma db push

# 查看数据库 (可选)
pnpm prisma studio
```

### 5. 启动开发服务器
```bash
pnpm dev
```

访问 http://localhost:3000 查看应用。

## 数据库架构

### 表结构

#### 1. advertisers (广告商基础信息)
- `id`: 主键
- `adv_id`: 广告商ID (唯一)
- `adv_name`: 广告商名称
- `m_id`: 媒体ID
- `adv_category`: 广告商分类
- `adv_type`: 广告类型
- `mailing_region`: 投放地区
- `approval_type`: 审核类型
- `approval_type_text`: 审核类型文本
- `adv_logo`: 广告商Logo
- `created_at`: 创建时间
- `updated_at`: 更新时间

#### 2. advertiser_snapshots (每日数据快照)
- `id`: 主键
- `advertiser_id`: 广告商ID (外键)
- `snapshot_date`: 快照日期
- `monthly_visits`: 月访问量
- `rd`: RD值
- `epc_30`: 30天EPC
- `rate_30`: 30天转化率
- `aff_ba`: 联盟余额
- `aff_ba_unit`: 余额单位
- `aff_ba_text`: 余额文本
- `join_status`: 加入状态
- `join_status_text`: 状态文本
- `created_at`: 创建时间

#### 3. epc_history (EPC历史数据)
- `id`: 主键
- `advertiser_id`: 广告商ID (外键)
- `snapshot_date`: 快照日期
- `epc_value`: EPC值
- `day_offset`: 天数偏移
- `created_at`: 创建时间

#### 4. crawl_logs (抓取日志)
- `id`: 主键
- `crawl_date`: 抓取日期
- `total_advertisers`: 总广告商数
- `success_count`: 成功数量
- `error_count`: 错误数量
- `start_time`: 开始时间
- `end_time`: 结束时间
- `duration_seconds`: 耗时(秒)
- `status`: 状态
- `error_message`: 错误信息
- `created_at`: 创建时间

## API接口

### 1. 数据抓取
```
POST /api/crawl
Content-Type: application/json

{
  "date": "2024-01-15"
}
```

### 2. 数据查询
```
GET /api/data?date=2024-01-15&timeRange=7
```

### 3. 抓取日志
```
GET /api/logs?limit=10
```

## 使用说明

### 数据抓取
1. 选择要抓取的日期
2. 点击"开始抓取"按钮
3. 系统会显示实时进度
4. 抓取完成后数据会自动保存到数据库

### 数据查看
1. 选择日期后系统会自动加载该日期的数据
2. 如果该日期已有数据，会直接从数据库加载
3. 如果该日期没有数据，会提示进行抓取

### 数据表格功能
- **排序**: 点击列标题进行排序
- **搜索**: 使用搜索框过滤数据
- **分页**: 支持分页浏览
- **EPC图表**: 每行显示EPC趋势图
- **时间范围**: 可选择7/14/30天的EPC数据

### 抓取日志
- 查看历史抓取记录
- 监控抓取成功率和耗时
- 排查抓取错误

## 部署

### Vercel部署 (推荐)
1. 将代码推送到GitHub
2. 在Vercel中导入项目
3. 配置环境变量
4. 部署完成

### 自托管部署
1. 构建项目: `pnpm build`
2. 启动服务: `pnpm start`
3. 配置反向代理 (如Nginx)

## 开发指南

### 添加新功能
1. 在 `lib/database.ts` 中添加数据库操作
2. 在 `app/api/` 中添加API路由
3. 在 `app/` 中添加页面组件
4. 更新Prisma模型 (如需要)

### 数据库迁移
```bash
# 创建迁移
pnpm prisma migrate dev --name migration_name

# 应用迁移
pnpm prisma migrate deploy
```

### 代码规范
- 使用TypeScript进行类型检查
- 遵循ESLint规则
- 使用Prettier格式化代码
- 编写单元测试 (推荐)

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查DATABASE_URL配置
   - 确认PostgreSQL服务运行正常
   - 验证数据库用户权限

2. **Prisma客户端错误**
   - 运行 `pnpm prisma generate`
   - 检查schema.prisma文件语法

3. **数据抓取失败**
   - 检查网络连接
   - 查看抓取日志
   - 确认API接口可用

4. **页面加载缓慢**
   - 检查数据库查询性能
   - 添加适当的索引
   - 优化组件渲染

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 创建Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交Issue或联系开发团队。
