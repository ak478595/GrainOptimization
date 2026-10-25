const highs = require('highs');

async function checkTelemetry() {
  const highsModule = await highs();
  const h = highsModule._Highs_create();
  
  // Query info value types or names
  // Let's check available getters
  console.log('Testing info value query...');
  // In HiGHS C API: Highs_getDoubleInfoValue(highs, "mip_dual_bound", &val)
  // Highs_getDoubleInfoValue(highs, "mip_gap", &val)
  // Let's test with a small solve using the persistent API or C API
  highsModule._Highs_destroy(h);
}

checkTelemetry().catch(console.error);

