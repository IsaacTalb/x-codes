require('dotenv').config(); // Load environment variables
const { TwitterApi } = require('twitter-api-v2');
const puppeteer = require('puppeteer');
const fs = require('fs'); // For debugging

// Twitter API client
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// Fetch tweet data
async function fetchTweet(tweetId) {
  const tweet = await client.v2.singleTweet(tweetId, {
    expansions: ['author_id', 'attachments.media_keys'],
    'tweet.fields': ['created_at', 'text'],
    'user.fields': ['username', 'name'],
    'media.fields': ['url', 'type'],
  });
  return tweet;
}

// Generate screenshot
async function screenshotTweet(url) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Set viewport to a reasonable size
  await page.setViewport({ width: 1200, height: 800 });

  // Go to the tweet URL
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Wait for the tweet content to load
  await page.waitForSelector('article[role="article"]', { timeout: 10000 });

  // Capture the screenshot
  const screenshot = await page.screenshot({ type: 'png', fullPage: true });
  await browser.close();

  // Save the screenshot to a file for debugging
  fs.writeFileSync('debug-screenshot.png', screenshot);
  console.log('Screenshot generated successfully');
  console.log('Screenshot size:', screenshot.length);

  return screenshot;
}

const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // Cache for 5 minutes

// API handler function
module.exports = async (req, res) => {
  const { tweetId } = req.query;

  if (!tweetId) {
    return res.status(400).json({ error: 'Tweet URL is required' });
  }

  // Check cache
  const cachedScreenshot = cache.get(tweetId);
  if (cachedScreenshot) {
    res.setHeader('Content-Type', 'image/png');
    return res.send(cachedScreenshot);
  }

  try {
    // Fetch tweet data
    const tweet = await fetchTweet(tweetId);
    const tweetUrl = `https://twitter.com/i/status/${tweetId}`;

    // Generate screenshot
    const screenshot = await screenshotTweet(tweetUrl);

    // Cache the screenshot
    cache.set(tweetId, screenshot);

    // Send the screenshot as a response
    res.setHeader('Content-Type', 'image/png');
    res.send(screenshot);
  } catch (error) {
    console.error('Error:', error);

    // Handle rate limit error
    if (error.code === 429) {
      const resetTime = new Date(error.rateLimit.reset * 1000).toLocaleTimeString();
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Please try again after ${resetTime}`,
      });
    }

    res.status(500).json({ error: 'Sorry, it failed to generate screenshot' });
  }
};