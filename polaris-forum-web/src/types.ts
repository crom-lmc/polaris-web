export interface ForumTag {
  id: string
  boardKey: string
  name: string
  count: number
  sortNo?: number
  enabled?: boolean
}

export interface Board {
  key: string
  parentKey?: string
  name: string
  description: string
  count: number
  color: string
  tags?: ForumTag[]
  children?: Board[]
}

export interface Author {
  accountId?: string
  name: string
  initials: string
  title: string
  color: string
  avatarUrl?: string
}

export type ContentKind = 'feed' | 'topic' | 'question' | 'article'

export interface Thread {
  id: string
  board: string
  kind: ContentKind
  title: string
  excerpt: string
  content?: string
  author: Author
  authorAccountId?: string
  createdAt: string
  replies: number
  views: number
  likes: number
  tags: string[]
  pinned?: boolean
  solved?: boolean
  reward?: number
  liked?: boolean
  favorited?: boolean
  deleted?: boolean
  coverAttachmentId?: string
  coverUrl?: string
  attachments?: ForumAttachment[]
  poll?: ForumPoll
}

export interface ForumAttachment {
  id: string
  originalName: string
  mimeType: string
  size: number
  usageType: 'ATTACHMENT' | 'COVER' | 'AVATAR' | 'PROFILE_COVER'
  url: string
}

export interface PollOption {
  id: string
  text: string
  votes: number
}

export interface ForumPoll {
  id: string
  mode: 'SINGLE' | 'MULTIPLE'
  maxChoices: number
  totalVotes: number
  voted: boolean
  selectedOptionIds: string[]
  options: PollOption[]
}

export interface PollInput {
  mode: 'SINGLE' | 'MULTIPLE'
  maxChoices: number
  options: string[]
}

export interface ForumDraft {
  id: string
  kind: ContentKind
  board: string
  title: string
  content: string
  tags: string[]
  reward: number
  coverAttachmentId?: string
  pollConfig?: PollInput
  attachments: ForumAttachment[]
  publishedThreadId?: string
  createdAt: string
  updatedAt: string
}

export interface ExchangeRecord {
  id: string
  accountId: string
  username?: string
  giftName: string
  points: number
  /** EXCHANGE 积分兑换、LOTTERY 抽奖中奖 */
  source?: 'EXCHANGE' | 'LOTTERY'
  status: 'PENDING_ISSUE' | 'SHIPPING' | 'ISSUED'
  trackingNo?: string
  createdAt: string
  issuedByName?: string
  issuedAt?: string
  issueRemark?: string
}

export interface ForumComment {
  id: string
  threadId: string
  authorAccountId: string
  author: Author
  content: string
  time: string
  likes: number
  liked?: boolean
  deleted?: boolean
  createdAt?: string
  parentCommentId?: string
  replies?: ForumComment[]
}

export interface Member {
  accountId: string
  username: string
  displayName?: string
  nickname?: string
  name?: string
  bio?: string
  location?: string
  website?: string
  points: number
  totalPoints?: number
  experience?: number
  level?: number
  levelName?: string
  levelColor?: string
  nextLevel?: number
  experienceToNext?: number
  levelProgress?: number
  threadsCount: number
  commentsCount?: number
  likesReceived: number
  avatarAttachmentId?: string
  coverAttachmentId?: string
  avatarUrl?: string
  coverUrl?: string
  favoriteCount?: number
  badgeCount?: number
  badges?: Badge[]
  following?: boolean
  followingCount?: number
  followersCount?: number
}

export interface MemberRelation {
  accountId: string
  username: string
  displayName?: string
  nickname?: string
  bio?: string
  location?: string
  avatarUrl?: string
  followedAt?: string
}

export type BadgeRuleType = 'TOTAL_POINTS' | 'THREAD_COUNT' | 'COMMENT_COUNT' | 'CHECKIN_DAYS' | 'LIKES_RECEIVED'

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  color: string
  sortOrder?: number
  ruleType: BadgeRuleType
  threshold: number
  status?: 'DRAFT' | 'PUBLISHED' | 'OFFLINE'
  publishedAt?: string
  currentValue?: number
  targetValue?: number
  awarded?: boolean
  awardedAt?: string
}

export type NotificationType = 'THREAD_COMMENT' | 'COMMENT_REPLY' | 'THREAD_LIKE' | 'BADGE_AWARDED' | 'REPORT_RESULT'

export interface ForumNotification {
  id: string
  type: NotificationType
  bizId: string
  threadId?: string
  title: string
  summary: string
  readAt?: string
  createdAt: string
  actorAccountId?: string
  actorName?: string
  actorAvatarUrl?: string
}

export interface PointLog {
  id: string
  changePoints: number
  balance: number
  bizType: string
  bizId: string
  remark: string
  createdAt: string
}

export interface Banner {
  id: string
  title: string
  imageUrl: string | null
  linkUrl: string
  sortNo?: number
  enabled?: boolean
}

export interface FriendLink {
  id: string
  name: string
  url: string
  sortNo?: number
  enabled?: boolean
}

export interface SiteConfig {
  aboutContent: string
  footerText: string
  friendLinks: FriendLink[]
}

/** 功能开关（抽奖/兑换），来自配置中心埋点 */
export interface FeatureFlags {
  lotteryEnabled: boolean
  exchangeEnabled: boolean
}

export type ReportTargetType = 'thread' | 'comment'

export interface ReportInput {
  targetType: ReportTargetType
  targetId: string
  reason: string
  detail: string
}

export interface Prize {
  key: string
  name: string
  points: number
  color: string
  /** POINTS 积分、GIFT 礼品 */
  prizeType?: 'POINTS' | 'GIFT'
  giftId?: string
  giftName?: string
  giftImageUrl?: string
  giftPoints?: number
}

export interface Gift {
  id: string
  name: string
  category: string
  description: string
  points: number
  stock: number
  icon: string
  imageUrl?: string
  /** 兑换所需最低社区等级，默认 1 */
  minLevel?: number
}

/** 社区等级定义 */
export interface ForumLevel {
  id: string
  levelNo: number
  name: string
  minExperience: number
  color: string
  icon: string
  description: string
  privileges: string
  sortNo: number
  enabled: boolean
}

/** 经验获取规则 */
export interface ExperienceRule {
  id: string
  ruleKey: string
  name: string
  experience: number
  sortNo: number
  enabled: boolean
}

/** 社区等级晋升路线 */
export interface LevelRoute {
  levels: ForumLevel[]
  currentLevel: number
  currentLevelName: string
  currentLevelColor: string
  nextLevel: number | null
  nextLevelName: string
  experienceToNext: number
  progress: number
  totalExperience: number
}
