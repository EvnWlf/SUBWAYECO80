/**
 * ValveBuilderMP.jsx
 * Ruta: src/components/layout/ValveBuilderMP.jsx
 *
 * Orquestador principal del configurador ECO80.
 * Consume src/data/eco80Rules.json — ningún dato de negocio está hardcodeado aquí.
 *
 * ┌─────────────────────────────────────────────────────┐
 * │  FASE 1 — Quick Config                              │
 * │    3 preguntas fundacionales en un panel            │
 * │    → guarda baseConfig → pasa a Fase 2             │
 * ├─────────────────────────────────────────────────────┤
 * │  FASE 2 — Detail Config                             │
 * │    Split: ThreeDView (izq) | Configurador (der)     │
 * │    Nav: [EVP] [S1] [S2] … [SN] [EVO]               │
 * │    Cada panel lee y escribe detailConfig            │
 * └─────────────────────────────────────────────────────┘
 *
 * Para extender: agrega campos en detailConfig.sections[i]
 * y crea un nuevo sub-panel en SectionConfigPanel.
 */

import { useState, useMemo } from 'react'
import rules from '../../data/eco80Rules.json'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — toda la lógica de negocio lee del JSON, no tiene valores fijos
// ─────────────────────────────────────────────────────────────────────────────

/** Opciones de flow rate del JSON, ordenadas y convertidas a número */
const getFlowOptions = () =>
  rules.questions.Q_SPOOL_FLOW.options
    .map(o => ({ value: Number(o.value), label: `≤ ${o.value} LPM` }))
    .sort((a, b) => a.value - b.value)

/** Spools del JSON filtrados por tipo de actuación y flow máximo */
const getSpools = (actuationType, maxFlow) => {
  if (!actuationType || !maxFlow) return []
  return rules.components.EVBS.items.filter(
    s => s.actuation === actuationType && s.flow_lpm <= maxFlow
  )
}

/** Actuadores del JSON filtrados por tipo */
const getActuators = (type) =>
  rules.components.ACTUATORS.items.filter(a => a.type === type)

/** Kit de tirantes para N secciones */
const getTieRod = (n) =>
  rules.components.EVAS.items.find(k => k.num_evb === n)

/** EVP resuelto según path + opciones del usuario */
const resolveEVP = (path, hasSolenoid, hasEVPX) => {
  const map = rules.components.EVP.selection_logic
  let key
  if (path === 'load_sense') {
    key = hasSolenoid ? 'load_sense_solenoid' : 'load_sense_no_solenoid'
  } else {
    key = hasEVPX
      ? 'standard_solenoid_evpx'
      : hasSolenoid
        ? 'standard_solenoid_no_evpx'
        : 'standard_no_solenoid_no_evpx'
  }
  const id = map[key]
  return rules.components.EVP.items.find(e => e.id === id) ?? null
}

/**
 * Tipos de actuación disponibles — mapeados para mostrar en UI.
 * El valor corresponde al campo `actuation` en EVBS.items del JSON.
 */
const ACTUATION_TYPES = [
  { value: 'mechanical',          label: 'Mechanical' },
  { value: 'mechanical_detent',   label: 'Mechanical + Detent' },
  { value: 'mechanical_exposed',  label: 'Mechanical Exposed' },
  { value: 'eh_prop',             label: 'EH Proportional' },
  { value: 'eh_onoff',            label: 'EH ON/OFF' },
]

/** Tipos de actuación que requieren solenoide → afectan EVP */
const EH_TYPES = ['eh_prop', 'eh_onoff']

/** Tipos de actuación que soportan body electro-hidráulico */
const EH_BODY_TYPES = ['eh_prop', 'eh_onoff']

// ─────────────────────────────────────────────────────────────────────────────
// PALETA Y ESTILOS — tema Montserrat / blanco / naranja
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  orange:      '#ef7b1b',
  orangeLight: 'rgba(239,123,27,0.07)',
  orangeMid:   'rgba(239,123,27,0.20)',
  text:        '#1a1a1a',
  muted:       '#999',
  light:       '#bbb',
  border:      '#e8e8e8',
  bg:          '#fff',
  bgGray:      '#f7f7f7',
  green:       '#22c55e',
  greenLight:  'rgba(34,197,94,0.08)',
  font:        "'Montserrat', sans-serif",
}

// Función helper para crear estilos de botón toggle reutilizables
const toggleStyle = (active, done = false) => ({
  fontFamily:      C.font,
  fontSize:        11,
  fontWeight:      600,
  letterSpacing:   1.5,
  textTransform:   'uppercase',
  cursor:          'pointer',
  borderRadius:    2,
  transition:      'all 0.15s',
  padding:         '8px 16px',
  border:          `1px solid ${active ? C.orange : done ? C.green : C.border}`,
  background:      active ? C.orangeLight : done ? C.greenLight : C.bg,
  color:           active ? C.orange : done ? C.green : C.muted,
})

const S = {
  // ── Raíz ──
  root: {
    minHeight:   '100vh',
    background:  C.bg,
    fontFamily:  C.font,
    color:       C.text,
  },

  // ── Tipografía compartida ──
  eyebrow: {
    fontSize:       10,
    fontWeight:     600,
    letterSpacing:  4,
    textTransform:  'uppercase',
    color:          C.orange,
    margin:         0,
  },
  sectionTitle: {
    fontSize:      14,
    fontWeight:    700,
    letterSpacing: 0.5,
    margin:        '0 0 6px',
  },
  sectionDesc: {
    fontSize:    11,
    color:       C.muted,
    lineHeight:  1.7,
    margin:      '0 0 24px',
    fontWeight:  400,
    letterSpacing: 0.3,
  },
  fieldLabel: {
    fontSize:      10,
    fontWeight:    700,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color:         C.muted,
    margin:        '0 0 10px',
    display:       'block',
  },
  fieldGroup: {
    marginBottom: 28,
  },

  // ── Panel card ──
  card: {
    border:        `1px solid ${C.border}`,
    borderRadius:  2,
    background:    C.bg,
    marginBottom:  16,
    overflow:      'hidden',
  },
  cardHeader: {
    padding:        '14px 20px',
    borderBottom:   `1px solid ${C.border}`,
    background:     C.bgGray,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  cardHeaderTitle: {
    fontSize:      11,
    fontWeight:    700,
    letterSpacing: 2,
    textTransform: 'uppercase',
    margin:        0,
    color:         C.text,
  },
  cardBody: {
    padding: '20px',
  },

  // ── Pill de part number ──
  pill: {
    display:       'inline-flex',
    alignItems:    'center',
    gap:           6,
    fontSize:      10,
    fontWeight:    700,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color:         C.orange,
    padding:       '4px 10px',
    background:    C.orangeLight,
    border:        `1px solid ${C.orangeMid}`,
    borderRadius:  2,
  },

  // ── Badge de respuesta ──
  badge: {
    display:       'inline-flex',
    alignItems:    'center',
    fontSize:      10,
    fontWeight:    700,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color:         C.orange,
    padding:       '4px 10px',
    background:    C.orangeLight,
    border:        `1px solid ${C.orangeMid}`,
    borderRadius:  2,
    alignSelf:     'flex-start',
    marginTop:     4,
  },

  // ── Toggle group horizontal ──
  toggleRow: {
    display:   'flex',
    flexWrap:  'wrap',
    gap:       8,
  },

  // ── Chips numéricos ──
  chipsRow: {
    display:  'flex',
    flexWrap: 'wrap',
    gap:      6,
  },
  chip: (active) => ({
    width:          38,
    height:         38,
    borderRadius:   2,
    border:         `1px solid ${active ? C.orange : C.border}`,
    background:     active ? C.orangeLight : C.bg,
    color:          active ? C.orange : C.muted,
    fontSize:       12,
    fontWeight:     700,
    cursor:         'pointer',
    transition:     'all 0.15s',
    fontFamily:     C.font,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
  }),

  // ── Divider ──
  divider: {
    height:     1,
    background: C.border,
    margin:     '0 32px',
  },

  // ── CTA principal ──
  cta: (ready) => ({
    width:         '100%',
    padding:       '13px',
    borderRadius:  2,
    border:        `1px solid ${ready ? C.orange : C.border}`,
    background:    ready ? C.orange : C.bg,
    color:         ready ? '#fff' : C.light,
    fontSize:      11,
    fontWeight:    600,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    cursor:        ready ? 'pointer' : 'not-allowed',
    transition:    'all 0.2s',
    fontFamily:    C.font,
  }),

  // ── FASE 1 ──
  phase1Wrap: {
    minHeight:      '100vh',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '48px 24px',
  },
  phase1Header: {
    textAlign:    'center',
    marginBottom: 36,
    maxWidth:     560,
  },
  phase1Title: {
    fontSize:      'clamp(26px, 4vw, 38px)',
    fontWeight:    700,
    letterSpacing: -1,
    margin:        '0 0 12px',
    lineHeight:    1.1,
  },
  phase1Sub: {
    fontSize:      13,
    color:         C.muted,
    lineHeight:    1.7,
    margin:        0,
    fontWeight:    400,
    letterSpacing: 0.3,
  },
  phase1Panel: {
    width:     '100%',
    maxWidth:  660,
    border:    `1px solid ${C.border}`,
    borderRadius: 2,
    background: C.bg,
  },
  questionBlock: {
    padding:       '28px 32px',
    display:       'flex',
    flexDirection: 'column',
    gap:           18,
  },
  questionLabelRow: {
    display:     'flex',
    gap:         16,
    alignItems:  'flex-start',
  },
  qNum: {
    fontSize:      10,
    fontWeight:    700,
    letterSpacing: 3,
    color:         C.orange,
    paddingTop:    2,
    minWidth:      24,
    textTransform: 'uppercase',
  },
  qText: {
    fontSize:      13,
    fontWeight:    600,
    margin:        '0 0 4px',
    letterSpacing: 0.3,
    lineHeight:    1.4,
  },
  qHint: {
    fontSize:      11,
    color:         C.muted,
    margin:        0,
    lineHeight:    1.6,
    letterSpacing: 0.2,
    fontWeight:    400,
  },
  panelFooter: {
    padding:    '22px 32px',
    borderTop:  `1px solid ${C.border}`,
  },

  // ── FASE 2 ──
  phase2Wrap: {
    display:       'flex',
    flexDirection: 'column',
    height:        '100vh',
    overflow:      'hidden',
  },
  topbar: {
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'space-between',
    padding:         '12px 28px',
    borderBottom:    `1px solid ${C.border}`,
    flexShrink:      0,
    background:      C.bg,
  },
  topbarLeft: {
    display:    'flex',
    alignItems: 'center',
    gap:        20,
  },
  summaryTag: {
    fontSize:      10,
    fontWeight:    600,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color:         C.muted,
    padding:       '4px 12px',
    border:        `1px solid ${C.border}`,
    borderRadius:  2,
  },
  resetBtn: {
    fontSize:      10,
    fontWeight:    600,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color:         C.muted,
    background:    C.bg,
    border:        `1px solid ${C.border}`,
    borderRadius:  2,
    padding:       '7px 14px',
    cursor:        'pointer',
    fontFamily:    C.font,
  },
  split: {
    display:  'flex',
    flex:     1,
    overflow: 'hidden',
  },
  pane3D: {
    flex:       '0 0 52%',
    borderRight: `1px solid ${C.border}`,
    background:  C.bgGray,
    position:    'relative',
    overflow:    'hidden',
  },
  placeholder3D: {
    position:       'absolute',
    inset:          0,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            14,
    color:          C.light,
  },
  p3DLabel: {
    fontSize:      10,
    fontWeight:    700,
    letterSpacing: 3,
    textTransform: 'uppercase',
    margin:        0,
    color:         C.light,
  },
  p3DSub: {
    fontSize:  10,
    margin:    0,
    color:     C.border,
    letterSpacing: 1,
  },
  configPane: {
    flex:          1,
    display:       'flex',
    flexDirection: 'column',
    overflow:      'hidden',
    background:    C.bg,
  },
  sectionNav: {
    display:      'flex',
    alignItems:   'center',
    gap:          4,
    padding:      '12px 20px',
    borderBottom: `1px solid ${C.border}`,
    flexShrink:   0,
    overflowX:    'auto',
  },
  configScroll: {
    flex:       1,
    overflowY:  'auto',
    padding:    '28px',
  },

  // ── Selección de opciones en grid ──
  optionGrid: {
    display:             'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap:                 8,
    marginBottom:        0,
  },
  optionCard: (active) => ({
    padding:    '12px 14px',
    border:     `1px solid ${active ? C.orange : C.border}`,
    background: active ? C.orangeLight : C.bg,
    borderRadius: 2,
    cursor:     'pointer',
    transition: 'all 0.15s',
  }),
  optionCardLabel: (active) => ({
    fontSize:      11,
    fontWeight:    600,
    letterSpacing: 0.5,
    color:         active ? C.orange : C.text,
    margin:        '0 0 4px',
    display:       'block',
  }),
  optionCardPN: {
    fontSize:      10,
    color:         C.muted,
    letterSpacing: 1,
    fontWeight:    500,
  },

  // ── Info box informativo ──
  infoBox: {
    padding:      '12px 16px',
    background:   C.bgGray,
    border:       `1px solid ${C.border}`,
    borderRadius: 2,
    fontSize:     11,
    color:        C.muted,
    lineHeight:   1.7,
    letterSpacing: 0.2,
    marginBottom: 20,
  },

  // ── BOM summary al fondo ──
  bomRow: {
    display:         'flex',
    justifyContent:  'space-between',
    alignItems:      'center',
    padding:         '10px 0',
    borderBottom:    `1px solid ${C.border}`,
    fontSize:        11,
    letterSpacing:   0.3,
  },
  bomLabel: { color: C.muted, fontWeight: 500 },
  bomPN:    { fontWeight: 700, color: C.text, letterSpacing: 1 },
}

// ─────────────────────────────────────────────────────────────────────────────
// UI ATOMS — componentes pequeños reutilizables
// ─────────────────────────────────────────────────────────────────────────────

/** Etiqueta de campo con número y texto */
function QLabel({ number, text, hint }) {
  return (
    <div style={S.questionLabelRow}>
      <span style={S.qNum}>{number}</span>
      <div>
        <p style={S.qText}>{text}</p>
        {hint && <p style={S.qHint}>{hint}</p>}
      </div>
    </div>
  )
}

/** Botones toggle en fila (selección única) */
function ToggleRow({ options, value, onChange }) {
  return (
    <div style={S.toggleRow}>
      {options.map(opt => (
        <button
          key={opt.value}
          style={toggleStyle(value === opt.value)}
          onClick={() => onChange(opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/** Chips numéricos 1..max */
function NumberChips({ value, onChange, max }) {
  return (
    <div style={S.chipsRow}>
      {Array.from({ length: max }, (_, i) => i + 1).map(n => (
        <button
          key={n}
          style={S.chip(value === n)}
          onClick={() => onChange(n)}
          type="button"
        >
          {n}
        </button>
      ))}
    </div>
  )
}

/** Badge naranja de confirmación */
function Badge({ children }) {
  return <div style={S.badge}>{children}</div>
}

/** Pill de part number */
function PNPill({ pn, label }) {
  return (
    <span style={S.pill}>
      PN {pn}{label ? ` — ${label}` : ''}
    </span>
  )
}

/** Cabecera de sección colapsable con título */
function CardSection({ title, children, action }) {
  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <p style={S.cardHeaderTitle}>{title}</p>
        {action}
      </div>
      <div style={S.cardBody}>{children}</div>
    </div>
  )
}

/** Etiqueta de campo */
function FieldLabel({ children }) {
  return <span style={S.fieldLabel}>{children}</span>
}

/** Grid de opciones seleccionables (spools, actuadores, etc.) */
function OptionGrid({ options, value, onChange, renderSub }) {
  return (
    <div style={S.optionGrid}>
      {options.map(opt => {
        const active = value === opt.id
        return (
          <div
            key={opt.id}
            style={S.optionCard(active)}
            onClick={() => onChange(active ? null : opt.id)}
          >
            <span style={S.optionCardLabel(active)}>{opt.label}</span>
            <span style={S.optionCardPN}>PN {opt.pn}</span>
            {renderSub && <div style={{ marginTop: 6 }}>{renderSub(opt)}</div>}
          </div>
        )
      })}
    </div>
  )
}

/** Box informativo gris */
function InfoBox({ children }) {
  return <div style={S.infoBox}>{children}</div>
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 1 — Panel de 3 preguntas fundacionales
// ─────────────────────────────────────────────────────────────────────────────

function Phase1Panel({ onComplete }) {
  const [loadSense,   setLoadSense]   = useState(null)   // 'yes' | 'no'
  const [numSections, setNumSections] = useState(null)   // 1–12
  const [maxFlow,     setMaxFlow]     = useState(null)   // LPM (número)

  // Opciones leídas del JSON
  const lsOptions   = rules.questions.Q_LS.options
  const flowOptions = useMemo(() => getFlowOptions(), [])
  const maxSections = rules._meta.maxSections
  const tieRod      = numSections ? getTieRod(numSections) : null

  const allAnswered = loadSense !== null && numSections !== null && maxFlow !== null

  function handleContinue() {
    if (!allAnswered) return
    onComplete({
      loadSense,
      numSections,
      maxFlowRate: maxFlow,
      path: loadSense === 'yes' ? 'load_sense' : 'standard',
    })
  }

  return (
    <div style={S.phase1Wrap}>

      {/* Encabezado */}
      <div style={S.phase1Header}>
        <p style={{ ...S.eyebrow, marginBottom: 14 }}>{rules._meta.product}</p>
        <h1 style={S.phase1Title}>Build your valve</h1>
        <p style={S.phase1Sub}>
          Three questions define the valve architecture.
          You'll configure each section in detail on the next step.
        </p>
      </div>

      {/* Panel de preguntas */}
      <div style={S.phase1Panel}>

        {/* Q1 — Load Sense */}
        <div style={S.questionBlock}>
          <QLabel
            number="01"
            text={rules.questions.Q_LS.label}
            hint="Load Sense = variable pump + Closed Center EVP. Without it = fixed pump + Open Center EVP."
          />
          <ToggleRow options={lsOptions} value={loadSense} onChange={setLoadSense} />
          {loadSense && (
            <Badge>
              {loadSense === 'yes' ? '→ Closed Center · LS path' : '→ Open Center · Standard path'}
            </Badge>
          )}
        </div>

        <div style={S.divider} />

        {/* Q2 — Número de secciones */}
        <div style={S.questionBlock}>
          <QLabel
            number="02"
            text={rules.questions.Q_NUM_SECTIONS.label}
            hint={`Each section = one directional circuit (EVB). Max ${maxSections} sections.`}
          />
          <NumberChips value={numSections} onChange={setNumSections} max={maxSections} />
          {numSections && tieRod && (
            <Badge>
              → {numSections} section{numSections > 1 ? 's' : ''} · Tie rod PN {tieRod.pn}
            </Badge>
          )}
        </div>

        <div style={S.divider} />

        {/* Q3 — Max flow rate */}
        <div style={S.questionBlock}>
          <QLabel
            number="03"
            text="What is the max flow rate entering the valve?"
            hint="Filters available spool ratings for all sections. Select the highest flow your pump delivers."
          />
          <ToggleRow options={flowOptions} value={maxFlow} onChange={setMaxFlow} />
          {maxFlow && (
            <Badge>→ Spools available up to {maxFlow} LPM</Badge>
          )}
        </div>

        {/* Footer CTA */}
        <div style={S.panelFooter}>
          <button
            style={S.cta(allAnswered)}
            onClick={handleContinue}
            disabled={!allAnswered}
            type="button"
          >
            {allAnswered
              ? `Configure ${numSections} section${numSections > 1 ? 's' : ''} →`
              : 'Answer all three questions to continue'}
          </button>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2 — Sub-panel: EVP (Pump Inlet Module)
// ─────────────────────────────────────────────────────────────────────────────

function EVPPanel({ baseConfig, config, onChange }) {
  /**
   * config shape:
   *   hasSolenoid: bool   — ¿alguna sección usa EH? (viene de secciones, se puede propagar)
   *   hasEVPX:     bool   — ¿descarga eléctrica de bomba?
   *   evpxVoltage: '12v' | '24v' | null
   *
   * El EVP se resuelve automáticamente. El usuario solo elige opciones adicionales.
   */
  const hasSolenoid  = config.hasSolenoid  ?? false
  const hasEVPX      = config.hasEVPX      ?? false
  const evpxVoltage  = config.evpxVoltage  ?? null

  const evp = resolveEVP(baseConfig.path, hasSolenoid, hasEVPX)

  // EVPX solo disponible en path standard (Open Center)
  const evpxAvailable = baseConfig.path === 'standard'

  // Opciones de voltage EVPX del JSON
  const evpxItems = rules.components.EVPX.items

  // Opciones de solenoid (del JSON Q_SOLENOID)
  const solenoidQ = rules.questions.Q_SOLENOID

  return (
    <div>
      <h2 style={S.sectionTitle}>Pump Inlet Module — EVP</h2>
      <p style={S.sectionDesc}>
        {baseConfig.path === 'load_sense'
          ? 'Closed Center EVP for variable-displacement pump with Load Sense.'
          : 'Open Center EVP for fixed-displacement pump.'}
        {' '}PPRV is required when any solenoid actuator is used.
      </p>

      {/* EVP resuelto automáticamente */}
      {evp && (
        <CardSection title="Resolved EVP Module">
          <div style={S.bomRow}>
            <span style={S.bomLabel}>Part Number</span>
            <PNPill pn={evp.pn} />
          </div>
          <div style={S.bomRow}>
            <span style={S.bomLabel}>Description</span>
            <span style={{ ...S.bomPN, fontWeight: 500, fontSize: 11 }}>{evp.label}</span>
          </div>
          <div style={S.bomRow}>
            <span style={S.bomLabel}>Pump type</span>
            <span style={S.bomPN}>{evp.pump === 'fixed' ? 'Fixed displacement' : 'Variable displacement'}</span>
          </div>
          <div style={{ ...S.bomRow, borderBottom: 'none' }}>
            <span style={S.bomLabel}>PPRV included</span>
            <span style={{ ...S.bomPN, color: evp.pprv ? C.green : C.muted }}>
              {evp.pprv ? 'Yes' : 'No'}
            </span>
          </div>
        </CardSection>
      )}

      {/* ¿Solenoides en el sistema? */}
      <CardSection title="Solenoid Actuation">
        <FieldLabel>{solenoidQ.label}</FieldLabel>
        <InfoBox>{solenoidQ.hint}</InfoBox>
        <ToggleRow
          options={[
            { value: false, label: 'No – Mechanical only' },
            { value: true,  label: 'Yes – Solenoid required' },
          ]}
          value={hasSolenoid}
          onChange={v => onChange({ hasSolenoid: v })}
        />
      </CardSection>

      {/* EVPX — solo en path standard */}
      {evpxAvailable && (
        <CardSection title="Electric Pump Unloading (EVPX)">
          <FieldLabel>{rules.questions.Q_EVPX.label}</FieldLabel>
          <InfoBox>{rules.questions.Q_EVPX.hint}</InfoBox>
          <ToggleRow
            options={[
              { value: false, label: 'No' },
              { value: true,  label: 'Yes – Add EVPX' },
            ]}
            value={hasEVPX}
            onChange={v => onChange({ hasEVPX: v, evpxVoltage: v ? evpxVoltage : null })}
          />

          {/* Voltage selector — aparece solo si se eligió EVPX */}
          {hasEVPX && (
            <div style={{ marginTop: 20 }}>
              <FieldLabel>EVPX Coil Voltage</FieldLabel>
              <div style={S.optionGrid}>
                {evpxItems.map(item => (
                  <div
                    key={item.id}
                    style={S.optionCard(evpxVoltage === item.id)}
                    onClick={() => onChange({ evpxVoltage: item.id })}
                  >
                    <span style={S.optionCardLabel(evpxVoltage === item.id)}>
                      {item.label}
                    </span>
                    <span style={S.optionCardPN}>PN {item.pn}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardSection>
      )}

      {/* Kit de conversión — info */}
      <InfoBox>
        💡 Open ↔ Closed Center conversion kit available: PN{' '}
        <strong>{rules.components.EVP.conversion_kit.pn}</strong>.
        Allows changing the center type in the field.
      </InfoBox>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2 — Sub-panel: Sección de trabajo (EVB)
// ─────────────────────────────────────────────────────────────────────────────

function SectionPanel({ section, baseConfig, onChange }) {
  /**
   * section shape:
   *   id:          number
   *   bodyType:    'low_mech' | 'med_mech' | 'low_eh' | 'med_eh' | null
   *   actuation:   string | null   — tipo de actuación (clave de ACTUATION_TYPES)
   *   actuatorId:  string | null   — ID del actuador en ACTUATORS.items
   *   voltage:     '12v' | '24v' | '24v_amp' | null   — para EH / pneumatic eléctrico
   *   spoolId:     string | null   — ID del spool en EVBS.items
   *   pvlp:        string | null   — ID del PVLP en PVLP.items
   *   pvla:        bool
   *   portCap:     string | null   — ID de tapa del pórtico (si aplica)
   */

  const { id, bodyType, actuation, actuatorId, voltage, spoolId, pvlp, pvla } = section

  // ── Body types del JSON ──
  const bodyOptions = rules.questions.Q_BODY_TYPE.options

  // ── Actuadores disponibles para el tipo seleccionado ──
  const actuators = useMemo(
    () => actuation ? getActuators(
      // mechanical_detent y mechanical_exposed usan el mismo tipo 'mechanical' para actuadores
      actuation.startsWith('mechanical') ? 'mechanical' : actuation
    ) : [],
    [actuation]
  )

  // ── Spools filtrados por actuación y flow máximo ──
  const spools = useMemo(
    () => getSpools(actuation, baseConfig.maxFlowRate),
    [actuation, baseConfig.maxFlowRate]
  )

  // ── ¿El actuador seleccionado necesita voltage? ──
  const needsVoltage = ['eh_prop', 'eh_onoff', 'electropneu'].includes(actuation)

  // ── Opciones de PVLP del JSON ──
  const pvlpOptions = rules.components.PVLP.items.filter(p => p.bar !== null)
  const pvlaItem    = rules.components.PVLP.items.find(p => p.id === 'PVLA')

  // ── Validación: medium body requerido para PVLP ──
  const hasMediumBody = bodyType?.includes('med')

  // ── EVB resuelto ──
  const evbItem = bodyType
    ? rules.components.EVB.items.find(e => {
        const bodyMap = {
          low_mech: 'EVB_LOW_MECH',
          med_mech: 'EVB_MED_MECH',
          low_eh:   'EVB_LOW_EH',
          med_eh:   'EVB_MED_EH',
        }
        return e.id === bodyMap[bodyType]
      })
    : null

  // ── Spool resuelto ──
  const spoolItem = spoolId
    ? rules.components.EVBS.items.find(s => s.id === spoolId)
    : null

  // ── Actuador resuelto ──
  const actuatorItem = actuatorId
    ? rules.components.ACTUATORS.items.find(a => a.id === actuatorId)
    : null

  return (
    <div>
      <h2 style={S.sectionTitle}>Work Section {id} — EVB</h2>
      <p style={S.sectionDesc}>
        Configure body, spool, actuation and optional shock valves for this section.
        Spools filtered to ≤ {baseConfig.maxFlowRate} LPM.
      </p>

      {/* ── 1. Body type ── */}
      <CardSection title="1 · Body Type (EVB)">
        <FieldLabel>Select body size and actuation compatibility</FieldLabel>
        <InfoBox>
          Medium body adds PVLP/PVLA cavity ports on A/B work ports.
          Electro-hydraulic body is required for EVHC / EVHCO actuators.
        </InfoBox>
        <div style={S.optionGrid}>
          {bodyOptions.map(opt => (
            <div
              key={opt.value}
              style={S.optionCard(bodyType === opt.value)}
              onClick={() => onChange({ bodyType: opt.value })}
            >
              <span style={S.optionCardLabel(bodyType === opt.value)}>
                {opt.label}
              </span>
              {/* Part number del EVB correspondiente */}
              {(() => {
                const map = { low_mech: 'EVB_LOW_MECH', med_mech: 'EVB_MED_MECH', low_eh: 'EVB_LOW_EH', med_eh: 'EVB_MED_EH' }
                const item = rules.components.EVB.items.find(e => e.id === map[opt.value])
                return item ? <span style={S.optionCardPN}>PN {item.pn}</span> : null
              })()}
            </div>
          ))}
        </div>
      </CardSection>

      {/* ── 2. Actuation type ── */}
      <CardSection title="2 · Actuation Type">
        <FieldLabel>How will this section be controlled?</FieldLabel>
        <div style={S.toggleRow}>
          {ACTUATION_TYPES.map(opt => (
            <button
              key={opt.value}
              style={toggleStyle(actuation === opt.value)}
              onClick={() => onChange({
                actuation: opt.value,
                actuatorId: null,  // reset al cambiar tipo
                spoolId:   null,
                voltage:   null,
              })}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Selector de voltage — aparece si el tipo lo requiere */}
        {needsVoltage && actuation && (
          <div style={{ marginTop: 20 }}>
            <FieldLabel>Coil Voltage</FieldLabel>
            <div style={S.toggleRow}>
              {actuation === 'electropneu'
                ? rules.questions.Q_EPNEU_VOLTAGE.options.map(o => (
                    <button key={o.value} style={toggleStyle(voltage === o.value)}
                      onClick={() => onChange({ voltage: o.value })} type="button">
                      {o.label}
                    </button>
                  ))
                : actuation === 'eh_prop'
                  ? rules.questions.Q_EH_VOLTAGE.options.map(o => (
                      <button key={o.value} style={toggleStyle(voltage === o.value)}
                        onClick={() => onChange({ voltage: o.value })} type="button">
                        {o.label}
                      </button>
                    ))
                  : rules.questions.Q_EHO_VOLTAGE.options.map(o => (
                      <button key={o.value} style={toggleStyle(voltage === o.value)}
                        onClick={() => onChange({ voltage: o.value })} type="button">
                        {o.label}
                      </button>
                    ))
              }
            </div>
          </div>
        )}
      </CardSection>

      {/* ── 3. Actuator module ── */}
      {actuation && (
        <CardSection title="3 · Actuator Module">
          <FieldLabel>
            {actuators.length > 0
              ? `${actuators.length} option${actuators.length > 1 ? 's' : ''} available`
              : 'No actuators for this type — check body compatibility'}
          </FieldLabel>
          {actuators.length > 0 && (
            <OptionGrid
              options={actuators}
              value={actuatorId}
              onChange={id => onChange({ actuatorId: id })}
            />
          )}
        </CardSection>
      )}

      {/* ── 4. Main spool (EVBS) ── */}
      {actuation && (
        <CardSection title="4 · Main Spool (EVBS)">
          <FieldLabel>
            {spools.length > 0
              ? `${spools.length} spools available — ${actuation.replace('_', ' ')} · ≤ ${baseConfig.maxFlowRate} LPM`
              : 'No spools match this actuation + flow combination'}
          </FieldLabel>
          {spools.length > 0 && (
            <OptionGrid
              options={spools.map(s => ({
                id:    s.id,
                pn:    s.pn,
                label: `${s.center.charAt(0).toUpperCase() + s.center.slice(1)} center · ${s.flow_lpm} LPM`,
              }))}
              value={spoolId}
              onChange={id => onChange({ spoolId: id })}
            />
          )}
          {spoolItem && (
            <div style={{ marginTop: 16 }}>
              <PNPill pn={spoolItem.pn} label={`${spoolItem.center} center · ${spoolItem.flow_lpm} LPM`} />
            </div>
          )}
        </CardSection>
      )}

      {/* ── 5. PVLP / PVLA — solo si medium body ── */}
      <CardSection title="5 · Shock & Anti-cavitation Valves (PVLP / PVLA)">
        {!hasMediumBody && (
          <InfoBox>
            ⚠️ PVLP/PVLA requires medium body. Change body type to enable these options.
          </InfoBox>
        )}

        {hasMediumBody && (
          <>
            <InfoBox>
              PVLP = shock valve (pressure protection). PVLA = anti-cavitation suction valve.
              Both mount on the A/B work ports of the medium body EVB.
            </InfoBox>

            {/* PVLP — selector de presión */}
            <div style={S.fieldGroup}>
              <FieldLabel>PVLP Shock Valve Pressure</FieldLabel>
              <div style={S.optionGrid}>
                {/* Opción "none" */}
                <div
                  style={S.optionCard(!pvlp)}
                  onClick={() => onChange({ pvlp: null })}
                >
                  <span style={S.optionCardLabel(!pvlp)}>None</span>
                  <span style={S.optionCardPN}>No shock valve</span>
                </div>
                {pvlpOptions.map(opt => (
                  <div
                    key={opt.id}
                    style={S.optionCard(pvlp === opt.id)}
                    onClick={() => onChange({ pvlp: opt.id })}
                  >
                    <span style={S.optionCardLabel(pvlp === opt.id)}>
                      {opt.bar} bar
                    </span>
                    <span style={S.optionCardPN}>PN {opt.pn}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* PVLA — toggle */}
            <div style={S.fieldGroup}>
              <FieldLabel>PVLA Anti-cavitation Valve</FieldLabel>
              <ToggleRow
                options={[
                  { value: false, label: 'No' },
                  { value: true,  label: `Yes — PN ${pvlaItem?.pn}` },
                ]}
                value={pvla}
                onChange={v => onChange({ pvla: v })}
              />
            </div>
          </>
        )}
      </CardSection>

      {/* ── BOM resumen de la sección ── */}
      {(evbItem || spoolItem || actuatorItem) && (
        <CardSection title="Section Summary">
          {evbItem && (
            <div style={S.bomRow}>
              <span style={S.bomLabel}>EVB Body</span>
              <PNPill pn={evbItem.pn} />
            </div>
          )}
          {spoolItem && (
            <div style={S.bomRow}>
              <span style={S.bomLabel}>Spool (EVBS)</span>
              <PNPill pn={spoolItem.pn} />
            </div>
          )}
          {actuatorItem && (
            <div style={S.bomRow}>
              <span style={S.bomLabel}>Actuator</span>
              <PNPill pn={actuatorItem.pn} />
            </div>
          )}
          {pvlp && (() => {
            const p = rules.components.PVLP.items.find(x => x.id === pvlp)
            return p ? (
              <div style={S.bomRow}>
                <span style={S.bomLabel}>PVLP</span>
                <PNPill pn={p.pn} label={`${p.bar} bar`} />
              </div>
            ) : null
          })()}
          {pvla && pvlaItem && (
            <div style={{ ...S.bomRow, borderBottom: 'none' }}>
              <span style={S.bomLabel}>PVLA</span>
              <PNPill pn={pvlaItem.pn} />
            </div>
          )}
        </CardSection>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2 — Sub-panel: EVO (End Plate)
// ─────────────────────────────────────────────────────────────────────────────

function EVOPanel({ config, onChange }) {
  /**
   * config shape:
   *   evoId: string | null   — ID del EVO en EVO.items
   */
  const { evoId } = config
  const evoOptions = rules.components.EVO.items
  const selected   = evoId ? evoOptions.find(e => e.id === evoId) : null

  return (
    <div>
      <h2 style={S.sectionTitle}>End Plate — EVO</h2>
      <p style={S.sectionDesc}>
        {rules.questions.Q_ENDPLATE.label}. LX port is required for
        pneumatic or external LS signal connection.
      </p>

      <CardSection title="End Plate Type">
        <OptionGrid
          options={evoOptions}
          value={evoId}
          onChange={id => onChange({ evoId: id })}
        />
      </CardSection>

      {selected && (
        <CardSection title="Selected End Plate">
          <div style={S.bomRow}>
            <span style={S.bomLabel}>Part Number</span>
            <PNPill pn={selected.pn} />
          </div>
          <div style={{ ...S.bomRow, borderBottom: 'none' }}>
            <span style={S.bomLabel}>Description</span>
            <span style={{ ...S.bomPN, fontWeight: 500, fontSize: 11 }}>{selected.label}</span>
          </div>
        </CardSection>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2 — Layout split completo
// ─────────────────────────────────────────────────────────────────────────────

function Phase2Layout({ baseConfig, onReset }) {
  /**
   * detailConfig — estado central de toda la configuración detallada.
   *
   * Se inicializa con:
   *   evp:      opciones del módulo de entrada
   *   sections: N objetos vacíos (uno por sección)
   *   evo:      opciones de la tapa final
   *
   * Cada sub-panel recibe su slice y un callback onChange para actualizar.
   */
  const [detailConfig, setDetailConfig] = useState(() => ({
    evp: {
      hasSolenoid: false,
      hasEVPX:     false,
      evpxVoltage: null,
    },
    sections: Array.from({ length: baseConfig.numSections }, (_, i) => ({
      id:          i + 1,
      bodyType:    null,
      actuation:   null,
      actuatorId:  null,
      voltage:     null,
      spoolId:     null,
      pvlp:        null,
      pvla:        false,
    })),
    evo: {
      evoId: null,
    },
  }))

  // Sección activa: 0 = EVP, 1..N = secciones, N+1 = EVO
  const [activeIdx, setActiveIdx] = useState(0)

  const totalSteps = 1 + baseConfig.numSections + 1

  // ── Updaters parciales por sección del config ──

  function updateEVP(patch) {
    setDetailConfig(prev => ({ ...prev, evp: { ...prev.evp, ...patch } }))
  }

  function updateSection(i, patch) {
    setDetailConfig(prev => {
      const sections = [...prev.sections]
      sections[i] = { ...sections[i], ...patch }
      return { ...prev, sections }
    })
  }

  function updateEVO(patch) {
    setDetailConfig(prev => ({ ...prev, evo: { ...prev.evo, ...patch } }))
  }

  // Una sección se marca como "done" si tiene body + spool + actuator
  function isDone(sec) {
    return sec.bodyType !== null && sec.spoolId !== null && sec.actuatorId !== null
  }

  return (
    <div style={S.phase2Wrap}>

      {/* ── Top bar ── */}
      <div style={S.topbar}>
        <div style={S.topbarLeft}>
          <p style={S.eyebrow}>ECO 80 · Valve Configurator</p>
          <span style={S.summaryTag}>
            {baseConfig.loadSense === 'yes' ? 'Load Sense' : 'Standard'} ·{' '}
            {baseConfig.numSections} section{baseConfig.numSections > 1 ? 's' : ''} ·{' '}
            ≤ {baseConfig.maxFlowRate} LPM
          </span>
        </div>
        <button style={S.resetBtn} onClick={onReset} type="button">
          ← Start over
        </button>
      </div>

      {/* ── Split ── */}
      <div style={S.split}>

        {/* LEFT — ThreeDView (placeholder hasta conectar 3DView.jsx) */}
        <div style={S.pane3D}>
          {/*
            Descomentar cuando 3DView.jsx esté listo:
            <ThreeDView
              path={baseConfig.path}
              numSections={baseConfig.numSections}
              detailConfig={detailConfig}
              activeSection={activeIdx}
            />
          */}

          {/* SVG esquemático que crece con las secciones */}
          <div style={S.placeholder3D}>
            <svg
              viewBox={`0 0 ${Math.max(120, 20 + baseConfig.numSections * 18)} 60`}
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              width={Math.min(320, 100 + baseConfig.numSections * 18)}
            >
              {/* Cuerpo principal */}
              <rect
                x="10" y="18"
                width={baseConfig.numSections * 18}
                height="22"
                rx="1"
                stroke={C.border}
                strokeWidth="1.5"
              />
              {/* Sección activa destacada */}
              {Array.from({ length: baseConfig.numSections }, (_, i) => {
                const isActive = activeIdx === i + 1
                const sec = detailConfig.sections[i]
                const done = isDone(sec)
                return (
                  <g key={i}>
                    {/* Rectángulo superior (actuador) */}
                    <rect
                      x={11 + i * 18} y="10"
                      width="16" height="9"
                      rx="1"
                      stroke={isActive ? C.orange : done ? C.green : C.border}
                      strokeWidth="1"
                      fill={isActive ? C.orangeLight : done ? C.greenLight : 'transparent'}
                    />
                    {/* Separador vertical */}
                    {i > 0 && (
                      <line
                        x1={10 + i * 18} y1="18"
                        x2={10 + i * 18} y2="40"
                        stroke={C.border}
                        strokeWidth="0.5"
                      />
                    )}
                  </g>
                )
              })}
              {/* EVP (izquierda) */}
              <rect x="0" y="22" width="10" height="14" rx="1"
                stroke={activeIdx === 0 ? C.orange : C.border} strokeWidth="1.2"
                fill={activeIdx === 0 ? C.orangeLight : 'transparent'}
              />
              {/* EVO (derecha) */}
              <rect
                x={10 + baseConfig.numSections * 18} y="22"
                width="10" height="14" rx="1"
                stroke={activeIdx === totalSteps - 1 ? C.orange : C.border} strokeWidth="1.2"
                fill={activeIdx === totalSteps - 1 ? C.orangeLight : 'transparent'}
              />
            </svg>

            <p style={S.p3DLabel}>3D View</p>
            <p style={S.p3DSub}>
              {baseConfig.path === 'load_sense' ? 'Closed Center' : 'Open Center'} ·{' '}
              {baseConfig.numSections} section{baseConfig.numSections > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* RIGHT — Configurador */}
        <div style={S.configPane}>

          {/* Nav de secciones */}
          <div style={S.sectionNav}>
            {/* EVP */}
            <button
              style={toggleStyle(activeIdx === 0)}
              onClick={() => setActiveIdx(0)}
              type="button"
            >
              EVP
            </button>

            {/* Una pestaña por sección */}
            {detailConfig.sections.map((sec, i) => (
              <button
                key={sec.id}
                style={toggleStyle(activeIdx === i + 1, isDone(sec))}
                onClick={() => setActiveIdx(i + 1)}
                type="button"
              >
                S{sec.id}
              </button>
            ))}

            {/* EVO */}
            <button
              style={toggleStyle(
                activeIdx === totalSteps - 1,
                detailConfig.evo.evoId !== null
              )}
              onClick={() => setActiveIdx(totalSteps - 1)}
              type="button"
            >
              EVO
            </button>
          </div>

          {/* Contenido del panel activo */}
          <div style={S.configScroll}>

            {activeIdx === 0 && (
              <EVPPanel
                baseConfig={baseConfig}
                config={detailConfig.evp}
                onChange={updateEVP}
              />
            )}

            {activeIdx > 0 && activeIdx < totalSteps - 1 && (
              <SectionPanel
                section={detailConfig.sections[activeIdx - 1]}
                baseConfig={baseConfig}
                onChange={patch => updateSection(activeIdx - 1, patch)}
              />
            )}

            {activeIdx === totalSteps - 1 && (
              <EVOPanel
                config={detailConfig.evo}
                onChange={updateEVO}
              />
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT — decide qué fase mostrar
// ─────────────────────────────────────────────────────────────────────────────

export default function ValveBuilderMP() {
  const [phase,      setPhase]      = useState(1)
  const [baseConfig, setBaseConfig] = useState(null)

  function handlePhase1Complete(config) {
    setBaseConfig(config)
    setPhase(2)
  }

  function handleReset() {
    setBaseConfig(null)
    setPhase(1)
  }

  return (
    <div style={S.root}>
      {phase === 1 && <Phase1Panel onComplete={handlePhase1Complete} />}
      {phase === 2 && baseConfig && (
        <Phase2Layout baseConfig={baseConfig} onReset={handleReset} />
      )}
    </div>
  )
}
