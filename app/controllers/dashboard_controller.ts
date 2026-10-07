import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import NotificationSchedule from '#models/notification_schedule'
import ScheduleCalculator from '#services/schedule_calculator'

const TZ = 'Asia/Bangkok'
const THAI_DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const THAI_DAYS_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

export default class DashboardController {
  /**
   * GET /dashboard — main landing for any logged-in user.
   */
  async index({ view }: HttpContext) {
    const now = DateTime.now().setZone(TZ)
    const today = now.toFormat('yyyy-MM-dd')

    const [
      activeSchedules,
      activeGroups,
      todayLogsRow,
      successRow,
      templatesCount,
      itemsCount,
      recentLogs,
      schedules,
      weeklyRows,
    ] = await Promise.all([
      db.from('notification_schedules').where('is_active', 1).count('* as count').first(),
      db.from('line_groups').where('is_active', 1).count('* as count').first(),
      db.from('notification_logs').whereRaw('DATE(sent_at) = ?', [today]).count('* as count').first(),
      db
        .from('notification_logs')
        .whereRaw('DATE(sent_at) = ?', [today])
        .select(db.raw('COUNT(*) as total'))
        .select(db.raw('SUM(CASE WHEN status_code = 200 THEN 1 ELSE 0 END) as success'))
        .first(),
      db.from('notification_templates').count('* as count').first(),
      db.from('notification_items').count('* as count').first(),
      db
        .from('notification_logs as l')
        .leftJoin('line_groups as g', 'l.group_id', 'g.id')
        .leftJoin('notification_schedules as s', 'l.schedule_id', 's.id')
        .orderBy('l.sent_at', 'desc')
        .limit(8)
        .select(
          'l.id',
          'l.status_code',
          'l.sent_at',
          'g.group_name',
          's.schedule_name'
        ),
      NotificationSchedule.query().where('is_active', 1).orderBy('send_time', 'asc'),
      this.fetchWeekly(now),
    ])

    const todayTotal = Number((successRow as any)?.total ?? 0)
    const todaySuccess = Number((successRow as any)?.success ?? 0)
    const successRate = todayTotal === 0 ? 0 : (todaySuccess / todayTotal) * 100

    const stats = {
      active_schedules: Number((activeSchedules as any)?.count ?? 0),
      active_groups: Number((activeGroups as any)?.count ?? 0),
      today_logs: Number((todayLogsRow as any)?.count ?? 0),
      success_rate: Number(successRate.toFixed(1)),
      total_templates: Number((templatesCount as any)?.count ?? 0),
      total_items: Number((itemsCount as any)?.count ?? 0),
    }

    const todaySchedules = schedules.map((s) => ({
      id: s.id,
      name: s.scheduleName,
      send_time: (s.sendTime ?? '').slice(0, 5),
      mode: s.scheduleMode ?? 'weekly',
      days: String(s.daysOfWeek ?? '')
        .split(',')
        .map((n) => parseInt(n.trim(), 10))
        .filter(Boolean),
      repeat_enabled: !!s.repeatEnabled,
      group_count: (s.groupIds ?? []).length,
      last_sent_date: s.lastSentDate?.toFormat('yyyy-MM-dd') ?? null,
    }))

    // Remaining sends today: repeat schedules use their stored next_send_time,
    // everything else asks the calculator for the next eligible slot.
    const upcoming = schedules
      .map((s) => {
        const next =
          s.repeatEnabled && s.nextSendTime
            ? s.nextSendTime.setZone(TZ)
            : ScheduleCalculator.calculateNextSendTime(s)
        return { s, next }
      })
      .filter(({ next }) => next && next >= now && next.hasSame(now, 'day'))
      .sort((a, b) => a.next!.toMillis() - b.next!.toMillis())
      .map(({ s, next }) => ({
        id: s.id,
        name: s.scheduleName,
        time: next!.toFormat('HH:mm'),
        minutes_until: Math.max(0, Math.round(next!.diff(now, 'minutes').minutes)),
        group_count: (s.groupIds ?? []).length,
        repeat_enabled: !!s.repeatEnabled,
      }))

    const wd = now.weekday === 7 ? 0 : now.weekday
    const todayLabel = `วัน${THAI_DAYS_FULL[wd]}ที่ ${now.day} ${THAI_MONTHS[now.month - 1]} ${now.year + 543}`

    return view.render('pages/dashboard', {
      title: 'แดชบอร์ด',
      stats,
      recentLogs,
      todaySchedules,
      weeklyStats: weeklyRows,
      upcoming,
      today,
      todayLabel,
      todayDow: wd + 1,
    })
  }

  private async fetchWeekly(now: DateTime) {
    const startDate = now.minus({ days: 6 }).toFormat('yyyy-MM-dd')
    const endDate = now.toFormat('yyyy-MM-dd')

    const dbRows = await db
      .from('notification_logs')
      .whereRaw('DATE(sent_at) >= ? AND DATE(sent_at) <= ?', [startDate, endDate])
      .select(db.raw('DATE(sent_at) as date'))
      .select(db.raw('COUNT(*) as total'))
      .select(db.raw('SUM(CASE WHEN status_code = 200 THEN 1 ELSE 0 END) as success'))
      .groupByRaw('DATE(sent_at)')

    const byDate = new Map((dbRows as any[]).map((r) => [r.date, r]))

    const rows: Array<{ date: string; day: string; total: number; success: number }> = []
    for (let i = 6; i >= 0; i--) {
      const luxon = now.minus({ days: i })
      const d = luxon.toFormat('yyyy-MM-dd')
      const wd = luxon.weekday === 7 ? 0 : luxon.weekday // Luxon 7=Sun → 0 (PHP w())
      const r = byDate.get(d)
      rows.push({
        date: d,
        day: THAI_DAYS[wd],
        total: Number(r?.total ?? 0),
        success: Number(r?.success ?? 0),
      })
    }
    return rows
  }
}
