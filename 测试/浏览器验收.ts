import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

interface 对局测试接口 {
  设置序列: (序列: string[]) => void;
  准备单行消除: () => void;
  读取状态: () => {
    阶段: string;
    分数: number;
    消行数: number;
    当前方块: string;
    当前格子: [number, number][];
    当前朝向: number;
    朝向: number;
  };
}

interface 快照测试接口 {
  getSnapshot: () => {
    sceneId: string;
    width: number;
    height: number;
    interactives: {
      name: string;
      bounds: { x: number; y: number; width: number; height: number } | null;
    }[];
  };
}

function 断言(条件: boolean, 说明: string): void {
  if (!条件) throw new Error(`验收失败：${说明}`);
  console.log(`通过：${说明}`);
}

const 地址 = process.argv[2] ?? "http://localhost:3000";
const 浏览器 = await chromium.launch({ headless: true });
const 页面 = await 浏览器.newPage({ viewport: { width: 960, height: 640 } });
const 页面错误: string[] = [];
页面.on("pageerror", (错误) => 页面错误.push(错误.message));
页面.on("console", (消息) => {
  if (消息.type() === "error") 页面错误.push(消息.text());
});

try {
  const 响应 = await 页面.goto(地址, { waitUntil: "domcontentloaded" });
  断言(响应?.ok() === true, "页面以 HTTP 200 启动");
  await mkdir("测试/正式版浏览器验收", { recursive: true });
  await 页面.waitForFunction(() =>
    Boolean((window as unknown as { __GAMEMAKER_TEST__?: 快照测试接口 }).__GAMEMAKER_TEST__),
  );
  await 页面.waitForFunction(
    () =>
      (window as unknown as { __GAMEMAKER_TEST__?: 快照测试接口 }).__GAMEMAKER_TEST__?.getSnapshot()
        .sceneId === "开始菜单",
  );
  const 点击测试对象 = async (名称: string) => {
    const 快照 = await 页面.evaluate(() =>
      (
        window as unknown as { __GAMEMAKER_TEST__?: 快照测试接口 }
      ).__GAMEMAKER_TEST__?.getSnapshot(),
    );
    const 项目 = 快照?.interactives.find((对象) => 对象.name === 名称);
    const 画布框 = await 页面.locator("canvas").first().boundingBox();
    断言(Boolean(项目?.bounds && 画布框 && 快照), `可定位菜单按钮 ${名称}`);
    if (!项目?.bounds || !画布框 || !快照) throw new Error(`找不到菜单按钮 ${名称}`);
    await 页面.mouse.click(
      画布框.x + ((项目.bounds.x + 项目.bounds.width / 2) / 快照.width) * 画布框.width,
      画布框.y + ((项目.bounds.y + 项目.bounds.height / 2) / 快照.height) * 画布框.height,
    );
  };
  await 点击测试对象("menu.start");
  await 页面.waitForTimeout(100);
  await 点击测试对象("mode.马拉松");
  await 页面.waitForFunction(() => {
    const 测试窗 = window as unknown as { __俄罗斯方块测试__?: 对局测试接口 };
    return Boolean(测试窗.__俄罗斯方块测试__);
  });

  const 读取对局 = async () =>
    await 页面.evaluate(() => {
      const 测试窗 = window as unknown as { __俄罗斯方块测试__?: 对局测试接口 };
      return 测试窗.__俄罗斯方块测试__?.读取状态();
    });

  await 页面.evaluate(() => {
    const 测试窗 = window as unknown as { __俄罗斯方块测试__?: 对局测试接口 };
    测试窗.__俄罗斯方块测试__?.设置序列(["T", "I", "O", "S"]);
  });
  const 初始 = await 读取对局();
  断言(初始?.当前方块 === "T", "固定序列可重现当前方块");
  await 页面.keyboard.press("z");
  断言((await 读取对局())?.当前朝向 === 2, "默认开启 Z 键 180°旋转");
  await 页面.keyboard.press("z");
  断言((await 读取对局())?.当前朝向 === 0, "再次按 Z 可转回原朝向");

  await 页面.keyboard.press("ArrowLeft");
  const 左移后 = await 读取对局();
  断言(
    Boolean(
      左移后?.当前格子.every(
        ([列, 行], 索引) =>
          列 === (初始?.当前格子[索引]?.[0] ?? 列) - 1 && 行 === 初始?.当前格子[索引]?.[1],
      ),
    ),
    "左方向键即时移动一格",
  );

  await 页面.keyboard.down("ArrowRight");
  await 页面.waitForTimeout(350);
  await 页面.keyboard.up("ArrowRight");
  const 连续横移后 = await 读取对局();
  const 最左格列 = 连续横移后?.当前格子[0]?.[0] ?? -100;
  const 初始最左格列 = 初始?.当前格子[0]?.[0] ?? 0;
  断言(
    最左格列 >= 初始最左格列 + 2,
    `按住方向键先等待 DAS，再按 ARR 连续移动（原位 ${初始最左格列}，现位 ${最左格列}）`,
  );

  await 页面.keyboard.press("ArrowUp");
  const 旋转后 = await 读取对局();
  断言(旋转后?.当前朝向 === 1, `上方向键顺时针旋转（实际朝向 ${旋转后?.当前朝向}）`);

  await 页面.keyboard.down("ArrowDown");
  await 页面.waitForTimeout(240);
  await 页面.keyboard.up("ArrowDown");
  const 软降后 = await 读取对局();
  断言(
    Boolean(
      软降后?.当前格子.some(
        ([列, 行]) => 行 > (旋转后?.当前格子.find(([旧列]) => 旧列 === 列)?.[1] ?? 行),
      ),
    ),
    "按住下方向键会按节奏软降",
  );

  await 页面.keyboard.press("p");
  const 暂停时 = await 读取对局();
  await 页面.waitForTimeout(900);
  const 暂停后等待 = await 读取对局();
  断言(暂停时?.阶段 === "暂停", "P 键切换到暂停状态");
  断言(
    JSON.stringify(暂停时?.当前格子) === JSON.stringify(暂停后等待?.当前格子),
    "暂停期间方块位置冻结",
  );
  await 页面.screenshot({ path: "测试/正式版浏览器验收/暂停.png", fullPage: true });
  await 页面.keyboard.press("Escape");
  断言((await 读取对局())?.阶段 === "进行中", "Esc 键恢复对局");

  await 页面.evaluate(() => {
    const 测试窗 = window as unknown as { __俄罗斯方块测试__?: 对局测试接口 };
    测试窗.__俄罗斯方块测试__?.准备单行消除();
  });
  await 页面.waitForTimeout(100);
  await 页面.keyboard.press("Space");
  const 消行后 = await 读取对局();
  断言(消行后?.消行数 === 1 && 消行后.分数 === 1140, "单行完美清场、硬降得分与升级前等级结算正确");

  await 页面.evaluate(() => {
    const 测试窗 = window as unknown as { __俄罗斯方块测试__?: 对局测试接口 };
    测试窗.__俄罗斯方块测试__?.设置序列(Array.from({ length: 30 }, () => "O"));
  });
  for (let 次数 = 0; 次数 < 15; 次数 += 1) {
    if ((await 读取对局())?.阶段 === "结束") break;
    await 页面.keyboard.press("Space");
    await 页面.waitForTimeout(70);
  }
  断言((await 读取对局())?.阶段 === "结束", "堆叠至出生碰撞后进入游戏结束");
  await 页面.screenshot({ path: "测试/正式版浏览器验收/结束.png", fullPage: true });

  const 快照 = await 页面.evaluate(() => {
    const 测试窗 = window as unknown as { __GAMEMAKER_TEST__?: 快照测试接口 };
    return 测试窗.__GAMEMAKER_TEST__?.getSnapshot();
  });
  const 重开项 = 快照?.interactives.find((项目) => 项目.name === "restart");
  const 画布 = await 页面.locator("canvas").first().boundingBox();
  断言(Boolean(重开项?.bounds && 画布), "结束画面提供可交互的重新开始按钮");
  if (!重开项?.bounds || !画布 || !快照) throw new Error("找不到重新开始按钮坐标");
  await 页面.waitForTimeout(3100);
  await 页面.mouse.click(
    画布.x + ((重开项.bounds.x + 重开项.bounds.width / 2) / 快照.width) * 画布.width,
    画布.y + ((重开项.bounds.y + 重开项.bounds.height / 2) / 快照.height) * 画布.height,
  );
  await 页面.waitForTimeout(120);
  const 重开后 = await 读取对局();
  断言(
    重开后?.阶段 === "进行中" && 重开后.分数 === 0 && 重开后.消行数 === 0,
    "点击重新开始重置整局状态",
  );

  await 页面.waitForTimeout(850);
  断言(页面错误.length === 0, "浏览器控制台与页面无运行时错误");
  await 页面.screenshot({ path: "测试/正式版浏览器验收/重新开始.png", fullPage: true });
} finally {
  await 浏览器.close();
}
