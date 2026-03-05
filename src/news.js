const QUERIES = [
  { id: 1, q: "ai" },
  { id: 2, q: "cyber security" },
  { id: 3, q: "quantum computing" }
];

export async function fetchAndStoreNews(env) {
  const apiKey = env.NEWS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing NEWS_API_KEY environment variable.");
  }

  const baseUrl = "https://newsdata.io/api/1/latest";

  try {
    const fetchPromises = QUERIES.map(async (queryObj) => {
      const queryParams = new URLSearchParams({
        apikey: apiKey,
        q: queryObj.q,
        language: "en",
        category: "breaking,technology,science",
        timezone: "asia/kolkata",
        prioritydomain: "top",
        removeduplicate: "1"
      });

      const response = await fetch(`${baseUrl}?${queryParams.toString()}`);
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`News API error ${response.status} for ${queryObj.q}: ${errText}`);
      }

      const data = await response.json();
      if (data.status !== "success" || !data.results) {
        throw new Error(`Invalid response for ${queryObj.q}`);
      }

      const newUpdates = data.results.slice(0, 10).map(article => {
        
        let safeLink = "";
        if (article.link && /^https?:\/\//i.test(article.link)) {
          safeLink = article.link;
        }

        return {
          category: (article.category && article.category.length > 0) ? article.category[0] : "Technology",
          time: article.pubDate || new Date().toISOString(),
          text: article.title || "No title available",
          link: safeLink
        };
      });

      await env.NEWS_KV.put(`news_updates:${queryObj.id}`, JSON.stringify(newUpdates));
    });

    await Promise.all(fetchPromises);

    await env.NEWS_KV.put('news_rotation_interval', "0");
    await rotateNewsFeed(env, 0);

    return new Response(JSON.stringify({ success: true, message: "Master news fetched (30 articles)." }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}


export async function rotateNewsFeed(env, forceInterval = null) {
  try {
    let interval = forceInterval;
    if (interval === null) {
      const currentIntervalStr = await env.NEWS_KV.get('news_rotation_interval');
      interval = currentIntervalStr ? parseInt(currentIntervalStr, 10) : 0;
      
      if (interval < 2) {
        interval += 1;
        await env.NEWS_KV.put('news_rotation_interval', interval.toString());
      }
    }

    const [aiRaw, cyberRaw, quantumRaw] = await Promise.all([
      env.NEWS_KV.get('news_updates:1'),
      env.NEWS_KV.get('news_updates:2'),
      env.NEWS_KV.get('news_updates:3')
    ]);

    const aiNews = JSON.parse(aiRaw || "[]");
    const cyberNews = JSON.parse(cyberRaw || "[]");
    const quantumNews = JSON.parse(quantumRaw || "[]");

    let activeNews = [];

    if (interval === 0) {
      activeNews = [...aiNews.slice(0, 4), ...cyberNews.slice(0, 3), ...quantumNews.slice(0, 3)];
    } else if (interval === 1) {
      activeNews = [...aiNews.slice(4, 7), ...cyberNews.slice(3, 7), ...quantumNews.slice(3, 6)];
    } else {
      activeNews = [...aiNews.slice(7, 10), ...cyberNews.slice(7, 10), ...quantumNews.slice(6, 10)];
    }

    await env.NEWS_KV.put('news_updates', JSON.stringify(activeNews, null, 2));

    return new Response(JSON.stringify({ success: true, interval_activated: interval, total_articles: activeNews.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}


// <--- Old Version ---> //
/*export async function fetchAndStoreNews(env) {
  
  const apiKey = env.NEWS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing NEWS_API_KEY environment variable.");
  }

  const baseUrl = "https://newsdata.io/api/1/latest";
  const queryParams = new URLSearchParams({
    apikey: apiKey,
    q: "ai OR quantum computing OR cyber security OR quantum",
    language: "en",
    category: "breaking,technology,science",
    timezone: "asia/kolkata",
    prioritydomain: "top",
    removeduplicate: "1"
  });

  const apiCallUrl = `${baseUrl}?${queryParams.toString()}`;

  try {
    const response = await fetch(apiCallUrl);
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`News API error ${response.status}: ${errText}`);
    }

    const data = await response.json();

    if (data.status !== "success" || !data.results || data.results.length === 0) {
      throw new Error("Invalid or empty response from News API.");
    }

    const newUpdates = [];

    for (let i = 0; i < Math.min(data.results.length, 10); i++) {
      const article = data.results[i];
      
      let safeLink = "";
      if (article.link && (article.link.startsWith("http://") || article.link.startsWith("https://"))) {
        safeLink = article.link;
      }

      newUpdates.push({
        category: article.category[0],
        time: article.pubDate || new Date().toISOString(),
        text: article.title || "No title available",
        link: safeLink
      });
    }

    await env.NEWS_KV.put('news_updates', JSON.stringify(newUpdates, null, 2));
    
    return new Response(JSON.stringify({ success: true, message: "News updated." }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
*/
