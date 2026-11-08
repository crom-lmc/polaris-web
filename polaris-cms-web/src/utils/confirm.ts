import { Modal } from 'ant-design-vue'

/**
 * 统一的二次确认对话框（居中模态，和顶部退登确认同款）。
 * 把列表页里散落的 a-popconfirm 与“直接执行”的危险操作都收敛到这里，
 * 保证视觉与交互一致：警告图标 + 取消/确定，确定按钮可标红（danger）。
 *
 * onOk 可直接传一个返回 Promise 的异步函数：对话框会在其 pending 时显示
 * 确定按钮 loading，promise resolve 后自动关闭；因此各 action 内部自行
 * 处理成功/失败的 message 即可。
 */
export function confirmAction(opts: {
  title: string
  content: string
  okText?: string
  /** 确定按钮类型，危险操作传 'danger' */
  okType?: 'primary' | 'danger'
  onOk: () => void | Promise<void>
}) {
  Modal.confirm({
    title: opts.title,
    content: opts.content,
    okText: opts.okText ?? '确定',
    okType: opts.okType ?? 'primary',
    cancelText: '取消',
    centered: true,
    onOk: opts.onOk
  })
}
