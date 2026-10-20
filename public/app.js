// Workflow definitions. Each node has a render(data, input) that returns the text shown under it.
const WORKFLOWS = [
  {
    id: "comment",
    num: "01",
    title: "Comment replies",
    desc: "People comment on your posts all day. If nobody replies fast, they lose interest and move on. This replies for you in seconds.",
    points: [
      "Understands what each person is asking or feeling",
      "Replies in your tone, without making up prices",
      "Moves price questions and complaints into a private message",
    ],
    samples: [
      { id: "c1", label: "Price question", text: "Hey! How much does this cost? 👀" },
      { id: "c2", label: "Compliment", text: "Love this so much, your content is always 🔥" },
      { id: "c3", label: "Complaint", text: "I ordered 3 days ago and still no reply from anyone." },
    ],
    nodes: [
      { icon: "💬", label: "Comment received", sub: "Instagram", render: (d, input) => input },
      { icon: "🧠", label: "Understands it", sub: "What they want", ai: true,
        render: (d) => `${d.intent ?? "—"} · ${d.sentiment ?? "—"}` },
      { icon: "✍️", label: "Writes reply", sub: "In your voice", render: (d) => d.reply ?? "—" },
      { icon: "📤", label: "Posts reply", sub: "Public reply", render: () => "Reply posted ✓" },
    ],
    finalText: (d) => d.reply ?? "—",
  },
  {
    id: "dm",
    num: "02",
    title: "Lead capture from DMs",
    desc: "Someone sends you a message asking about your service. If you take hours to answer, they buy from someone else. This answers, asks the right question, and gets them to book.",
    points: [
      "Starts when someone sends a set keyword",
      "Asks one simple question to learn what they need",
      "Saves every good lead and sends them your booking link",
    ],
    samples: [
      { id: "d1", label: "Wants growth", text: "Hi, I saw your post. I want to grow my Instagram, I have about 6 months." },
      { id: "d2", label: "Just curious", text: "Just curious how this works" },
      { id: "d3", label: "Urgent, tight budget", text: "I run a small shop and need more customers this month. Budget is tight but I'm serious." },
    ],
    nodes: [
      { icon: "📩", label: "Message received", sub: "Keyword matched", render: (d, input) => input },
      { icon: "🧠", label: "Checks if they're a fit", sub: "Their goal", ai: true,
        render: (d) => `${d.intent ?? "—"} · Score ${d.lead_score ?? "—"}/10` },
      { icon: "✍️", label: "Writes reply", sub: "One simple question", render: (d) => d.reply ?? "—" },
      { icon: "🗂️", label: "Saves lead", sub: "Sends booking link", render: (d) => `Saved (score ${d.lead_score ?? "—"}/10) · Link sent ✓` },
    ],
    finalText: (d) => d.reply ?? "—",
  },
  {
    id: "enquiry",
    num: "03",
    title: "Inbound enquiry router",
    desc: "Customers ask questions at night, on weekends, and while you're busy. Unanswered questions turn into lost sales. This answers them from your own information and passes anything unclear to a real person.",
    points: [
      "Answers only from information you approve",
      "Checks how sure it is before replying",
      "Sends unclear questions to your team with a short summary",
    ],
    samples: [
      { id: "e1", label: "Hours (not in info)", text: "What are your opening hours on Saturday?" },
      { id: "e2", label: "Service question", text: "Do you offer Service B and how long does it take?" },
      { id: "e3", label: "Custom legal request", text: "I need a custom contract for a 2 year deal with my company's legal terms." },
    ],
    nodes: [
      { icon: "🌐", label: "Question received", sub: "Website chat", render: (d, input) => input },
      { icon: "🧠", label: "Looks up answer", sub: "From your info", ai: true,
        render: (d) => `${d.intent ?? "—"} · Sure ${d.confidence != null ? Math.round(d.confidence * 100) + "%" : "—"}` },
      { icon: "🔀", label: "Decides", sub: "Answer or hand off",
        render: (d) => (d.confidence ?? 0) >= 0.6 ? "Sure enough → answer" : "Not sure → send to a person" },
      { icon: "📤", label: "Sends reply", sub: "Back to the chat",
        render: (d) => (d.confidence ?? 0) >= 0.6 ? "Answer sent ✓" : `Team notified: ${d.summary ?? "—"}` },
    ],
    finalText: (d) => (d.confidence ?? 0) >= 0.6
      ? (d.answer || "—")
      : "Let me connect you with a team member who can help with this.",
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
        <div class="bubble">
          <span class="bubble-label">Final reply</span>
          <p class="bubble-text">Press run to see it work.</p>
        </div>
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
  return article;
}

function resetCanvas(article) {
  article.querySelectorAll(".node").forEach((n) => {
    n.classList.remove("running", "done");
    n.querySelector(".out").textContent = "Waiting";
  });
  article.querySelectorAll(".link").forEach((l) => l.classList.remove("lit"));
  article.querySelector(".bubble-text").textContent = "Press run to see it work.";
}

async function runWorkflow(wf, article) {
  if (article.dataset.busy) return;
  article.dataset.busy = "1";

  const sample = wf.samples.find((s) => s.id === article.dataset.sample);
  const nodes = [...article.querySelectorAll(".node")];
  const links = [...article.querySelectorAll(".link")];
  const runBtn = article.querySelector(".run");
  const bubble = article.querySelector(".bubble-text");
  const chips = article.querySelectorAll(".chip");
  const aiIndex = wf.nodes.findIndex((n) => n.ai);

  runBtn.disabled = true;
  runBtn.textContent = "Running…";
  chips.forEach((c) => (c.disabled = true));
  resetCanvas(article);

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

  bubble.textContent = data ? wf.finalText(data, sample.text) : "Preview unavailable right now. Try again in a moment.";
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
