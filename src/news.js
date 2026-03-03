export async function fetchAndStoreNews(env) {
  
  const apiKey = env.NEWS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing NEWS_API_KEY environment variable.");
  }

  const baseUrl = "https://newsdata.io/api/1/latest";
  const queryParams = new URLSearchParams({
    apikey: apiKey,
    q="ai, quantum,quantum technologies AND quantum computing,computers",
    language="en",
    category="breaking,technology,science",
    timezone="asia/kolkata",
    prioritydomain="top",
    removeduplicate="1"
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
    const categories = ['Top Story', 'Tech Radar', 'Global Pulse'];

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
