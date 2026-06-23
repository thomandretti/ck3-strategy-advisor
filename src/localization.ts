export class Localizer {
  constructor(private gameDir: string | null) {}
  resolve(key: string): string { return key; }
  resolveTrait(idx: number): string { return `trait_${idx}`; }
}
