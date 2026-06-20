/**
 * ValveBuilderMP.jsx
 * 
 * Orchestrator for the ECO80 valve configurator.
 * 
 * PHASE 1 — Quick Config
 *   Three foundational questions rendered simultaneously in a panel:
 *   1. Load Sense required?          → determines EVP type + spool path
 *   2. Number of work sections (EVB) → 1–12, determines model + tie rod kit
 *   3. Max flow rate entering valve  → filters valid spool LPM options
 *
 *   When all three are answered → saves to baseConfig state → transitions to Phase 2.
 *
 * PHASE 2 — Detail Config
 *   Split layout:
 *   Left  → <ThreeDView /> receives baseConfig and renders the correct 3D model
 *   Right → section-by-section configurator panels (EVP, EVB × N, EVO)
 *
 * State shape:
 *   baseConfig: {
 *     loadSense: 'yes' | 'no' | null,
 *     numSections: number | null,          // 1–12
 *     maxFlowRate: number | null,          // LPM — filters spool options
 *     path: 'standard' | 'load_sense' | null
 *   }
 *
 *   detailConfig: {
 *     evp: {},
 *     sections: [ { id, spool, actuation, pvlp, pvla }, ... ],
 *     evo: {}
 *   }
 */

import { useState, useMemo } from "react";

// ─── Flow rate options that map to available spool LPMs ──────────────────────
const FLOW_OPTIONS = [
  { value: 8,   label: "≤ 8 LPM",   spools: [8] },
  { value: 25,  label: "≤ 25 LPM",  spools: [8, 25] },
  { value: 40,  label: "≤ 40 LPM",  spools: [8, 25, 40] },
  { value: 60,  label: "≤ 60 LPM",  spools: [8, 25, 40, 60] },
  { value: 80,  label: "≤ 80 LPM",  spools: [8, 25, 40, 60, 80] },
  { value: 100, label: "≤ 100 LPM", spools: [8, 25, 40, 60, 80, 100] },
];

// ─── Section count chips ──────────────────────────────────────────────────────
const SECTION_COUNTS = Array.from({ length: 12 }, (_, i) => i + 1);

// ─── Tiny UI primitives ───────────────────────────────────────────────────────

function QuestionLabel({ number, text, hint }) {
  return (
    <div className="vb-question-label">
      <span className="vb-q-number">{number}</span>
      <div>
        <p className="vb-q-text">{text}</p>
        {hint && <p className="vb-q-hint">{hint}</p>}
      </div>
    </div>
  );
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div className="vb-toggle-group">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`vb-toggle-btn${value === opt.value ? " active" : ""}`}
          onClick={() => onChange(opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SectionChips({ value, onChange }) {
  return (
    <div className="vb-chips">
      {SECTION_COUNTS.map((n) => (
        <button
          key={n}
          className={`vb-chip${value === n ? " active" : ""}`}
          onClick={() => onChange(n)}
          type="button"
        >
          {n}
        </button>
      ))}
    </div>
  );
}

// ─── PHASE 1 — Quick Config Panel ────────────────────────────────────────────

function Phase1Panel({ onComplete }) {
  const [loadSense, setLoadSense]   = useState(null);
  const [numSections, setNumSections] = useState(null);
  const [maxFlow, setMaxFlow]       = useState(null);

  const allAnswered = loadSense !== null && numSections !== null && maxFlow !== null;

  function handleContinue() {
    if (!allAnswered) return;
    onComplete({
      loadSense,
      numSections,
      maxFlowRate: maxFlow,
      path: loadSense === "yes" ? "load_sense" : "standard",
    });
  }

  return (
    <div className="vb-phase1-wrapper">
      <div className="vb-phase1-header">
        <p className="vb-eyebrow">ECO 80 · Valve Configurator</p>
        <h1 className="vb-title">Build your valve</h1>
        <p className="vb-subtitle">
          Answer three questions to set the architecture. You'll configure each
          section in detail on the next step.
        </p>
      </div>

      <div className="vb-panel">

        {/* Q1 — Load Sense */}
        <div className="vb-question">
          <QuestionLabel
            number="01"
            text="Does your system require Load Sense?"
            hint="Load Sense uses a variable-displacement pump with Closed Center EVP. Without it, a fixed-displacement pump with Open Center EVP is used."
          />
          <ToggleGroup
            options={[
              { value: "no",  label: "No — Fixed pump / Open Center" },
              { value: "yes", label: "Yes — Variable pump / Closed Center" },
            ]}
            value={loadSense}
            onChange={setLoadSense}
          />
          {loadSense && (
            <div className="vb-answer-badge">
              {loadSense === "yes"
                ? "→ Closed Center EVP · LS path"
                : "→ Open Center EVP · Standard path"}
            </div>
          )}
        </div>

        <div className="vb-divider" />

        {/* Q2 — Number of sections */}
        <div className="vb-question">
          <QuestionLabel
            number="02"
            text="How many work sections do you need?"
            hint="Each section is one directional control circuit (EVB). Max 12 sections."
          />
          <SectionChips value={numSections} onChange={setNumSections} />
          {numSections && (
            <div className="vb-answer-badge">
              → {numSections} section{numSections > 1 ? "s" : ""} · tie rod kit EVAS_{numSections}
            </div>
          )}
        </div>

        <div className="vb-divider" />

        {/* Q3 — Max flow rate */}
        <div className="vb-question">
          <QuestionLabel
            number="03"
            text="What is the max flow rate entering the valve?"
            hint="This filters the available spool flow ratings for every section. Select the highest flow your pump will deliver."
          />
          <ToggleGroup
            options={FLOW_OPTIONS.map((f) => ({ value: f.value, label: f.label }))}
            value={maxFlow}
            onChange={setMaxFlow}
          />
          {maxFlow && (
            <div className="vb-answer-badge">
              → Spools available up to {maxFlow} LPM
            </div>
          )}
        </div>

        <div className="vb-panel-footer">
          <button
            className={`vb-cta${allAnswered ? " ready" : ""}`}
            onClick={handleContinue}
            disabled={!allAnswered}
            type="button"
          >
            {allAnswered
              ? `Configure ${numSections} section${numSections > 1 ? "s" : ""} →`
              : "Answer all three questions to continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PHASE 2 — Detail Config Layout (scaffold) ───────────────────────────────

function Phase2Layout({ baseConfig, onReset }) {
  /**
   * detailConfig holds the per-section state.
   * Each section starts empty and gets filled as the user configures it.
   * Shape: { evp: {}, sections: Array(numSections).fill({}), evo: {} }
   */
  const [detailConfig, setDetailConfig] = useState(() => ({
    evp: {},
    sections: Array.from({ length: baseConfig.numSections }, (_, i) => ({
      id: i + 1,
      spool: null,
      actuation: null,
      pvlp: null,
      pvla: false,
    })),
    evo: {},
  }));

  const [activeSection, setActiveSection] = useState(0); // 0 = EVP, 1–N = section N, N+1 = EVO

  function updateSection(index, patch) {
    setDetailConfig((prev) => {
      const sections = [...prev.sections];
      sections[index] = { ...sections[index], ...patch };
      return { ...prev, sections };
    });
  }

  const totalSteps = 1 + baseConfig.numSections + 1; // EVP + sections + EVO

  return (
    <div className="vb-phase2-wrapper">

      {/* Top bar */}
      <div className="vb-topbar">
        <div className="vb-topbar-left">
          <span className="vb-eyebrow">ECO 80 · Valve Configurator</span>
          <span className="vb-config-summary">
            {baseConfig.loadSense === "yes" ? "Load Sense" : "Standard"} ·{" "}
            {baseConfig.numSections} section{baseConfig.numSections > 1 ? "s" : ""} ·{" "}
            ≤ {baseConfig.maxFlowRate} LPM
          </span>
        </div>
        <button className="vb-reset-btn" onClick={onReset} type="button">
          ← Start over
        </button>
      </div>

      {/* Split layout */}
      <div className="vb-split">

        {/* LEFT — 3D View placeholder (will be replaced by <ThreeDView /> ) */}
        <div className="vb-3d-pane">
          {/*
            <ThreeDView
              path={baseConfig.path}
              numSections={baseConfig.numSections}
              detailConfig={detailConfig}
              activeSection={activeSection}
            />
          */}
          <div className="vb-3d-placeholder">
            <div className="vb-3d-placeholder-inner">
              <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" width="64" height="64">
                <rect x="10" y="28" width="60" height="30" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="18" y="20" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="34" y="20" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="50" y="20" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="4"  y="34" width="10" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="66" y="34" width="10" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              <p className="vb-3d-label">3D model loads here</p>
              <p className="vb-3d-sublabel">
                {baseConfig.path === "load_sense" ? "Closed Center" : "Open Center"} ·{" "}
                {baseConfig.numSections} section{baseConfig.numSections > 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT — Section configurator */}
        <div className="vb-config-pane">

          {/* Section nav */}
          <div className="vb-section-nav">
            <button
              className={`vb-snav-btn${activeSection === 0 ? " active" : ""}`}
              onClick={() => setActiveSection(0)}
              type="button"
            >
              EVP
            </button>
            {detailConfig.sections.map((s, i) => (
              <button
                key={s.id}
                className={`vb-snav-btn${activeSection === i + 1 ? " active" : ""}${s.spool ? " done" : ""}`}
                onClick={() => setActiveSection(i + 1)}
                type="button"
              >
                S{s.id}
              </button>
            ))}
            <button
              className={`vb-snav-btn${activeSection === totalSteps - 1 ? " active" : ""}`}
              onClick={() => setActiveSection(totalSteps - 1)}
              type="button"
            >
              EVO
            </button>
          </div>

          {/* Config panel content */}
          <div className="vb-config-content">
            {activeSection === 0 && (
              <EVPConfigPanel baseConfig={baseConfig} config={detailConfig.evp} />
            )}
            {activeSection > 0 && activeSection < totalSteps - 1 && (
              <SectionConfigPanel
                section={detailConfig.sections[activeSection - 1]}
                baseConfig={baseConfig}
                onChange={(patch) => updateSection(activeSection - 1, patch)}
              />
            )}
            {activeSection === totalSteps - 1 && (
              <EVOConfigPanel config={detailConfig.evo} />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Phase 2 sub-panels (scaffolds — to be expanded) ─────────────────────────

function EVPConfigPanel({ baseConfig }) {
  return (
    <div className="vb-subpanel">
      <h2 className="vb-subpanel-title">Pump Inlet Module — EVP</h2>
      <p className="vb-subpanel-desc">
        {baseConfig.path === "load_sense"
          ? "Closed Center EVP with PPRV for variable pump + Load Sense."
          : "Open Center EVP. PPRV required if solenoid actuators are used."}
      </p>
      <div className="vb-coming-soon">EVP detail options — coming next step</div>
    </div>
  );
}

function SectionConfigPanel({ section, baseConfig, onChange }) {
  return (
    <div className="vb-subpanel">
      <h2 className="vb-subpanel-title">Work Section {section.id} — EVB</h2>
      <p className="vb-subpanel-desc">
        Configure body type, spool, actuation, and optional shock valves for this section.
        Available spools filtered to ≤ {baseConfig.maxFlowRate} LPM.
      </p>
      <div className="vb-coming-soon">
        Section {section.id} detail options — coming next step
      </div>
    </div>
  );
}

function EVOConfigPanel() {
  return (
    <div className="vb-subpanel">
      <h2 className="vb-subpanel-title">End Plate — EVO</h2>
      <p className="vb-subpanel-desc">
        Select end plate type. LX port required for pneumatic or LS signal connection.
      </p>
      <div className="vb-coming-soon">EVO options — coming next step</div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function ValveBuilderMP() {
  const [phase, setPhase]           = useState(1);
  const [baseConfig, setBaseConfig] = useState(null);

  function handlePhase1Complete(config) {
    setBaseConfig(config);
    setPhase(2);
  }

  function handleReset() {
    setBaseConfig(null);
    setPhase(1);
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="vb-root">
        {phase === 1 && <Phase1Panel onComplete={handlePhase1Complete} />}
        {phase === 2 && baseConfig && (
          <Phase2Layout baseConfig={baseConfig} onReset={handleReset} />
        )}
      </div>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  /* ── Tokens ── */
  .vb-root {
    --vb-bg:         #ffffff;
    --vb-surface:    #181c27;
    --vb-border:     #ef7b1b;
    --vb-accent:     #e8002d;
    --vb-accent-dim: rgba(232,0,45,0.12);
    --vb-text:       #f0f2f5;
    --vb-muted:      #7a8499;
    --vb-done:       #22c55e;
    --vb-radius:     10px;
    --vb-radius-sm:  6px;
    font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
    background: var(--vb-bg);
    color: var(--vb-text);
    min-height: 100vh;
  }

  /* ── Phase 1 ── */
  .vb-phase1-wrapper {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
  }
  .vb-phase1-header {
    text-align: center;
    margin-bottom: 36px;
    max-width: 560px;
  }
  .vb-eyebrow {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--vb-accent);
    margin: 0 0 12px;
  }
  .vb-title {
    font-size: clamp(28px, 4vw, 40px);
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 12px;
  }
  .vb-subtitle {
    font-size: 15px;
    color: var(--vb-muted);
    line-height: 1.6;
    margin: 0;
  }
  .vb-panel {
    background: var(--vb-surface);
    border: 1px solid var(--vb-border);
    border-radius: var(--vb-radius);
    width: 100%;
    max-width: 640px;
    overflow: hidden;
  }
  .vb-question {
    padding: 28px 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .vb-question-label {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }
  .vb-q-number {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--vb-accent);
    padding-top: 2px;
    min-width: 24px;
  }
  .vb-q-text {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 4px;
    line-height: 1.4;
  }
  .vb-q-hint {
    font-size: 12px;
    color: var(--vb-muted);
    margin: 0;
    line-height: 1.5;
  }
  .vb-divider {
    height: 1px;
    background: var(--vb-border);
    margin: 0 32px;
  }
  .vb-toggle-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .vb-toggle-btn {
    padding: 8px 16px;
    border-radius: var(--vb-radius-sm);
    border: 1px solid var(--vb-border);
    background: transparent;
    color: var(--vb-muted);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .vb-toggle-btn:hover {
    border-color: rgba(255,255,255,0.2);
    color: var(--vb-text);
  }
  .vb-toggle-btn.active {
    background: var(--vb-accent-dim);
    border-color: var(--vb-accent);
    color: var(--vb-text);
  }
  .vb-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .vb-chip {
    width: 36px;
    height: 36px;
    border-radius: var(--vb-radius-sm);
    border: 1px solid var(--vb-border);
    background: transparent;
    color: var(--vb-muted);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .vb-chip:hover {
    border-color: rgba(255,255,255,0.2);
    color: var(--vb-text);
  }
  .vb-chip.active {
    background: var(--vb-accent-dim);
    border-color: var(--vb-accent);
    color: var(--vb-text);
  }
  .vb-answer-badge {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--vb-accent);
    padding: 4px 10px;
    background: var(--vb-accent-dim);
    border-radius: 4px;
    align-self: flex-start;
  }
  .vb-panel-footer {
    padding: 24px 32px;
    border-top: 1px solid var(--vb-border);
  }
  .vb-cta {
    width: 100%;
    padding: 14px;
    border-radius: var(--vb-radius-sm);
    border: none;
    background: var(--vb-border);
    color: var(--vb-muted);
    font-size: 14px;
    font-weight: 600;
    cursor: not-allowed;
    transition: all 0.2s;
  }
  .vb-cta.ready {
    background: var(--vb-accent);
    color: #fff;
    cursor: pointer;
  }
  .vb-cta.ready:hover {
    background: #ef7b1b;
  }

  /* ── Phase 2 ── */
  .vb-phase2-wrapper {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }
  .vb-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    border-bottom: 1px solid var(--vb-border);
    flex-shrink: 0;
    background: var(--vb-surface);
  }
  .vb-topbar-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .vb-config-summary {
    font-size: 12px;
    color: var(--vb-muted);
    padding: 4px 10px;
    border: 1px solid var(--vb-border);
    border-radius: 4px;
  }
  .vb-reset-btn {
    font-size: 12px;
    color: var(--vb-muted);
    background: none;
    border: 1px solid var(--vb-border);
    border-radius: var(--vb-radius-sm);
    padding: 6px 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .vb-reset-btn:hover {
    color: var(--vb-text);
    border-color: rgba(255,255,255,0.2);
  }
  .vb-split {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  .vb-3d-pane {
    flex: 0 0 55%;
    border-right: 1px solid var(--vb-border);
    background: #0c0e14;
    position: relative;
    overflow: hidden;
  }
  .vb-3d-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .vb-3d-placeholder-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: var(--vb-muted);
    opacity: 0.5;
  }
  .vb-3d-label {
    font-size: 13px;
    font-weight: 600;
    margin: 0;
  }
  .vb-3d-sublabel {
    font-size: 11px;
    margin: 0;
  }
  .vb-config-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .vb-section-nav {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--vb-border);
    flex-shrink: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .vb-section-nav::-webkit-scrollbar { display: none; }
  .vb-snav-btn {
    padding: 5px 12px;
    border-radius: var(--vb-radius-sm);
    border: 1px solid var(--vb-border);
    background: transparent;
    color: var(--vb-muted);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .vb-snav-btn:hover { color: var(--vb-text); border-color: rgba(255,255,255,0.2); }
  .vb-snav-btn.active {
    background: var(--vb-accent-dim);
    border-color: var(--vb-accent);
    color: var(--vb-text);
  }
  .vb-snav-btn.done:not(.active) {
    border-color: var(--vb-done);
    color: var(--vb-done);
  }
  .vb-config-content {
    flex: 1;
    overflow-y: auto;
    padding: 28px 28px;
  }
  .vb-subpanel-title {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 8px;
    letter-spacing: -0.01em;
  }
  .vb-subpanel-desc {
    font-size: 13px;
    color: var(--vb-muted);
    line-height: 1.6;
    margin: 0 0 24px;
  }
  .vb-coming-soon {
    padding: 20px;
    border: 1px dashed var(--vb-border);
    border-radius: var(--vb-radius);
    font-size: 13px;
    color: var(--vb-muted);
    text-align: center;
  }
`;