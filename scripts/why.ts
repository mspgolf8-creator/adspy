// Usage : npx tsx scripts/why.ts "texte de la pub"  → montre quels mots-clés matchent
import { explain } from "../src/lib/rules";
console.log(explain(process.argv.slice(2).join(" ")));
