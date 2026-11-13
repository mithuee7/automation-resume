// Cloudflare Worker: serves the static site and one API route for workflow previews.
// No database. Groq results are cached per sample in the Cache API, so each sample
// is generated at most once globally. A per-IP limit guards against abuse.

const WORKFLOW_PROMPTS = {
  instant: `You reply to new Instagram or WhatsApp messages for a small service business.
Reply in 1-2 short, warm sentences, and rate the lead as hot, warm or cold.
Never invent prices, dates or policies. If unsure, offer to check and follow up.
Respond with JSON only: {"intent": "<short label>", "temperature": "hot" | "warm" | "cold", "reply": "<message>"}`,

  followup: `You write follow-up messages for leads who have gone quiet.
Read the last messages, work out where the conversation stopped, and write ONE short, friendly follow-up that adds value and does not pressure.
Never invent prices or policies.
Respond with JSON only: {"stage": "<where the conversation stopped>", "recommended_message": "<follow-up message>"}`,

  calls: `You are the AI receptionist answering a phone call for a small business. The caller's words are given as a transcript.
Write what you say next on the call, in 1-2 sentences. Ask for a name and callback number if they are missing.
Mark urgency high only for emergencies or same-day problems.
Respond with JSON only: {"intent": "<short label>", "urgency": "high" | "normal", "reply": "<what you say on the call>"}`,

  booking: `You handle booking requests in a business chat. Offer times that fit the request and confirm one when it works.
Keep it to 1-2 sentences.
Respond with JSON only: {"intent": "<short label>", "slot": "available" | "unavailable", "reply": "<message>"}`,

  qualify: `You qualify a new lead for a small business. Ask ONE question to learn their budget, timeline or need, and score the lead.
Never invent prices.
Respond with JSON only: {"intent": "<short label>", "lead_score": <integer 1-10>, "reply": "<message>"}`,

  reviews: `You reply to a customer's answer after they used a business's service.
If they are happy, thank them and invite a review. If they are unhappy, apologise and offer a private fix instead of a public review.
Respond with JSON only: {"sentiment": "positive" | "neutral" | "negative", "reply": "<message>"}`,
};

const SAMPLES = {
  instant: {
    l1: { text: "Hi! Do you have any slots this week?", fallback: { intent: "availability", temperature: "hot", reply: "Hi! Yes, we have a few openings this week. Which day suits you best?" } },
    l2: { text: "How much is the basic package?", fallback: { intent: "pricing question", temperature: "warm", reply: "Happy to help! A quick call lets us give you the right price. Want to book one?" } },
    l3: { text: "Just browsing, thanks", fallback: { intent: "browsing", temperature: "cold", reply: "Glad you stopped by! Send any questions here anytime." } },
  },
  followup: {
    f1: { text: "Thanks for the quote. I need to think about the budget first.", fallback: { stage: "quote sent, budget concern", recommended_message: "Totally fair. Would a smaller starter package help? I can send two options that fit a tighter budget." } },
    f2: { text: "Still looking at options, will update you soon", fallback: { stage: "undecided, no timeline", recommended_message: "No rush at all. Would a short comparison you can look at later help?" } },
    f3: { text: "Sounds good, I'll think about it", fallback: { stage: "positive but silent", recommended_message: "Glad it sounds good. Would Thursday or Friday work for a quick call to lock it in?" } },
  },
  calls: {
    c1: { text: "Hi, my kitchen sink is leaking badly and water is everywhere.", fallback: { intent: "emergency repair", urgency: "high", reply: "I'm sorry, that sounds urgent. Can I take your name and callback number so our team can call you right away?" } },
    c2: { text: "Hello, what time do you open on Saturday?", fallback: { intent: "opening hours", urgency: "normal", reply: "Thanks for calling! We're open Monday to Friday, 9am to 6pm. Would you like me to take a message?" } },
    c3: { text: "I'd like to book a service for next week, what's available?", fallback: { intent: "booking request", urgency: "normal", reply: "Sure, I can help. Which day next week works, and what's the best callback number?" } },
  },
  booking: {
    b1: { text: "Can I book a consultation this Friday afternoon?", fallback: { intent: "consultation booking", slot: "available", reply: "Yes, Friday afternoon is open. Would 2:30 or 5:00 suit you?" } },
    b2: { text: "Do you have anything at 8am tomorrow?", fallback: { intent: "early slot request", slot: "unavailable", reply: "We're not open at 8am, but 9:00 tomorrow is free. Shall I book that for you?" } },
    b3: { text: "Can I move my appointment from Monday to Wednesday?", fallback: { intent: "reschedule", slot: "available", reply: "Of course. Wednesday at 11:00 is free. Want me to move your booking?" } },
  },
  qualify: {
    q1: { text: "We run a dental clinic and want to automate appointment booking this month.", fallback: { intent: "clinic, urgent need", lead_score: 8, reply: "Thanks, that helps. Roughly how many bookings do you handle each week?" } },
    q2: { text: "Just exploring ideas for my shop, no timeline yet.", fallback: { intent: "exploring", lead_score: 3, reply: "Great to hear! What task takes up the most of your time right now?" } },
    q3: { text: "We have a budget of about 20k a month and want to start next week.", fallback: { intent: "budget and timeline", lead_score: 9, reply: "That's a clear plan. I'll pass your details to our team so they can call you today." } },
  },
  reviews: {
    r1: { text: "Great service, the team was so kind and quick!", fallback: { sentiment: "positive", reply: "Thank you, that means a lot! Would you mind leaving a quick review? It really helps us." } },
    r2: { text: "The job was fine but it took longer than I expected.", fallback: { sentiment: "neutral", reply: "Thanks for being honest. We'd like to make the next visit faster. Is there anything we could improve?" } },
    r3: { text: "I'm not happy. The work wasn't finished properly.", fallback: { sentiment: "negative", reply: "I'm really sorry about that. A manager will contact you directly to put it right." } },
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
