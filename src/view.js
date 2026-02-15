export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    
    // --- 1. SECURITY & CORS ---
    const allowedOrigins = [
      "https://pslkk.github.io",
      "https://pslkk.space"
    ];
    
    //const origin = request.headers.get("Origin");
    const isAllowed = allowedOrigins.includes(origin);

    const rawOrigin = request.headers.get("Origin") || request.headers.get("Referer") || "";
    let origin = "";
    try {
      if (rawOrigin) {
        const urlObj = new URL(rawOrigin);
        origin = urlObj.origin;
      }
    } catch (e) {
      origin = "";
    }

     if (!origin || !isAllowed) {
       return new Response(JSON.stringify({ error: "⛔ Access Denied" }), { status: 403 });
    }
    
    const corsHeaders = {
      "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[1],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- 2. BOT PROTECTION ---
    const ua = request.headers.get("User-Agent") || "";
    if (ua.toLowerCase().includes("bot") || ua.toLowerCase().includes("spider")) {
      return new Response(JSON.stringify({ status: "ignored" }), { headers: corsHeaders });
    }

    // --- 3. LOGIC ---
    try {
      const path = url.searchParams.get("path") || "/";

      // GET Stats
      if (request.method === "GET") {
        const views = await env.KV_STATS.get(`views::${path}`);
        const unique = await env.KV_STATS.get(`unique::${path}`);
        return Response.json({ 
          views: parseInt(views || 0), 
          unique: parseInt(unique || 0) 
        }, { headers: corsHeaders });
      }

      // POST Increment
      if (request.method === "POST") {
        const ipKey = `ip::${path}::${clientIP}`;
        const hasVisited = await env.KV_STATS.get(ipKey);

        // Background Update (High Performance)
        ctx.waitUntil((async () => {
          let currentViews = await env.KV_STATS.get(`views::${path}`);
          await env.KV_STATS.put(`views::${path}`, (parseInt(currentViews || 0) + 1).toString());

          if (!hasVisited) {
            let currentUnique = await env.KV_STATS.get(`unique::${path}`);
            await env.KV_STATS.put(`unique::${path}`, (parseInt(currentUnique || 0) + 1).toString());
            await env.KV_STATS.put(ipKey, "1", { expirationTtl: 86400 });
          }
        })());

        return new Response(JSON.stringify({ status: "ok" }), { headers: corsHeaders });
      }
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }
};


/*export default {
  async fetch(request, env) {
    // CORS first - handle OPTIONS preflight
    const origin = request.headers.get('Origin') || request.headers.get('Referer') || '';
    const allowedOrigins = [
      'https://pslkk.space',
      'https://mywebpage-dix.pages.dev'
    ];
    
    if (!allowedOrigins.includes(origin) && origin) {
      return new Response('CORS denied', { status: 403 });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const url = new URL(request.url);

    try {
      // GET: Return current stats
      if (request.method === 'GET') {
        const path = decodeURIComponent(url.searchParams.get('path') || '/');
        
        const totalStr = await env.PAGE_VIEWS?.get(path, { type: 'text' }) || '0';
        const total = parseInt(totalStr, 10) || 0;

        const uniqueSummary = await env.UNIQUE_VISITORS?.get(path, { type: 'json' });
        const unique = uniqueSummary?.count || 0;

        return Response.json({ total, unique }, {
          headers: { 
            ...corsHeaders,
            'Cache-Control': 'public, max-age=60'
          }
        });
      }

      // POST: Increment counters
      if (request.method === 'POST') {
        const body = await request.json();
        const { path } = body;

        if (!path) {
          return Response.json({ error: 'Missing path' }, { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        // Bot check
        const ua = request.headers.get('User-Agent') || '';
        if (ua.toLowerCase().includes('bot') || ua.toLowerCase().includes('crawler') || request.headers.get('Sec-CH-UA-Platform') === '"undefined' || navigator.webdriver) {
          return new Response(null, { status: 204, headers: corsHeaders });
        }

        // Dedupe per IP per page (24h)
        const ipKey = `ip:${path}:${clientIP}`;
        const lastVisit = await env.UNIQUE_VISITORS?.get(ipKey);
        if (lastVisit) {
          return new Response(null, { status: 204, headers: corsHeaders });
        }

        // Increment total
        const currentTotal = await env.PAGE_VIEWS?.get(path, { type: 'text' }) || '0';
        await env.PAGE_VIEWS?.put(path, (parseInt(currentTotal, 10) + 1).toString());

        // Track unique IP
        await env.UNIQUE_VISITORS?.put(ipKey, { timestamp: Date.now() }, {
          expirationTtl: 86400
        });

        // Update unique count
        const summary = await env.UNIQUE_VISITORS?.get(path, { type: 'json' }) || { count: 0 };
        await env.UNIQUE_VISITORS?.put(path, { count: summary.count + 1 });

        return new Response(null, { status: 204, headers: corsHeaders });
      }

      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    } catch (error) {
      console.error('Counter error:', error);
      return Response.json({ error: 'Server error' }, { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  }
};


export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      
      // GET: Read counters
      if (request.method === 'GET') {
        const path = decodeURIComponent(url.searchParams.get('path') || '/');
        
        const totalStr = await env.PAGE_VIEWS?.get(path) || '0';
        const total = parseInt(totalStr) || 0;
        
        const uniqueData = await env.UNIQUE_VISITORS?.get(path);
        let unique = 0;
        if (uniqueData) {
          try {
            unique = JSON.parse(uniqueData)?.count || 0;
          } catch {
            unique = 0;
          }
        }
        
        return new Response(JSON.stringify({ total, unique }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // POST: Increment counters  
      if (request.method === 'POST') {
        const { path } = await request.json();
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        
        // Increment total
        const currentTotal = await env.PAGE_VIEWS?.get(path) || '0';
        await env.PAGE_VIEWS?.put(path, (parseInt(currentTotal) + 1).toString());
        
        // Track unique visitor
        const ipKey = `${path}:${ip}`;
        const exists = await env.UNIQUE_VISITORS?.get(ipKey);
        if (!exists) {
          await env.UNIQUE_VISITORS?.put(ipKey, '1', { expirationTtl: 86400 });
          
          const pageData = await env.UNIQUE_VISITORS?.get(path) || '0';
          const count = parseInt(pageData) + 1;
          await env.UNIQUE_VISITORS?.put(path, JSON.stringify({ count }));
        }
        
        return new Response(null, { status: 204 });
      }
      
      return new Response('Method not allowed', { status: 405 });
    } catch (e) {
      return new Response(`Error: ${e.message}`, { status: 500 });
    }
  }
};*/
