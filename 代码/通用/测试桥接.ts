export interface 游戏测试交互项 {
  id: string;
  name: string;
  sceneId: string;
  type: string;
  label: string;
  enabled: boolean;
  visible: boolean;
  bounds: { x: number; y: number; width: number; height: number } | null;
}

export type 游戏测试节点详细度 = "概要" | "标准" | "完整";

export interface 游戏测试节点 {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  active: boolean;
  bounds: { x: number; y: number; width: number; height: number } | null;
  text?: string;
  childCount: number;
  子节点已省略?: number;
  children?: 游戏测试节点[];
  视觉属性?: Record<string, string | number | boolean | null>;
  文字样式?: Record<string, string | number | boolean | null>;
}

export interface 游戏测试快照 {
  version: 1;
  sequence: number;
  game: string;
  sceneId: string;
  sceneName: string;
  width: number;
  height: number;
  texts: string[];
  state?: Record<string, unknown>;
  interactives: 游戏测试交互项[];
  nodes?: 游戏测试节点[];
  diagnostics: { errors: string[]; warnings: string[] };
}

export interface 游戏测试接口 {
  getSnapshot(详细度?: 游戏测试节点详细度): 游戏测试快照;
  subscribe(listener: (snapshot: 游戏测试快照) => void): () => void;
  waitForRendered(sequence: number, timeoutMs?: number): Promise<boolean>;
}

interface Phaser边界 {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Phaser交互数据 {
  enabled?: boolean;
}

interface Phaser游戏对象 {
  name?: string;
  type?: string;
  text?: unknown;
  active?: boolean;
  visible?: boolean;
  input?: Phaser交互数据 | null;
  list?: Phaser游戏对象[];
  getBounds?: () => Phaser边界;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  alpha?: number;
  depth?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  originX?: number;
  originY?: number;
  scrollFactorX?: number;
  scrollFactorY?: number;
  blendMode?: number;
  style?: Record<string, unknown>;
}

interface Phaser场景 {
  sys?: {
    settings?: { key?: string };
    displayList?: { getChildren?: () => Phaser游戏对象[] };
  };
  input?: { isActive?: () => boolean };
  scale?: { width?: number; height?: number };
}

interface Phaser游戏 {
  scene: { getScenes: (activeOnly?: boolean) => Phaser场景[] };
  events?: {
    on: (event: string, listener: () => void) => void;
    off?: (event: string, listener: () => void) => void;
  };
}

declare global {
  interface Window {
    __GAMEMAKER_TEST__?: 游戏测试接口;
  }
}

function 收集文字(object: Phaser游戏对象): string[] {
  const texts: string[] = [];
  if (typeof object.text === "string" && object.text.trim()) texts.push(object.text.trim());
  for (const child of object.list ?? []) texts.push(...收集文字(child));
  return texts;
}

function 扫描场景(scene: Phaser场景): {
  sceneId: string;
  width: number;
  height: number;
  texts: string[];
  interactives: 游戏测试交互项[];
  nodes?: 游戏测试节点[];
  errors: string[];
} {
  const sceneId = scene.sys?.settings?.key ?? "unknown-scene";
  const width = scene.scale?.width ?? 0;
  const height = scene.scale?.height ?? 0;
  const roots = scene.sys?.displayList?.getChildren?.() ?? [];
  const allObjects: {
    object: Phaser游戏对象;
    active: boolean;
    visible: boolean;
  }[] = [];
  const texts: string[] = [];

  function 遍历(objects: Phaser游戏对象[], parentActive = true, parentVisible = true): void {
    for (const object of objects) {
      const active = parentActive && object.active !== false;
      const visible = parentVisible && object.visible !== false;
      allObjects.push({ object, active, visible });
      texts.push(...收集文字(object));
      遍历(object.list ?? [], active, visible);
    }
  }
  遍历(roots);

  const interactiveObjects = allObjects
    .map((entry, index) => ({ ...entry, index }))
    .filter(({ object }) => object.input !== undefined && object.input !== null);
  const namedObjects = interactiveObjects.filter(({ object }) => Boolean(object.name?.trim()));
  const selectedObjects = namedObjects.length > 0 ? namedObjects : interactiveObjects;
  const errors: string[] = [];
  const nameCounts = new Map<string, number>();
  for (const { object } of namedObjects) {
    const name = object.name?.trim() ?? "";
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  for (const [name, count] of nameCounts) {
    if (count > 1) errors.push(`场景“${sceneId}”中交互对象 name 重复：${name}`);
  }

  const interactives = selectedObjects.map(({ object, active, visible }, index): 游戏测试交互项 => {
    const name = object.name?.trim() ?? "";
    const bounds = object.getBounds?.();
    const label = 收集文字(object).join(" ") || name || object.type || "交互对象";
    return {
      id: name ? `${sceneId}/${name}` : `${sceneId}/interactive-${index + 1}`,
      name,
      sceneId,
      type: object.type ?? "GameObject",
      label,
      enabled: active && object.input?.enabled !== false,
      visible,
      bounds: bounds
        ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
        : null,
    };
  });

  return { sceneId, width, height, texts: [...new Set(texts)], interactives, errors };
}

function 节点视觉属性(object: Phaser游戏对象): 游戏测试节点["视觉属性"] {
  const properties: Record<string, string | number | boolean | null> = {};
  for (const key of [
    "x",
    "y",
    "width",
    "height",
    "alpha",
    "depth",
    "rotation",
    "scaleX",
    "scaleY",
    "originX",
    "originY",
    "scrollFactorX",
    "scrollFactorY",
    "blendMode",
  ] as const) {
    const value = object[key];
    if (typeof value === "number" && Number.isFinite(value)) properties[key] = value;
  }
  return properties;
}

function 节点文字样式(object: Phaser游戏对象): 游戏测试节点["文字样式"] | undefined {
  if (typeof object.text !== "string" || !object.style) return undefined;
  const style: Record<string, string | number | boolean | null> = {};
  for (const key of [
    "fontFamily",
    "fontSize",
    "fontStyle",
    "color",
    "stroke",
    "strokeThickness",
    "align",
    "lineSpacing",
    "wordWrapWidth",
  ]) {
    const value = object.style[key];
    if (
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value)) ||
      value === null
    ) {
      style[key] = value;
    }
  }
  return style;
}

function 收集节点(
  对象: Phaser游戏对象[],
  场景: string,
  详细度: 游戏测试节点详细度,
): 游戏测试节点[] {
  let 已收集数量 = 0;
  const 最大节点数 = 2_000;
  const 最大深度 = 2;

  function 遍历(
    当前对象: Phaser游戏对象[],
    父路径: string,
    深度: number,
    父激活 = true,
    父可见 = true,
  ): 游戏测试节点[] {
    const nodes: 游戏测试节点[] = [];
    for (const [index, object] of 当前对象.entries()) {
      if (已收集数量 >= 最大节点数) break;
      已收集数量 += 1;
      const id = `${父路径}/${index + 1}${object.name ? `:${object.name}` : `:${object.type ?? "对象"}`}`;
      const children = object.list ?? [];
      const active = 父激活 && object.active !== false;
      const visible = 父可见 && object.visible !== false;
      const bounds = object.getBounds?.();
      const node: 游戏测试节点 = {
        id,
        name: object.name?.trim() ?? "",
        type: object.type ?? "GameObject",
        visible,
        active,
        bounds: bounds
          ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
          : null,
        childCount: children.length,
      };
      if (typeof object.text === "string") node.text = object.text;

      if (详细度 === "完整") {
        node.视觉属性 = 节点视觉属性(object);
        const 文字样式 = 节点文字样式(object);
        if (文字样式) node.文字样式 = 文字样式;
      }

      if (children.length > 0) {
        if (详细度 === "完整" || 深度 < 最大深度) {
          node.children = 遍历(children, id, 深度 + 1, active, visible);
          const omitted = children.length - (node.children?.length ?? 0);
          if (omitted > 0) node.子节点已省略 = omitted;
        } else {
          node.子节点已省略 = children.length;
        }
      }
      nodes.push(node);
    }
    return nodes;
  }

  return 遍历(对象, 场景, 0);
}

function 复制快照(snapshot: 游戏测试快照): 游戏测试快照 {
  return structuredClone(snapshot);
}

/** 只在本机开发地址暴露 Phaser 的通用场景和输入对象信息。 */
export function 连接游戏测试桥接(game: Phaser游戏): void {
  if (
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1" &&
    window.location.hostname !== "[::1]"
  ) {
    return;
  }

  let sequence = 0;
  let exposedState: Record<string, unknown> | undefined;
  window.addEventListener("gamemaker:game-state", (event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (typeof detail !== "object" || detail === null || Array.isArray(detail)) return;
    exposedState = structuredClone(detail as Record<string, unknown>);
    发布变化();
  });
  let latestSignature = "";
  let latestSnapshot: 游戏测试快照 = {
    version: 1,
    sequence,
    game: document.title,
    sceneId: "",
    sceneName: "",
    width: 0,
    height: 0,
    texts: [],
    interactives: [],
    diagnostics: { errors: [], warnings: [] },
  };
  const subscribers = new Set<(snapshot: 游戏测试快照) => void>();

  function 扫描(详细度?: 游戏测试节点详细度): 游戏测试快照 {
    const scenes = game.scene
      .getScenes(true)
      .filter((scene) => scene.input?.isActive?.() ?? true)
      .map((scene) => ({ scene, snapshot: 扫描场景(scene) }));
    const current = scenes.at(-1);
    const currentScene = current?.snapshot;
    const roots = current?.scene.sys?.displayList?.getChildren?.() ?? [];
    return {
      version: 1,
      sequence,
      game: document.title,
      sceneId: currentScene?.sceneId ?? "",
      sceneName: currentScene?.sceneId ?? "",
      width: currentScene?.width ?? 0,
      height: currentScene?.height ?? 0,
      texts: currentScene?.texts ?? [],
      ...(exposedState ? { state: exposedState } : {}),
      interactives: currentScene?.interactives ?? [],
      ...(详细度 && 详细度 !== "概要" && currentScene
        ? { nodes: 收集节点(roots, currentScene.sceneId, 详细度) }
        : {}),
      diagnostics: {
        errors: scenes.flatMap(({ snapshot }) => snapshot.errors),
        warnings: [],
      },
    };
  }

  function 发布变化(): void {
    const next = 扫描();
    const signature = JSON.stringify({ ...next, sequence: 0 });
    if (signature === latestSignature) return;
    latestSignature = signature;
    sequence += 1;
    latestSnapshot = { ...next, sequence };
    const snapshot = 复制快照(latestSnapshot);
    for (const listener of subscribers) listener(snapshot);
  }

  const api: 游戏测试接口 = {
    getSnapshot: (详细度) => 复制快照(详细度 ? 扫描(详细度) : latestSnapshot),
    subscribe(listener) {
      subscribers.add(listener);
      listener(复制快照(latestSnapshot));
      return () => subscribers.delete(listener);
    },
    waitForRendered(sequence, timeoutMs = 3_000) {
      if (!game.events) return Promise.resolve(false);
      if (latestSnapshot.sequence >= sequence) return Promise.resolve(true);
      return new Promise((resolve) => {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const unsubscribe = api.subscribe((snapshot) => {
          if (snapshot.sequence < sequence) return;
          if (timeout !== undefined) clearTimeout(timeout);
          unsubscribe();
          resolve(true);
        });
        timeout = setTimeout(() => {
          unsubscribe();
          resolve(false);
        }, timeoutMs);
      });
    },
  };

  window.__GAMEMAKER_TEST__ = api;
  window.dispatchEvent(new Event("gamemaker:test-ready"));
  if (game.events) {
    game.events.on("postrender", 发布变化);
  } else {
    // 兼容缺少 Phaser 游戏事件总线的宿主；此时快照同步不具备渲染帧保证。
    window.setInterval(发布变化, 100);
    发布变化();
  }
}
