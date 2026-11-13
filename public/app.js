// Workflow definitions. Each node has a render(data, input) that returns the text shown under it.
const WORKFLOWS = [
  {
    id: "instant",
    num: "01",
    title: "Instant lead response",
    desc: "A new message on Instagram or WhatsApp gets a reply in seconds, day or night. Leads who wait lose interest, so this answers them while they're still interested.",
    points: [
      "Replies to new Instagram and WhatsApp messages in seconds",
      "Rates each lead as hot, warm or cold",
      "Stays in your tone and never invents prices",
    ],
    samples: [
      { id: "l1", label: "Asks availability", text: "Hi! Do you have any slots this week?" },
      { id: "l2", label: "Asks pricing", text: "How much is the basic package?" },
      { id: "l3", label: "Just browsing", text: "Just browsing, thanks" },
    ],
    nodes: [
      { icon: "📩", label: "Message received", sub: "Instagram or WhatsApp", render: (d, input) => input },
      { icon: "🧠", label: "Understands it", sub: "Intent and interest", ai: true,
        render: (d) => `${d.intent ?? "—"} · ${d.temperature ?? "—"}` },
      { icon: "✍️", label: "Writes reply", sub: "In your voice", render: (d) => d.reply ?? "—" },
      { icon: "📤", label: "Sends reply", sub: "Within seconds", render: () => "Reply sent ✓" },
    ],
    finalText: (d) => d.reply ?? "—",
  },
  {
    id: "followup",
    num: "02",
    title: "Follow-ups with recommended messages",
    desc: "Most sales happen after the third or fourth message, but most people never send one. This reads where the conversation stopped and suggests the next message to send.",
    points: [
      "Finds leads who have gone quiet",
      "Recommends the next message based on where things stopped",
      "You approve each message before it goes out",
    ],
    samples: [
      { id: "f1", label: "Budget concern", text: "Thanks for the quote. I need to think about the budget first." },
      { id: "f2", label: "Undecided", text: "Still looking at options, will update you soon" },
      { id: "f3", label: "Positive, silent", text: "Sounds good, I'll think about it" },
    ],
    nodes: [
      { icon: "⏱️", label: "No reply detected", sub: "After 48 hours", render: (d, input) => input },
      { icon: "🧠", label: "Reads the chat", sub: "Where it stopped", ai: true,
        render: (d) => d.stage ?? "—" },
      { icon: "✍️", label: "Recommends message", sub: "You approve first", render: (d) => d.recommended_message ?? "—" },
      { icon: "🗓️", label: "Queued", sub: "Sends at a good time", render: () => "Scheduled ✓" },
    ],
    finalText: (d) => d.recommended_message ?? "—",
  },
  {
    id: "calls",
    num: "03",
    title: "Receiving calls",
    desc: "Missed calls turn into missed customers. An AI receptionist picks up, answers what it can, and takes a message for anything that needs your team.",
    points: [
      "Answers every call, even after hours",
      "Captures the caller's name and callback number",
      "Sends urgent calls to your team straight away",
    ],
    samples: [
      { id: "c1", label: "Emergency", text: "Hi, my kitchen sink is leaking badly and water is everywhere." },
      { id: "c2", label: "Opening hours", text: "Hello, what time do you open on Saturday?" },
      { id: "c3", label: "Booking a service", text: "I'd like to book a service for next week, what's available?" },
    ],
    nodes: [
      { icon: "📞", label: "Call answered", sub: "First ring", render: (d, input) => input },
      { icon: "🧠", label: "Understands caller", sub: "Need and urgency", ai: true,
        render: (d) => `${d.intent ?? "—"} · ${d.urgency ?? "—"} urgency` },
      { icon: "🗒️", label: "Captures details", sub: "Name and callback", render: (d) => d.reply ?? "—" },
      { icon: "🔀", label: "Routes call", sub: "Urgent to your team",
        render: (d) => d.urgency === "high" ? "Sent to your team ✓" : "Logged for callback ✓" },
    ],
    finalText: (d) => d.reply ?? "—",
  },
  {
    id: "booking",
    num: "04",
    title: "Viewing bookings",
    desc: "Customers check availability and book inside the chat. Your calendar stays current, and confirmations go out without anyone typing them.",
    points: [
      "Shows open times that fit the request",
      "Confirms the booking in the same chat",
      "Keeps your calendar and reminders up to date",
    ],
    samples: [
      { id: "b1", label: "Friday afternoon", text: "Can I book a consultation this Friday afternoon?" },
      { id: "b2", label: "Early slot", text: "Do you have anything at 8am tomorrow?" },
      { id: "b3", label: "Reschedule", text: "Can I move my appointment from Monday to Wednesday?" },
    ],
    nodes: [
      { icon: "💬", label: "Booking request", sub: "In the chat", render: (d, input) => input },
      { icon: "🧠", label: "Reads request", sub: "Date and time", ai: true,
        render: (d) => d.intent ?? "—" },
      { icon: "📅", label: "Checks calendar", sub: "Live availability",
        render: (d) => d.slot === "available" ? "Slot free ✓" : "Offers other times" },
      { icon: "✅", label: "Confirms booking", sub: "Sends confirmation", render: (d) => d.reply ?? "—" },
    ],
    finalText: (d) => d.reply ?? "—",
  },
  {
    id: "qualify",
    num: "05",
    title: "Lead qualification",
    desc: "Before your team gets involved, the AI asks the questions that matter: budget, timeline and what the lead actually needs. Only ready leads reach your calendar.",
    points: [
      "Asks one question at a time to learn the lead's need",
      "Scores each lead from 1 to 10",
      "Passes hot leads to your team with a summary",
    ],
    samples: [
      { id: "q1", label: "Clinic, urgent", text: "We run a dental clinic and want to automate appointment booking this month." },
      { id: "q2", label: "Just exploring", text: "Just exploring ideas for my shop, no timeline yet." },
      { id: "q3", label: "Budget and timeline", text: "We have a budget of about 20k a month and want to start next week." },
    ],
    nodes: [
      { icon: "📩", label: "Lead arrives", sub: "Any channel", render: (d, input) => input },
      { icon: "🧠", label: "Scores lead", sub: "Need, budget, timeline", ai: true,
        render: (d) => `Score ${d.lead_score ?? "—"}/10 · ${d.intent ?? "—"}` },
      { icon: "✍️", label: "Asks next question", sub: "One at a time", render: (d) => d.reply ?? "—" },
      { icon: "🗂️", label: "Saves lead", sub: "Hot leads to team",
        render: (d) => (d.lead_score ?? 0) >= 7 ? "Passed to team ✓" : "Kept for nurturing ✓" },
    ],
    finalText: (d) => d.reply ?? "—",
  },
  {
    id: "reviews",
    num: "06",
    title: "Reviews and referrals",
    desc: "After a job is done, the AI asks how it went. Happy customers get a review link and a referral invite. Unhappy ones reach you privately before they post anywhere.",
    points: [
      "Follows up after each completed job",
      "Asks happy customers for a review and a referral",
      "Routes unhappy replies to you privately",
    ],
    samples: [
      { id: "r1", label: "Happy customer", text: "Great service, the team was so kind and quick!" },
      { id: "r2", label: "Mixed feelings", text: "The job was fine but it took longer than I expected." },
      { id: "r3", label: "Unhappy", text: "I'm not happy. The work wasn't finished properly." },
    ],
    nodes: [
      { icon: "💬", label: "Customer replies", sub: "After the job", render: (d, input) => input },
      { icon: "🧠", label: "Reads the mood", sub: "Happy or unhappy", ai: true,
        render: (d) => d.sentiment ?? "—" },
      { icon: "✍️", label: "Writes reply", sub: "Next step", render: (d) => d.reply ?? "—" },
      { icon: "🔀", label: "Routes it", sub: "Public or private",
        render: (d) => d.sentiment === "negative" ? "Sent to you privately ✓" : "Review link sent ✓" },
    ],
    finalText: (d) => d.reply ?? "—",
  },
];

const NODE_DELAY_MIN = 2000; // each node takes a random 2 to 4 seconds
const NODE_DELAY_MAX = 4000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomDelay = () => NODE_DELAY_MIN + Math.random() * (NODE_DELAY_MAX - NODE_DELAY_MIN);

async function fetchResult(workflowId, sampleId) {
  try {
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow: workflowId, sample: sampleId }),
    });
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

function buildWorkflow(wf) {
  const article = document.createElement("article");
  article.className = "wf reveal";
  article.id = wf.id;
  article.dataset.sample = wf.samples[0].id;
  article.innerHTML = `
    <div class="wf-info">
      <span class="wf-num">${wf.num}</span>
      <h3>${wf.title}</h3>
      <p>${wf.desc}</p>
      <ul>${wf.points.map((p) => `<li>${p}</li>`).join("")}</ul>
    </div>
    <div class="canvas">
      <div class="samples">
        ${wf.samples.map((s, i) => `<button class="chip${i === 0 ? " on" : ""}" data-id="${s.id}">${s.label}</button>`).join("")}
      </div>
      <div class="pipeline">
        ${wf.nodes.map((n, i) => `
          <div class="node" data-i="${i}">
            <div class="tile"><span class="badge"></span>${n.icon}</div>
            <div class="label">${n.label}</div>
            <div class="sub">${n.sub}</div>
            <div class="out">Waiting</div>
          </div>${i < wf.nodes.length - 1 ? '<div class="link"></div>' : ""}`).join("")}
      </div>
      <div class="bottom">
        <div class="thread">
          <div class="bubble in"><span class="bubble-label">Incoming</span><p class="in-text"></p></div>
          <div class="bubble out"><span class="bubble-label">Reply</span><p class="out-text">Press run to see it work.</p></div>
        </div>
        <button class="btn primary run">Run preview</button>
      </div>
    </div>`;

  article.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      if (article.dataset.busy) return;
      article.dataset.sample = chip.dataset.id;
      article.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === chip));
      resetCanvas(wf, article);
    });
  });
  article.querySelector(".run").addEventListener("click", () => runWorkflow(wf, article));
  resetCanvas(wf, article);
  return article;
}

function currentSample(wf, article) {
  return wf.samples.find((s) => s.id === article.dataset.sample) || wf.samples[0];
}

function resetCanvas(wf, article) {
  article.querySelectorAll(".node").forEach((n) => {
    n.classList.remove("running", "done");
    n.querySelector(".out").textContent = "Waiting";
  });
  article.querySelectorAll(".link").forEach((l) => l.classList.remove("lit"));
  article.querySelector(".in-text").textContent = currentSample(wf, article).text;
  article.querySelector(".out-text").textContent = "Press run to see it work.";
}

async function runWorkflow(wf, article) {
  if (article.dataset.busy) return;
  article.dataset.busy = "1";

  const sample = currentSample(wf, article);
  const nodes = [...article.querySelectorAll(".node")];
  const links = [...article.querySelectorAll(".link")];
  const runBtn = article.querySelector(".run");
  const outText = article.querySelector(".out-text");
  const chips = article.querySelectorAll(".chip");
  const aiIndex = wf.nodes.findIndex((n) => n.ai);

  runBtn.disabled = true;
  runBtn.textContent = "Running…";
  chips.forEach((c) => (c.disabled = true));
  resetCanvas(wf, article);

  let pending = null;
  let data = null;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const cfg = wf.nodes[i];
    if (i > 0) links[i - 1].classList.add("lit");

    node.classList.add("running");
    node.querySelector(".out").textContent = "Working…";

    // The real Groq call starts with the AI node and runs while the node animates.
    if (i === aiIndex) pending = fetchResult(wf.id, sample.id).then((d) => (data = d));

    const wait = sleep(randomDelay());
    if (pending) await pending;
    await wait;

    node.classList.remove("running");
    node.classList.add("done");
    node.querySelector(".out").textContent = cfg.render(data || {}, sample.text);
  }

  outText.textContent = data ? wf.finalText(data, sample.text) : "Preview unavailable right now. Try again in a moment.";
  runBtn.disabled = false;
  runBtn.textContent = "Run again";
  chips.forEach((c) => (c.disabled = false));
  delete article.dataset.busy;
}

// Build the workflow list
const list = document.getElementById("workflow-list");
WORKFLOWS.forEach((wf) => list.appendChild(buildWorkflow(wf)));

// Scroll reveal
const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }),
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// "See the workflows" scrolls without changing the URL
document.querySelectorAll("[data-scroll]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById(btn.dataset.scroll).scrollIntoView({ behavior: "smooth" });
  });
});
