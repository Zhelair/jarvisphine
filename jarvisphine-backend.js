// jarvisphine-backend.js
// Backend for Google Assistant integration
// Deploy to: Vercel, Netlify, or Heroku (free tier)

const http = require('http');

// Simulate JARVISPHINE logic (in real setup, connect to your API)
const RESPONSE_TEMPLATES = {
  'how_am_i_doing': () => {
    // In production, fetch from localStorage via API
    const stats = {
      soberDays: Math.floor(Math.random() * 7),
      sportDays: Math.floor(Math.random() * 5),
      mood: ['good', 'neutral', 'low'][Math.floor(Math.random() * 3)]
    };
    return `you're at ${stats.soberDays} sober days and ${stats.sportDays} sport days. mood is ${stats.mood}. looking solid.`;
  },
  
  'log_workout': () => {
    return `logged your workout. that's what I'm talking about. keep it up.`;
  },
  
  'log_mood': (mood) => {
    const responses = {
      good: "awesome. glad you're feeling good today.",
      low: "rough day? that's okay. tomorrow you try again.",
      neutral: "alright, keep going. you got this."
    };
    return responses[mood] || responses.neutral;
  },
  
  'check_goals': () => {
    return `you've got weekly goals to crush, monthly projects in progress, and a 3-month challenge. what do you want to focus on?`;
  },
  
  'default': () => {
    return `hey. what's up? you know I'm listening.`;
  }
};

// Parse Google Assistant intent
function parseGoogleAssistantRequest(text) {
  const lower = text.toLowerCase();
  
  if (lower.includes('how am i doing') || lower.includes('how am i')) {
    return { intent: 'how_am_i_doing' };
  } else if (lower.includes('log') && lower.includes('workout')) {
    return { intent: 'log_workout' };
  } else if (lower.includes('mood')) {
    const mood = lower.includes('good') ? 'good' : lower.includes('low') ? 'low' : 'neutral';
    return { intent: 'log_mood', mood };
  } else if (lower.includes('goals')) {
    return { intent: 'check_goals' };
  }
  
  return { intent: 'default' };
}

// Generate response
function generateResponse(request) {
  const { intent, mood } = request;
  const template = RESPONSE_TEMPLATES[intent];
  
  if (template) {
    return template(mood);
  }
  return RESPONSE_TEMPLATES.default();
}

// HTTP Server
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  
  // OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // POST /api/google-assistant
  if (req.method === 'POST' && req.url === '/api/google-assistant') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const userInput = data.text || data.query || '';
        
        // Parse intent
        const request = parseGoogleAssistantRequest(userInput);
        
        // Generate response
        const response = generateResponse(request);
        
        // Send back
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          response: response,
          intent: request.intent,
          timestamp: new Date().toISOString()
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({
          success: false,
          error: err.message
        }));
      }
    });
  } 
  
  // GET /health (for monitoring)
  else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      service: 'jarvisphine-backend',
      version: '4.0'
    }));
  }
  
  // 404
  else {
    res.writeHead(404);
    res.end(JSON.stringify({
      error: 'Not found'
    }));
  }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎯 Jarvisphine Backend running on port ${PORT}`);
  console.log(`📝 POST /api/google-assistant — Google Assistant integration`);
  console.log(`💚 GET /health — Health check`);
});

module.exports = server;
