// Workflow definitions. Each node has a render(data, input) that returns the text shown under it.
const WORKFLOWS = [
  {
    id: "comment",
    num: "01",
    title: "Comment automation",
    desc: "Every comment on a post gets read, understood and answered within seconds, in your brand's voice.",
    points: [
      "Reads intent and sentiment on each comment",
      "Replies publicly in your tone, never inventing prices",
      "Moves pricing or complaint threads to DM automatically",
    ],
    samples: [
      { id: "c1", label: "Price question", text: "Hey! How much does this cost? 👀" },
      { id: "c2", label: "Compliment", text: "Love this so much, your content is always 🔥" },
      { id: "c3", label: "Complaint", text: "I ordered 3 days ago and still no reply from anyone." },
    ],
    nodes: [
      { icon: "💬", title: "Received comment", tag: "Instagram · Trigger", render: (d, input) => input },
      { icon: "🧠", title: "AI interprets comment", tag: "Groq · Intent & sentiment", ai: true,
        render: (d) => `Intent: ${d.intent ?? "—"} · Sentiment: ${d.sentiment ?? "—"}` },
      { icon: "✍️", title: "Writes reply comment", tag: "Groq · Reply", render: (d) => d.reply ?? "—" },
      { icon: "📤", title: "Sends comment", tag: "Meta Graph API · placeholder", render: () => "Posted as a public reply ✓" },
    ],
    finalText: (d) => d.reply ?? "—",
  },
  {
    id: "dm",
    num: "02",
    title: "Lead capture from DMs",
    desc: "A follower DMs a keyword. The AI qualifies them with one smart question and sends a booking link if they're a fit.",
    points: [
      "Triggers on a keyword in DMs or comments",
      "Asks one qualifying question, not a form",
      "Scores each lead and saves it with a summary",
    ],
    samples: [
      { id: "d1", label: "Growth goal", text: "Hi, I saw your post. I want to grow my Instagram, I have about 6 months." },
      { id: "d2", label: "Just curious", text: "Just curious how this works" },
      { id: "d3", label: "Urgent, tight budget", text: "I run a small shop and need more customers this month. Budget is tight but I'm serious." },
    ],
    nodes: [
      { icon: "📩", title: "DM received", tag: "Instagram DM · Keyword trigger", render: (d, input) => input },
      { icon: "🧠", title: "AI qualifies lead", tag: "Groq · Goal & fit", ai: true,
        render: (d) => `Intent: ${d.intent ?? "—"} · Lead score: ${d.lead_score ?? "—"}/10` },
      { icon: "✍️", title: "Writes DM reply", tag: "Groq · Qualifying question", render: (d) => d.reply ?? "—" },
      { icon: "🗂️", title: "Saves lead & sends link", tag: "Sheet + booking link · placeholder",
        render: (d) => `Lead saved (score ${d.lead_score ?? "—"}/10) · Booking link sent ✓` },
    ],
    finalText: (d) => d.reply ?? "—",
  },
  {
    id: "enquiry",
    num: "03",
    title: "Inbound enquiry router",
    desc: "Website and chat enquiries are answered from your knowledge base. Anything the AI isn't sure about goes to a human with a summary.",
    points: [
      "Answers only from your approved knowledge base",
      "Checks confidence before replying",
      "Escalates unclear requests with a one-line summary",
    ],
    samples: [
      { id: "e1", label: "Hours (not in KB)", text: "What are your opening hours on Saturday?" },
      { id: "e2", label: "Service question", text: "Do you offer Service B and how long does it take?" },
      { id: "e3", label: "Custom legal request", text: "I need a custom contract for a 2 year deal with my company's legal terms." },
    ],
    nodes: [
      { icon: "🌐", title: "Website chat received", tag: "Chat widget · Trigger", render: (d, input) => input },
      { icon: "🧠", title: "AI checks knowledge base", tag: "Groq · Answer & confidence", ai: true,
        render: (d) => `Intent: ${d.intent ?? "—"} · Confidence: ${d.confidence != null ? Math.round(d.confidence * 100) + "%" : "—"}` },
      { icon: "🔀", title: "Replies or escalates", tag: "Confidence router",
        render: (d) => (d.confidence ?? 0) >= 0.6 ? "Confident → answering" : "Low confidence → escalating to a human" },
      { icon: "📤", title: "Sends to chat", tag: "Chat widget · placeholder",
        render: (d) => (d.confidence ?? 0) >= 0.6 ? "Answer delivered ✓" : `Summary to team: ${d.summary ?? "—"}` },
    ],
    finalText: (d) => (d.confidence ?? 0) >= 0.6
      ? (d.answer || "—")
      : "Let me connect you with a team member who can help with this.",
  },
];

const NODE_DELAY_MIN = 5000; // each node takes a random 5 to 7 seconds
const NODE_DELAY_MAX = 7000;

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
            <div class="node-head">
              <span class="node-icon">${n.icon}</span>
              <div><strong>${n.title}</strong><small>${n.tag}</small></div>
              <span class="dot"></span>
            </div>
            <div class="node-out">Waiting</div>
          </div>${i < wf.nodes.length - 1 ? '<div class="link"></div>' : ""}`).join("")}
      </div>
      <div class="bottom">
        <div class="bubble">
          <span class="bubble-label">Final output</span>
          <p class="bubble-text">Press run to preview this workflow.</p>
        </div>
        <button class="btn primary run">Run preview</button>
      </div>
    </div>`;

  article.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      if (article.dataset.busy) return;
      article.dataset.sample = chip.dataset.id;
      article.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === chip));
      resetCanvas(article, wf);
    });
  });
  article.querySelector(".run").addEventListener("click", () => runWorkflow(wf, article));
  return article;
}

function resetCanvas(article, wf) {
  article.querySelectorAll(".node").forEach((n) => {
    n.classList.remove("running", "done");
    n.querySelector(".node-out").textContent = "Waiting";
  });
  article.querySelectorAll(".link").forEach((l) => l.classList.remove("lit"));
  article.querySelector(".bubble-text").textContent = "Press run to preview this workflow.";
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
  resetCanvas(article, wf);

  let pending = null;
  let data = null;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const cfg = wf.nodes[i];
    if (i > 0) links[i - 1].classList.add("lit");

    node.classList.add("running");
    node.querySelector(".node-out").textContent = "Processing…";

    // The real Groq call starts when the AI node starts and runs while the node animates.
    if (i === aiIndex) pending = fetchResult(wf.id, sample.id).then((d) => (data = d));

    const wait = sleep(randomDelay());
    if (pending) await pending;
    await wait;

    node.classList.remove("running");
    node.classList.add("done");
    node.querySelector(".node-out").textContent = cfg.render(data || {}, sample.text);
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
  (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
