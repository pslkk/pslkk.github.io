/*export const onRequest = [
  {
    onRequestGet: async ({ request, env }) => {
      const url = new URL(request.url);
      const path = decodeURIComponent(url.searchParams.get('path') || '/');
      
      if (!path) return new Response('Missing path', { status: 400 });
      
      // Atomic read for total views
      const totalStr = await env.PAGE_VIEWS.get(path, { type: 'text' }) || '0';
      const total = parseInt(totalStr);
      
      // Atomic read for unique count (JSON with IP set)
      const uniqueData = await env.UNIQUE_VISITORS.get(path, { type: 'json' });
      const unique = uniqueData ? uniqueData.count : 0;
      
      return new Response(JSON.stringify({ total, unique }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
      });
    },
    
    onRequestPost: async ({ request, env }) => {
      const { path } = await request.json();
      
      if (!path) return new Response('Missing path', { status: 400 });
      
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      
      // Atomic increment total views
      await env.PAGE_VIEWS.put(path, (await env.PAGE_VIEWS.get(path, { type: 'text' }) || '0') + 1);
      
      // Atomic unique visitor tracking (24hr TTL)
      const uniqueKey = `${path}:${clientIP}`;
      const existing = await env.UNIQUE_VISITORS.get(uniqueKey, { type: 'json' });
      if (!existing) {
        await env.UNIQUE_VISITORS.put(uniqueKey, { timestamp: Date.now() }, { 
          expirationTtl: 86400 // 24hr TTL per IP
        });
        
        // Update page unique count
        const pageData = await env.UNIQUE_VISITORS.get(path, { type: 'json' }) || { count: 0 };
        await env.UNIQUE_VISITORS.put(path, { count: pageData.count + 1 });
      }
      
      return new Response(null, { status: 204 });
    }
  }
];*/

export const onRequest = [
  {
    onRequestGet: async (context) => {
      try {
        const url = new URL(context.request.url);
        const path = decodeURIComponent(url.searchParams.get('path') || '/');
        
        if (!context.env.PAGE_VIEWS) {
          return new Response('KV PAGE_VIEWS not bound', { status: 500 });
        }
        
        const totalStr = await context.env.PAGE_VIEWS.get(path) || '0';
        const total = parseInt(totalStr) || 0;
        
        const uniqueData = await context.env.UNIQUE_VISITORS.get(path);
        const unique = uniqueData ? JSON.parse(uniqueData).count || 0 : 0;
        
        return new Response(JSON.stringify({ total, unique }), {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60'
          }
        });
      } catch (e) {
        return new Response('GET Error: ' + e.message, { status: 500 });
      }
    },
    
    onRequestPost: async (context) => {
      try {
        const body = await context.request.json();
        const path = body.path || '/';
        const clientIP = context.request.headers.get('CF-Connecting-IP') || 'unknown';
        
        if (!context.env.PAGE_VIEWS || !context.env.UNIQUE_VISITORS) {
          return new Response('KV bindings missing', { status: 500 });
        }
        
        // Increment total
        const currentTotal = await context.env.PAGE_VIEWS.get(path) || '0';
        await context.env.PAGE_VIEWS.put(path, (parseInt(currentTotal) + 1).toString());
        
        // Unique visitor (simple IP check, 24hr)
        const visitorKey = `${path}:${clientIP}`;
        const existing = await context.env.UNIQUE_VISITORS.get(visitorKey);
        if (!existing) {
          await context.env.UNIQUE_VISITORS.put(visitorKey, Date.now(), { 
            expirationTtl: 86400 
          });
          
          const pageData = await context.env.UNIQUE_VISITORS.get(path);
          const currentUnique = pageData ? JSON.parse(pageData).count || 0 : 0;
          await context.env.UNIQUE_VISITORS.put(path, JSON.stringify({ 
            count: currentUnique + 1 
          }));
        }
        
        return new Response(null, { status: 204 });
      } catch (e) {
        return new Response('POST Error: ' + e.message, { status: 500 });
      }
    }
  }
];

