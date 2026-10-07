import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import SettingsService from '#services/settings_service'

export default class ShareViewGlobalsMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    await ctx.auth.check()

    const [orgName, siteTitle] = await Promise.all([
      SettingsService.get('org_name', 'โรงพยาบาลแก้งสนามนาง'),
      SettingsService.get('site_title', ''),
    ])

    ctx.view.share({
      user: ctx.auth.user ?? null,
      currentPath: ctx.request.url(),
      csrfToken: ctx.request.csrfToken,
      flash: ctx.session.flashMessages.all(),
      orgName,
      // Settings → "หัวข้อหลัก"; views fall back to appName() when empty
      siteTitle: siteTitle?.trim() || null,
    })

    return next()
  }
}
