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
};
