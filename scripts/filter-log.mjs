import readline from 'node:readline';

const KEEP = [
  /https?:\/\/localhost/i,
  /rodando em/i,
  /error/i,
  /erro\b/i,
  /warn/i,
  /bundle generation complete/i,
  /watching for file changes/i,
];

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', (line) => {
  const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
  if (KEEP.some((pattern) => pattern.test(plain))) {
    console.log(line);
  }
});
