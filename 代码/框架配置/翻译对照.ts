/**
 * 英文界面的整句对照表，交给框架 `设置界面对照`；文字服务绘制/测量前统一调用 `翻译界面`。
 * 键必须是界面实际画出的整句：词条越整句越不会误伤，数字、计时这类动态部分用短词条拼接。
 * 主题名取 `代码/项目配置/主题目录.ts` 的四套完整主题，这里只补它们自己的英文。
 * 英文界面里翻译后仍含汉字的文案由 `读取未翻译文案` 记录，`测试/浏览器/英文覆盖.ts` 逐页检查它为空。
 */

/** 游戏专有短语：按界面分组，方便逐页核对。 */
const 界面短语: Record<string, string> = {
  // 主界面与通用
  设置: "Settings",
  成就: "Achievements",
  商店: "Shop",
  开始游戏: "Start Game",
  开始: "Start",
  返回: "Back",
  返回主界面: "Main menu",
  // 模式选择：英文标题由模式卡数据提供，这里补测量与无障碍名称用到的中文名
  选择模式: "Select Mode",
  马拉松: "Marathon",
  冲刺: "Sprint",
  极限: "Ultra",
  每日挑战: "Daily",
  无时间限制: "No time limit",
  不断挑战更高等级与分数: "Chase higher levels and scores",
  "目标 40 行": "Goal 40 lines",
  "率先消除 40 行": "Clear 40 lines first",
  "限时 02:00": "Timed 02:00",
  "120 秒内冲击最高分": "Top score in 120 seconds",
  每日更新: "Updates daily",
  "今天，每个人面对相同序列": "Everyone gets the same sequence today",
  最佳: "Best",
  尚无纪录: "No record yet",
  // 排行榜
  "当前环境无排行榜能力，请在 TapTap App 内打开":
    "Leaderboards need the TapTap App. Open the game there.",
  // 设置与商店：四套主题名
  极光原野: "Aurora Fields",
  砖机液晶: "Brick LCD",
  街机彩砖: "Arcade Color",
  立体晶格: "Crystal Lattice",
  // 商店：价格行与说明（数字走子串拼接）
  静态: "Still",
  动态: "Live",
  界面: "UI",
  方块: "Blocks",
  音效: "SFX",
  音乐: "Music",
  界面配色示意: "UI colour preview",
  方块币: "Coins",
  "Motion 开": "Motion On",
  "Motion 关": "Motion Off",
  // 对局：暂停层与成就提示
  已暂停: "Paused",
  当前进度已保留: "Progress saved",
  继续: "Resume",
  重新开始: "Restart",
  "按 P 或 Esc 继续": "Press P or Esc to resume",
  成就解锁: "Unlocked",
  // 文字测量用的基准字
  字: "A",
};

export const 界面对照表: Record<string, string> = { ...界面短语 };
