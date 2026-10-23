import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Deploy from './pages/Deploy'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="deploy" element={<Deploy />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  )
}
