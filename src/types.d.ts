// esbuild bundles .css imports as text (see esbuild.config.mjs).
declare module "*.css" {
  const content: string;
  export default content;
}
