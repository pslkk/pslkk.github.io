export default {
  async fetch(request, env) {
    // Security: Rate limit & CORS
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = [
      'https://mywebpage-dix.pages.dev',
      'https://pslkk.space',
      'https://www.pslkk.space'
    ];
    
    const isAllowedOrigin = allowedOrigins.some(domain => origin === domain);
    if (!isAllowedOrigin && origin !== '') {
      return new Response('CORS denied', { status: 403 });
    }
    
    //if (!request.headers.get('Origin')?.includes('mywebpage-dix.pages.dev')) {
    //  return new Response('CORS denied', { status: 403 });
    //}

    try {
      const url = new URL(request.url);

      // GET: Read current stats
      if (request.method === 'GET') {
        const path = decodeURIComponent(url.searchParams.get('path') || '/');
        
        // Total page views (string counter)
        const totalStr = await env.PAGE_VIEWS?.get(path) || '0';
        const total = parseInt(totalStr) || 0;

        // Unique visitors summary (JSON counter)
        const uniqueSummary = await env.UNIQUE_VISITORS?.get(path);
        let unique = 0;
        if (uniqueSummary) {
          try {
            unique = JSON.parse(uniqueSummary).count || 0;
          } catch {
            unique = 0;
          }
        }

        return Response.json({ total, unique }, {
          headers: { 
            'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // POST: Increment counters (with bot protection)
      if (request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response('Invalid JSON', { status: 400 });
        }

        const { path } = body;
        if (!path || typeof path !== 'string') {
          return new Response('Missing/invalid path', { status: 400 });
        }

        // Bot protection: Skip headless browsers & crawlers
        const ua = request.headers.get('User-Agent') || '';
        if (ua.includes('bot') || ua.includes('crawler') || 
            request.headers.get('Sec-CH-UA-Platform') === '"undefined' ||
            navigator.webdriver) {
          return new Response(null, { status: 204 });
        }

        // Rate limit: 1 increment per IP per page per 24h
        const ipKey = `${path}:${clientIP}`;
        const lastVisit = await env.UNIQUE_VISITORS?.get(ipKey);
        if (lastVisit) {
          return new Response(null, { status: 204 }); // Already counted
        }

        // Increment total views (atomic)
        const currentTotal = await env.PAGE_VIEWS?.get(path) || '0';
        await env.PAGE_VIEWS?.put(path, (parseInt(currentTotal) + 1).toString());

        // Track unique visitor (24h TTL)
        await env.UNIQUE_VISITORS?.put(ipKey, Date.now().toString(), {
          expirationTtl: 86400
        });

        // Update unique summary
        const summaryData = await env.UNIQUE_VISITORS?.get(path) || '0';
        let summaryCount = parseInt(summaryData) + 1;
        if (typeof summaryData === 'object') {
          summaryCount = (JSON.parse(summaryData).count || 0) + 1;
        }
        await env.UNIQUE_VISITORS?.put(path, JSON.stringify({ count: summaryCount }));

        return new Response(null, { status: 204 });
      }

      return new Response('Method not allowed', { status: 405 });
    } catch (error) {
      console.error('Views counter error:', error);
      return new Response('Internal error', { status: 500 });
    }
  }
};


/*export default {
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
