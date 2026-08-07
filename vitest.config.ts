import { mergeConfig } from 'vite'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, {
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
