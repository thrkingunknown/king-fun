import type { Preview } from '@storybook/react-vite'
import '../src/index.css'
import '../src/App.css'
import '../src/design-system.css'

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/ } },
    a11y: { test: 'error' },
    layout: 'centered',
  },
  decorators: [Story => <div className="app dark" style={{ minHeight: '100vh', width: '100%', padding: 24 }}><Story /></div>],
}

export default preview
