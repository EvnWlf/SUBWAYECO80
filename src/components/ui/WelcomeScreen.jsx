import { useEffect, useRef, useState } from 'react'
function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

export default function WelcomeScreen({ onDesign }) {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function run() {
      await delay(200)
      setVisible(true)

      const steps = [20, 45, 70, 90, 100]
      for (const pct of steps) {
        await delay(380)
        setProgress(pct)
      }

      await delay(400)
      setReady(true)
    }
    run()
  }, [])

  return (
    <div style={styles.root}>
      <div style={{ ...styles.content, opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(12px)', transition: 'all 0.9s ease' }}>

<img src="src/assets/LionStoreLogo.svg" alt="Lion Store Parts" style={styles.logo} />

        {!ready && (
          <>
            <p style={styles.label}>Cargando</p>
            <div style={styles.track}>
              <div style={{ ...styles.fill, width: `${progress}%` }} />
            </div>
          </>
        )}

        {ready && (
          <button style={styles.btn} onClick={onDesign}>
            Diseñar
          </button>
        )}

      </div>
    </div>
  )
}

const styles = {
  root: {
    minHeight: '100vh',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Montserrat', sans-serif",
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 28,
  },
  logo: { width: 160 },
  label: {
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#bbb',
    fontWeight: 300,
  },
  track: {
    width: 160,
    height: 2,
    background: '#f0f0f0',
    borderRadius: 99,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    background: '#ef7b1b',
    borderRadius: 99,
    transition: 'width 0.4s cubic-bezier(.4,0,.2,1)',
  },
  btn: {
    fontFamily: "'Montserrat', sans-serif",
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#ef7b1b',
    background: '#fff',
    border: '1px solid #ef7b1b',
    padding: '11px 32px',
    borderRadius: 2,
    cursor: 'pointer',
  },
}