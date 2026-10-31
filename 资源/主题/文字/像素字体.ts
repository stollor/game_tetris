import { 像素规范 } from "../像素/像素规范";

let 载入: Promise<void> | undefined;
/**
 * 在正式文字烘焙前载入本地字体。
 * 字体文件随包作为静态素材发布，这里只按 `像素规范.字体文件` 的地址加载，
 * 不再用 Bun 的 file 导入语法，避免同一份 woff2 既进 JS bundle 又被当静态素材复制一遍。
 */
export function 准备像素字体(): Promise<void> {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return Promise.resolve();
  载入 ??= new FontFace(像素规范.字体, `url("${像素规范.字体文件}") format("woff2")`)
    .load()
    .then((字体) => {
      document.fonts.add(字体);
    })
    .catch(() => {
      // 预览沙箱曾禁止 data: 字体；失败时沿用系统后备，不把整页打成 NetworkError。
    });
  return 载入;
}
