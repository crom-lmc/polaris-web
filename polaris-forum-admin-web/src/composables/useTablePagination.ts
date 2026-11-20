import { computed, ref, unref, watch, type Ref } from 'vue'

/**
 * 后台列表统一前端分页：接口返回全量数组，分页只负责当前展示页。
 * 分页条贴在表格滚动容器底部，必须与 .table-scroll + .ant-table-pagination 样式配套使用。
 */
export function useTablePagination<T>(source: Ref<T[]>, defaultSize = 20) {
  const page = ref(1)
  const size = ref(defaultSize)

  // 没有数据时直接隐藏分页条，避免空列表底部留一条空白分页栏
  const pagination = computed(() => {
    const total = unref(source).length
    if (!total) return false
    return {
      current: page.value,
      pageSize: size.value,
      total,
      showSizeChanger: true,
      showTotal: (value: number) => `共 ${value} 条`
    }
  })

  const pagedSource = computed(() => {
    const list = unref(source)
    const start = (page.value - 1) * size.value
    return list.slice(start, start + size.value)
  })

  function reset() {
    page.value = 1
  }

  function onChange(pag: { current?: number; pageSize?: number }) {
    page.value = pag?.current || 1
    size.value = pag?.pageSize || size.value
  }

  // 删除或筛选后当前页可能越界，自动回落到最后一页
  watch([() => unref(source).length, size], () => {
    const total = unref(source).length
    const maxPage = Math.max(1, Math.ceil(total / size.value))
    if (page.value > maxPage) page.value = maxPage
  })

  return { page, size, pagination, pagedSource, reset, onChange }
}
