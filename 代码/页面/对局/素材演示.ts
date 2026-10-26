/** 素材录像的结局只给采集脚本读。浏览器是独立会话，不写玩家存档。 */
export const 素材演示状态 = {
  结束: false,
  完赛: false,
  消行数: 0,
};

export function 重置素材演示状态(): void {
  素材演示状态.结束 = false;
  素材演示状态.完赛 = false;
  素材演示状态.消行数 = 0;
}

export function 记下素材演示结局(完赛: boolean, 消行数: number): void {
  素材演示状态.结束 = true;
  素材演示状态.完赛 = 完赛;
  素材演示状态.消行数 = 消行数;
}
