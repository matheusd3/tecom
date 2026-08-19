// aplicar-zip.mjs — traz para o repositório um zip vindo de fora (Manus).
//
// Uso:  node scripts/aplicar-zip.mjs caminho/do/arquivo.zip
//
// Por que existe: ferramentas que rodam em sandbox próprio não escrevem no
// diretório do projeto; elas devolvem um zip. Descompactar por cima na mão é
// onde o trabalho se perde — sobrescreve o que estava em andamento, apaga o
// que o zip não trouxe, e ninguém vê o que mudou antes de já ter mudado.
//
// O que este script garante:
//  1. Recusa rodar com a árvore suja, então nada seu é sobrescrito sem commit.
//  2. NUNCA apaga arquivo. Zip parcial (só os arquivos tocados) é o caso comum;
//     apagar o que não veio nele destruiria o projeto.
//  3. Mostra o que mudou ANTES de você decidir, e roda check + build.
//
// Depois de rodar, o trabalho fica na árvore sem commit: revise com
// `git diff`, e só então `git add -A && git commit`.

import { execFileSync, execSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

/** Pastas que nunca entram, venha o que vier no zip. */
const IGNORAR = new Set(["node_modules", ".git", "dist", ".vite", ".DS_Store"]);

const zip = process.argv[2];
if (!zip || zip === "--help") {
  console.log("uso: node scripts/aplicar-zip.mjs caminho/do/arquivo.zip");
  process.exit(zip ? 0 : 1);
}
if (!existsSync(zip)) {
  console.error(`nao encontrei o zip: ${zip}`);
  process.exit(1);
}

const raiz = resolve(import.meta.dirname, "..");
const git = (args) => execFileSync("git", args, { cwd: raiz, encoding: "utf8" });

// 1. Árvore limpa, senão o zip engole trabalho não commitado.
const sujo = git(["status", "--porcelain"]).trim();
if (sujo) {
  console.error("A árvore tem mudanças sem commit. Commite ou guarde antes:\n");
  console.error(sujo);
  process.exit(1);
}

// 2. Descompacta num diretório temporário.
const temp = mkdtempSync(join(tmpdir(), "zip-externo-"));
try {
  if (process.platform === "win32") {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${resolve(zip)}' -DestinationPath '${temp}' -Force"`,
      { stdio: "inherit" }
    );
  } else {
    execFileSync("unzip", ["-q", "-o", resolve(zip), "-d", temp], { stdio: "inherit" });
  }
} catch {
  console.error("falha ao descompactar o zip");
  process.exit(1);
}

// 3. Zip costuma vir embrulhado numa pasta só; desembrulha para os caminhos
//    baterem com os do repositório.
let origem = temp;
const conteudo = readdirSync(origem).filter((n) => !IGNORAR.has(n));
if (conteudo.length === 1 && statSync(join(origem, conteudo[0])).isDirectory()) {
  origem = join(origem, conteudo[0]);
  console.log(`zip vinha embrulhado em "${conteudo[0]}/" — desembrulhado`);
}

// 4. Copia por cima. Sem apagar nada: zip parcial é o caso normal.
cpSync(origem, raiz, {
  recursive: true,
  filter: (src) => {
    const rel = relative(origem, src);
    if (!rel) return true;
    return !rel.split(/[\/]/).some((parte) => IGNORAR.has(parte));
  },
});
rmSync(temp, { recursive: true, force: true });

// 5. Mostra o estrago antes de qualquer decisão.
const mudou = git(["status", "--porcelain"]).trim();
if (!mudou) {
  console.log("\nO zip não trouxe nada diferente do que já está no repositório.");
  process.exit(0);
}
console.log("\n--- arquivos que o zip mudou ---");
console.log(git(["diff", "--stat"]).trim() || "(só arquivos novos)");
const novos = mudou.split("\n").filter((l) => l.startsWith("??"));
if (novos.length) console.log("\nnovos:\n" + novos.map((l) => "  " + l.slice(3)).join("\n"));

// 6. Valida. Falhar aqui não desfaz nada: o trabalho fica na árvore para
//    você corrigir, que é melhor que descobrir depois do commit.
console.log("\n--- npm run check ---");
try {
  execSync("npm run check", { cwd: raiz, stdio: "inherit" });
  console.log("\n--- npm run build ---");
  execSync("npm run build", { cwd: raiz, stdio: "inherit" });
  console.log("\nOK. Revise com `git diff` e depois `git add -A && git commit`.");
} catch {
  console.error("\nO zip NÃO compila. Está tudo na árvore para você corrigir;");
  console.error("para descartar e voltar ao estado anterior: git checkout -- . && git clean -fd");
  process.exit(1);
}
