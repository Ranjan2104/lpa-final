const cron = require("node-cron");
const {
  updateBattleResult,
  updateBttleResultNotUpdatedByUser,
} = require("./cronHelper");

// Example 1: Run every minute
cron.schedule("* * * * *", updateBattleResult);
// Example 2: Run every minute
cron.schedule("* * * * *", updateBttleResultNotUpdatedByUser);
