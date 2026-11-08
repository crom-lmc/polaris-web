import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import App from './App.vue'
import router from './router'
import 'ant-design-vue/dist/reset.css'
// 编辑器完整样式（工具栏/编辑区/预览区）—— 只引 preview.css 会导致工具栏按钮竖排堆叠
import 'md-editor-v3/lib/style.css'
import './styles/global.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(Antd)
app.mount('#app')
