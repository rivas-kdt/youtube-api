import { filter, getData, initialize } from './index.js';
import http from 'http';
import url from 'url';

const PORT = 3200;

initialize()

const server = http.createServer(async (req, res) => {
  try {
    // Parse the URL to get the video ID from query parameters
    const parsedUrl = url.parse(req.url, true);
    const videoId = parsedUrl.query.videoId;
    
    if (!videoId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing videoId query parameter' }));
    }
    
    console.log(`Processing request for video ID: ${videoId}`);
    let date = Date.now();
    // Get video data
    const videoInfo = await getData(videoId);
    console.log(Date.now() - date, 'time took', videoId)
    const filtered = filter(videoInfo.formats, 'bestaudio');
    // Set headers and return the response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(!videoInfo?.fallback ? filtered : videoInfo.formats[0], null, 2));
    
  } catch (error) {
    console.error('Error processing request:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Try: http://localhost:${PORT}?videoId=JECspBECC8U`);
});




