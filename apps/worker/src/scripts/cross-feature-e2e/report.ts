export interface CheckResult {
  name: string;
  pass: boolean;
  detail?: string;
}

// Tiny pass/fail collector for verify-cross-feature-e2e.ts's index.ts - not a
// generic reporting library, just enough to print a readable summary table
// and let index.ts decide its own process.exit() code.
export class Report {
  private results: CheckResult[] = [];

  check(name: string, pass: boolean, detail?: string): boolean {
    this.results.push({ name, pass, detail });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ` - ${detail}` : ''}`);
    return pass;
  }

  print(): boolean {
    const failed = this.results.filter((r) => !r.pass);
    console.log('\n=== Cross-Feature E2E Summary ===');
    for (const r of this.results) {
      console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    }
    console.log(`\n${this.results.length - failed.length}/${this.results.length} checks passed`);
    return failed.length === 0;
  }
}
