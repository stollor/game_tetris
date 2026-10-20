/** Bun 的 `with { type: "file" }` 导入会返回构建产物地址，这里给 TypeScript 一个声明。 */
declare module "*.png" {
  const 地址: string;
  export default 地址;
}
