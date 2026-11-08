import request from './request'

/**
 * OAuth2 标准授权码流程（A 档）。
 *
 * /authorize 靠 HttpOnly 中心会话 cookie（或 Bearer）识别身份，
 * 与 /ticket 同一批白名单；/token 是应用后端调用，前端永不接触。
 */

export interface OAuthAuthorizeParams {
  responseType: 'code'
  clientId: string
  redirectUri: string
  scope?: string
  state?: string
  codeChallenge?: string
  codeChallengeMethod?: string
}

/** 静默签发授权码，返回 redirectTo（应用回跳地址，已带 code & state） */
export function oauthAuthorize(data: OAuthAuthorizeParams) {
  return request.post<never, { data: { code: string; redirectTo: string; expiresIn: number } }>(
    '/api/auth/oauth/authorize',
    data
  )
}
