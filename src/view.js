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

    const isAllowed = allowedOrigins.includes(origin);

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
        const [currentViewsStr, currentUniqueStr, hasVisited] = await Promise.all([
          env.KV_STATS.get(`views::${path}`),
          env.KV_STATS.get(`unique::${path}`),
          env.KV_STATS.get(ipKey)
        ]);

        let newViews = parseInt(currentViewsStr || 0) + 1;
        let newUnique = parseInt(currentUniqueStr || 0);

        if (!hasVisited) {
          newUnique += 1;
        }

        // Background Update (High Performance)
        ctx.waitUntil((async () => {
          await env.KV_STATS.put(`views::${path}`, newViews.toString());
          if (!hasVisited) {
            await env.KV_STATS.put(`unique::${path}`, newUnique.toString());
            await env.KV_STATS.put(ipKey, "1", { expirationTtl: 86400 });
          }
        })());

        return Response.json({ 
          views: newViews, 
          unique: newUnique 
        }, { headers: corsHeaders });

        // -- OLD Version --
        /*const hasVisited = await env.KV_STATS.get(ipKey);

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

        return new Response(JSON.stringify({ status: "ok" }), { headers: corsHeaders });*/
      }
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }
};
