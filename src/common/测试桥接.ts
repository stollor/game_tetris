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
  diagnostics: { errors: string[]; warnings: string[] };
}

export interface 游戏测试接口 {
  getSnapshot(): 游戏测试快照;
  subscribe(listener: (snapshot: 游戏测试快照) => void): () => void;
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
  errors: string[];
} {
  const sceneId = scene.sys?.settings?.key ?? "unknown-scene";
  const width = scene.scale?.width ?? 0;
  const height = scene.scale?.height ?? 0;
  const roots = scene.sys?.displayList?.getChildren?.() ?? [];
  const allObjects: Phaser游戏对象[] = [];
  const texts: string[] = [];

  function 遍历(objects: Phaser游戏对象[]): void {
    for (const object of objects) {
      allObjects.push(object);
      texts.push(...收集文字(object));
      遍历(object.list ?? []);
    }
  }
  遍历(roots);

  const interactiveObjects = allObjects
    .map((object, index) => ({ object, index }))
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

  const interactives = selectedObjects.map(({ object }, index): 游戏测试交互项 => {
    const name = object.name?.trim() ?? "";
    const bounds = object.getBounds?.();
    const label = 收集文字(object).join(" ") || name || object.type || "交互对象";
    return {
      id: name ? `${sceneId}/${name}` : `${sceneId}/interactive-${index + 1}`,
      name,
      sceneId,
      type: object.type ?? "GameObject",
      label,
      enabled: object.active !== false && object.input?.enabled !== false,
      visible: object.visible !== false,
      bounds: bounds
        ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
        : null,
    };
  });

  return { sceneId, width, height, texts: [...new Set(texts)], interactives, errors };
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

  function 扫描(): 游戏测试快照 {
    const scenes = game.scene
      .getScenes(true)
      .filter((scene) => scene.input?.isActive?.() ?? true)
      .map(扫描场景);
    const currentScene = scenes.at(-1);
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
      diagnostics: { errors: scenes.flatMap((scene) => scene.errors), warnings: [] },
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
    getSnapshot: () => 复制快照(latestSnapshot),
    subscribe(listener) {
      subscribers.add(listener);
      listener(复制快照(latestSnapshot));
      return () => subscribers.delete(listener);
    },
  };

  window.__GAMEMAKER_TEST__ = api;
  window.dispatchEvent(new Event("gamemaker:test-ready"));
  window.setInterval(发布变化, 100);
  发布变化();
}
