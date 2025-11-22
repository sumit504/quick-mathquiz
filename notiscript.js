const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { parse } = require("csv-parse");

const CSV_PATH = "quickmath_users.csv";
const NOTIFICATION_URL = "https://api.farcaster.xyz/v1/frame-notifications";
const appUrl = "https://quick-mathquiz.vercel.app/";

// Choose your notification:
const title = "⏱️ Math is not easy?";
// const title = "⏱️ New Prize Pool Added!";
const body = "Wohhoo! you are eligble to solve math problems & earn rewards.Exclusive NFTs await for you.";
const BATCH_SIZE = 40;
const DELAY_BETWEEN_BATCHES = 3000;
const MAX_RETRIES = 1;
const RETRY_DELAY = 1000;


// FIX: Use dynamic import for node-fetch
let fetch;

async function initializeFetch() {
  try {
    // Try using built-in fetch (Node.js 18+)
    if (typeof globalThis.fetch !== 'undefined') {
      fetch = globalThis.fetch;
      console.log("✅ Using built-in fetch");
    } else {
      // Fallback to node-fetch
      const { default: nodeFetch } = await import('node-fetch');
      fetch = nodeFetch;
      console.log("✅ Using node-fetch");
    }
  } catch (error) {
    console.error("❌ Could not initialize fetch:", error.message);
    process.exit(1);
  }
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendNotificationWithRetry({ fid, token }, retries = 0) {
  const payload = {
    fid,
    notificationId: crypto.randomUUID(),
    title,
    body,
    targetUrl: appUrl,
    tokens: [token],
  };

  try {
    const res = await fetch(NOTIFICATION_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "User-Agent": "QuickMath/1.0"
      },
      body: JSON.stringify(payload),
    });

    // Check if response is actually JSON
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const textResponse = await res.text();
      console.error(`[${fid}] ❌ Non-JSON response (${res.status}):`, textResponse.substring(0, 200));
      
      if (retries < MAX_RETRIES) {
        console.log(`[${fid}] 🔄 Retrying (${retries + 1}/${MAX_RETRIES})...`);
        await delay(RETRY_DELAY * (retries + 1));
        return sendNotificationWithRetry({ fid, token }, retries + 1);
      }
      
      return { fid, success: false, error: `Non-JSON response: ${res.status}` };
    }

    const json = await res.json();

    if (res.status === 200) {
      // Check for rate limiting in response
      if (json.result && json.result.rateLimitedTokens && json.result.rateLimitedTokens.length > 0) {
        console.warn(`[${fid}] ⚠️ Rate limited`);
        return { fid, success: false, error: 'Rate Limited' };
      } else {
        console.log(`[${fid}] ✅ Sent successfully`);
        return { fid, success: true };
      }
    } else if (res.status === 429 && retries < MAX_RETRIES) {
      // Rate limited, retry with exponential backoff
      const retryDelay = RETRY_DELAY * Math.pow(2, retries);
      console.warn(`[${fid}] ⚠️ Rate limited, retrying in ${retryDelay}ms...`);
      await delay(retryDelay);
      return sendNotificationWithRetry({ fid, token }, retries + 1);
    } else {
      console.error(`[${fid}] ❌ Failed (${res.status}):`, json);
      
      if (retries < MAX_RETRIES && (res.status >= 500 || res.status === 429)) {
        console.log(`[${fid}] 🔄 Retrying (${retries + 1}/${MAX_RETRIES})...`);
        await delay(RETRY_DELAY * (retries + 1));
        return sendNotificationWithRetry({ fid, token }, retries + 1);
      }
      
      return { fid, success: false, error: `HTTP ${res.status}` };
    }
  } catch (error) {
    console.error(`[${fid}] ❌ Network Error:`, error.message);
    
    // Retry on network errors
    if (retries < MAX_RETRIES) {
      console.log(`[${fid}] 🔄 Retrying due to network error (${retries + 1}/${MAX_RETRIES})...`);
      await delay(RETRY_DELAY * (retries + 1));
      return sendNotificationWithRetry({ fid, token }, retries + 1);
    }
    
    return { fid, success: false, error: error.message };
  }
}

async function processBatch(batch, batchNumber, totalBatches) {
  console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} users) in parallel...`);
  
  // Process all users in parallel with Promise.allSettled for better error handling
  const promises = batch.map(user => sendNotificationWithRetry(user));
  const settledResults = await Promise.allSettled(promises);
  
  // Transform settled results to our expected format
  const results = settledResults.map((settled, index) => {
    if (settled.status === 'fulfilled') {
      return settled.value;
    } else {
      // Handle rejected promises
      console.error(`[${batch[index].fid}] ❌ Promise rejected:`, settled.reason.message);
      return { 
        fid: batch[index].fid, 
        success: false, 
        error: `Promise rejected: ${settled.reason.message}` 
      };
    }
  });
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Batch ${batchNumber} completed: ${successful} successful, ${failed} failed`);
  
  // Log failed attempts for debugging
  const failedResults = results.filter(r => !r.success);
  if (failedResults.length > 0) {
    console.log(`   Failed FIDs: ${failedResults.map(r => `${r.fid}(${r.error})`).join(', ')}`);
  }
  
  return { successful, failed, results };
}

async function processCSVAndNotify() {
  console.log("🧮 Quick Math Notification Sender");
  console.log("==================================");
  console.log(`📝 Title: ${title}`);
  console.log(`💬 Message: ${body}`);
  console.log(`🔗 Target URL: ${appUrl}`);
  console.log(`📁 CSV File: ${CSV_PATH}\n`);

  // Initialize fetch first
  await initializeFetch();

  const parser = fs
    .createReadStream(path.resolve(CSV_PATH))
    .pipe(parse({ columns: true, trim: true }));

  const usersToNotify = [];
  let totalProcessed = 0;

  parser.on("data", (row) => {
    totalProcessed++;
    
    // Filter qualified users
    if ((row.added === "TRUE" || row.added === "true") && 
        row.notificationToken && 
        row.notificationToken !== "null" &&
        row.notificationToken.trim() !== "") {
      usersToNotify.push({
        fid: parseInt(row.fid),
        token: row.notificationToken,
      });
    }
  });

  parser.on("end", async () => {
    console.log(`📊 PROCESSING SUMMARY:`);
    console.log(`📄 Total rows processed: ${totalProcessed}`);
    console.log(`🧮 Qualified for notifications: ${usersToNotify.length}\n`);
    
    if (usersToNotify.length === 0) {
      console.log("❌ No qualified users found.");
      return;
    }
    
    console.log(`🔄 Processing ${usersToNotify.length} users in batches of ${BATCH_SIZE} (parallel processing)`);
    console.log(`⏳ Delay between batches: ${DELAY_BETWEEN_BATCHES / 1000} seconds\n`);

    // Split users into batches
    const batches = [];
    for (let i = 0; i < usersToNotify.length; i += BATCH_SIZE) {
      batches.push(usersToNotify.slice(i, i + BATCH_SIZE));
    }

    console.log(`📊 Total batches: ${batches.length}\n`);

    let totalSuccessful = 0;
    let totalFailed = 0;
    const allFailedUsers = [];

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      try {
        const result = await processBatch(batches[i], i + 1, batches.length);
        totalSuccessful += result.successful;
        totalFailed += result.failed;
        
        // Collect failed users for summary
        allFailedUsers.push(...result.results.filter(r => !r.success));
        
        if (i < batches.length - 1) {
          console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000} seconds before next batch...`);
          await delay(DELAY_BETWEEN_BATCHES);
        }
      } catch (error) {
        console.error(`❌ Error processing batch ${i + 1}:`, error.message);
        // Continue with next batch instead of stopping
        totalFailed += batches[i].length;
      }
    }

    console.log(`\n🎉 All batches completed!`);
    console.log(`📊 Final Results: ${totalSuccessful} successful, ${totalFailed} failed`);
    
    if (totalSuccessful > 0) {
      const successRate = ((totalSuccessful / (totalSuccessful + totalFailed)) * 100).toFixed(1);
      console.log(`📈 Success Rate: ${successRate}%`);
      console.log(`🧮 ${totalSuccessful} Quick Math players notified successfully! ⏱️`);
    }
    
    if (totalFailed > 0) {
      console.log(`\n❌ Failed notifications summary:`);
      const errorCounts = {};
      allFailedUsers.forEach(user => {
        errorCounts[user.error] = (errorCounts[user.error] || 0) + 1;
      });
      
      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`   ${error}: ${count} users`);
      });
      
      // Save failed users to a file for retry
      const failedUsersData = allFailedUsers.map(u => ({ fid: u.fid, error: u.error }));
      fs.writeFileSync('failed_quickmath_notifications.json', JSON.stringify(failedUsersData, null, 2));
      console.log(`📁 Failed user details saved to: failed_quickmath_notifications.json`);
    }
  });

  parser.on("error", (err) => {
    console.error("❌ Error reading CSV:", err.message);
    process.exit(1);
  });
}

// Check if CSV file exists
if (!fs.existsSync(CSV_PATH)) {
  console.error(`❌ CSV file not found: ${CSV_PATH}`);
  process.exit(1);
}

// Add graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n⚠️ Received interrupt signal. Gracefully shutting down...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the script
processCSVAndNotify().catch((error) => {
  console.error("❌ Fatal error:", error.message);
  process.exit(1);
});