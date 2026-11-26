// Placeholder for root scripts whose features don't exist yet (docs/PLAN.md Appendix A2).
// Exits 0 so CI placeholders pass until the real script lands.
const name = process.argv[2] ?? 'script';
console.log(`${name}: not implemented`);
process.exit(0);
