import prisma from "@/lib/prisma";
import { NextApiRequest, NextApiResponse } from "next";
import { hash } from "bcrypt";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // 检查注册是否被禁用
    const registrationConfig = await prisma.systemConfig.findUnique({
      where: { key: 'registration_enabled' }
    });
    
    if (registrationConfig && registrationConfig.value === 'false') {
      return NextResponse.json({ error: "注册功能已被禁用" }, { status: 403 });
    }
    
    const { username, password } = await req.json();
    
    const exists = await prisma.user.findUnique({
      where: {
        username,
      },
    });
    
    if (exists) {
      return NextResponse.json({ error: "用户已存在" }, { status: 400 });
    }
    
    const user = await prisma.user.create({
      data: {
        username,
        password: await hash(password, 10),
      },
    });
    
    // 转换BigInt为字符串以避免序列化问题
    const userResponse = {
      id: user.id.toString(),
      username: user.username,
      createdAt: user.createdAt,
    };
    
    return NextResponse.json(userResponse);
  } catch (error) {
    console.error("注册错误:", error);
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}
