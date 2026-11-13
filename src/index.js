// Cloudflare Worker: serves the static site and two API routes for live previews.
//   POST /api/run   runs one workflow step with Groq (uses conversation history)
//   POST /api/vary  rewrites a client message, or writes the next caller/client turn
// No database. Per-IP rate limit via the Cache API. All scenarios are for real estate agents.

const MAX_TURNS = 4;
const RATE_LIMIT_PER_HOUR = 150;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const RE = "You work for a real estate agent. Never invent prices, addresses or availability that were not given to you.";

const WORKFLOW_PROMPTS = {
  instant: `${RE}
You reply to a new Instagram or WhatsApp enquiry from a prospective buyer or renter.
Reply in 2-3 friendly sentences and rate the lead as hot, warm or cold. If you do not know the answer, offer to check and confirm.
Respond with JSON only: {"intent": "<short label>", "temperature": "hot" | "warm" | "cold", "reply": "<message>"}`,

  followup: `${RE}
You write follow-up messages for real estate leads who went quiet after an enquiry or viewing.
Read the chat, work out where it stopped, and write ONE short, friendly follow-up in 2-3 sentences that adds value and does not pressure.
Respond with JSON only: {"stage": "<where the conversation stopped>", "recommended_message": "<follow-up message>"}`,

  calls: `${RE}
You are the AI receptionist for a real estate agency, answering a phone call. The conversation so far is provided; the last message is what the caller just said.
Reply as the receptionist in 2-4 natural sentences. Ask for a name and callback number if they are missing.
This is turn {turn} of 4. On turn 4, wrap up: confirm what has been arranged and that the caller's issue is handled.
Mark urgency high only for same-day emergencies, such as a tenant with no heating or a burst pipe.
Respond with JSON only: {"intent": "<short label>", "urgency": "high" | "normal", "reply": "<what you say on the call>"}`,

  booking: `${RE}
You handle viewing bookings for a real estate agent in a chat.
If no time has been agreed yet, propose ONE specific viewing time that fits the request, in 2-3 sentences.
If the client has agreed to a time, confirm the viewing in 2-3 sentences with the time and what to bring.
Respond with JSON only: {"intent": "<short label>", "slot": "available" | "unavailable", "reply": "<message>"}`,

  qualify: `${RE}
You qualify a real estate buyer or renter lead. Ask ONE question at a time to learn their budget, timeline or what they need, in 2-3 sentences.
Score the lead from 1 to 10.
Respond with JSON only: {"intent": "<short label>", "lead_score": <integer 1-10>, "reply": "<message>"}`,

  reviews: `${RE}
You reply to a client after a property sale or letting has been completed.
If they are happy, thank them warmly and invite a Google review in 2-3 sentences.
If they are unhappy, apologise and say the agent will contact them directly to put it right.
Respond with JSON only: {"sentiment": "positive" | "neutral" | "negative", "reply": "<message>"}`,
};

const VARY_PROMPTS = {
  customer: `Rewrite this message from a prospective client to a real estate agent. Keep the same meaning and details, but change the wording and tone so it reads like a real person typing. Keep it to 1-2 sentences.
Respond with JSON only: {"message": "<rewritten message>"}`,
  caller: `You are a person phoning a real estate agency. Write what the caller says next, in 2-4 natural sentences, reacting to what the receptionist just said. This is turn {turn} of 4. On turn 4 the caller is satisfied and their issue is sorted, so they thank the receptionist.
Respond with JSON only: {"message": "<what the caller says>"}`,
  agree: `You are a client who was offered a viewing time by a real estate agent. Accept the proposed time in 1-3 sentences, naturally.
Respond with JSON only: {"message": "<client reply>"}`,
  disagree: `You are a client who was offered a viewing time that does not suit you. Politely decline it in 1-2 sentences and suggest a different day or time.
Respond with JSON only: {"message": "<client reply>"}`,
};

const SAMPLES = {
  instant: {
    l1: { text: "Hi! Do you have any viewing slots this week?", fallback: { intent: "availability", temperature: "hot", reply: "Hi! Yes, we have a few viewing slots this week. Which day suits you best?" } },
    l2: { text: "What's the asking price for the 2 bed flat on Maple Street?", fallback: { intent: "pricing question", temperature: "warm", reply: "Happy to help! The asking price is shared with viewers, so would you like to book a viewing to see it?" } },
    l3: { text: "Just browsing the listings, thanks", fallback: { intent: "browsing", temperature: "cold", reply: "Glad you're looking! Send any questions here anytime, and I can share new listings that match what you want." } },
  },
  followup: {
    f1: { text: "Thanks for showing me the flat. I need to think about the budget first.", fallback: { stage: "viewed, budget concern", recommended_message: "Totally fair. Would it help if I sent you two similar flats in a slightly lower range to compare?" } },
    f2: { text: "Still looking at options, will update you soon", fallback: { stage: "undecided, no timeline", recommended_message: "No rush at all. Would a short shortlist of new listings help you compare?" } },
    f3: { text: "Loved the place, I'll think about it", fallback: { stage: "positive but silent", recommended_message: "Glad you liked it! Would Thursday or Friday work for a quick call to talk through next steps?" } },
  },
  calls: {
    c1: { text: "Urgent: the boiler in my rental has broken and it's freezing.", fallback: { intent: "tenant emergency", urgency: "high", reply: "I'm sorry, that sounds urgent. Can I take your name, address and callback number so our team can call you right away?" } },
    c2: { text: "Hi, what time are your viewings on Saturday?", fallback: { intent: "viewing hours", urgency: "normal", reply: "Thanks for calling! Saturday viewings run from 10am to 4pm. Which property are you interested in?" } },
    c3: { text: "I want to sell my house, can someone value it next week?", fallback: { intent: "valuation request", urgency: "normal", reply: "Of course, we'd be happy to arrange a valuation. Which day next week suits you, and what's the best callback number?" } },
  },
  booking: {
    b1: { text: "Can I view the 3 bed house on Oak Lane this Friday afternoon?", fallback: { intent: "viewing request", slot: "available", reply: "Yes, Friday afternoon is open. Would 2:30 or 4:00 suit you?" } },
    b2: { text: "Do you have anything at 8am tomorrow for a viewing?", fallback: { intent: "early viewing request", slot: "unavailable", reply: "We don't do 8am viewings, but 9:00 tomorrow is free. Shall I book that for you?" } },
    b3: { text: "Can I move my Monday viewing to Wednesday?", fallback: { intent: "reschedule", slot: "available", reply: "Of course. Wednesday at 11:00 is free. Want me to move your viewing?" } },
  },
  qualify: {
    q1: { text: "We need a 2 bed flat before the end of the month, our lease ends soon.", fallback: { intent: "urgent buyer or renter", lead_score: 8, reply: "Thanks, that helps. What's your budget range, and are you looking to rent or buy?" } },
    q2: { text: "Just exploring the market, no timeline yet.", fallback: { intent: "exploring", lead_score: 3, reply: "Great to hear! What would you most like to know about the local market?" } },
    q3: { text: "We have around 450k budget and want to buy within two months.", fallback: { intent: "budget and timeline", lead_score: 9, reply: "That's a clear plan. I'll pass your details to an agent so they can call you today." } },
  },
  reviews: {
    r1: { text: "Thank you so much for selling our house so quickly, the whole team was great!", fallback: { sentiment: "positive", reply: "Thank you, that means a lot! Would you mind leaving a quick Google review? It really helps us." } },
    r2: { text: "The sale went fine but the paperwork took longer than I expected.", fallback: { sentiment: "neutral", reply: "Thanks for being honest. We'd like to make the next one smoother. Is there anything we could have done faster?" } },
    r3: { text: "I'm not happy. The valuation was wrong and the photos were poor.", fallback: { sentiment: "negative", reply: "I'm really sorry about that. The agent will contact you directly to put it right." } },
  },
};

// Fallbacks for later turns, used if Groq is unavailable.
const CALL_FOLLOWUP = [
  { intent: "follow-up", urgency: "normal", reply: "Thanks, I've noted that down. I'll get someone to call you back today with the details. Is this the best number?" },
  { intent: "confirmation", urgency: "normal", reply: "Perfect, I've passed it to the team. Is there anything else I can help you with?" },
  { intent: "wrap-up", urgency: "normal", reply: "Great, that's all arranged and you'll get a confirmation shortly. Thanks for calling!" },
];
const CALL_CALLER = [
  "Okay, that sounds good. Can someone call me back today?",
  "Yes, that's the best number. Thanks for sorting that out.",
  "Perfect, thank you so much for your help.",
];
const BOOKING_CONFIRM = { intent: "confirmation", slot: "available", reply: "Brilliant, that's booked in. You'll get a confirmation and a reminder shortly." };
const LEAD_FALLBACK = { agree: "Yes, that time works for me. See you then!", disagree: "Sorry, that time doesn't work for me. Could we do later in the week instead?" };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/run") return handleRun(request, env);
    if (request.method === "POST" && url.pathname === "/api/vary") return handleVary(request, env);
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
    return env.ASSETS.fetch(request);
  },
};

async function handleRun(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const spec = SAMPLES[body.workflow];
  if (!spec) return json({ error: "Unknown workflow" }, 400);
  const sample = spec[body.sample] || Object.values(spec)[0];
  const text = cleanText(body.text) || sample.text;
  const history = cleanHistory(body.history);
  const turn = clampInt(body.turn, 1, MAX_TURNS, 1);
  const fallback = fallbackFor(body.workflow, sample, turn);

  if (!env.GROQ_API_KEY || (await isRateLimited(request))) {
    return json({ data: fallback, source: "fallback" });
  }
  try {
    const system = WORKFLOW_PROMPTS[body.workflow].replaceAll("{turn}", String(turn));
    const messages = [
      { role: "system", content: system },
      ...history.map((h) => ({ role: h.role === "customer" ? "user" : "assistant", content: h.text })),
      { role: "user", content: text },
    ];
    const data = await groq(env, messages, 0.7, 600);
    return json({ data, source: "groq" });
  } catch (err) {
    console.error("Groq failed:", err.message);
    return json({ data: fallback, source: "fallback" });
  }
}

async function handleVary(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const turn = clampInt(body.turn, 2, MAX_TURNS, 2);
  const history = cleanHistory(body.history);
  const base = cleanText(body.base) || "";
  const role = body.role;

  let promptKey, fallbackMessage, userText;
  if (role === "customer") {
    promptKey = "customer";
    fallbackMessage = base;
    userText = `Message to rewrite: ${base}`;
  } else if (role === "caller") {
    promptKey = "caller";
    fallbackMessage = CALL_CALLER[Math.min(turn - 2, CALL_CALLER.length - 1)];
    userText = `Conversation so far:\n${transcript(history)}`;
  } else if (role === "lead") {
    const mode = body.mode === "disagree" ? "disagree" : "agree";
    promptKey = mode;
    fallbackMessage = LEAD_FALLBACK[mode];
    userText = `Conversation so far:\n${transcript(history)}`;
  } else {
    return json({ error: "Unknown role" }, 400);
  }

  if (!env.GROQ_API_KEY || (await isRateLimited(request))) {
    return json({ data: { message: fallbackMessage }, source: "fallback" });
  }
  try {
    const system = VARY_PROMPTS[promptKey].replaceAll("{turn}", String(turn));
    const data = await groq(env, [
      { role: "system", content: system },
      { role: "user", content: userText },
    ], 0.95, 300);
    const message = cleanText(data.message);
    if (!message) throw new Error("empty message");
    return json({ data: { message }, source: "groq" });
  } catch (err) {
    console.error("Vary failed:", err.message);
    return json({ data: { message: fallbackMessage }, source: "fallback" });
  }
}

function fallbackFor(workflow, sample, turn) {
  if (workflow === "calls" && turn > 1) return CALL_FOLLOWUP[Math.min(turn - 2, CALL_FOLLOWUP.length - 1)];
  if (workflow === "booking" && turn > 1) return BOOKING_CONFIRM;
  return sample.fallback;
}

async function groq(env, messages, temperature, maxTokens) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.GROQ_MODEL || "qwen/qwen3.8-27b",
      messages,
      temperature,
      max_completion_tokens: maxTokens,
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

function transcript(history) {
  return history.map((h) => `${h.role === "customer" ? "Client" : "Agent"}: ${h.text}`).join("\n");
}

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 400);
}

function cleanHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((h) => h && (h.role === "customer" || h.role === "agent") && typeof h.text === "string")
    .slice(-8)
    .map((h) => ({ role: h.role, text: cleanText(h.text) }));
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function isRateLimited(request) {
  const ip = request.headers.get("cf-connecting-ip") || "anon";
  const cache = caches.default;
  const key = new Request(`https://rate.internal/${encodeURIComponent(ip)}`);
  const hit = await cache.match(key);
  const count = hit ? Number(await hit.text()) : 0;
  if (count >= RATE_LIMIT_PER_HOUR) return true;
  await cache.put(key, new Response(String(count + 1), { headers: { "Cache-Control": "max-age=3600" } }));
  return false;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
