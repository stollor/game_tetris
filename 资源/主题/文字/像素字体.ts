import 地址 from "../../字体/像素中文.woff2" with { type: "file" };
import { 像素规范 } from "../像素/像素规范";

let 载入: Promise<void> | undefined;
/** 在正式文字烘焙前载入本地字体，预览与发布包使用同一个文件。 */
export function 准备像素字体(): Promise<void> {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return Promise.resolve();
  载入 ??= new FontFace(像素规范.字体, `url("${地址}") format("woff2")`)
    .load()
    .then((字体) => {
      document.fonts.add(字体);
    })
    .catch(() => {
      // 预览沙箱曾禁止 data: 字体；失败时沿用系统后备，不把整页打成 NetworkError。
    });
  return 载入;
}
