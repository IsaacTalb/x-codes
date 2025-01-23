const {onRequest} = require("firebase-functions/v2/https");
const screenshot = require("./screenshot"); // Import the screenshot function

// Export the screenshot function
exports.screenshot = onRequest(screenshot);
