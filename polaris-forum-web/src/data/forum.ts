import { reactive } from 'vue'
import { fetchBoards } from '@/api/forum'
import type { Board, ForumTag } from '@/types'

export const boards = reactive<Board[]>([
  { key: 'general', name: '综合讨论', description: '技术之外，也聊聊工作与生活', count: 0, color: '#5b67f1' },
  { key: 'frontend', name: '前端开发', description: 'Vue、React、工程化与用户体验', count: 0, color: '#1677ff' },
  { key: 'devops', name: '运维部署', description: 'Docker、Linux、CI/CD 与可观测性', count: 0, color: '#fa8c16' },
  { key: 'design', name: '产品设计', description: '产品思考、设计方法与创意灵感', count: 0, color: '#a855f7' },
  { key: 'career', name: '职场成长', description: '经验分享、学习方法与职业发展', count: 0, color: '#eb4b8d' }
])

export async function loadBoards() {
  const result = await fetchBoards()
  boards.splice(0, boards.length, ...result)
}

/** 聚合所有板块下启用的标签：前台分类栏与发布页预设标签共用，顺序按后台配置的 sortNo。 */
export async function collectAllTags(): Promise<ForumTag[]> {
  const boardList = await fetchBoards()
  const tagMap = new Map<string, ForumTag>()
  boardList.forEach(board => board.tags?.forEach(tag => {
    const existing = tagMap.get(tag.name)
    if (existing) existing.count += tag.count
    else tagMap.set(tag.name, { ...tag })
  }))
  return [...tagMap.values()].sort((a, b) =>
    (a.sortNo ?? 0) - (b.sortNo ?? 0) || b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
}

export function formatTime(value?: string) {
  if (!value) return ''
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value
  const diff = Date.now() - date.getTime()
  if (diff >= 0 && diff < 60_000) return '刚刚'
  if (diff >= 0 && diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff >= 0 && diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff >= 0 && diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return value.slice(0, 16)
}
