import React from 'react'
import ReactDOM from 'react-dom/client'
import { FlowVisualizer } from './flow-visualizer'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <div style={{ height: '100vh', width: '100vw' }}>
            <FlowVisualizer />
        </div>
    </React.StrictMode>
)
