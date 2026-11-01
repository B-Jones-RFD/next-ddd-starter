import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'

import AdrList from './AdrList.vue'

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, { 'doc-after': () => h(AdrList) }),
}
