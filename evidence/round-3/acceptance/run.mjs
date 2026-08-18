import path from "node:path";
import process from "node:process";
import ts from "typescript";

const repositoryRoot = process.argv[2] && path.resolve(process.argv[2]);
if (!repositoryRoot) {
  console.error("usage: node run.mjs <repository-root>");
  process.exit(2);
}

const harness = path.join(path.dirname(new URL(import.meta.url).pathname.slice(1)), "type-contract.ts");
const sourceEntry = path.join(repositoryRoot, "src", "index.ts");
const config = {
  compilerOptions: {
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    target: "ES2022",
    lib: ["ES2022", "DOM", "DOM.Iterable"],
    module: "ESNext",
    moduleResolution: "Bundler",
    baseUrl: repositoryRoot,
    paths: {
      "ofetch-under-test": [sourceEntry],
    },
  },
  files: [harness],
};

const parsed = ts.parseJsonConfigFileContent(
  config,
  ts.sys,
  repositoryRoot,
  undefined,
  path.join(repositoryRoot, "acceptance.generated.json"),
);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const diagnostics = ts.getPreEmitDiagnostics(program);

for (const diagnostic of diagnostics) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  if (diagnostic.file && diagnostic.start !== undefined) {
    const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    console.error(
      `${diagnostic.file.fileName}:${position.line + 1}:${position.character + 1} TS${diagnostic.code}: ${message}`,
    );
  } else {
    console.error(`TS${diagnostic.code}: ${message}`);
  }
}

if (diagnostics.length > 0) {
  console.error(`ACCEPTANCE: FAIL (${diagnostics.length} diagnostics)`);
  process.exit(1);
}

console.log("ACCEPTANCE: PASS");
