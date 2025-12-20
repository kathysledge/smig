import DefaultTheme from 'vitepress/theme';
import mediumZoom from 'medium-zoom';
import { h, onMounted, watch, nextTick } from 'vue';
import { useRoute } from 'vitepress';
import Breadcrumbs from './Breadcrumbs.vue';

import './custom.css';

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // Add breadcrumbs above the document
      'doc-before': () => h(Breadcrumbs),
    });
  },
  setup() {
    const route = useRoute();
    
    const initZoom = () => {
      mediumZoom('.main img', { 
        background: 'var(--vp-c-bg)',
        margin: 24,
      });
    };
    
    onMounted(() => {
      initZoom();
    });
    
    watch(
      () => route.path,
      () => nextTick(() => initZoom())
    );
  },
};
