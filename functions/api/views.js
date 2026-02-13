export const onRequest = [
  {
    onRequestGet: async ({ request, env }) => {
      const url = new URL(request.url);
      const path = decodeURIComponent(url.searchParams.get('path') || '/');
      
      if (!path) return new Response('Missing path', { status: 400 });
      
      // ✅ NO { type: 'text' } - Pages Functions syntax
      const totalStr = await env.PAGE_VIEWS?.get(path) || '0';
      const total = parseInt(totalStr) || 0;
      
      // ✅ NO { type: 'json' } - Manual JSON parsing
      const uniqueDataRaw = await env.UNIQUE_VISITORS?.get(path);
      let unique = 0;
      if (uniqueDataRaw) {
        try {
          const uniqueData = JSON.parse(uniqueDataRaw);
          unique = uniqueData?.count || 0;
        } catch {
          unique = 0;
        }
      }
      
      return new Response(JSON.stringify({ total, unique }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
      });
    },
    
    onRequestPost: async ({ request, env }) => {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response('Invalid JSON', { status: 400 });
      }
      
      const { path } = body;
      if (!path) return new Response('Missing path', { status: 400 });
      
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      
      // ✅ NO { type: 'text' } - Simple get/put
      const currentTotal = await env.PAGE_VIEWS?.get(path) || '0';
      await env.PAGE_VIEWS?.put(path, (parseInt(currentTotal) + 1).toString());
      
      // Unique visitor tracking (24hr TTL)
      const uniqueKey = `${path}:${clientIP}`;
      const existing = await env.UNIQUE_VISITORS?.get(uniqueKey);
      if (!existing) {
        await env.UNIQUE_VISITORS?.put(uniqueKey, Date.now().toString(), { 
          expirationTtl: 86400 
        });
        
        // Update page unique count
        const pageDataRaw = await env.UNIQUE_VISITORS?.get(path);
        let pageData = { count: 0 };
        if (pageDataRaw) {
          try {
            pageData = JSON.parse(pageDataRaw);
          } catch {}
        }
        await env.UNIQUE_VISITORS?.put(path, JSON.stringify({ count: pageData.count + 1 }));
      }
      
      return new Response(null, { status: 204 });
    }
  }
];
