// 抓取状态管理
interface CrawlStatus {
  isRunning: boolean;
  currentPage?: number;
  totalPages?: number;
  successCount: number;
  errorCount: number;
  startTime?: Date;
  estimatedEndTime?: Date;
  triggerType?: 'manual' | 'scheduled';
  snapshotDate?: string;
}

// 使用 global 对象来避免热重载导致的状态重置
declare global {
  var _globalCrawlStatus: CrawlStatus | undefined;
  var _statusCallbacks: Set<StatusUpdateCallback> | undefined;
}

// 状态更新回调
type StatusUpdateCallback = (status: CrawlStatus) => void;

// 获取或初始化全局状态
function getGlobalCrawlStatus(): CrawlStatus {
  if (!global._globalCrawlStatus) {
    global._globalCrawlStatus = {
      isRunning: false,
      successCount: 0,
      errorCount: 0
    };
  }
  return global._globalCrawlStatus;
}

// 获取或初始化回调集合
function getStatusCallbacks(): Set<StatusUpdateCallback> {
  if (!global._statusCallbacks) {
    global._statusCallbacks = new Set();
  }
  return global._statusCallbacks;
}

export class CrawlStatusManager {
  // 获取当前状态
  static getStatus(): CrawlStatus {
    const globalCrawlStatus = getGlobalCrawlStatus();
    return { ...globalCrawlStatus };
  }

  // 开始抓取
  static startCrawl(triggerType: 'manual' | 'scheduled', snapshotDate?: string) {
    console.log(`🚀 [CrawlStatusManager] 开始抓取 - 触发类型: ${triggerType}, 快照日期: ${snapshotDate}`);
    global._globalCrawlStatus = {
      isRunning: true,
      currentPage: 0,
      totalPages: undefined,
      successCount: 0,
      errorCount: 0,
      startTime: new Date(),
      triggerType,
      snapshotDate
    };
    console.log(`📊 [CrawlStatusManager] 状态已更新:`, global._globalCrawlStatus);
    this.notifyCallbacks();
  }

  // 更新进度
  static updateProgress(currentPage: number, totalPages: number, successCount: number, errorCount: number) {
    console.log(`📈 [CrawlStatusManager] 更新进度 - 页面: ${currentPage}/${totalPages}, 成功: ${successCount}, 失败: ${errorCount}`);
    const globalCrawlStatus = getGlobalCrawlStatus();
    if (globalCrawlStatus.isRunning) {
      globalCrawlStatus.currentPage = currentPage;
      globalCrawlStatus.totalPages = totalPages;
      globalCrawlStatus.successCount = successCount;
      globalCrawlStatus.errorCount = errorCount;
      
      // 估算结束时间
      if (globalCrawlStatus.startTime && currentPage > 0) {
        const elapsed = Date.now() - globalCrawlStatus.startTime.getTime();
        const avgTimePerPage = elapsed / currentPage;
        const remainingPages = totalPages - currentPage;
        const estimatedRemainingTime = remainingPages * avgTimePerPage;
        globalCrawlStatus.estimatedEndTime = new Date(Date.now() + estimatedRemainingTime);
      }
      
      this.notifyCallbacks();
    } else {
      console.log(`⚠️ [CrawlStatusManager] 尝试更新进度，但抓取未运行`);
    }
  }

  // 完成抓取
  static completeCrawl(successCount: number, errorCount: number) {
    console.log(`✅ [CrawlStatusManager] 完成抓取 - 成功: ${successCount}, 失败: ${errorCount}`);
    const globalCrawlStatus = getGlobalCrawlStatus();
    global._globalCrawlStatus = {
      isRunning: false,
      successCount,
      errorCount,
      currentPage: globalCrawlStatus.totalPages,
      totalPages: globalCrawlStatus.totalPages
    };
    console.log(`📊 [CrawlStatusManager] 最终状态:`, global._globalCrawlStatus);
    this.notifyCallbacks();
  }

  // 抓取失败
  static failCrawl(error: string) {
    console.log(`❌ [CrawlStatusManager] 抓取失败 - 错误: ${error}`);
    const globalCrawlStatus = getGlobalCrawlStatus();
    global._globalCrawlStatus = {
      ...globalCrawlStatus,
      isRunning: false
    };
    console.log(`📊 [CrawlStatusManager] 失败后状态:`, global._globalCrawlStatus);
    this.notifyCallbacks();
  }

  // 添加状态监听器
  static addStatusCallback(callback: StatusUpdateCallback) {
    const statusCallbacks = getStatusCallbacks();
    statusCallbacks.add(callback);
  }

  // 移除状态监听器
  static removeStatusCallback(callback: StatusUpdateCallback) {
    const statusCallbacks = getStatusCallbacks();
    statusCallbacks.delete(callback);
  }

  // 通知所有监听器
  private static notifyCallbacks() {
    const statusCallbacks = getStatusCallbacks();
    statusCallbacks.forEach(callback => {
      try {
        const globalCrawlStatus = getGlobalCrawlStatus();
        callback(globalCrawlStatus);
      } catch (error) {
        console.error('状态回调执行错误:', error);
      }
    });
  }

  // 检查是否正在运行
  static isRunning(): boolean {
    const globalCrawlStatus = getGlobalCrawlStatus();
    return globalCrawlStatus.isRunning;
  }

  // 获取进度百分比
  static getProgress(): number {
    const globalCrawlStatus = getGlobalCrawlStatus();
    if (!globalCrawlStatus.isRunning || !globalCrawlStatus.totalPages || !globalCrawlStatus.currentPage) {
      return 0;
    }
    return Math.round((globalCrawlStatus.currentPage / globalCrawlStatus.totalPages) * 100);
  }
} 