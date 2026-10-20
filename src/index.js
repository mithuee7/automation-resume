// Cloudflare Worker: serves the static site and one API route for workflow previews.
// No database. Groq results are cached per sample in the Cache API, so each sample
// is generated at most once globally. A per-IP limit guards against abuse.

const WORKFLOW_PROMPTS = {
  comment: `You manage public comments on a business's Instagram or Facebook posts.
Classify the comment, then write a short, warm public reply (1-2 sentences).
Never invent prices, links or policies. If details are needed, say they will be sent in DM.
Respond with JSON only: {"intent": "<short label>", "sentiment": "positive" | "neutral" | "negative", "reply": "<reply>"}`,

  dm: `You qualify people who DM a business after replying to a keyword.
Work out their goal and timeline, then ask ONE friendly qualifying question.
Score the lead from 1 to 10. Never invent prices or links.
Respond with JSON only: {"intent": "<short label>", "lead_score": <integer 1-10>, "reply": "<DM reply>"}`,

  enquiry: `You answer website chat enquiries for a placeholder business.
Placeholder knowledge base: services = "Service A, Service B, Service C"; hours = "Mon-Fri 9am-6pm"; contact = "team@example.com".
Only answer from this knowledge base. If you are not sure, set confidence low.
Respond with JSON only: {"intent": "<short label>", "confidence": <number between 0 and 1>, "answer": "<reply>", "summary": "<one-line summary for a human agent>"}`,
};

const SAMPLES = {
  comment: {
    c1: {
      text: "Hey! How much does this cost? 👀",
      fallback: { intent: "pricing question", sentiment: "neutral", reply: "Great question! We'll send you the details in your DMs 💬" },
    },
    c2: {
      text: "Love this so much, your content is always 🔥",
      fallback: { intent: "compliment", sentiment: "positive", reply: "Thank you, that means a lot! More coming this week 🙌" },
    },
    c3: {
      text: "I ordered 3 days ago and still no reply from anyone.",
      fallback: { intent: "complaint, delayed response", sentiment: "negative", reply: "Sorry for the wait, we're on it. Please check your DMs, we'll sort this out for you." },
    },
  },
  dm: {
    d1: {
      text: "Hi, I saw your post. I want to grow my Instagram, I have about 6 months.",
      fallback: { intent: "growth enquiry", lead_score: 7, reply: "Love that you're thinking long term! Quick question: what would success look like for you in 6 months?" },
    },
    d2: {
      text: "Just curious how this works",
      fallback: { intent: "general curiosity", lead_score: 3, reply: "Happy to explain! What are you hoping to get out of it, more leads, more sales or more reach?" },
    },
    d3: {
      text: "I run a small shop and need more customers this month. Budget is tight but I'm serious.",
      fallback: { intent: "urgent need, tight budget", lead_score: 8, reply: "That's a great place to start. Would it help if we looked at a quick plan that fits your budget?" },
    },
  },
  enquiry: {
    e1: {
      text: "What are your opening hours on Saturday?",
      fallback: { intent: "opening hours", confidence: 0.4, answer: "We're open Monday to Friday, 9am to 6pm.", summary: "Visitor asked about Saturday hours, not in knowledge base." },
    },
    e2: {
      text: "Do you offer Service B and how long does it take?",
      fallback: { intent: "service details", confidence: 0.9, answer: "Yes, we offer Service B. Timelines depend on scope, so our team will confirm the exact timing with you.", summary: "Service B enquiry, timing needs confirmation." },
    },
    e3: {
      text: "I need a custom contract for a 2 year deal with my company's legal terms.",
      fallback: { intent: "custom legal request", confidence: 0.2, answer: "", summary: "Custom contract request, requires human review." },
    },
  },
};

const RATE_LIMIT_PER_HOUR = 20;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/run" && request.method === "POST") {
      return handleRun(request, env, ctx);
    }
    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, 404);
    }
    return env.ASSETS.fetch(request);
  },
};

async function handleRun(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const sample = SAMPLES[body.workflow]?.[body.sample];
  if (!sample) return json({ error: "Unknown sample" }, 400);

  const cache = caches.default;
  const cacheKey = new Request(`https://cache.internal/v1/${body.workflow}/${body.sample}`);

  // 1. Already generated for this sample? Serve it, no Groq call.
  const cached = await cache.match(cacheKey);
  if (cached) return json({ data: await cached.json(), source: "cache" });

  // 2. No key or over the limit: serve the placeholder output.
  const ip = request.headers.get("cf-connecting-ip") || "anon";
  if (!env.GROQ_API_KEY || (await isRateLimited(cache, ip))) {
    return json({ data: sample.fallback, source: "fallback" });
  }

  // 3. Generate once with Groq and cache it for a week.
  try {
    const data = await callGroq(env, WORKFLOW_PROMPTS[body.workflow], sample.text);
    ctx.waitUntil(
      cache.put(
        cacheKey,
        new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=604800" },
        })
      )
    );
    return json({ data, source: "groq" });
  } catch (err) {
    console.error("Groq failed:", err.message);
    return json({ data: sample.fallback, source: "fallback" });
  }
}

async function callGroq(env, systemPrompt, userText) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL || "qwen/qwen3.8-27b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
      temperature: 0.6,
      max_completion_tokens: 600,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`Groq responded ${res.status}`);

  const payload = await res.json();
  const raw = payload.choices?.[0]?.message?.content || "";
  // Some Qwen models emit <think> blocks before the JSON. Strip them, then pull out the object.
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in model output");
  return JSON.parse(match[0]);
}

async function isRateLimited(cache, ip) {
  const key = new Request(`https://rate.internal/${encodeURIComponent(ip)}`);
  const hit = await cache.match(key);
  const count = hit ? Number(await hit.text()) : 0;
  if (count >= RATE_LIMIT_PER_HOUR) return true;
  await cache.put(key, new Response(String(count + 1), { headers: { "Cache-Control": "max-age=3600" } }));
  return false;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
