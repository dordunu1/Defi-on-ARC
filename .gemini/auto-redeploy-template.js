/**
 * ========================================
 * AUTO-REDEPLOY TEMPLATE FOR RAILWAY
 * ========================================
 * 
 * This code automatically redeploys your Railway service after a specified interval
 * to prevent issues like RPC errors, memory leaks, or connection degradation.
 * 
 * FEATURES:
 * - Automatic redeploy every X minutes (configurable)
 * - Uses Railway's GraphQL API for full service redeploy
 * - Fallback to process exit if API fails (Railway auto-restarts)
 * - Time tracking and logging
 * - Error handling
 * 
 * REQUIRED ENVIRONMENT VARIABLES:
 * - RAILWAY_API_TOKEN: Your Railway API token
 * - RAILWAY_SERVICE_ID: The service ID to redeploy
 * - RAILWAY_ENVIRONMENT_ID: The environment ID (auto-provided by Railway)
 * 
 * HOW TO USE:
 * 1. Copy the required functions to your main service file
 * 2. Replace your main loop with the run() function pattern
 * 3. Set the RESTART_INTERVAL_MS to your desired interval
 * 4. Add your service logic inside the main loop
 */

const https = require('https');

// ============================================
// ENVIRONMENT VARIABLES
// ============================================
const RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN || '';
const RAILWAY_SERVICE_ID = process.env.RAILWAY_SERVICE_ID || '';
const RAILWAY_ENVIRONMENT_ID = process.env.RAILWAY_ENVIRONMENT_ID || '';

// ============================================
// FUNCTION 1: Trigger Railway Redeploy
// ============================================
/**
 * Trigger a Railway redeploy via GraphQL API
 * @returns {Promise<boolean>} - True if redeploy was triggered successfully
 */
async function triggerRailwayRedeploy() {
    if (!RAILWAY_API_TOKEN || !RAILWAY_SERVICE_ID || !RAILWAY_ENVIRONMENT_ID) {
        console.warn('⚠️ Railway API credentials not set - cannot trigger redeploy');
        console.warn('   Required: RAILWAY_API_TOKEN, RAILWAY_SERVICE_ID, RAILWAY_ENVIRONMENT_ID');
        return false;
    }

    try {
        const url = 'https://backboard.railway.com/graphql/v2';

        console.log(`   Using Service ID: ${RAILWAY_SERVICE_ID}`);
        console.log(`   Using Environment ID: ${RAILWAY_ENVIRONMENT_ID}`);

        const graphqlMutation = {
            query: `
        mutation serviceInstanceDeploy($serviceId: String!, $environmentId: String!) {
          serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId)
        }
      `,
            variables: {
                serviceId: RAILWAY_SERVICE_ID,
                environmentId: RAILWAY_ENVIRONMENT_ID,
            }
        };

        const data = JSON.stringify(graphqlMutation);

        return new Promise((resolve, reject) => {
            const options = {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            };

            const req = https.request(url, options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            const jsonResponse = JSON.parse(responseData);
                            if (jsonResponse.errors) {
                                console.error(`❌ Railway GraphQL errors:`, JSON.stringify(jsonResponse.errors, null, 2));
                                resolve(false);
                            } else if (jsonResponse.data && jsonResponse.data.serviceInstanceDeploy !== undefined) {
                                console.log('✅ Railway redeploy triggered successfully');
                                console.log(`   Result: ${jsonResponse.data.serviceInstanceDeploy}`);
                                resolve(true);
                            } else {
                                console.error(`❌ Unexpected Railway API response:`, responseData);
                                resolve(false);
                            }
                        } catch (parseError) {
                            console.error(`❌ Error parsing Railway API response:`, parseError);
                            console.error(`   Response:`, responseData);
                            resolve(false);
                        }
                    } else {
                        console.error(`❌ Railway API error: ${res.statusCode}`);
                        console.error(`   Full response: ${responseData}`);
                        resolve(false);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('❌ Error triggering Railway redeploy:', error);
                resolve(false);
            });

            req.write(data);
            req.end();
        });
    } catch (error) {
        console.error('❌ Exception triggering Railway redeploy:', error);
        return false;
    }
}

// ============================================
// FUNCTION 2: Main Service Loop with Auto-Redeploy
// ============================================
/**
 * Main service loop with automatic redeploy
 * Replace YOUR_SERVICE_LOGIC() with your actual service code
 */
async function run() {
    const startTime = Date.now();

    // ⏰ CONFIGURE YOUR RESTART INTERVAL HERE
    const RESTART_INTERVAL_MS = 90 * 60 * 1000; // 90 minutes (1.5 hours)
    // Examples:
    // - 30 minutes: 30 * 60 * 1000
    // - 1 hour: 60 * 60 * 1000
    // - 2 hours: 120 * 60 * 1000

    console.log('🚀 Starting service with auto-redeploy...');
    console.log(`⏰ Scheduled redeploy in ${RESTART_INTERVAL_MS / (60 * 1000)} minutes`);
    console.log(`   Next redeploy at: ${new Date(startTime + RESTART_INTERVAL_MS).toISOString()}`);

    let lastTimeRemainingLog = 0;

    // Helper: Check if it's time to restart
    async function checkRestartTime() {
        const elapsed = Date.now() - startTime;
        if (elapsed >= RESTART_INTERVAL_MS) {
            const hours = (elapsed / (60 * 60 * 1000)).toFixed(2);
            const minutes = (elapsed / (60 * 1000)).toFixed(0);
            const intervalMinutes = RESTART_INTERVAL_MS / (60 * 1000);

            console.log(`\n⏰ ${intervalMinutes} minute interval reached (ran for ${hours} hours / ${minutes} minutes)`);
            console.log('🔄 Attempting to trigger Railway redeploy (full rebuild)...');

            const redeployTriggered = await triggerRailwayRedeploy();

            if (redeployTriggered) {
                console.log('✅ Redeploy triggered - Railway will rebuild and redeploy the service');
                console.log('   Exiting now - Railway will handle the redeploy\n');
            } else {
                console.log('⚠️ Could not trigger redeploy via API - falling back to exit');
                console.log('   Railway will restart this service automatically.\n');
            }

            // Exit - Railway will redeploy or restart
            process.exit(1);
        }
        return elapsed;
    }

    // Helper: Log time remaining until restart
    function logTimeRemaining(elapsed, forceLog = false) {
        const timeRemaining = RESTART_INTERVAL_MS - elapsed;
        const minutesRemaining = Math.floor(timeRemaining / (60 * 1000));
        const secondsRemaining = Math.floor((timeRemaining % (60 * 1000)) / 1000);
        const elapsedHours = (elapsed / (60 * 60 * 1000)).toFixed(2);
        const elapsedMinutes = Math.floor(elapsed / (60 * 1000));

        // Log every 5 minutes or when forced
        const currentInterval = Math.floor(elapsed / (5 * 60 * 1000));
        const shouldLog = forceLog || (minutesRemaining > 0 && minutesRemaining % 5 === 0 && currentInterval !== lastTimeRemainingLog);

        if (shouldLog && minutesRemaining > 0) {
            const hoursRemaining = (minutesRemaining / 60).toFixed(1);
            console.log(`⏰ Elapsed: ${elapsedMinutes}m (${elapsedHours}h) | Time until restart: ${minutesRemaining}m ${secondsRemaining}s (${hoursRemaining}h)`);
            lastTimeRemainingLog = currentInterval;
        }
    }

    // ============================================
    // MAIN SERVICE LOOP
    // ============================================
    while (true) {
        // Check if it's time to restart
        const elapsed = await checkRestartTime();
        logTimeRemaining(elapsed, true);

        // Check again before starting work
        await checkRestartTime();

        try {
            // ========================================
            // 🔧 YOUR SERVICE LOGIC GOES HERE
            // ========================================
            // Replace this with your actual service code
            // Examples:
            // - await indexBlockchainData();
            // - await processQueue();
            // - await syncDatabase();
            // - await monitorEvents();

            console.log('Running service iteration...');
            // YOUR CODE HERE

            // ========================================

            // Check again after work completes
            const elapsedAfter = await checkRestartTime();
            logTimeRemaining(elapsedAfter);

        } catch (error) {
            console.error('❌ Error in service loop:', error.message || error);
            if (error.stack) {
                console.error('Stack:', error.stack);
            }
        }

        // ⏱️ CONFIGURE YOUR POLLING INTERVAL HERE
        const POLL_INTERVAL_MS = 10000; // 10 seconds
        // Wait before next iteration (with restart checks during wait)
        console.log(`Waiting ${POLL_INTERVAL_MS / 1000} seconds before next iteration...`);
        const waitStart = Date.now();
        const checkInterval = 5000; // Check every 5 seconds

        while (Date.now() - waitStart < POLL_INTERVAL_MS) {
            await checkRestartTime();
            await new Promise(resolve => setTimeout(resolve, Math.min(checkInterval, POLL_INTERVAL_MS - (Date.now() - waitStart))));
        }
    }
}

// ============================================
// ERROR HANDLERS
// ============================================
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // Don't exit, just log and continue
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit, just log and continue
});

// ============================================
// START THE SERVICE
// ============================================
console.log('🚀 Initializing service with auto-redeploy...');
console.log('📍 Working directory:', process.cwd());
console.log('📦 Node version:', process.version);
console.log('');

// Validate Railway credentials
if (!RAILWAY_API_TOKEN || !RAILWAY_SERVICE_ID || !RAILWAY_ENVIRONMENT_ID) {
    console.warn('⚠️ WARNING: Railway credentials not fully configured');
    console.warn('   Auto-redeploy will fall back to process exit (Railway will auto-restart)');
    console.warn('   For full redeploy functionality, set:');
    console.warn('   - RAILWAY_API_TOKEN');
    console.warn('   - RAILWAY_SERVICE_ID');
    console.warn('   - RAILWAY_ENVIRONMENT_ID');
    console.log('');
}

// Start the service
run().catch((error) => {
    console.error('❌ Fatal error in service:', error);
    if (error.stack) {
        console.error('Stack trace:', error.stack);
    }
    console.error('❌ Service stopped. Railway will restart based on restart policy.');
    process.exit(1);
});

// ============================================
// EXPORT (if using as module)
// ============================================
module.exports = {
    run,
    triggerRailwayRedeploy
};
