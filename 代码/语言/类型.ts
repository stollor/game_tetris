import type { 游戏文案 as 通用游戏文案 } from "../../.gamemaker/依赖/框架/设置/语言/类型";

export interface 再消一行文案 {
  商店部位: Record<string, string>;
  商店穿戴: string;
  商店穿整套: string;
  商店搭配说明: string;
  商店包含静态: string;
  商店穿戴说明: string;
  对局设置: string;
  落点影透明度: string;
  旋转180设置: string;
  显示网格: string;
  显示按键说明: string;
  返回暂停菜单: string;
  游戏名称: string;
  操作标题: string;
  操作移动: string;
  操作旋转: string;
  操作半转: string;
  操作软降: string;
  操作硬降: string;
  操作暂停: string;
  快速移动提示: string;
  面板等级: string;
  面板分数: string;
  面板消行: string;
  最佳纪录: string;
  消除行数: string;
  最高等级: string;
  最佳连击: string;
  重新开始: string;
  返回主菜单: string;
  离开: string;
  暂停: string;
  继续: string;
  挑战完成: string;
  挑战成功: string;
  挑战失败: string;
  本局结算: string;
  游戏结束: string;
  已暂停: string;
  暂停进度保留: string;
  成就金币: string;
  技巧完美清场: string;
  技巧T旋: string;
  技巧迷你T旋: string;
  技巧四连消: string;
  技巧消行: string;
  技巧连击: string;
  技巧背靠背: string;
  按P或Esc继续: string;
  暂无纪录: string;
  暂无完赛纪录: string;
  模式马拉松: string;
  模式冲刺: string;
  模式极限: string;
  模式每日挑战: string;
  有效用时: string;
  历史最佳: string;
  纪录刷新: string;
  纪录未刷新: string;
  未完赛: string;
  目标达成: string;
  操作半转关闭: string;

  // —— 主题商店 ——
  主题商店: string;
  主题商店副题: string;
  主题默认: string;
  主题已拥有: string;
  主题使用中: string;
  主题使用: string;
  主题购买: string;
  主题余额: string;
  主题切换说明: string;
  主题已拥有说明: string;
  主题购买说明: string;
  主题扣币说明: string;
  主题确认购买: string;
  主题金币不足: string;
  主题购买失败: string;
  主题纯享: string;
  主题去商店: string;
  主题预览开始: string;
  主题预览设置: string;

  // —— 设置外观页 ——
  设置常规: string;
  设置外观: string;
  设置语言: string;
  设置开: string;
  设置关: string;
  设置跟随系统: string;
  返回: string;
  设置账号: string;
  主题取消: string;
  设置音乐: string;
  设置音效: string;
  设置背景动态: string;
  设置省电模式: string;
  设置屏幕适配: string;
  设置显示触屏提示: string;
  设置自动: string;
  设置手机竖屏: string;
  设置电脑横屏: string;
  设置云同步中: string;
  设置立即同步: string;
  设置用户ID: string;
  设置最近存档: string;
  设置存档状态: string;
  设置未登录: string;
  设置尚无存档: string;
  设置已同步: string;
  设置同步失败: string;
  设置未登录无法同步: string;
  设置不支持云存档: string;
  设置已跳过: string;
  设置尚未同步: string;

  // —— 结算 ——
  方块币奖励: string;
  成就标题: string;
  成就副题: string;
  成就同步: string;
  成就同步中: string;
  成就同步失败: string;
  结算奖励失败: string;
  结算新纪录: string;
  结算获得: string;
  结算纪录刷新: string;
  结算已结算: string;
  结算重开: string;
  结算重开倒计时: string;
  结算重试: string;
  结算奖励入账: string;
  结算奖励条件: string;
  结算成就更多: string;
  成就解锁: string;
  成就更多: string;
  点击重试: string;

  // —— 排行榜 ——
  排行榜标题: string;
  排行榜加载中: string;
  排行榜空提示: string;
  排行榜登录Tap: string;
  排行榜登录成功: string;
  排行榜需登录: string;
  排行榜我的名次: string;
  排行榜我的暂无成绩: string;
  排行榜玩家: string;
  排行榜周期日: string;
  排行榜周期周: string;
  排行榜周期月: string;
  排行榜周期总: string;
  排行榜无能力: string;
  排行榜无能力提示: string;
  排行榜管理器不可用: string;
  排行榜查询不可用: string;
  排行榜编号未配置: string;
  排行榜周期未配置: string;
  排行榜无有效分数: string;
  排行榜已提交: string;
  排行榜部分提交: string;
  排行榜提交失败: string;
  排行榜已打开: string;
  排行榜已加载: string;
  排行榜错误白名单: string;
  排行榜错误不匹配: string;
  排行榜错误周期结束: string;
  排行榜错误未登录: string;
  排行榜错误无权限: string;
  排行榜错误加载失败: string;
  排行榜错误带原因: string;

  // —— 云存档与用户身份 ——
  云同步中: string;
  云同步已同步: string;
  云同步已同步时间: string;
  云同步失败: string;
  云同步未登录: string;
  云同步无能力: string;
  云同步跳过: string;
  云同步默认: string;
  云同步附带: string;
  云存储无能力: string;
  云存储上传限频: string;
  云存储上传中: string;
  云存储拉取中: string;
  云存储管理器不可用: string;
  云存储已更新: string;
  云存储已创建: string;
  云存储云端无存档: string;
  云存储格式无效: string;
  云存储本地较新: string;
  云存储已写入: string;
  云存储回调超时: string;
  用户身份ID: string;
  用户身份昵称: string;
  未知错误: string;

  // —— 收藏与金币 ——
  收藏商品不存在: string;
  收藏已拥有: string;
  收藏余额不足: string;
  收藏保存失败: string;
  收藏无法保存: string;
  收藏对局无效: string;
  收藏奖励已领取: string;
  收藏对局未达标: string;
  收藏成就无待领: string;
  收藏测试金币无效: string;
  收藏购买成功: string;
  收藏成就奖励: string;
  收藏测试金币: string;
  收藏对局奖励: string;
  收藏对局首局: string;
  收藏对局纪录: string;

  // —— 平台成就与登录 ——
  平台成就已同步: string;
  平台成就同步失败: string;
  平台成就同步中: string;
  平台成就无能力: string;
  平台成就未映射: string;
  平台成就待同步: string;
  平台成就原因未登录: string;
  平台成就原因待发布: string;
  平台成就原因ID无效: string;
  平台成就原因已解锁: string;
  平台成就原因错误码: string;
  平台成就ID未配置: string;
  平台成就环境无能力: string;
  平台成就管理器不可用: string;
  平台成就无响应: string;
  平台成就已解锁同步: string;
  登录需App内打开: string;
  登录环境不支持: string;
  登录接口不可用: string;
  登录已登录: string;
  登录未返回凭证: string;
  登录失败: string;

  // —— 纯享 ——
  纯享动态开: string;
  纯享动态关: string;

  // —— 数据表文案：键是成就编号 / 主题名，值才是展示文字 ——
  /** 成就名称，键为成就编号。 */
  成就名称: Record<string, string>;
  /** 成就说明，键为成就编号。 */
  成就说明: Record<string, string>;
  /** 主题一句话说明，键为主题名。 */
  主题说明: Record<string, string>;
}

export type 游戏文案 = 通用游戏文案 & 再消一行文案;

/** 文案占位符填充：模板里写 {名称}，这里按名称替换，避免把数字/状态拼进字典。 */
export function 填充文案(模板: string, 参数: Readonly<Record<string, string | number>>): string {
  return 模板.replace(/\{([^}]+)\}/g, (整段, 名称: string) => {
    const 值 = 参数[名称];
    return 值 === undefined ? 整段 : String(值);
  });
}
