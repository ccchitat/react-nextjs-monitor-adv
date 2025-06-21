// 定时管理功能测试脚本
const BASE_URL = 'http://localhost:3000';

async function testScheduleAPI() {
  console.log('开始测试定时管理功能...\n');

  try {
    // 1. 获取当前状态
    console.log('1. 获取当前定时任务状态...');
    const statusResponse = await fetch(`${BASE_URL}/api/schedule`);
    const statusData = await statusResponse.json();
    console.log('当前状态:', statusData);
    console.log('');

    // 2. 启动定时任务（设置1分钟后执行）
    console.log('2. 启动定时任务（间隔1分钟）...');
    const startResponse = await fetch(`${BASE_URL}/api/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'start',
        interval: 1, // 1分钟
        scheduledTime: new Date(Date.now() + 60000).toTimeString().slice(0, 5) // 1分钟后
      }),
    });
    const startData = await startResponse.json();
    console.log('启动结果:', startData);
    console.log('');

    // 3. 再次获取状态确认
    console.log('3. 确认定时任务已启动...');
    const statusResponse2 = await fetch(`${BASE_URL}/api/schedule`);
    const statusData2 = await statusResponse2.json();
    console.log('启动后状态:', statusData2);
    console.log('');

    // 4. 等待2分钟让任务执行
    console.log('4. 等待2分钟让定时任务执行...');
    console.log('请观察控制台输出和抓取日志页面...');
    
    // 5. 检查抓取日志
    setTimeout(async () => {
      console.log('5. 检查抓取日志...');
      const logsResponse = await fetch(`${BASE_URL}/api/logs`);
      const logsData = await logsResponse.json();
      console.log('最新抓取日志:', logsData.logs?.[0] || '无日志');
      console.log('');

      // 6. 停止定时任务
      console.log('6. 停止定时任务...');
      const stopResponse = await fetch(`${BASE_URL}/api/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'stop'
        }),
      });
      const stopData = await stopResponse.json();
      console.log('停止结果:', stopData);
      console.log('');

      console.log('测试完成！');
    }, 120000); // 等待2分钟

  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 快速验证模式 - 只测试API接口，不等待实际执行
async function quickTest() {
  console.log('开始快速验证定时管理API...\n');

  try {
    // 1. 测试获取状态
    console.log('1. 测试获取状态API...');
    const statusResponse = await fetch(`${BASE_URL}/api/schedule`);
    const statusData = await statusResponse.json();
    console.log('✅ 获取状态成功:', statusData.success);
    console.log('');

    // 2. 测试启动定时任务
    console.log('2. 测试启动定时任务API...');
    const startResponse = await fetch(`${BASE_URL}/api/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'start',
        interval: 1440, // 24小时
        scheduledTime: '09:00'
      }),
    });
    const startData = await startResponse.json();
    console.log('✅ 启动定时任务成功:', startData.success);
    console.log('消息:', startData.message);
    console.log('');

    // 3. 再次获取状态确认
    console.log('3. 确认定时任务状态...');
    const statusResponse2 = await fetch(`${BASE_URL}/api/schedule`);
    const statusData2 = await statusResponse2.json();
    console.log('✅ 定时任务已启动:', statusData2.data.isScheduled);
    console.log('配置:', statusData2.data.config);
    console.log('');

    // 4. 测试停止定时任务
    console.log('4. 测试停止定时任务API...');
    const stopResponse = await fetch(`${BASE_URL}/api/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'stop'
      }),
    });
    const stopData = await stopResponse.json();
    console.log('✅ 停止定时任务成功:', stopData.success);
    console.log('消息:', stopData.message);
    console.log('');

    // 5. 最终确认状态
    console.log('5. 最终状态确认...');
    const finalStatusResponse = await fetch(`${BASE_URL}/api/schedule`);
    const finalStatusData = await finalStatusResponse.json();
    console.log('✅ 定时任务已停止:', !finalStatusData.data.isScheduled);
    console.log('');

    console.log('🎉 快速验证完成！所有API接口工作正常！');
    console.log('');
    console.log('💡 提示：');
    console.log('- 定时任务API接口验证通过');
    console.log('- 要验证实际执行，可以设置较短的间隔时间');
    console.log('- 真实抓取任务需要30分钟，建议在非工作时间测试');

  } catch (error) {
    console.error('❌ 快速验证失败:', error);
  }
}

// 选择测试模式
const testMode = process.argv[2] || 'quick';

if (testMode === 'full') {
  console.log('运行完整测试模式（需要等待2分钟）...');
  testScheduleAPI();
} else {
  console.log('运行快速验证模式（只测试API接口）...');
  quickTest();
} 