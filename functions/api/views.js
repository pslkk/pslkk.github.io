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

export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({ 
    total: env?.PAGE_VIEWS ? 'OK' : 'MISSING', 
    unique: env?.UNIQUE_VISITORS ? 'OK' : 'MISSING' 
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
