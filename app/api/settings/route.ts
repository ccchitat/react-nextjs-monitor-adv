import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

// 初始化 Prisma 客户端
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// 获取系统配置
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const publicCheck = searchParams.get('public');
    const checkKey = searchParams.get('key');
    
    // 如果是公开检查特定配置（如注册状态），不需要认证
    if (publicCheck === 'true' && checkKey) {
      const config = await prisma.systemConfig.findUnique({
        where: { key: checkKey }
      });
      
      // 如果没有找到配置且是注册检查，返回默认值
      if (!config && checkKey === 'registration_enabled') {
        await prisma.systemConfig.upsert({
          where: { key: 'registration_enabled' },
          update: {},
          create: {
            key: 'registration_enabled',
            value: 'true',
            description: '是否允许用户注册'
          }
        });
        return NextResponse.json({
          success: true,
          value: 'true'
        });
      }
      
      return NextResponse.json({
        success: true,
        value: config?.value || null
      });
    }
    
    // 其他情况需要管理员权限
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.isAdmin) {
      return NextResponse.json(
        { success: false, message: '权限不足' },
        { status: 403 }
      );
    }

    const configs = await prisma.systemConfig.findMany({
      orderBy: { key: 'asc' }
    });

    // 转换为键值对象格式
    const configMap: Record<string, string> = {};
    configs.forEach(config => {
      configMap[config.key] = config.value;
    });

    // 如果没有配置，设置默认值
    if (!configMap.registration_enabled) {
      await prisma.systemConfig.upsert({
        where: { key: 'registration_enabled' },
        update: {},
        create: {
          key: 'registration_enabled',
          value: 'true',
          description: '是否允许用户注册'
        }
      });
      configMap.registration_enabled = 'true';
    }

    return NextResponse.json({
      success: true,
      configs: configMap
    });
  } catch (error) {
    console.error('获取系统配置失败:', error);
    return NextResponse.json(
      { success: false, message: '获取系统配置失败' },
      { status: 500 }
    );
  }
}

// 更新系统配置
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.isAdmin) {
      return NextResponse.json(
        { success: false, message: '权限不足' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { key, value, description } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { success: false, message: '缺少必要参数' },
        { status: 400 }
      );
    }

    const config = await prisma.systemConfig.upsert({
      where: { key },
      update: { 
        value: String(value),
        description: description || undefined
      },
      create: {
        key,
        value: String(value),
        description: description || undefined
      }
    });

    return NextResponse.json({
      success: true,
      message: '配置更新成功',
      config: {
        id: config.id.toString(),
        key: config.key,
        value: config.value,
        description: config.description
      }
    });
  } catch (error) {
    console.error('更新系统配置失败:', error);
    return NextResponse.json(
      { success: false, message: '更新系统配置失败' },
      { status: 500 }
    );
  }
} 