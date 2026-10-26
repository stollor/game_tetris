import { 地点皮肤表 } from "./旅行地点";

/**
 * 英文界面的整句对照表，交给框架 `设置界面对照`；文字服务绘制/测量前统一调用 `翻译界面`。
 * 键必须是界面实际画出的整句：词条越整句越不会误伤，数字、计时这类动态部分用短词条拼接。
 * 地点名称取地点表自己的英文字段，这里只补地点表里没有英文的省市和副题。
 * 英文界面里翻译后仍含汉字的文案由 `读取未翻译文案` 记录，`测试/浏览器/英文覆盖.ts` 逐页检查它为空。
 */

const 地点英文: Record<string, string> = {
  "四川 · 成都": "Sichuan · Chengdu",
  "云南 · 丽江": "Yunnan · Lijiang",
  "北京 · 长城": "Beijing · Great Wall",
  "北京 · 故宫": "Beijing · Forbidden City",
  "浙江 · 杭州": "Zhejiang · Hangzhou",
  "甘肃 · 敦煌": "Gansu · Dunhuang",
  "广西 · 桂林": "Guangxi · Guilin",
  "江苏 · 苏州": "Jiangsu · Suzhou",
  "重庆 · 两江": "Chongqing · Two Rivers",
  "陕西 · 西安": "Shaanxi · Xi'an",
  "安徽 · 黄山": "Anhui · Huangshan",
  "西藏 · 拉萨": "Tibet · Lhasa",
};

const 副题英文: Record<string, string> = {
  "竹影摇曳，熊猫打个盹": "Bamboo sways, a panda naps.",
  "日照雪峰，清风穿过铃声": "Sun on the snow peaks, wind through the bells.",
  "山脊蜿蜒，烽火映着落日": "The ridge winds on, beacons glow at sunset.",
  "朱墙金瓦，檐下灯影缓缓": "Red walls, gold roofs, lantern light drifting.",
  "断桥烟雨，一池荷叶听涟漪": "Misty rain, lotus leaves and gentle ripples.",
  "月牙泉畔，驼铃随风越沙丘": "By Crescent Lake, camel bells cross the dunes.",
  "青峰倒映，竹筏划开薄雾": "Green peaks mirrored, a raft parts the mist.",
  "粉墙黛瓦，窗中借一片春色": "White walls, grey tiles, spring framed in a window.",
  "轻轨穿城，霓虹在江面回响": "Rail cuts the city, neon echoes on the river.",
  "城楼暮鼓，万盏灯照归途": "Evening drums, ten thousand lanterns light the way home.",
  "奇松立石，云海漫过山门": "Odd pines on stone, a sea of cloud floods the gate.",
  "雪域晴空，彩色织带随风": "Clear sky over the snowland, bright ribbons in the wind.",
};

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
  练习: "Practice",
  无时间限制: "No time limit",
  不断挑战更高等级与分数: "Chase higher levels and scores",
  "目标 40 行": "Goal 40 lines",
  "率先消除 40 行": "Clear 40 lines first",
  "限时 02:00": "Timed 02:00",
  "120 秒内冲击最高分": "Top score in 120 seconds",
  每日更新: "Updates daily",
  "今天，每个人面对相同序列": "Everyone gets the same sequence today",
  等级不变: "Fixed level",
  "等级保持不变，方便反复练习": "Level stays fixed for repeated practice",
  最佳: "Best",
  尚无纪录: "No record yet",
  // 排行榜
  "当前环境无排行榜能力，请在 TapTap App 内打开":
    "Leaderboards need the TapTap App. Open the game there.",
  // 设置：主题名
  夜空鎏金: "Night Gold",
  暖纸古典: "Warm Paper",
  青蓝未来: "Blue Future",
  云海山岚: "Cloud Hills",
  极光原野: "Aurora Fields",
  // 商店：分类页签与价格行（数字走子串拼接）
  静态: "Still",
  动态: "Live",
  界面: "UI",
  方块: "Blocks",
  音效: "SFX",
  音乐: "Music",
  界面配色示意: "UI colour preview",
  方块币: "Coins",
  旅行方块币: "Travel Coins",
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

function 生成地点对照(): Record<string, string> {
  const 表: Record<string, string> = {};
  for (const 地点 of 地点皮肤表) {
    表[地点.名称] = 地点.英文;
    表[地点.地点] = 地点英文[地点.地点] ?? 地点.地点;
    表[地点.副题] = 副题英文[地点.副题] ?? 地点.副题;
  }
  return 表;
}

export const 界面对照表: Record<string, string> = { ...界面短语, ...生成地点对照() };
