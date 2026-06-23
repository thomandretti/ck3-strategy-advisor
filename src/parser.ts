import { Jomini } from "jomini";

export type Query = { at(path: string): unknown; root(): unknown };

let parserPromise: ReturnType<typeof Jomini.initialize> | null = null;
function getParser() {
  if (!parserPromise) parserPromise = Jomini.initialize();
  return parserPromise;
}

export async function queryGamestate<T>(gamestate: Buffer, fn: (q: Query) => T): Promise<T> {
  const parser = await getParser();
  return parser.parseText(gamestate, { encoding: "utf8" }, (query: Query) => fn(query));
}
