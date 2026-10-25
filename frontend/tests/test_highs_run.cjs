const highs = require('highs');

async function testHighs() {
  const solver = await highs();
  console.log('Available solver exports:', Object.keys(solver));

  // Test legacy one-shot solve
  const lp = [
    'Minimize',
    ' obj: 1000 shifts1 + 1000 shifts2 + 10 x1 + 15 x2',
    'Subject To',
    ' dem1: x1 >= 50',
    ' dem2: x2 >= 40',
    ' cap1: x1 - 250 shifts1 <= 0',
    ' cap2: x2 - 270 shifts2 <= 0',
    'Bounds',
    ' 0 <= shifts1 <= 3',
    ' 0 <= shifts2 <= 3',
    ' x1 >= 0',
    ' x2 >= 0',
    'General',
    ' shifts1',
    ' shifts2',
    'End'
  ].join('\n');

  console.log('Solving test LP...');
  const res = solver.solve(lp);
  console.log('Solve result:');
  console.log('Status:', res.Status);
  console.log('Objective:', res.ObjectiveValue);
  console.log('Columns:', res.Columns);
}

testHighs().catch(console.error);

