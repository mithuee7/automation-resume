// Workflow definitions for real estate agents. Each node has a render(data, input) that returns the text shown under it.
const WORKFLOWS = [
  {
    id: "instant",
    num: "01",
    title: "Instant lead response",
    desc: "A new enquiry on Instagram or WhatsApp gets a reply in seconds, day or night. Buyers and renters who wait move on to the next listing, so this answers while they're still interested.",
    points: [
      "Replies to new Instagram and WhatsApp enquiries in seconds",
      "Rates each lead as hot, warm or cold",
      "Stays in your tone and never makes up prices",
    ],
    samples: [
      { id: "l1", label: "Asks availability", text: "Hi! Do you have any viewing slots this week?" },
      { id: "l2", label: "Asks pricing", text: "What's the asking price for the 2 bed flat on Maple Street?" },
      { id: "l3", label: "Just browsing", text: "Just browsing the listings, thanks" },
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
    desc: "Most buyers need several touchpoints after a viewing, and most agents never send them. This reads where the conversation stopped and recommends the next message to send.",
    points: [
      "Finds leads who have gone quiet after a viewing",
      "Recommends the next message based on where things stopped",
      "You approve each message before it goes out",
    ],
    samples: [
      { id: "f1", label: "Budget concern", text: "Thanks for showing me the flat. I need to think about the budget first." },
      { id: "f2", label: "Undecided", text: "Still looking at options, will update you soon" },
      { id: "f3", label: "Positive, silent", text: "Loved the place, I'll think about it" },
    ],
    nodes: [
      { icon: "⏱️", label: "No reply detected", sub: "After 3 days", render: (d, input) => input },
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
    desc: "Missed calls become missed listings. An AI receptionist picks up, handles the caller's question from start to finish, and books a viewing or valuation or passes urgent issues to the agent.",
    points: [
      "Answers every call, even after hours",
      "Captures the caller's name and callback number",
      "Sends urgent issues to the agent straight away",
    ],
    samples: [
      { id: "c1", label: "Emergency", text: "Urgent: the boiler in my rental has broken and it's freezing." },
      { id: "c2", label: "Opening hours", text: "Hi, what time are your viewings on Saturday?" },
      { id: "c3", label: "Booking a valuation", text: "I want to sell my house, can someone value it next week?" },
    ],
    nodes: [
      { icon: "📞", label: "Call answered", sub: "First ring", render: (d, input) => input },
      { icon: "🧠", label: "Understands caller", sub: "Need and urgency", ai: true,
        render: (d) => `${d.intent ?? "—"} · ${d.urgency ?? "—"} urgency` },
      { icon: "🗒️", label: "Replies on the call", sub: "In your voice", render: (d) => d.reply ?? "—" },
      { icon: "🔀", label: "Routes call", sub: "Urgent to the agent",
        render: (d) => d.urgency === "high" ? "Sent to the agent ✓" : "Logged for callback ✓" },
    ],
    finalText: (d) => d.reply ?? "—",
    multi: true,
  },
  {
    id: "booking",
    num: "04",
    title: "Viewing bookings",
    desc: "Buyers check availability and book a viewing inside the chat. Your calendar stays current, and confirmations go out without anyone typing them.",
    points: [
      "Proposes viewing times that fit the request",
      "Confirms the viewing in the same chat",
      "Keeps your calendar and reminders up to date",
    ],
    samples: [
      { id: "b1", label: "Friday afternoon", text: "Can I view the 3 bed house on Oak Lane this Friday afternoon?" },
      { id: "b2", label: "Early slot", text: "Do you have anything at 8am tomorrow for a viewing?" },
      { id: "b3", label: "Reschedule", text: "Can I move my Monday viewing to Wednesday?" },
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
    multi: true,
  },
  {
    id: "qualify",
    num: "05",
    title: "Lead qualification",
    desc: "Before you spend time on a viewing, the AI asks the questions that matter: budget, timeline and what the buyer or renter actually needs. Only ready leads reach your calendar.",
    points: [
      "Asks one question at a time to learn what the client needs",
      "Scores each lead from 1 to 10",
      "Passes ready leads to you with a summary",
    ],
    samples: [
      { id: "q1", label: "Urgent buyer", text: "We need a 2 bed flat before the end of the month, our lease ends soon." },
      { id: "q2", label: "Just exploring", text: "Just exploring the market, no timeline yet." },
      { id: "q3", label: "Budget and timeline", text: "We have around 450k budget and want to buy within two months." },
    ],
    nodes: [
      { icon: "📩", label: "Lead arrives", sub: "Any channel", render: (d, input) => input },
      { icon: "🧠", label: "Scores lead", sub: "Need, budget, timeline", ai: true,
        render: (d) => `Score ${d.lead_score ?? "—"}/10 · ${d.intent ?? "—"}` },
      { icon: "✍️", label: "Asks next question", sub: "One at a time", render: (d) => d.reply ?? "—" },
      { icon: "🗂️", label: "Saves lead", sub: "Hot leads to agent",
        render: (d) => (d.lead_score ?? 0) >= 7 ? "Passed to agent ✓" : "Kept for nurturing ✓" },
    ],
    finalText: (d) => d.reply ?? "—",
  },
  {
    id: "reviews",
    num: "06",
    title: "Reviews and referrals",
    desc: "After a sale or letting is completed, the AI checks how it went. Happy clients get a Google review invite. Unhappy ones reach you privately before they post anywhere.",
    points: [
      "Follows up after each completed sale or letting",
      "Asks happy clients for a review",
      "Routes unhappy replies to you privately",
    ],
    samples: [
      { id: "r1", label: "Happy client", text: "Thank you so much for selling our house so quickly, the whole team was great!" },
      { id: "r2", label: "Mixed feelings", text: "The sale went fine but the paperwork took longer than I expected." },
      { id: "r3", label: "Unhappy", text: "I'm not happy. The valuation was wrong and the photos were poor." },
    ],
    nodes: [
      { icon: "💬", label: "Client replies", sub: "After the sale or let", render: (d, input) => input },
      { icon: "🧠", label: "Reads the mood", sub: "Happy or unhappy", ai: true,
        render: (d) => d.sentiment ?? "—" },
      { icon: "✍️", label: "Writes reply", sub: "Next step", render: (d) => d.reply ?? "—" },
      { icon: "🔀", label: "Routes it", sub: "Public or private",
        render: (d) => d.sentiment === "negative" ? "Sent to you privately ✓" : "Review link sent ✓" },
    ],
    finalText: (d) => d.reply ?? "—",
  },
];

const MAX_RUNS = 4;
const NODE_DELAY_MIN = 2000; // each node takes a random 2 to 4 seconds
const NODE_DELAY_MAX = 4000;

// Used only if the network fails, so the preview still runs.
const CALLER_FALLBACK = [
  "Okay, that sounds good. Can someone call me back today?",
  "Yes, that's the best number. Thanks for sorting that out.",
  "Perfect, thank you so much for your help.",
];
const LEAD_FALLBACK = {
  agree: "Yes, that time works for me. See you then!",
  disagree: "Sorry, that time doesn't work for me. Could we do later in the week instead?",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomDelay = () => NODE_DELAY_MIN + Math.random() * (NODE_DELAY_MAX - NODE_DELAY_MIN);

async function post(path, body) {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

const varyCustomer = async (wf, sample) => {
  const d = await post("/api/vary", { role: "customer", workflow: wf.id, base: sample.text });
  return d?.message || sample.text;
};

const varyCaller = async (history, turn) => {
  const d = await post("/api/vary", { role: "caller", history: history.slice(-8), turn });
  return d?.message || CALLER_FALLBACK[Math.min(turn - 2, CALLER_FALLBACK.length - 1)];
};

const varyLead = async (mode, history) => {
  const d = await post("/api/vary", { role: "lead", mode, history: history.slice(-8) });
  return d?.message || LEAD_FALLBACK[mode];
};

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
      <span class="run-count">1×</span>
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
        <div class="thread"></div>
        <button class="btn primary run">Run preview</button>
      </div>
    </div>`;

  article.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      if (article.dataset.busy) return;
      article.dataset.sample = chip.dataset.id;
      article.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === chip));
      resetCanvas(article);
    });
  });
  article.querySelector(".run").addEventListener("click", () => runWorkflow(wf, article));
  resetCanvas(article);
  return article;
}

function currentSample(wf, article) {
  return wf.samples.find((s) => s.id === article.dataset.sample) || wf.samples[0];
}

function resetNodes(article) {
  article.querySelectorAll(".node").forEach((n) => {
    n.classList.remove("running", "done");
    n.querySelector(".out").textContent = "Waiting";
  });
  article.querySelectorAll(".link").forEach((l) => l.classList.remove("lit"));
}

function resetCanvas(article) {
  resetNodes(article);
  setCount(article, 1);
  const thread = article.querySelector(".thread");
  thread.innerHTML = '<p class="hint">Press run to see it work.</p>';
}

function setCount(article, n) {
  article.querySelector(".run-count").textContent = `${n}×`;
}

function addBubble(article, kind, text) {
  const thread = article.querySelector(".thread");
  thread.querySelector(".hint")?.remove();
  const div = document.createElement("div");
  div.className = `bubble ${kind}`;
  div.innerHTML = `<span class="bubble-label">${kind === "in" ? "Incoming" : "Reply"}</span><p></p>`;
  div.querySelector("p").textContent = text;
  thread.appendChild(div);
  thread.scrollTop = thread.scrollHeight;
}

// Runs the node pipeline once for a single message. The real Groq call starts at the AI node.
async function runPipeline(wf, article, sample, message, history, turn) {
  const nodes = [...article.querySelectorAll(".node")];
  const links = [...article.querySelectorAll(".link")];
  const aiIndex = wf.nodes.findIndex((n) => n.ai);
  resetNodes(article);

  let pending = null;
  let data = null;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const cfg = wf.nodes[i];
    if (i > 0) links[i - 1].classList.add("lit");

    node.classList.add("running");
    node.querySelector(".out").textContent = "Working…";

    if (i === aiIndex) {
      pending = post("/api/run", {
        workflow: wf.id,
        sample: sample.id,
        text: message,
        history: history.slice(-8),
        turn,
      }).then((d) => (data = d));
    }

    const wait = sleep(randomDelay());
    if (pending) await pending;
    await wait;

    node.classList.remove("running");
    node.classList.add("done");
    node.querySelector(".out").textContent = cfg.render(data || {}, message);
  }
  return data;
}

async function runWorkflow(wf, article) {
  if (article.dataset.busy) return;
  article.dataset.busy = "1";

  const sample = currentSample(wf, article);
  const runBtn = article.querySelector(".run");
  const chips = article.querySelectorAll(".chip");
  runBtn.disabled = true;
  runBtn.textContent = "Running…";
  chips.forEach((c) => (c.disabled = true));
  article.querySelector(".thread").innerHTML = "";
  resetNodes(article);
  setCount(article, 1);

  const history = [];

  // One conversation turn: show the incoming message, run the workflow, show the reply.
  const turn = async (message, n) => {
    setCount(article, n);
    addBubble(article, "in", message);
    const data = await runPipeline(wf, article, sample, message, history, n);
    history.push({ role: "customer", text: message });
    const reply = data ? wf.finalText(data, message) : "Preview unavailable right now. Try again in a moment.";
    addBubble(article, "out", reply);
    history.push({ role: "agent", text: reply });
    return data;
  };

  try {
    if (wf.id === "calls") {
      // A caller keeps talking until their issue is solved, up to MAX_RUNS turns.
      let message = await varyCustomer(wf, sample);
      for (let n = 1; n <= MAX_RUNS; n++) {
        if (n > 1) message = await varyCaller(history, n);
        await turn(message, n);
      }
    } else if (wf.id === "booking") {
      // The AI proposes a time. The client agrees or disagrees with a 50% chance each round.
      let message = await varyCustomer(wf, sample);
      let n = 1;
      let agreed = false;
      while (true) {
        await turn(message, n);
        if (agreed || n >= MAX_RUNS) break;
        agreed = Math.random() < 0.5;
        message = await varyLead(agreed ? "agree" : "disagree", history);
        n++;
      }
    } else {
      await turn(await varyCustomer(wf, sample), 1);
    }
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = "Run again";
    chips.forEach((c) => (c.disabled = false));
    delete article.dataset.busy;
  }
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
