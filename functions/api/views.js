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

export async function onRequest({ request, env }) {
  try {
    const url = new URL(request.url);
    
    if (request.method === 'GET') {
      const path = decodeURIComponent(url.searchParams.get('path') || '/');
      
      // Correct KV syntax - NO type parameter needed
      let total = 0;
      if (env.PAGE_VIEWS) {
        const totalStr = await env.PAGE_VIEWS.get(path) || '0';
        total = parseInt(totalStr) || 0;
      }
      
      let unique = 0;
      if (env.UNIQUE_VISITORS) {
        const uniqueData = await env.UNIQUE_VISITORS.get(path);
        if (uniqueData) {
          try {
            const parsed = JSON.parse(uniqueData);
            unique = parsed.count || 0;
          } catch {
            unique = 0;
          }
        }
      }
      
      return new Response(JSON.stringify({ total, unique }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' }
      });
    }
    
    if (request.method === 'POST') {
      const body = await request.json();
      const path = body.path || '/';
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      
      // Increment total views
      if (env.PAGE_VIEWS) {
        const current = await env.PAGE_VIEWS.get(path) || '0';
        await env.PAGE_VIEWS.put(path, (parseInt(current) + 1).toString());
      }
      
      // Track unique visitors
      if (env.UNIQUE_VISITORS) {
        const ipKey = `${path}:${ip}`;
        const exists = await env.UNIQUE_VISITORS.get(ipKey);
        if (!exists) {
          await env.UNIQUE_VISITORS.put(ipKey, '1', { expirationTtl: 86400 });
          
          // Update page total unique count
          const pageData = await env.UNIQUE_VISITORS.get(path) || '0';
          const count = parseInt(pageData) + 1;
          await env.UNIQUE_VISITORS.put(path, JSON.stringify({ count }));
        }
      }
      
      return new Response(null, { status: 204 });
    }
    
    return new Response('Method not allowed', { status: 405 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
