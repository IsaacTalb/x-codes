const functions = require('firebase-functions');
const { TwitterApi } = require('twitter-api-v2');
const puppeteer = require('puppeteer');

const client = new TwitterApi({
  appKey: functions.config().twitter.api_key,
  appSecret: functions.config().twitter.api_secret,
  accessToken: functions.config().twitter.access_token,
  accessSecret: functions.config().twitter.access_secret,
});

exports.screenshot = functions.https.onRequest(async (req, res) => {
  const { tweetId } = req.query;

  if (!tweetId) {
    return res.status(400).json({ error: 'Tweet URL is required' });
  }

  try {
    // Fetch tweet data
    const tweet = await client.v2.singleTweet(tweetId, {
      expansions: ['author_id', 'attachments.media_keys'],
      'tweet.fields': ['created_at', 'text'],
      'user.fields': ['username', 'name'],
      'media.fields': ['url', 'type'],
    });

    const tweetUrl = `https://twitter.com/i/status/${tweetId}`;

    // Generate screenshot
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(tweetUrl, { waitUntil: 'networkidle2' });
    await page.waitForSelector('article[role="article"]', { timeout: 10000 });
    const screenshot = await page.screenshot({ type: 'png', fullPage: true });
    await browser.close();

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

    // Handle other errors
    res.status(500).json({ 
      error: 'Failed to generate screenshot',
      details: error.message || 'Unknown error occurred',
    });
  }
});