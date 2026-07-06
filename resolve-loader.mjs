import { existsSync } from "node:fs";

const extensions = [".js", ".ts", ".jsx", ".tsx", ".mjs"];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND") {
      for (const ext of extensions) {
        try {
          return await nextResolve(specifier + ext, context);
        } catch {}
      }
    }
    throw err;
  }
}
