import { Modal } from 'ant-design-vue'

export function confirmAction(options: {
  title: string
  content: string
  okText?: string
  okType?: 'primary' | 'danger'
  onOk: () => void | Promise<void>
}) {
  Modal.confirm({
    title: options.title,
    content: options.content,
    okText: options.okText || '确定',
    okType: options.okType || 'primary',
    cancelText: '取消',
    centered: true,
    onOk: options.onOk
  })
}
