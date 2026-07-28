import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import SettingsService from '#services/settings_service'

export default class ShareViewGlobalsMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    await ctx.auth.check()

    const orgName = await SettingsService.get('org_name', 'โรงพยาบาลแก้งสนามนาง')

    ctx.view.share({
      user: ctx.auth.user ?? null,
      currentPath: ctx.request.url(),
      csrfToken: ctx.request.csrfToken,
      flash: ctx.session.flashMessages.all(),
      orgName,
    })

    return next()
  }
}
