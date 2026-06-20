import { useState } from 'react'
import './App.css'
import WelcomeScreen from './components/ui/WelcomeScreen'
import ValveBuilderMP from './components/layout/ValveBuilderMP'

function App() {
  const [started, setStarted] = useState(false)

  if (!started) {
    return <WelcomeScreen onDesign={() => setStarted(true)} />
  }
  return <ValveBuilderMP />
  
}

export default App