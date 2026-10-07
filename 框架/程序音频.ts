import { 获取游戏设置, type 游戏设置 } from "./设置";

type 音乐场景 = "菜单" | "对局";

const 音高 = (半音: number): number => 440 * 2 ** ((半音 - 69) / 12);
const 和弦 = [45, 45, 41, 43, 48, 43, 41, 40];
const 当前 = {
  上下文: null as AudioContext | null,
  总线: null as GainNode | null,
  音乐总线: null as GainNode | null,
  音效总线: null as GainNode | null,
  白噪声: null as AudioBuffer | null,
  场景: "菜单" as 音乐场景,
  暂停: false,
  音乐启用: true,
  音乐音量: 0.6,
  音效音量: 0.8,
  调度器: 0,
  下次拍点: 0,
  音乐步数: 0,
  最近音效: new Map<string, number>(),
};

function 初始化(): AudioContext | null {
  if (当前.上下文) return 当前.上下文;
  const 构造器 = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!构造器) return null;
  try {
    const 上下文 = new 构造器();
    const 总线 = 上下文.createGain();
    const 音乐总线 = 上下文.createGain();
    const 音效总线 = 上下文.createGain();
    const 白噪声 = 上下文.createBuffer(1, 上下文.sampleRate, 上下文.sampleRate);
    const 噪声采样 = 白噪声.getChannelData(0);
    for (let i = 0; i < 噪声采样.length; i++) 噪声采样[i] = Math.random() * 2 - 1;
    const 限幅器 = 上下文.createDynamicsCompressor();
    总线.connect(限幅器).connect(上下文.destination);
    音乐总线.connect(总线);
    音效总线.connect(总线);
    当前.上下文 = 上下文;
    当前.总线 = 总线;
    当前.音乐总线 = 音乐总线;
    当前.音效总线 = 音效总线;
    当前.白噪声 = 白噪声;
    应用设置(获取游戏设置());
    return 上下文;
  } catch {
    return null;
  }
}

function 应用设置(设置: 游戏设置): void {
  当前.音乐启用 = 设置.背景音乐;
  当前.音乐音量 = 设置.音乐音量 / 100;
  当前.音效音量 = 设置.音效音量 / 100;
  if (当前.音乐总线) 当前.音乐总线.gain.setTargetAtTime(当前.音乐启用 ? 当前.音乐音量 * 0.22 : 0, 当前.上下文?.currentTime ?? 0, 0.04);
  if (当前.音效总线) 当前.音效总线.gain.setTargetAtTime(当前.音效音量 * 0.82, 当前.上下文?.currentTime ?? 0, 0.04);
}

window.addEventListener("gamemaker:settings-change", (事件: Event) => {
  应用设置((事件 as CustomEvent<游戏设置>).detail);
});

export function 解锁程序音频(): void {
  const 上下文 = 初始化();
  if (上下文?.state === "suspended") void 上下文.resume().catch(() => undefined);
}

function 发音(
  频率: number,
  时长: number,
  波形: OscillatorType,
  音量: number,
  开始: number,
  总线?: AudioNode,
  结束频率 = 频率,
): void {
  const 上下文 = 当前.上下文;
  if (!上下文 || !总线 || !Number.isFinite(频率)) return;
  const 振荡器 = 上下文.createOscillator();
  const 包络 = 上下文.createGain();
  振荡器.type = 波形;
  振荡器.frequency.setValueAtTime(Math.max(25, 频率), 开始);
  振荡器.frequency.exponentialRampToValueAtTime(Math.max(25, 结束频率), 开始 + 时长);
  包络.gain.setValueAtTime(0.0001, 开始);
  包络.gain.exponentialRampToValueAtTime(Math.max(0.0002, 音量), 开始 + 0.008);
  包络.gain.exponentialRampToValueAtTime(0.0001, 开始 + Math.max(0.025, 时长));
  振荡器.connect(包络).connect(总线);
  振荡器.start(开始);
  振荡器.stop(开始 + 时长 + 0.02);
}

function 噪音(时长: number, 音量: number, 滤波: BiquadFilterType, 频率: number, 开始: number, 总线?: AudioNode): void {
  const 上下文 = 当前.上下文;
  if (!上下文 || !总线 || !当前.白噪声) return;
  const 声源 = 上下文.createBufferSource();
  const 滤波器 = 上下文.createBiquadFilter();
  const 包络 = 上下文.createGain();
  声源.buffer = 当前.白噪声;
  滤波器.type = 滤波;
  滤波器.frequency.setValueAtTime(频率, 开始);
  if (滤波 === "bandpass") 滤波器.Q.value = 0.9;
  包络.gain.setValueAtTime(0.0001, 开始);
  包络.gain.exponentialRampToValueAtTime(Math.max(0.0002, 音量), 开始 + 0.004);
  包络.gain.exponentialRampToValueAtTime(0.0001, 开始 + 时长);
  声源.connect(滤波器).connect(包络).connect(总线);
  声源.start(开始);
  声源.stop(开始 + 时长 + 0.01);
}

export function 播放程序音效(
  名称: "开始" | "移动" | "旋转" | "软降" | "硬降" | "锁定" | "消行" | "暂停" | "继续" | "结束" | "返回",
  消行数 = 1,
): void {
  const 上下文 = 初始化();
  if (!上下文 || 当前.音效音量 <= 0) return;
  if (上下文.state === "suspended") void 上下文.resume().catch(() => undefined);
  const 现在 = 上下文.currentTime;
  const 上次 = 当前.最近音效.get(名称) ?? -1;
  if (现在 - 上次 < (名称 === "移动" || 名称 === "软降" ? 0.045 : 0.025)) return;
  当前.最近音效.set(名称, 现在);
  const 起点 = 现在 + 0.004;
  const 总线 = 当前.音效总线 ?? undefined;
  const T = (起频: number, 终频: number, 时长: number, 音量: number, 波形: OscillatorType = "sine", 延迟 = 0) =>
    发音(起频, 时长, 波形, 音量, 起点 + 延迟, 总线, 终频);
  const N = (时长: number, 音量: number, 滤波: BiquadFilterType, 频率: number, 延迟 = 0) =>
    噪音(时长, 音量, 滤波, 频率, 起点 + 延迟, 总线);

  switch (名称) {
    case "移动": T(1500, 1250, 0.03, 0.11, "square"); N(0.02, 0.065, "bandpass", 3600); break;
    case "旋转": T(1150, 1550, 0.055, 0.12, "triangle"); N(0.018, 0.045, "bandpass", 4500); break;
    case "软降": N(0.014, 0.11, "bandpass", 5200); break;
    case "硬降":
      N(0.12, 0.13, "bandpass", 1200);
      T(150, 52, 0.3, 0.28, "sawtooth", 0.085);
      N(0.02, 0.09, "highpass", 1800, 0.085);
      break;
    case "锁定": N(0.03, 0.075, "bandpass", 2500); T(110, 70, 0.12, 0.18, "triangle"); break;
    case "消行": {
      const 音符表 = [[69, 76], [69, 73, 76], [64, 69, 73, 76], [57, 64, 69, 73, 76]];
      const 时长 = [0.32, 0.42, 0.52, 0.75][Math.max(0, Math.min(3, 消行数 - 1))] ?? 0.32;
      N(时长, 消行数 >= 4 ? 0.15 : 0.11, 消行数 >= 4 ? "bandpass" : "highpass", 消行数 >= 4 ? 900 : 2600);
      for (const 音符 of 音符表[Math.max(0, Math.min(3, 消行数 - 1))] ?? [69, 76]) {
        const 频率 = 音高(音符);
        T(频率, 频率, 时长, 0.075, "sawtooth");
      }
      T(90, 55, 时长, 消行数 >= 4 ? 0.24 : 0.14, "triangle");
      if (消行数 >= 2) T(音高(81), 音高(81), 时长 * 0.8, 0.065, "sine");
      break;
    }
    case "开始": T(523, 523, 0.12, 0.12, "triangle"); T(784, 880, 0.18, 0.12, "triangle", 0.09); break;
    case "暂停": T(520, 494, 0.1, 0.1, "triangle"); T(330, 311, 0.22, 0.1, "triangle", 0.1); break;
    case "继续": T(330, 349, 0.09, 0.1, "triangle"); T(523, 554, 0.2, 0.11, "triangle", 0.09); break;
    case "结束": T(440, 42, 0.9, 0.21, "triangle", 0.1); [440, 349, 294, 220].forEach((频率, i) => T(频率, 频率, 0.5, 0.07, "triangle", i * 0.16)); break;
    case "返回": T(392, 392, 0.08, 0.1, "sine"); T(294, 294, 0.14, 0.1, "sine", 0.08); break;
  }
}

function 排一拍(): void {
  const 上下文 = 当前.上下文;
  if (!上下文 || 当前.暂停 || !当前.音乐总线) return;
  const 拍速 = 当前.场景 === "菜单" ? 100 : Math.min(180, 112 + Math.floor(当前.音乐步数 / 128) * 4);
  const 步长 = 60 / 拍速 / 4;
  const 琶音 = [0, 2, 1, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];
  const 和弦音 = [0, 3, 7, 12];
  while (当前.下次拍点 < 上下文.currentTime + 0.14) {
    const 步 = 当前.音乐步数;
    const 根音 = 和弦[Math.floor(步 / 16) % 和弦.length] ?? 45;
    const 小节内步 = 步 % 16;
    if (当前.音乐启用) {
      const 音程 = 和弦音[琶音[小节内步] ?? 0] ?? 0;
      发音(音高(根音 + 12 + 音程), 0.16, "triangle", 当前.场景 === "菜单" ? 0.045 : 0.035, 当前.下次拍点, 当前.音乐总线);
    }
    if (当前.音乐启用 && 当前.场景 === "对局" && 小节内步 % 8 === 0) {
      发音(音高(根音 - 12), 0.22, "sawtooth", 0.075, 当前.下次拍点, 当前.音乐总线);
      发音(音高(根音 - 24), 0.12, "sine", 0.055, 当前.下次拍点, 当前.音乐总线);
    }
    当前.下次拍点 += 步长;
    当前.音乐步数++;
  }
}

export function 设置程序音乐场景(场景: 音乐场景): void {
  初始化();
  当前.暂停 = false;
  if (当前.场景 === 场景 && 当前.调度器) return;
  当前.场景 = 场景;
  当前.音乐步数 = 0;
  当前.下次拍点 = (当前.上下文?.currentTime ?? 0) + 0.04;
  if (!当前.调度器) 当前.调度器 = window.setInterval(排一拍, 40);
}

export function 设置程序音乐暂停(暂停: boolean): void {
  当前.暂停 = 暂停;
  if (!暂停) 当前.下次拍点 = (当前.上下文?.currentTime ?? 0) + 0.04;
}
