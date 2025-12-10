import { type TypeDocOptions } from "typedoc";

const config: Partial<TypeDocOptions & { themeColor: string }> = {
    entryPointStrategy: "expand",
    entryPoints: ["./src"],
    out: "docs",
    exclude: ["node_modules", "dist", "build", "coverage", "docs", "prisma", "src/**/*.test.ts", "src/**/*.spec.ts"],
    plugin: ["typedoc-material-theme"],
    themeColor: "#187258",
};

export default config;