const config: Partial<import("typedoc").TypeDocOptions> = {
    entryPointStrategy: "expand",
    entryPoints: ["./src/app.ts"],
    out: "docs",
    exclude: ["node_modules", "dist", "build", "coverage", "docs", "prisma", "src/**/*.test.ts", "src/**/*.spec.ts"],
};

export default config;