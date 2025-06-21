import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    const adminUsername = 'admin';
    const adminPassword = '87990258';

    // 检查是否已存在管理员用户
    const existingUser = await prisma.user.findUnique({
      where: { username: adminUsername },
    });

    if (existingUser) {
      console.log('管理员用户已存在:', adminUsername);
      return;
    }

    // 创建管理员用户
    const hashedPassword = await hash(adminPassword, 10);
    const admin = await prisma.user.create({
      data: {
        username: adminUsername,
        password: hashedPassword,
        isAdmin: true,
      },
    });

    console.log('✅ 管理员用户创建成功!');
    console.log('👤 账号:', adminUsername);
    console.log('🔑 密码:', adminPassword);
    console.log('🔧 管理员权限: 是');
    console.log('用户ID:', admin.id);
  } catch (error) {
    console.error('❌ 创建管理员用户失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser(); 