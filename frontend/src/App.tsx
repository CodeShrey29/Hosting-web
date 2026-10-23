import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Deploy from './pages/Deploy'
import Servers from './pages/Servers'
import Monitoring from './pages/Monitoring'
import Billing from './pages/Billing'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="deploy" element={<Deploy />} />
        <Route path="servers" element={<Servers />} />
        <Route path="monitoring" element={<Monitoring />} />
        <Route path="billing" element={<Billing />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  )
}
