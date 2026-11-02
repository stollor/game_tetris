import { 串 } from "./工具";

/** 底板·背景：深巧克力墙 + 顶部扇贝帷幔 + 暗角 + 角落甜点道具。 */

/** 一排扇贝帘：每个瓣是一个半圆，向下垂；底沿再压一道亮边。 */
function 画扇贝帘(
  笔: CanvasRenderingContext2D,
  宽: number,
  帘高: number,
  瓣半径: number,
  底色: string,
  亮边: string,
): void {
  const 数 = Math.ceil(宽 / (瓣半径 * 2)) + 1;
  const 步 = 宽 / (数 - 1);
  笔.save();
  笔.beginPath();
  笔.moveTo(0, 0);
  笔.lineTo(宽, 0);
  笔.lineTo(宽, 帘高);
  for (let i = 数 - 1; i >= 0; i -= 1) {
    const x = i * 步;
    笔.arc(x, 帘高, 瓣半径, 0, Math.PI, true);
  }
  笔.closePath();
  const 渐变 = 笔.createLinearGradient(0, 0, 0, 帘高 + 瓣半径);
  渐变.addColorStop(0, 底色);
  渐变.addColorStop(1, "rgba(0,0,0,0.28)");
  笔.fillStyle = 渐变;
  笔.shadowColor = "rgba(0,0,0,0.45)";
  笔.shadowBlur = 9;
  笔.shadowOffsetY = 5;
  笔.fill();
  笔.restore();
  // 瓣沿亮线
  笔.save();
  笔.beginPath();
  笔.moveTo(0, 帘高);
  for (let i = 0; i < 数; i += 1) {
    const x = i * 步;
    笔.arc(x, 帘高, 瓣半径, 0, Math.PI, false);
  }
  笔.strokeStyle = 亮边;
  笔.lineWidth = 1.4;
  笔.stroke();
  笔.restore();
}

/** 拐杖糖：一根斜插的糖棍，粉白斜纹。 */
function 画拐杖糖(
  笔: CanvasRenderingContext2D,
  x: number,
  y: number,
  长: number,
  角度: number,
): void {
  笔.save();
  笔.translate(x, y);
  笔.rotate(角度);
  const 宽 = 11;
  笔.beginPath();
  笔.rect(0, -宽 / 2, 长, 宽);
  笔.save();
  笔.beginPath();
  笔.rect(-1, -宽 / 2 - 1, 长 + 2, 宽 + 2);
  笔.clip();
  const 纹 = 笔.createLinearGradient(0, 0, 22, 0);
  纹.addColorStop(0, "#fff4ef");
  纹.addColorStop(0.5, "#e2607f");
  纹.addColorStop(1, "#fff4ef");
  笔.fillStyle = 纹;
  笔.fillRect(0, -宽 / 2, 长, 宽);
  笔.restore();
  笔.save();
  const 明 = 笔.createLinearGradient(0, -宽 / 2, 0, 宽 / 2);
  明.addColorStop(0, "rgba(255,255,255,0.45)");
  明.addColorStop(0.45, "rgba(255,255,255,0.05)");
  明.addColorStop(1, "rgba(0,0,0,0.28)");
  笔.fillStyle = 明;
  笔.fillRect(0, -宽 / 2, 长, 宽);
  笔.restore();
  笔.restore();
}

/** 松露巧克力：一颗压扁的球 + 高光 + 可可粉点。 */
function 画松露(笔: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  笔.save();
  笔.beginPath();
  笔.ellipse(x, y + r * 0.18, r, r * 0.92, 0, 0, Math.PI * 2);
  笔.fillStyle = "rgba(0,0,0,0.35)";
  笔.shadowColor = "rgba(0,0,0,0.5)";
  笔.shadowBlur = 6;
  笔.shadowOffsetY = 3;
  笔.fill();
  笔.restore();
  const 体 = 笔.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  体.addColorStop(0, "#8a5638");
  体.addColorStop(0.6, "#5a3020");
  体.addColorStop(1, "#30160e");
  笔.beginPath();
  笔.ellipse(x, y, r, r * 0.92, 0, 0, Math.PI * 2);
  笔.fillStyle = 体;
  笔.fill();
  for (let i = 0; i < 14; i += 1) {
    const a = i * 2.3;
    const rr = r * (0.25 + ((i * 37) % 10) / 18);
    笔.fillStyle = `rgba(255,230,210,${0.12 + ((i * 13) % 7) / 40})`;
    笔.beginPath();
    笔.arc(
      x + Math.cos(a) * rr,
      y + Math.sin(a) * rr * 0.9,
      Math.max(0.6, r * 0.06),
      0,
      Math.PI * 2,
    );
    笔.fill();
  }
}

export function 画糖果背景(笔: CanvasRenderingContext2D, 宽: number, 高: number): void {
  // ① 竖渐变
  const 底 = 笔.createLinearGradient(0, 0, 0, 高);
  底.addColorStop(0, 串(0x451d26));
  底.addColorStop(0.4, 串(0x33121a));
  底.addColorStop(1, 串(0x240a11));
  笔.fillStyle = 底;
  笔.fillRect(0, 0, 宽, 高);

  // ② 棋盘后方的暖光：中间亮一档
  const 暖 = 笔.createRadialGradient(宽 * 0.45, 高 * 0.45, 宽 * 0.08, 宽 * 0.45, 高 * 0.46, 宽 * 0.95);
  暖.addColorStop(0, "rgba(190,90,90,0.22)");
  暖.addColorStop(0.55, "rgba(150,60,70,0.08)");
  暖.addColorStop(1, "rgba(0,0,0,0)");
  笔.fillStyle = 暖;
  笔.fillRect(0, 0, 宽, 高);

  // ③ 暗角
  const 暗角 = 笔.createRadialGradient(宽 / 2, 高 * 0.5, 宽 * 0.35, 宽 / 2, 高 * 0.5, 宽 * 1.25);
  暗角.addColorStop(0, "rgba(0,0,0,0)");
  暗角.addColorStop(0.75, "rgba(0,0,0,0.22)");
  暗角.addColorStop(1, "rgba(0,0,0,0.5)");
  笔.fillStyle = 暗角;
  笔.fillRect(0, 0, 宽, 高);

  // ④ 角落甜点
  画拐杖糖(笔, -6, 58, 96, 0.5);
  画拐杖糖(笔, 宽 + 8, 150, 74, -2.4);
  画松露(笔, 宽 - 26, 66, 15);
  画松露(笔, 宽 - 8, 92, 10);

  // ⑤ 顶部扇贝帷幔
  画扇贝帘(笔, 宽, 18, 9, 串(0x8e3d4e), 串(0xd98b9c, 0.75));

  // ⑥ 糖粒
  for (let i = 0; i < 80; i += 1) {
    const x = Math.abs((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1) * 宽;
    const y = Math.abs((Math.sin(i * 74.7 + 191.3) * 24634.6345) % 1) * 高;
    const r = 0.5 + Math.abs(Math.sin(i * 3.3)) * 1.1;
    笔.fillStyle = `rgba(255,240,240,${0.08 + Math.abs(Math.sin(i)) * 0.12})`;
    笔.beginPath();
    笔.arc(x, y, r, 0, Math.PI * 2);
    笔.fill();
  }
}
