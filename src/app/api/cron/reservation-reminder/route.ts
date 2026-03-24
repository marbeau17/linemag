import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingReservationsForReminder, markReminderSent } from '@/lib/booking/reservations';
import { getCustomerById } from '@/lib/crm/customers';
import { buildReservationReminderMessage } from '@/lib/line/templates-business';
import { config as appConfig } from '@/lib/line/config';

export async function GET(request: NextRequest) {
  // 1. CRON_SECRET auth check (same pattern as existing cron route)
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Get reservations starting within 1 hour that haven't been reminded
    const upcoming = await getUpcomingReservationsForReminder(1);

    if (upcoming.length === 0) {
      return NextResponse.json({ message: 'No reminders to send', count: 0 });
    }

    let sent = 0;
    for (const reservation of upcoming) {
      try {
        // 3. Get customer LINE ID
        const customer = await getCustomerById(reservation.customerId);
        if (!customer) continue;
        // customer has lineUserId field

        // 4. Build reminder message
        const minutesUntil = Math.round((new Date(`${reservation.date}T${reservation.startTime}`).getTime() - Date.now()) / 60000);
        const message = buildReservationReminderMessage({
          date: reservation.date || '',
          startTime: reservation.startTime || '',
          endTime: reservation.endTime || '',
          consultantName: reservation.consultantName || '',
          meetUrl: reservation.meetUrl || '',
          minutesUntil,
        });

        // 5. Send via LINE Push API
        // Use the customer's lineUserId from the customer record
        const lineResponse = await fetch(appConfig.line.pushUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${appConfig.line.channelAccessToken}`,
          },
          body: JSON.stringify({
            to: (customer as any).lineUserId,
            messages: [{ type: 'flex', altText: '予約リマインダー', contents: message }],
          }),
        });

        if (lineResponse.ok) {
          await markReminderSent(reservation.id);
          sent++;
        }
      } catch (err) {
        console.error(`[reminder] Failed for reservation ${reservation.id}:`, err);
      }
    }

    return NextResponse.json({ message: `Sent ${sent} reminders`, total: upcoming.length, sent });
  } catch (error) {
    console.error('[cron/reservation-reminder]', error);
    return NextResponse.json({ error: 'Reminder processing failed' }, { status: 500 });
  }
}
