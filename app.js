const stageTitles = [
  "Problem Appears",
  "Search",
  "Trust Signal Comparison",
  "Decision",
  "Problem Resolution",
  "Final Screen"
];

const stageIcons = ["🌧️", "🔎", "🛡️", "🏠", "⚖️", "✅"];

const companies = [
  {
    id: "rapid",
    name: "Rapid Roof Repair",
    google: 4.9,
    bbb: false,
    licensed: false,
    complaintsResolved: false,
    adBlurb: "Storm special today. Fast crews, instant booking, no waiting."
  },
  {
    id: "stormshield",
    name: "StormShield Roofing",
    google: 4.7,
    bbb: true,
    licensed: true,
    complaintsResolved: true,
    adBlurb: "Neighborhood favorite with premium shingles and same-day estimates."
  },
  {
    id: "budget",
    name: "Budget Roof Pros",
    google: 4.4,
    bbb: false,
    licensed: false,
    complaintsResolved: false,
    adBlurb: "Low-price promo language, quick turnaround, limited-time discount."
  },
  {
    id: "elite",
    name: "Elite Roofing & Siding",
    google: 4.8,
    bbb: true,
    licensed: true,
    complaintsResolved: true,
    adBlurb: "White-glove installation, premium warranty support, local team."
  }
];

const state = {
  currentStage: 0,
  maxUnlocked: 0,
  trustSignalsRevealed: false,
  selectedCompanyId: null,
  outcome: null,
  shadyProfile: null,
  shadyAccredited: false
};

const trackerEl = document.getElementById("stageTracker");
const stageEl = document.getElementById("stageContainer");
const humorEl = document.getElementById("humorContainer");

function getSelectedCompany() {
  return companies.find((company) => company.id === state.selectedCompanyId) || null;
}

function getSignalSnapshot(company) {
  const present = [];
  const missing = [];
  const bbbProfileAvailable = Boolean(company.bbb || company.complaintsResolved);

  if (company.bbb) {
    present.push("BBB Accredited");
  } else {
    missing.push("BBB Accreditation not shown");
  }

  if (bbbProfileAvailable) {
    present.push("BBB Profile Available");
  } else {
    missing.push("BBB profile unavailable");
  }

  if (company.complaintsResolved) {
    present.push("Complaint response history visible");
  } else {
    missing.push("Complaint response history unclear");
  }

  if (company.licensed) {
    present.push("License verified");
  } else {
    missing.push("License status unclear");
  }

  return { present, missing, bbbProfileAvailable };
}

function getConfidenceAssessment(company, signalSnapshot) {
  if (company.bbb && company.licensed) {
    return { label: "HIGH", riskLabel: "LOWER RISK", tone: "high" };
  }

  if (signalSnapshot.bbbProfileAvailable || company.licensed) {
    return { label: "MEDIUM", riskLabel: "MODERATE RISK", tone: "medium" };
  }

  return { label: "LOW", riskLabel: "HIGHER RISK", tone: "low" };
}

function unlockAndGo(nextStage) {
  state.maxUnlocked = Math.max(state.maxUnlocked, nextStage);
  state.currentStage = nextStage;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderTracker() {
  trackerEl.innerHTML = stageTitles
    .map((title, index) => {
      const isLocked = index > state.maxUnlocked;
      const isActive = index === state.currentStage;
      const classes = ["stage-pill"];
      if (isActive) classes.push("active");
      return `
        <button
          class="${classes.join(" ")}"
          data-action="go-stage"
          data-stage="${index}"
          ${isLocked ? "disabled" : ""}
        >
          <span class="step-no">${stageIcons[index]} Step ${index + 1}</span>
          <span class="step-name">${title}</span>
        </button>
      `;
    })
    .join("");
}

function renderStage() {
  const rendererByStage = [
    renderStageProblem,
    renderStageSearch,
    renderStageComparison,
    renderStageDecision,
    renderStageResolution,
    renderStageFinal
  ];
  stageEl.innerHTML = rendererByStage[state.currentStage]();
}

function renderStageProblem() {
  const rainDrops = Array.from({ length: 18 }, (_, i) => `<span class="drop" style="--i:${i};"></span>`).join("");
  return `
    <div class="stage-view">
      <h2 class="stage-title">Stage 1: Problem Appears</h2>
      <p class="section-lede">A storm rolls through. The leak starts. Panic meets search bar.</p>

      <div class="storm-scene">
        <div class="cloud cloud-a"></div>
        <div class="cloud cloud-b"></div>
        <div class="rain">${rainDrops}</div>
        <div class="house">
          <div class="roof"></div>
          <div class="house-body"></div>
          <div class="leak">💧</div>
        </div>
        <div class="homeowner" aria-label="concerned homeowner">😬</div>
      </div>

      <p class="note"><strong>"I need a roofer. Who can I trust?"</strong></p>
      <div class="btn-row">
        <button class="btn btn-primary" data-action="next-stage" data-next="1">Continue Journey</button>
      </div>
    </div>
  `;
}

function renderStageSearch() {
  const discoveryChannels = [
    { icon: "🔎", title: "Google Search", detail: "Fast, noisy, and full of ads." },
    { icon: "👥", title: "Facebook Group", detail: "Strong opinions. Mixed quality." },
    { icon: "🏡", title: "Neighbor Recommendation", detail: "Helpful, but still one data point." },
    { icon: "📣", title: "Online Ads", detail: "Strong marketing is not the same as accountability." }
  ];

  const toggleStateLabel = state.trustSignalsRevealed ? "ON" : "OFF";

  return `
    <div class="stage-view">
      <h2 class="stage-title">Stage 2: Search</h2>
      <p class="section-lede">Consumers often start with visibility first, then look for stronger trust signals.</p>

      <div class="behavior-grid">
        ${discoveryChannels
          .map(
            (channel) => `
              <article class="behavior-card">
                <p class="behavior-title">${channel.icon} ${channel.title}</p>
                <p class="behavior-sub">${channel.detail}</p>
              </article>
            `
          )
          .join("")}
      </div>

      <div class="signal-toggle-panel ${state.trustSignalsRevealed ? "on" : "off"}">
        <button
          class="signal-toggle ${state.trustSignalsRevealed ? "on" : "off"}"
          type="button"
          data-action="toggle-trust-signals"
          aria-pressed="${state.trustSignalsRevealed}"
        >
          <span class="toggle-label">Reveal Trust Signals</span>
          <span class="toggle-track"><span class="toggle-knob"></span></span>
          <span class="toggle-state">${toggleStateLabel}</span>
        </button>
        <p class="toggle-help">
          Aha moment: ratings and ads show visibility. Trust signals show accountability.
        </p>
      </div>

      <ul class="company-list">
        ${companies
          .map(
            (company) => `
              <li class="company-row">
                <div class="company-head">
                  <span>${company.name}</span>
                  <span class="google-score">⭐ ${company.google.toFixed(1)}</span>
                </div>
                ${
                  state.trustSignalsRevealed
                    ? `<div class="pill-wrap">${companyPills(company)}</div>`
                    : `<p class="ad-blurb">Ad blurb: "${company.adBlurb}"</p>`
                }
              </li>
            `
          )
          .join("")}
      </ul>

      <div class="btn-row">
        <button
          class="btn btn-primary"
          data-action="next-stage"
          data-next="2"
          ${state.trustSignalsRevealed ? "" : "disabled"}
        >
          Continue to Comparison
        </button>
      </div>
    </div>
  `;
}

function companyPills(company) {
  const snapshot = getSignalSnapshot(company);
  const pills = [];

  pills.push(company.bbb ? '<span class="pill trust">BBB Accredited</span>' : '<span class="pill risk">Not BBB Accredited</span>');
  pills.push(snapshot.bbbProfileAvailable ? '<span class="pill trust">BBB Profile Available</span>' : '<span class="pill risk">BBB Profile Unavailable</span>');
  pills.push(company.complaintsResolved ? '<span class="pill trust">Complaint Response History</span>' : '<span class="pill risk">Complaint History Unclear</span>');
  pills.push(company.licensed ? '<span class="pill trust">License Verified</span>' : '<span class="pill risk">License Unclear</span>');

  return pills.join("");
}

function renderStageComparison() {
  return `
    <div class="stage-view">
      <h2 class="stage-title">Stage 3: Trust Signal Comparison</h2>
      <p class="section-lede">Two companies can look polished at first glance. Accountability details matter.</p>

      <div class="comparison-grid">
        <article class="biz-card risk">
          <h3>Business A</h3>
          <ul class="signal-list">
            <li>4.9 Google stars</li>
            <li>No BBB profile</li>
            <li>No license listed</li>
            <li>Complaint history unclear</li>
          </ul>
        </article>

        <article class="biz-card trust">
          <h3>Business B</h3>
          <ul class="signal-list">
            <li>BBB Accredited</li>
            <li>BBB profile available</li>
            <li>Licensed contractor</li>
            <li>Complaint response history visible</li>
          </ul>
        </article>
      </div>

      <div class="tooltip-wrap">
        <button class="tooltip-trigger" type="button">Why these trust signals matter ⓘ</button>
        <span class="tooltip">
          BBB trust data supports informed choices by showing accountability signals consumers can review before hiring.
        </span>
      </div>

      <div class="btn-row">
        <button class="btn btn-primary" data-action="next-stage" data-next="3">Choose a Roofer</button>
      </div>
    </div>
  `;
}

function renderStageDecision() {
  const selectedCompany = getSelectedCompany();
  return `
    <div class="stage-view">
      <h2 class="stage-title">Stage 4: Decision</h2>
      <p class="section-lede">Pick a company, then run the simulation to explore one possible consumer outcome.</p>

      <div class="choice-grid">
        ${companies
          .map((company) => {
            const snapshot = getSignalSnapshot(company);
            const confidence = getConfidenceAssessment(company, snapshot);
            return `
              <button
                class="choice-card ${state.selectedCompanyId === company.id ? "selected" : ""}"
                data-action="select-company"
                data-company-id="${company.id}"
              >
                <div class="choice-head">
                  <strong>${company.name}</strong>
                  <span class="google-score">⭐ ${company.google.toFixed(1)}</span>
                </div>
                <div class="choice-signals">
                  <span class="pill ${confidence.tone === "high" ? "trust" : confidence.tone === "medium" ? "neutral" : "risk"}">
                    Confidence: ${confidence.label}
                  </span>
                  ${company.bbb ? '<span class="pill trust">BBB Accredited</span>' : '<span class="pill risk">Not BBB Accredited</span>'}
                </div>
              </button>
            `;
          })
          .join("")}
      </div>

      <div class="btn-row">
        <button class="btn btn-primary" data-action="simulate-outcome" ${selectedCompany ? "" : "disabled"}>
          Run Outcome Simulation
        </button>
      </div>

      ${state.outcome ? renderOutcomeCard(selectedCompany) : '<p class="note">Select one company to unlock the simulation.</p>'}

      ${
        state.outcome
          ? `
        <div class="btn-row">
          <button class="btn btn-trust" data-action="next-stage" data-next="4">Continue to Resolution</button>
        </div>
      `
          : ""
      }
    </div>
  `;
}

function renderOutcomeCard(selectedCompany) {
  const positive = state.outcome.good;
  const headline = positive ? "GOOD OUTCOME" : "POTENTIAL RISK";
  const bulletPoints = positive
    ? ["Work completed professionally", "Warranty terms honored", "Customer feels satisfied"]
    : ["Scope disputes create stress", "Work quality concerns appear", "Warranty support is unclear"];

  const assessment = state.outcome.assessment;
  const signals = state.outcome.signals;

  const nuance = selectedCompany.bbb
    ? "BBB trust signals can support confidence and accountability during the selection process."
    : "Consumers may want additional verification when trust signals are missing.";

  return `
    <article class="outcome-card ${positive ? "good" : "risk"}">
      <p class="outcome-label">${positive ? "✅" : "⚠️"} ${headline}</p>
      <ul class="signal-list compact">
        ${bulletPoints.map((point) => `<li>${point}</li>`).join("")}
      </ul>

      <div class="confidence-summary ${assessment.tone}">
        <p class="confidence-line"><strong>Confidence Level:</strong> ${assessment.label}</p>
        <p class="confidence-line"><strong>Risk Indicator:</strong> ${assessment.riskLabel}</p>
      </div>

      <div class="signal-columns">
        <div class="signal-column">
          <p class="column-title">Trust signals present</p>
          <ul class="signal-list compact">
            ${signals.present.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </div>
        <div class="signal-column">
          <p class="column-title">Signals missing</p>
          <ul class="signal-list compact">
            ${signals.missing.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </div>
      </div>

      <p class="microcopy">${nuance}</p>
      <p class="microcopy">These signals can help consumers feel more confident, though outcomes vary.</p>
      <p class="simulation-note">This simulation illustrates how consumers evaluate trust signals. Actual outcomes vary.</p>
    </article>
  `;
}

function renderStageResolution() {
  const selectedCompany = getSelectedCompany();
  const highlightsAccountability = Boolean(selectedCompany && selectedCompany.bbb);
  const selectionText = selectedCompany
    ? `${selectedCompany.name} ${selectedCompany.bbb ? "is" : "is not"} BBB Accredited.`
    : "Selection unavailable.";

  return `
    <div class="stage-view">
      <h2 class="stage-title">Stage 5: Problem Resolution</h2>
      <p class="section-lede">${selectionText} Here is how accountability paths can differ during disputes.</p>

      <div class="path-grid">
        <article class="path-card risk ${highlightsAccountability ? "" : "highlight"}">
          <h3>Without BBB</h3>
          <ul class="signal-list compact">
            <li>Customer leaves an angry review</li>
            <li>No structured resolution channel</li>
            <li>Frustration continues</li>
          </ul>
        </article>

        <article class="path-card trust ${highlightsAccountability ? "highlight" : ""}">
          <h3>With BBB</h3>
          <ul class="signal-list compact">
            <li>Complaint can be filed</li>
            <li>Business is prompted to respond</li>
            <li>Resolution steps are documented</li>
          </ul>
        </article>
      </div>

      <div class="mediation-flow">
        <div class="flow-step">1. Consumer files complaint</div>
        <div class="flow-step">2. BBB notifies business</div>
        <div class="flow-step">3. Response and documentation</div>
        <div class="flow-step">4. Accountability trail remains visible</div>
      </div>

      <p class="note">
        BBB mediation supports communication and accountability. Outcomes can vary by case.
      </p>

      <div class="btn-row">
        <button class="btn btn-primary" data-action="next-stage" data-next="5">View Final Screen</button>
      </div>
    </div>
  `;
}

function renderStageFinal() {
  return `
    <div class="stage-view">
      <h2 class="stage-title">Final Screen</h2>

      <p class="quote">
        <strong>Consumers are not just buying roofing.<br>They are buying confidence.</strong>
      </p>

      <div class="summary-flow">
        <article class="flow-node">
          <p class="flow-title">1. Consumer Problem</p>
          <p class="flow-sub">Leak appears after storm.</p>
        </article>
        <article class="flow-node">
          <p class="flow-title">2. Search</p>
          <p class="flow-sub">Google, social, referrals, ads.</p>
        </article>
        <article class="flow-node bbb-role">
          <p class="flow-title">3. Trust Signals</p>
          <p class="flow-sub">BBB supports informed decisions through accountability data.</p>
        </article>
        <article class="flow-node bbb-role">
          <p class="flow-title">4. Hire Decision</p>
          <p class="flow-sub">Trust signals can reduce uncertainty before hiring.</p>
        </article>
        <article class="flow-node bbb-role">
          <p class="flow-title">5. Accountability</p>
          <p class="flow-sub">Complaint channels can support resolution.</p>
        </article>
      </div>

      <p class="callout">
        BBB helps ethical businesses stand out and helps consumers hire with confidence.
      </p>

      <div class="btn-row">
        <button class="btn btn-secondary" data-action="restart-journey">Run Again</button>
      </div>
    </div>
  `;
}

function renderHumor() {
  let body = '<div class="shady-output empty">No suspicious contractor generated yet.</div>';

  if (state.shadyProfile && !state.shadyAccredited) {
    body = `
      <div class="shady-output">
        <p class="shady-name">Company Name: ${state.shadyProfile.name}</p>
        <p class="status risk">Trust Signals: Proceed with caution.</p>
        <div class="chip-row">
          ${state.shadyProfile.shadySignals.map((signal) => `<span class="chip shady">${signal}</span>`).join("")}
        </div>
      </div>
    `;
  }

  if (state.shadyProfile && state.shadyAccredited) {
    body = `
      <div class="shady-output">
        <p class="shady-name">Company Name: ${state.shadyProfile.name}</p>
        <p class="status trust">Transparency Mode: Enabled.</p>
        <div class="chip-row">
          ${state.shadyProfile.cleanSignals.map((signal) => `<span class="chip clean">${signal}</span>`).join("")}
        </div>
      </div>
    `;
  }

  humorEl.innerHTML = `
    <h3>Optional Humor Feature</h3>
    <p class="humor-intro">Because every storm seems to attract one questionable roofing ad.</p>
    <div class="btn-row">
      <button class="btn btn-secondary" data-action="generate-shady">Generate Shady Roofer</button>
      <button class="btn btn-trust" data-action="accredit-shady" ${state.shadyProfile ? "" : "disabled"}>Add BBB Accreditation</button>
    </div>
    ${body}
  `;
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pickMany(list, count) {
  const copy = [...list];
  const picked = [];
  while (picked.length < count && copy.length) {
    const index = Math.floor(Math.random() * copy.length);
    picked.push(copy.splice(index, 1)[0]);
  }
  return picked;
}

function generateShadyProfile() {
  const first = ["UltraFast", "Turbo", "StormChaser", "Flash", "Skyline", "RoofRocket", "ZeroDelay", "Quantum"];
  const second = ["Roofing & Crypto", "Storm Solutions", "Roof Pros", "Tar Wizards", "Shingle Syndicate", "Roof Group"];
  const shadySignals = [
    "Fake reviews",
    "PO Box address",
    "Three dissolved LLCs",
    "No license number on invoices",
    "Changes phone number every season",
    "Mysterious cash-only discount"
  ];

  state.shadyProfile = {
    name: `${randomFrom(first)} ${randomFrom(second)}`,
    shadySignals: pickMany(shadySignals, 3),
    cleanSignals: [
      "BBB Accredited business profile",
      "Verified business license",
      "Complaint responses documented"
    ]
  };
  state.shadyAccredited = false;
}

function simulateOutcome() {
  const selectedCompany = getSelectedCompany();
  if (!selectedCompany) return;

  const signals = getSignalSnapshot(selectedCompany);
  const assessment = getConfidenceAssessment(selectedCompany, signals);

  const outcomePool = {
    HIGH: [true, true, true, false],
    MEDIUM: [true, true, false, false],
    LOW: [true, false, false, false]
  };

  const pool = outcomePool[assessment.label];
  const good = pool[Math.floor(Math.random() * pool.length)];
  state.outcome = { good, signals, assessment };
}

function restartJourney() {
  state.currentStage = 0;
  state.maxUnlocked = 0;
  state.trustSignalsRevealed = false;
  state.selectedCompanyId = null;
  state.outcome = null;
}

function handleAction(event) {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;
  if (trigger.disabled) return;

  const action = trigger.dataset.action;
  if (action === "go-stage") {
    const stage = Number(trigger.dataset.stage);
    if (stage <= state.maxUnlocked) {
      state.currentStage = stage;
      render();
    }
    return;
  }

  if (action === "next-stage") {
    const next = Number(trigger.dataset.next);
    if (Number.isInteger(next)) {
      unlockAndGo(next);
    }
    return;
  }

  if (action === "toggle-trust-signals") {
    state.trustSignalsRevealed = !state.trustSignalsRevealed;
    render();
    return;
  }

  if (action === "select-company") {
    state.selectedCompanyId = trigger.dataset.companyId;
    state.outcome = null;
    render();
    return;
  }

  if (action === "simulate-outcome") {
    simulateOutcome();
    render();
    return;
  }

  if (action === "restart-journey") {
    restartJourney();
    render();
    return;
  }

  if (action === "generate-shady") {
    generateShadyProfile();
    renderHumor();
    return;
  }

  if (action === "accredit-shady" && state.shadyProfile) {
    state.shadyAccredited = true;
    renderHumor();
  }
}

function render() {
  renderTracker();
  renderStage();
  renderHumor();
}

document.addEventListener("click", handleAction);
render();
